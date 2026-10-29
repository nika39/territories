import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { state } from "../state";
import { showToast } from "../ui/toast";
import { restoreGeoJson } from "./geojsonImport";
import { addGeomanOptionsControl } from "./optionsControl";
import {
    deleteTrackedShape,
    registerDrawnLayer,
    registerDrawnMarker,
    trackedShapes,
} from "./shapeRegistry";
import { getDrawingStyleOptions } from "./styles";

const TOOLBAR_ORDER = [
    "drawPolygon",
    "drawRectangle",
    "drawMarker",
    "editMode",
    "dragMode",
    "cutPolygon",
    "removalMode",
    "rotateMode",
];

const GEORGIAN_TRANSLATIONS = {
    actions: {
        finish: "დასრულება",
        cancel: "გაუქმება",
        removeLastVertex: "ბოლო წერტილის წაშლა",
    },
    buttonTitles: {
        drawPolyButton: "პოლიგონის დახაზვა (P / 1)",
        drawRectButton: "მართკუთხედის დახაზვა",
        drawMarkerButton: "პინის დასმა (M / 2)",
        editButton: "ობიექტების რედაქტირება (E / 3)",
        dragButton: "ობიექტების გადაადგილება (D / V / 4)",
        cutButton: "პოლიგონის ამოჭრა",
        deleteButton: "ობიექტების წაშლა",
        rotateButton: "ობიექტების შემობრუნება",
    },
};

function configureToolbar(mapInstance: L.Map): void {
    mapInstance.pm.addControls({
        position: "topright",
        drawPolygon: true,
        drawRectangle: true,
        drawMarker: true,
        editMode: true,
        dragMode: true,
        cutPolygon: true,
        removalMode: true,
        rotateMode: true,
        drawCircleMarker: false,
        drawPolyline: false,
        drawCircle: false,
        drawText: false,
        oneBlock: false,
    });

    // Ensure Polygon comes first, then Rectangle, then Pin Marker
    mapInstance.pm.Toolbar.changeControlOrder(TOOLBAR_ORDER);
}

function localizeToolbar(mapInstance: L.Map): void {
    mapInstance.pm.setLang(
        "ka" as unknown as L.PM.SupportLocales,
        GEORGIAN_TRANSLATIONS,
        "en",
    );
}

/**
 * Sets global drawing styles, marker styles, and snapping configuration.
 */
function applyInitialGlobalOptions(mapInstance: L.Map): void {
    mapInstance.pm.setGlobalOptions({
        tooltips: false,
        snappable: state.isSnappingEnabled,
        snapDistance: 16,
        allowSelfIntersection: false,
        continueDrawing: false,
        exitModeOnEscape: true,
        ...getDrawingStyleOptions(),
    });
}

/**
 * Restores previously drawn shapes & pins if the map was recreated.
 */
function restorePreservedShapes(): void {
    const preserved = state.preservedDrawnGeoJson;
    if (preserved && preserved.features.length > 0) {
        trackedShapes.clear();
        restoreGeoJson(preserved, false);
    }
}

function bindGeomanEvents(mapInstance: L.Map): void {
    mapInstance.on("pm:create", (e) => {
        if (e.shape === "Marker") {
            const shape = registerDrawnMarker(
                e.layer as L.Marker,
                state.activeDrawColor,
            );
            showToast(`${shape.name} დაისვა`);
            // Automatically exit marker drawing mode after placing 1 pin
            mapInstance.pm.disableDraw();
        } else {
            const shapeType = e.shape === "Rectangle" ? "Rectangle" : "Polygon";
            const shape = registerDrawnLayer(e.layer as L.Polygon, shapeType);
            showToast(`${shape.name} მოინიშნა`);
        }
    });

    mapInstance.on("pm:remove", (e) => {
        for (const [id, s] of trackedShapes.entries()) {
            if (s.layer === e.layer) {
                deleteTrackedShape(id, false);
                break;
            }
        }
    });
}

/**
 * Monkey-patches Leaflet Geoman's snapping handlers.
 *
 * Known Leaflet Geoman issues addressed:
 * 1. `_handleSnapping` does not verify `this.options.snappable` or global `snappable`
 *    before calculating snap targets, allowing drag and draw handlers to snap even when disabled.
 * 2. In `SnapMixin`, `_disableSnapping()` does not unbind the `drag` event on vertex
 *    markers (`this._markers`), leaving existing markers snappable on drag.
 */
export function patchGeomanSnapping(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PM = (L as any).PM;
    if (!PM) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const protosToPatch: any[] = [
        PM.Draw?.prototype,
        PM.Edit?.prototype,
        PM.Edit?.Line?.prototype,
        PM.Edit?.Polygon?.prototype,
        PM.Edit?.Rectangle?.prototype,
        PM.Edit?.Marker?.prototype,
        PM.Edit?.CircleMarker?.prototype,
        PM.Draw?.Line?.prototype,
        PM.Draw?.Polygon?.prototype,
        PM.Draw?.Rectangle?.prototype,
        PM.Draw?.Marker?.prototype,
    ].filter(Boolean);

    protosToPatch.forEach((proto) => {
        if (proto._snappingHandlerPatched) return;
        proto._snappingHandlerPatched = true;

        const originalHandleSnapping = proto._handleSnapping;
        if (typeof originalHandleSnapping === "function") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            proto._handleSnapping = function (e: any, selfSnapOnly = false) {
                if (!state.isSnappingEnabled) {
                    if (e?.target) {
                        e.target._snapped = false;
                    }
                    if (this._hintMarker) {
                        this._hintMarker._snapped = false;
                    }
                    return false;
                }
                return originalHandleSnapping.call(this, e, selfSnapOnly);
            };
        }

        const originalDisableSnapping = proto._disableSnapping;
        if (typeof originalDisableSnapping === "function") {
            proto._disableSnapping = function () {
                originalDisableSnapping.call(this);
                if (Array.isArray(this._markers)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const unbindMarkers = (arr: any[]) => {
                        arr.forEach((m) => {
                            if (Array.isArray(m)) {
                                unbindMarkers(m);
                            } else if (m && typeof m.off === "function") {
                                m.off("drag", this._handleSnapping, this);
                                m.off("dragend", this._cleanupSnapping, this);
                                m.off("pm:drag", this._handleSnapping, this);
                                m.off("pm:dragend", this._cleanupSnapping, this);
                                m._snapped = false;
                            }
                        });
                    };
                    unbindMarkers(this._markers);
                }
                this._cleanupSnapping?.();
            };
        }
    });
}

/**
 * Sets up Leaflet Geoman controls, locales, styles and event listeners on a map instance.
 */
export function setupGeomanOnMap(mapInstance: L.Map): void {
    patchGeomanSnapping();
    configureToolbar(mapInstance);
    localizeToolbar(mapInstance);
    applyInitialGlobalOptions(mapInstance);
    addGeomanOptionsControl(mapInstance);

    state.drawnItemsGroup = L.featureGroup().addTo(mapInstance);

    restorePreservedShapes();
    bindGeomanEvents(mapInstance);
}
