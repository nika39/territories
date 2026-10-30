import { state } from "../state";
import { byId } from "../utils/dom";
import { showToast } from "../ui/toast";
import { getDrawingStyleOptions, getGeomanPathOptions } from "./styles";
import { notifyShapesChanged, trackedShapes } from "./shapeRegistry";
import L from "leaflet";

/**
 * Pushes the current color / opaque-mode dependent style to Geoman,
 * so that future drawings pick it up.
 */
export function applyDrawingStyleToMap(): void {
    state.map?.pm.setGlobalOptions(getDrawingStyleOptions());
}

/**
 * Changes the active drawing color and synchronizes Geoman options.
 */
export function setActiveDrawColor(color: string): void {
    state.activeDrawColor = color;
    applyDrawingStyleToMap();
}

/**
 * Toggles opaque fill mode for marked shapes and synchronizes toolbar & map styles.
 */
export function toggleDrawnOpaque(): void {
    state.isDrawnOpaque = !state.isDrawnOpaque;

    // Update button active state on the on-map toolbar
    byId("map-btn-opaque-container")?.classList.toggle(
        "active",
        state.isDrawnOpaque,
    );

    // Update all existing tracked polygons on map
    for (const shape of trackedShapes.values()) {
        if (shape.layer instanceof L.Polygon) {
            shape.layer.setStyle(getGeomanPathOptions(shape.color));
        }
    }

    // Update global options for future drawings
    applyDrawingStyleToMap();
    notifyShapesChanged();

    showToast(
        state.isDrawnOpaque
            ? "შიგთავსი: გაუმჭვირვალე"
            : "შიგთავსი: გამჭვირვალე",
    );
}

/**
 * Toggles snapping mode for Geoman drawing tools and updates toolbar button state.
 */
export function toggleSnapping(): void {
    state.isSnappingEnabled = !state.isSnappingEnabled;

    byId("map-btn-snapping-container")?.classList.toggle(
        "active",
        state.isSnappingEnabled,
    );

    const map = state.map;
    if (map && map.pm) {
        map.pm.setGlobalOptions({ snappable: state.isSnappingEnabled });

        // If a shape is currently being drawn, reset snap state on its active instance
        const activeShape = map.pm.Draw.getActiveShape();
        if (activeShape) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const drawInstance = (map.pm.Draw as any)[activeShape];
            if (drawInstance) {
                drawInstance.setOptions({ snappable: state.isSnappingEnabled });
                if (!state.isSnappingEnabled) {
                    drawInstance._cleanupSnapping?.();
                    if (drawInstance._hintMarker) {
                        drawInstance._hintMarker._snapped = false;
                    }
                }
            }
        }

        // Synchronize all existing tracked shapes and layers
        for (const shape of trackedShapes.values()) {
            (shape.layer.options as L.LayerOptions).snapIgnore =
                !state.isSnappingEnabled;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pmLayer = (shape.layer as any).pm;
            if (pmLayer) {
                pmLayer.setOptions({ snappable: state.isSnappingEnabled });
                if (!state.isSnappingEnabled) {
                    pmLayer._cleanupSnapping?.();
                    pmLayer._disableSnapping?.();
                } else if (pmLayer.enabled()) {
                    pmLayer.applyOptions?.();
                }
            }
        }

        map.pm.applyGlobalOptions();
    }

    showToast(
        state.isSnappingEnabled
            ? "მიბმა (Snapping): ჩართულია"
            : "მიბმა (Snapping): გამორთულია",
    );
}
