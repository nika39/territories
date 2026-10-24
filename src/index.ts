import "./styles.scss";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";

// Tbilisi initial coordinates
const initialCenter: L.LatLngTuple = [41.677763, 44.848284];
const initialZoom = 16;

// Global map reference and active provider state
let map: L.Map | null = null;
let currentProvider = "yandex";


// Global UI visibility state
let isUiHidden = false;

// Define tile layers
const maptilerApiKey: string = process.env.MAPTILER_API_KEY || "";

const maptilerLayer = new MaptilerLayer({
    apiKey: maptilerApiKey,
    style: "01a120ea-26f0-7a1d-b08e-4c63cf192ffd",
});

const googleStreetLayer = L.tileLayer(
    "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ka",
    {
        maxZoom: 21,
        attribution: "&copy; Google",
    },
);

export const YANDEX_STYLE_OLD =
    "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=" +
    "tags.any:commercial_services|stylers.visibility:off~" +
    // "tags.any:entrance|stylers.visibility:off~" +
    "tags.any:road|tags.none:road_1|tags.none:road_2|tags.none:road_3|tags.none:road_4|tags.none:road_5|tags.none:road_6|tags.none:road_7|elements:label.icon|stylers.visibility:off";

export const YANDEX_STYLE_NEW =
    "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=" +
    "tags.any:poi|tags.none:parking|tags.none:cemetery|stylers.visibility:off~" +
    // "tags.any:entrance|stylers.visibility:off~" +
    "tags.any:food_and_drink|tags.any:shopping|tags.any:commercial_services|stylers.visibility:off~" +
    "tags.any:road|tags.none:road_1|tags.none:road_2|tags.none:road_3|tags.none:road_4|tags.none:road_5|tags.none:road_6|tags.none:road_7|elements:label.icon|stylers.visibility:off";

let activeYandexStyle: "old" | "new" = "old";

const yandexLayer = L.tileLayer(YANDEX_STYLE_OLD, {
    maxZoom: 20,
    attribution: "&copy; Yandex",
});

// Store layers in a record
const layers: Record<string, L.Layer> = {
    maptiler: maptilerLayer,
    "google-street": googleStreetLayer,
    yandex: yandexLayer,
};

// ============================================================================
// Geoman Polygon & Area Marking Module
// ============================================================================

interface TrackedShape {
    id: string;
    layer: L.Polygon | L.Marker;
    shapeType: "Polygon" | "Rectangle" | "Marker";
    name: string;
    area: number; // in square meters (0 for Marker)
    perimeter: number; // in meters (0 for Marker)
    color: string;
}

let drawnItemsGroup: L.FeatureGroup | null = null;
const trackedShapes = new Map<string, TrackedShape>();
let activeDrawColor = "#007aff";
let isSnappingEnabled = true;
let isDrawnOpaque = false;
let preservedDrawnGeoJson: GeoJSON.FeatureCollection | null = null;

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Darkens a hex color by a specified factor (e.g. 0.32 = 32% darker).
 */
function darkenHexColor(hex: string, factor = 0.32): string {
    const clean = hex.replace("#", "");
    if (clean.length !== 6 && clean.length !== 3) return hex;
    const full =
        clean.length === 3
            ? clean
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : clean;
    const num = parseInt(full, 16);
    if (isNaN(num)) return hex;
    const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - factor)));
    const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - factor)));
    const b = Math.max(0, Math.floor((num & 255) * (1 - factor)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Returns a UI specialist curated, slightly more prominent / deeper contour tone
 * of the inner fill color when opaque mode is enabled.
 * If opaque mode is disabled, the contour matches the fill color.
 */
function getContourColor(fillColor: string): string {
    if (!isDrawnOpaque) return fillColor;
    const lower = fillColor.toLowerCase();
    const curatedPairs: Record<string, string> = {
        "#007aff": "#004bb5", // ლურჯი
        "#34c759": "#30b657", // მწვანე
        "#ff9500": "#b85900", // ნარინჯისფერი
        "#ff3b30": "#e13930", // წითელი
        "#af52de": "#6e2096", // იისფერი
    };
    if (curatedPairs[lower]) {
        return curatedPairs[lower];
    }
    return darkenHexColor(fillColor, 0.32);
}

function getGeomanPathOptions(color = activeDrawColor): L.PathOptions {
    const contour = getContourColor(color);
    return {
        color: contour,
        weight: isDrawnOpaque ? 3 : 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: isDrawnOpaque ? 1.0 : 0.35,
        fill: true,
        lineCap: "round",
        lineJoin: "round",
    };
}

function getPolygonLatLngs(layer: L.Polygon): L.LatLng[] {
    const latlngs = layer.getLatLngs();
    if (Array.isArray(latlngs)) {
        if (Array.isArray(latlngs[0])) {
            if (Array.isArray(latlngs[0][0])) {
                return latlngs[0][0] as L.LatLng[];
            }
            return latlngs[0] as L.LatLng[];
        }
        return latlngs as L.LatLng[];
    }
    return [];
}

/**
 * Calculates geodesic polygon area on WGS84 ellipsoid in square meters.
 */
function calculatePolygonArea(latlngs: L.LatLng[]): number {
    const RADIUS = 6378137;
    if (latlngs.length < 3) return 0;
    let area = 0;
    const len = latlngs.length;
    for (let i = 0; i < len; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[(i + 1) % len];
        area +=
            (p2.lng - p1.lng) *
            (Math.PI / 180) *
            (2 +
                Math.sin(p1.lat * (Math.PI / 180)) +
                Math.sin(p2.lat * (Math.PI / 180)));
    }
    area = (area * RADIUS * RADIUS) / 2.0;
    return Math.abs(area);
}

/**
 * Calculates perimeter in meters.
 */
function calculatePolygonPerimeter(latlngs: L.LatLng[]): number {
    if (latlngs.length < 2) return 0;
    let perimeter = 0;
    const len = latlngs.length;
    for (let i = 0; i < len; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[(i + 1) % len];
        perimeter += p1.distanceTo(p2);
    }
    return perimeter;
}

/**
 * Re-indexes all tracked shapes sequentially:
 * Polygons/Rectangles: ტერიტორია #1, ტერიტორია #2...
 * Pins/Markers: პინი #1, პინი #2...
 */
function reindexTrackedShapes(): void {
    let polyIdx = 1;
    let pinIdx = 1;
    for (const shape of trackedShapes.values()) {
        if (shape.shapeType === "Marker") {
            if (!shape.name || /^პინი #\d+$/.test(shape.name)) {
                shape.name = `პინი #${pinIdx}`;
            }
            pinIdx++;
        } else {
            if (!shape.name || /^ტერიტორია #\d+$/.test(shape.name)) {
                shape.name = `ტერიტორია #${polyIdx}`;
            }
            polyIdx++;
        }
    }
}

/**
 * Registers a newly created or restored polygon layer in the tracking system.
 */
function registerDrawnLayer(
    layer: L.Polygon,
    shapeType: "Polygon" | "Rectangle",
    existingId?: string,
    customColor?: string,
    customName?: string,
): TrackedShape {
    const id =
        existingId && !trackedShapes.has(existingId)
            ? existingId
            : `bld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const color = customColor || activeDrawColor;

    const latlngs = getPolygonLatLngs(layer);
    const area = calculatePolygonArea(latlngs);
    const perimeter = calculatePolygonPerimeter(latlngs);

    layer.setStyle(getGeomanPathOptions(color));

    const shape: TrackedShape = {
        id,
        layer,
        shapeType,
        name: customName || `ტერიტორია #${trackedShapes.size + 1}`,
        area,
        perimeter,
        color,
    };

    trackedShapes.set(id, shape);
    if (drawnItemsGroup && !drawnItemsGroup.hasLayer(layer)) {
        drawnItemsGroup.addLayer(layer);
    }

    // Always maintain clean sequential numbering (1, 2, 3...)
    reindexTrackedShapes();

    // Update measurements on edit, drag or rotate (no popups)
    layer.on("pm:edit", () => {
        const updatedLatLngs = getPolygonLatLngs(layer);
        shape.area = calculatePolygonArea(updatedLatLngs);
        shape.perimeter = calculatePolygonPerimeter(updatedLatLngs);
        updateDrawnShapesUI();
    });

    layer.on("pm:dragend", () => {
        const updatedLatLngs = getPolygonLatLngs(layer);
        shape.area = calculatePolygonArea(updatedLatLngs);
        shape.perimeter = calculatePolygonPerimeter(updatedLatLngs);
        updateDrawnShapesUI();
    });

    layer.on("pm:rotateend", () => {
        const updatedLatLngs = getPolygonLatLngs(layer);
        shape.area = calculatePolygonArea(updatedLatLngs);
        shape.perimeter = calculatePolygonPerimeter(updatedLatLngs);
        updateDrawnShapesUI();
    });

    updateDrawnShapesUI();
    return shape;
}

/**
 * Creates custom high-visibility vector SVG pin marker icon.
 * Designed with a white outer border + drop shadow for maximum contrast
 * on any map tile or building roof in screenshots.
 */
function createPinIcon(color = activeDrawColor): L.DivIcon {
    return L.divIcon({
        className: "building-pin-wrapper",
        html: `
            <div class="building-pin" style="--pin-color: ${color};">
                <svg viewBox="0 0 34 44" width="49" height="63" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 2C9.268 2 3 8.268 3 16C3 26.5 17 41 17 41C17 41 31 26.5 31 16C31 8.268 24.732 2 17 2Z" 
                          fill="${color}" 
                          stroke="#FFFFFF" 
                          stroke-width="2.4" 
                          stroke-linejoin="round"/>
                    <circle cx="17" cy="16" r="6.2" fill="#FFFFFF"/>
                    <circle cx="17" cy="16" r="3" fill="${color}"/>
                </svg>
            </div>
        `,
        iconSize: [49, 63],
        iconAnchor: [24.5, 59],
    });
}

/**
 * Registers a newly created or restored building marker (Pin) in the tracking system.
 */
function registerDrawnMarker(
    marker: L.Marker,
    customColor?: string,
    existingId?: string,
    customName?: string,
): TrackedShape {
    const id =
        existingId && !trackedShapes.has(existingId)
            ? existingId
            : `pin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const color = customColor || activeDrawColor;

    marker.setIcon(createPinIcon(color));
    if (marker.dragging) {
        marker.dragging.enable();
    }

    const shape: TrackedShape = {
        id,
        layer: marker,
        shapeType: "Marker",
        name: customName || `პინი #${trackedShapes.size + 1}`,
        area: 0,
        perimeter: 0,
        color,
    };

    trackedShapes.set(id, shape);
    if (drawnItemsGroup && !drawnItemsGroup.hasLayer(marker)) {
        drawnItemsGroup.addLayer(marker);
    }

    reindexTrackedShapes();

    // Right-click directly on pin deletes it immediately
    marker.on("contextmenu", (e) => {
        L.DomEvent.stopPropagation(e);
        deleteTrackedShape(id);
    });

    marker.on("dragend", () => {
        updateDrawnShapesUI();
    });

    updateDrawnShapesUI();
    return shape;
}

/**
 * Deletes a tracked shape by ID and reindexes remaining shapes.
 */
function deleteTrackedShape(id: string, notify = true): void {
    const shape = trackedShapes.get(id);
    if (!shape) return;

    const deletedName = shape.name;

    if (drawnItemsGroup && drawnItemsGroup.hasLayer(shape.layer)) {
        drawnItemsGroup.removeLayer(shape.layer);
    }
    if (map && map.hasLayer(shape.layer)) {
        map.removeLayer(shape.layer);
    }

    trackedShapes.delete(id);
    reindexTrackedShapes();
    updateDrawnShapesUI();

    if (notify) {
        showToast(`${deletedName} წაიშალა`);
    }
}

/**
 * Copies GeoJSON feature of a single marked shape to clipboard.
 */
function copySingleShapeGeoJson(id: string): void {
    const shape = trackedShapes.get(id);
    if (!shape) return;

    const feat = shape.layer.toGeoJSON();
    feat.properties = {
        id: shape.id,
        name: shape.name,
        shapeType: shape.shapeType,
        area: shape.area,
        perimeter: shape.perimeter,
        color: shape.color,
    };

    const text = JSON.stringify(feat, null, 2);
    navigator.clipboard
        .writeText(text)
        .then(() => {
            showToast(`${shape.name}-ს GeoJSON დაკოპირდა`);
        })
        .catch(() => {
            showToast("კოპირება ვერ მოხერხდა");
        });
}

/**
 * Updates the sidebar list of marked territories.
 */
function updateDrawnShapesUI(): void {
    const emptyState = document.getElementById("empty-drawn-state");
    const listContainer = document.getElementById("drawn-objects-list");
    const batchActions = document.getElementById("drawn-batch-actions");

    const shapes = Array.from(trackedShapes.values());
    const count = shapes.length;

    if (emptyState && listContainer && batchActions) {
        if (count === 0) {
            emptyState.style.display = "flex";
            listContainer.style.display = "none";
            batchActions.style.display = "none";
            listContainer.innerHTML = "";
            return;
        }

        emptyState.style.display = "none";
        listContainer.style.display = "flex";
        batchActions.style.display = "flex";

        listContainer.innerHTML = "";
        shapes.forEach((shape) => {
            const card = document.createElement("div");
            card.className = "drawn-item-card";

            const contour = getContourColor(shape.color);
            const dotStyle = isDrawnOpaque
                ? `background-color: ${shape.color}; border: 2px solid ${contour};`
                : `background-color: ${shape.color}; border: 2px solid transparent;`;

            const iconHtml =
                shape.shapeType === "Marker"
                    ? `<span class="item-pin-icon" style="color: ${shape.color};">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                            <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
                        </svg>
                    </span>`
                    : `<span class="item-color-dot" style="${dotStyle}"></span>`;

            card.innerHTML = `
                <div class="item-left">
                    ${iconHtml}
                    <div class="item-info">
                        <span class="item-title" title="${escapeHtml(shape.name)}">${escapeHtml(shape.name)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button type="button" class="item-btn focus-btn" title="ობიექტის ნახვა რუკაზე">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </button>
                    <button type="button" class="item-btn copy-btn" title="GeoJSON-ის კოპირება">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button type="button" class="item-btn danger delete-btn" title="წაშლა">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            // Focus on territory or pin without opening any popup
            card.querySelector(".focus-btn")?.addEventListener("click", () => {
                if (!map) return;
                if (shape.layer instanceof L.Marker) {
                    map.flyTo(
                        shape.layer.getLatLng(),
                        Math.max(map.getZoom(), 19),
                        {
                            duration: 1.0,
                        },
                    );
                    showToast(shape.name);
                } else {
                    const bounds = shape.layer.getBounds();
                    if (bounds.isValid()) {
                        map.fitBounds(bounds, {
                            padding: [80, 80],
                            maxZoom: 19,
                            animate: true,
                        });
                        showToast(shape.name);
                    }
                }
            });

            card.querySelector(".copy-btn")?.addEventListener("click", () => {
                copySingleShapeGeoJson(shape.id);
            });

            card.querySelector(".delete-btn")?.addEventListener("click", () => {
                deleteTrackedShape(shape.id);
            });

            listContainer.appendChild(card);
        });
    }
}

/**
 * Exports all drawn shapes into GeoJSON format, copies to clipboard and updates the GeoJSON input area.
 */
function exportAllDrawnGeoJson(): void {
    if (trackedShapes.size === 0) {
        showToast("მონიშნული ტერიტორიები არ არის");
        return;
    }

    const features = Array.from(trackedShapes.values()).map((s) => {
        const feat = s.layer.toGeoJSON();
        feat.properties = {
            id: s.id,
            name: s.name,
            shapeType: s.shapeType,
            area: s.area,
            perimeter: s.perimeter,
            color: s.color,
        };
        return feat;
    });

    const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
    };

    const text = JSON.stringify(fc, null, 2);

    const geoJsonInput = document.getElementById(
        "geojson-input",
    ) as HTMLTextAreaElement | null;
    if (geoJsonInput) {
        geoJsonInput.value = text;
    }

    navigator.clipboard
        .writeText(text)
        .then(() => {
            showToast("GeoJSON დაკოპირდა და გადატანილია ველში");
        })
        .catch(() => {
            showToast("GeoJSON გადატანილია ველში");
        });
}

/**
 * Sets up Leaflet Geoman controls, locales, styles and event listeners on a map instance.
 */
function setupGeomanOnMap(mapInstance: L.Map): void {
    // 1. Configure Geoman on-map toolbar (topright)
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
    mapInstance.pm.Toolbar.changeControlOrder([
        "drawPolygon",
        "drawRectangle",
        "drawMarker",
        "editMode",
        "dragMode",
        "cutPolygon",
        "removalMode",
        "rotateMode",
    ]);

    // 2. Localize Geoman actions and button titles into Georgian
    mapInstance.pm.setLang(
        "ka" as unknown as L.PM.SupportLocales,
        {
            actions: {
                finish: "დასრულება",
                cancel: "გაუქმება",
                removeLastVertex: "ბოლო წერტილის წაშლა",
            },
            buttonTitles: {
                drawPolyButton: "პოლიგონის დახაზვა (შენობა / არეალი)",
                drawRectButton: "მართკუთხედის დახაზვა",
                drawMarkerButton: "პინის დასმა (შენობის / კორპუსის მონიშვნა)",
                editButton: "ობიექტების რედაქტირება",
                dragButton: "ობიექტების გადაადგილება",
                cutButton: "პოლიგონის ამოჭრა (შიდა ეზო)",
                deleteButton: "ობიექტების წაშლა",
                rotateButton: "ობიექტების შემობრუნება",
            },
        },
        "en",
    );

    // 3. Set global drawing styles, marker styles, and snapping configuration
    mapInstance.pm.setGlobalOptions({
        tooltips: false,
        snappable: isSnappingEnabled,
        snapDistance: 16,
        allowSelfIntersection: false,
        continueDrawing: false,
        exitModeOnEscape: true,
        templineStyle: {
            color: getContourColor(activeDrawColor),
            weight: isDrawnOpaque ? 3 : 2,
        },
        hintlineStyle: {
            color: getContourColor(activeDrawColor),
            dashArray: [5, 5],
        },
        pathOptions: getGeomanPathOptions(activeDrawColor),
        markerStyle: {
            icon: createPinIcon(activeDrawColor),
            draggable: true,
        },
    });

    // 4. Add custom Opacity and Snapping controls at the end of the right toolbar
    const GeomanOptionsControl = L.Control.extend({
        options: {
            position: "topright" as L.ControlPosition,
        },
        onAdd: function () {
            const container = L.DomUtil.create(
                "div",
                "leaflet-pm-toolbar leaflet-bar pm-options-toolbar",
            );

            container.innerHTML = `
                <div class="button-container ${isDrawnOpaque ? "active" : ""}" id="map-btn-opaque-container">
                    <a class="leaflet-buttons-control-button" id="map-btn-toggle-opaque" title="გაუმჭვირვალე შიგთავსი" role="button">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9"></circle>
                            <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"></path>
                        </svg>
                    </a>
                </div>
                <div class="button-container ${isSnappingEnabled ? "active" : ""}" id="map-btn-snapping-container">
                    <a class="leaflet-buttons-control-button" id="map-btn-toggle-snapping" title="კუთხეების მიბმა (Snapping)" role="button">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 3v7a6 6 0 0 0 12 0V3"></path>
                            <line x1="4" y1="3" x2="8" y2="3"></line>
                            <line x1="16" y1="3" x2="20" y2="3"></line>
                        </svg>
                    </a>
                </div>
            `;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            container
                .querySelector("#map-btn-toggle-opaque")
                ?.addEventListener("click", (e) => {
                    e.preventDefault();
                    toggleDrawnOpaque();
                });

            container
                .querySelector("#map-btn-toggle-snapping")
                ?.addEventListener("click", (e) => {
                    e.preventDefault();
                    toggleSnapping();
                });

            return container;
        },
    });

    new GeomanOptionsControl().addTo(mapInstance);

    // 5. Create and attach drawn items FeatureGroup
    drawnItemsGroup = L.featureGroup().addTo(mapInstance);

    // 5. Restore previously drawn shapes & pins if map was recreated
    if (preservedDrawnGeoJson && preservedDrawnGeoJson.features.length > 0) {
        trackedShapes.clear();
        restoreGeoJson(preservedDrawnGeoJson, false);
    }

    // 6. Map event bindings for Geoman
    mapInstance.on("pm:create", (e) => {
        if (e.shape === "Marker") {
            const marker = e.layer as L.Marker;
            const shape = registerDrawnMarker(marker, activeDrawColor);
            showToast(`${shape.name} დაისვა`);
            // Automatically exit marker drawing mode after placing 1 pin
            mapInstance.pm.disableDraw();
        } else {
            const shapeType = e.shape === "Rectangle" ? "Rectangle" : "Polygon";
            const layer = e.layer as L.Polygon;
            const shape = registerDrawnLayer(layer, shapeType);
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
 * Toggles opaque fill mode for marked shapes and synchronizes toolbar & map styles.
 */
function toggleDrawnOpaque(): void {
    isDrawnOpaque = !isDrawnOpaque;

    // Update button active state on the on-map toolbar
    const opaqueContainer = document.getElementById("map-btn-opaque-container");
    opaqueContainer?.classList.toggle("active", isDrawnOpaque);

    // Update all existing tracked polygons on map
    for (const shape of trackedShapes.values()) {
        if (shape.layer instanceof L.Polygon) {
            shape.layer.setStyle(getGeomanPathOptions(shape.color));
        }
    }

    // Update global options for future drawings
    if (map) {
        map.pm.setGlobalOptions({
            templineStyle: {
                color: getContourColor(activeDrawColor),
                weight: isDrawnOpaque ? 3 : 2,
            },
            hintlineStyle: {
                color: getContourColor(activeDrawColor),
                dashArray: [5, 5],
            },
            pathOptions: getGeomanPathOptions(activeDrawColor),
        });
    }

    updateDrawnShapesUI();

    showToast(
        isDrawnOpaque
            ? "შიგთავსი: გაუმჭვირვალე (კონტური გამოკვეთილია)"
            : "შიგთავსი: გამჭვირვალე (0.35)",
    );
}

/**
 * Toggles snapping mode for Geoman drawing tools and updates toolbar button state.
 */
function toggleSnapping(): void {
    isSnappingEnabled = !isSnappingEnabled;

    const snappingContainer = document.getElementById(
        "map-btn-snapping-container",
    );
    snappingContainer?.classList.toggle("active", isSnappingEnabled);

    if (map) {
        map.pm.setGlobalOptions({
            snappable: isSnappingEnabled,
        });
    }

    showToast(
        isSnappingEnabled
            ? "მიბმა (Snapping): ჩართულია"
            : "მიბმა (Snapping): გამორთულია",
    );
}

/**
 * Sets up sidebar buttons and tools for Geoman.
 */
function setupGeomanSidebarControls(): void {
    const exportDrawnBtn = document.getElementById("btn-export-drawn-geojson");
    const clearAllDrawnBtn = document.getElementById("btn-clear-all-drawn");
    const colorChips = document.querySelectorAll(
        "#drawing-color-chips .color-chip",
    );

    // Color picker chips
    colorChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            const color = chip.getAttribute("data-color");
            if (!color) return;
            activeDrawColor = color;

            colorChips.forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");

            if (map) {
                map.pm.setGlobalOptions({
                    templineStyle: {
                        color: getContourColor(activeDrawColor),
                        weight: isDrawnOpaque ? 3 : 2,
                    },
                    hintlineStyle: {
                        color: getContourColor(activeDrawColor),
                        dashArray: [5, 5],
                    },
                    pathOptions: getGeomanPathOptions(activeDrawColor),
                    markerStyle: {
                        icon: createPinIcon(activeDrawColor),
                        draggable: true,
                    },
                });
            }
        });
    });

    // Export all drawn shapes
    exportDrawnBtn?.addEventListener("click", exportAllDrawnGeoJson);

    // Clear all drawn shapes
    clearAllDrawnBtn?.addEventListener("click", () => {
        if (trackedShapes.size === 0) return;
        if (confirm("ნამდვილად გსურთ ყველა მონიშნული ტერიტორიის წაშლა?")) {
            const ids = Array.from(trackedShapes.keys());
            ids.forEach((id) => deleteTrackedShape(id, false));
            preservedDrawnGeoJson = null;
        }
    });
}

// ============================================================================
// Leaflet Map Recreation & Lifecycle
// ============================================================================

/**
 * Recreates the Leaflet map instance with the appropriate CRS projection.
 */
function recreateMap(
    crs: L.CRS,
    center: L.LatLngTuple,
    zoom: number,
    provider: string,
): void {
    if (map) {
        // Preserve drawn shapes before destroying previous map instance
        if (trackedShapes.size > 0) {
            const features = Array.from(trackedShapes.values()).map((s) => {
                const feat = s.layer.toGeoJSON();
                feat.properties = {
                    id: s.id,
                    name: s.name,
                    shapeType: s.shapeType,
                    color: s.color,
                    area: s.area,
                    perimeter: s.perimeter,
                };
                return feat;
            });
            preservedDrawnGeoJson = {
                type: "FeatureCollection",
                features,
            };
        }
        map.remove();
    }

    map = L.map("map-container", {
        center: center,
        zoom: zoom,
        zoomControl: false,
        attributionControl: true,
        crs: crs,
    });



    // Ensure UI visibility class remains consistent on body
    document.body.classList.toggle("ui-hidden", isUiHidden);

    // Attach selected layer
    const layer = layers[provider];
    if (layer) {
        layer.addTo(map);

        // Hide loader overlay once tiles are loaded
        layer.on("load", () => {
            const loader = document.getElementById("app-loader");
            if (loader) {
                loader.classList.add("fade-out");
            }
        });
    }

    // Initialize Geoman on the newly created map
    setupGeomanOnMap(map);




}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Displays a sleek temporary toast for visual feedback.
 */
function showToast(message: string): void {
    let toast = document.getElementById("map-status-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "map-status-toast";
        toast.className = "map-status-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    toastTimeout = setTimeout(() => {
        toast?.classList.remove("visible");
    }, 1800);
}

/**
 * Toggles visibility of UI overlay elements (Sidebar, Zoom controls, Geoman toolbar, Copyright).
 */
function toggleUiVisibility(): void {
    isUiHidden = !isUiHidden;
    document.body.classList.toggle("ui-hidden", isUiHidden);
    showToast(
        isUiHidden
            ? "ინტერფეისი დამალულია • დააჭირე H-ს გამოსაჩენად"
            : "ინტერფეისი გამოჩენილია",
    );
}

/**
 * Deactivates any currently active Leaflet Geoman drawing or editing mode.
 * Returns the human-readable Georgian label of the deactivated mode, or null if no mode was active.
 */
function disableActiveGeomanModes(): string | null {
    if (!map || !map.pm) return null;

    let deactivatedName: string | null = null;

    // 1. Drawing modes (Polygon, Rectangle, Pin/Marker, Cut)
    if (map.pm.globalDrawModeEnabled()) {
        const activeShape = map.pm.Draw.getActiveShape();
        if (activeShape === "Marker") {
            deactivatedName = "პინის დასმა";
        } else if (activeShape === "Rectangle") {
            deactivatedName = "მართკუთხედის დახაზვა";
        } else if (activeShape === "Polygon") {
            deactivatedName = "პოლიგონის დახაზვა";
        } else if (activeShape === "Cut") {
            deactivatedName = "ამოჭრა";
        } else {
            deactivatedName = "დახაზვის რეჟიმი";
        }
        map.pm.disableDraw();
    }

    // 2. Cut mode
    if (map.pm.globalCutModeEnabled()) {
        if (!deactivatedName) deactivatedName = "ამოჭრა";
        map.pm.disableGlobalCutMode();
    }

    // 3. Global Edit mode
    if (map.pm.globalEditModeEnabled()) {
        if (!deactivatedName) deactivatedName = "რედაქტირება";
        map.pm.disableGlobalEditMode();
    }

    // 4. Global Drag mode
    if (map.pm.globalDragModeEnabled()) {
        if (!deactivatedName) deactivatedName = "გადაადგილება";
        map.pm.disableGlobalDragMode();
    }

    // 5. Global Removal mode
    if (map.pm.globalRemovalModeEnabled()) {
        if (!deactivatedName) deactivatedName = "წაშლა";
        map.pm.disableGlobalRemovalMode();
    }

    // 6. Global Rotate mode
    if (map.pm.globalRotateModeEnabled()) {
        if (!deactivatedName) deactivatedName = "შემობრუნება";
        map.pm.disableGlobalRotateMode();
    }

    // 7. Ensure any layer-level Geoman mode is disabled as well
    if (drawnItemsGroup) {
        drawnItemsGroup.eachLayer((layer) => {
            const l = layer as L.Path | L.Marker;
            if (l.pm && typeof l.pm.enabled === "function" && l.pm.enabled()) {
                if (!deactivatedName) deactivatedName = "რედაქტირება";
                l.pm.disable();
            }
        });
    }

    if (deactivatedName) {
        showToast(`${deactivatedName} გაითიშა`);
    }

    return deactivatedName;
}

/**
 * Sets up keyboard shortcuts for toggling UI overlays and canceling active Geoman modes.
 */
function setupKeyboardShortcuts(): void {
    window.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isInputField =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target?.isContentEditable;

            // 1. ESC key: Disable any active Geoman drawing / editing mode
            if (e.key === "Escape" || e.code === "Escape") {
                const deactivated = disableActiveGeomanModes();
                if (deactivated) {
                    e.preventDefault();
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                    return;
                }
            }

            // 2. H key: Toggle UI visibility
            const isHKey =
                e.code === "KeyH" ||
                e.key.toLowerCase() === "h" ||
                e.key === "ჰ";

            if (!isHKey) return;

            const isCmdShiftH =
                (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey;
            const isSoloH =
                !isInputField &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey &&
                !e.shiftKey;

            if (isCmdShiftH || isSoloH) {
                e.preventDefault();
                toggleUiVisibility();
            }
        },
        true,
    );
}

/**
 * Sets up map provider switcher behavior.
 */
function setupMapSwitcher(): void {
    const buttons = document.querySelectorAll(".switcher-btn");
    const subtitle = document.querySelector(".logo-title .sub-title");
    const yandexStyleSwitcher = document.getElementById(
        "yandex-style-switcher",
    );

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const provider = btn.getAttribute("data-provider") || "osm";
            if (provider === currentProvider || !map) return;

            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            const center = map.getCenter();
            const lat = center.lat;
            const lng = center.lng;
            const zoom = map.getZoom();

            const crs = provider === "yandex" ? L.CRS.EPSG3395 : L.CRS.EPSG3857;

            recreateMap(crs, [lat, lng], zoom, provider);

            if (subtitle) {
                if (provider === "maptiler") {
                    subtitle.textContent = "MapTiler ინტეგრაცია";
                } else if (provider === "google-street") {
                    subtitle.textContent = "Google Maps ინტეგრაცია";
                } else if (provider === "yandex") {
                    subtitle.textContent = "Yandex Maps ინტეგრაცია";
                }
            }

            if (yandexStyleSwitcher) {
                yandexStyleSwitcher.style.display =
                    provider === "yandex" ? "block" : "none";
            }

            currentProvider = provider;
        });
    });
}

/**
 * Switches between existing and new Yandex style links.
 */
function switchYandexStyle(style: "old" | "new"): void {
    if (activeYandexStyle === style && currentProvider === "yandex") return;
    activeYandexStyle = style;

    const targetUrl = style === "new" ? YANDEX_STYLE_NEW : YANDEX_STYLE_OLD;
    yandexLayer.setUrl(targetUrl);

    // Update style buttons state
    const styleButtons = document.querySelectorAll(".yandex-style-btn");
    styleButtons.forEach((btn) => {
        if (btn.getAttribute("data-yandex-style") === style) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Update badge text
    const badge = document.getElementById("yandex-style-badge");
    if (badge) {
        badge.textContent = style === "new" ? "გაფილტრული" : "ყველა იარლიყი";
    }

    // If not currently on Yandex, switch map to Yandex
    if (currentProvider !== "yandex") {
        const yandexBtn = document.querySelector(
            '.switcher-btn[data-provider="yandex"]',
        ) as HTMLButtonElement | null;
        if (yandexBtn) {
            yandexBtn.click();
        }
    }

    showToast(
        style === "new"
            ? "Yandex: გაფილტრული რეჟიმი (არასაჭირო იარლიყები დამალულია)"
            : "Yandex: სრული რეჟიმი (ყველა იარლიყი გამოჩენილია)",
    );
}

/**
 * Sets up Yandex style toggle buttons listeners.
 */
function setupYandexStyleSwitcher(): void {
    const yandexStyleSwitcher = document.getElementById(
        "yandex-style-switcher",
    );
    if (yandexStyleSwitcher) {
        yandexStyleSwitcher.style.display =
            currentProvider === "yandex" ? "block" : "none";
    }

    const styleButtons = document.querySelectorAll(".yandex-style-btn");
    styleButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const style = btn.getAttribute("data-yandex-style") as
                | "old"
                | "new"
                | null;
            if (style === "old" || style === "new") {
                switchYandexStyle(style);
            }
        });
    });
}

// Initial initialization when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    // Initialize default Yandex Maps view (EPSG:3395)
    recreateMap(L.CRS.EPSG3395, initialCenter, initialZoom, "yandex");

    // Set up listeners once
    setupMapSwitcher();
    setupYandexStyleSwitcher();
    setupKeyboardShortcuts();
    setupGeoJsonControls();
    setupGeomanSidebarControls();

    // Fallback load overlay fade-out after 3 seconds
    setTimeout(() => {
        const loader = document.getElementById("app-loader");
        if (loader && !loader.classList.contains("fade-out")) {
            loader.classList.add("fade-out");
        }
    }, 3000);
});

// ============================================================================
// GeoJSON Import & Restoration Engine
// ============================================================================

/**
 * Extracts color hex or string from GeoJSON properties if present.
 */
function extractColorFromProperties(
    props: Record<string, any> | null | undefined,
): string {
    if (!props) return activeDrawColor;
    const candidate =
        props.color ||
        props.fill ||
        props.stroke ||
        props["marker-color"] ||
        props["marker_color"];
    if (typeof candidate === "string" && candidate.trim()) {
        const trimmed = candidate.trim();
        if (/^#([0-9a-fA-F]{3}){1,2}$/.test(trimmed)) {
            return trimmed;
        }
        return trimmed;
    }
    return activeDrawColor;
}

/**
 * Extracts custom title/name from GeoJSON properties if present.
 */
function extractNameFromProperties(
    props: Record<string, any> | null | undefined,
): string | undefined {
    if (!props) return undefined;
    const candidate = props.name || props.title || props.label;
    if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
    }
    return undefined;
}

/**
 * Parses raw JSON / object into an array of GeoJSON Features.
 * Fully compatible with geojson.io, FeatureCollection, single Feature,
 * array of features, or direct geometry objects (Polygon, MultiPolygon, Point).
 */
function parseGeoJsonFeatures(data: any): GeoJSON.Feature[] {
    if (!data || typeof data !== "object") return [];

    // 1. FeatureCollection
    if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        return data.features.filter(
            (f: any) => f && typeof f === "object" && f.geometry,
        );
    }

    // 2. Single Feature
    if (data.type === "Feature" && data.geometry) {
        return [data as GeoJSON.Feature];
    }

    // 3. Array of Features or Geometries
    if (Array.isArray(data)) {
        const result: GeoJSON.Feature[] = [];
        for (const item of data) {
            if (item && item.type === "Feature" && item.geometry) {
                result.push(item);
            } else if (item && item.type && item.coordinates) {
                result.push({
                    type: "Feature",
                    properties: {},
                    geometry: item,
                });
            }
        }
        return result;
    }

    // 4. Direct geometry object (Polygon, MultiPolygon, Point, etc.)
    if (data.type && data.coordinates) {
        return [
            {
                type: "Feature",
                properties: {},
                geometry: data,
            },
        ];
    }

    return [];
}

/**
 * Restores GeoJSON data directly into tracked shapes and pins.
 * Fully preserves color, coordinates, name, and ID as if drawn by the user.
 */
function restoreGeoJson(
    geoJsonData: unknown,
    shouldFitBounds = true,
): { success: boolean; message: string; count: number } {
    if (!map || !drawnItemsGroup) {
        return {
            success: false,
            message: "რუკა ჯერ არ არის ინიციალიზებული",
            count: 0,
        };
    }

    const features = parseGeoJsonFeatures(geoJsonData);
    if (features.length === 0) {
        return {
            success: false,
            message: "GeoJSON-ში ვალიდური გეომეტრია ვერ მოიძებნა",
            count: 0,
        };
    }

    const addedShapes: TrackedShape[] = [];

    for (const feat of features) {
        const props = (feat.properties || {}) as Record<string, any>;
        const geom = feat.geometry;
        if (!geom) continue;

        const color = extractColorFromProperties(props);
        const name = extractNameFromProperties(props);
        const existingId =
            typeof props.id === "string" && props.id ? props.id : undefined;

        // 1. Point -> Pin / Marker
        if (geom.type === "Point") {
            const coords = (geom as GeoJSON.Point).coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            const lng = Number(coords[0]);
            const lat = Number(coords[1]);
            if (isNaN(lng) || isNaN(lat)) continue;

            const marker = L.marker([lat, lng], {
                icon: createPinIcon(color),
                draggable: true,
            });
            const shape = registerDrawnMarker(marker, color, existingId, name);
            addedShapes.push(shape);
            continue;
        }

        // 2. Polygon, MultiPolygon or other 2D geometries
        const tempLayer = L.geoJSON(feat, {
            style: () => getGeomanPathOptions(color),
        });

        const sublayers = tempLayer.getLayers();
        for (const sub of sublayers) {
            if (sub instanceof L.Polygon) {
                tempLayer.removeLayer(sub);
                const shapeType: "Polygon" | "Rectangle" =
                    props.shapeType === "Rectangle" ? "Rectangle" : "Polygon";
                const shape = registerDrawnLayer(
                    sub,
                    shapeType,
                    existingId,
                    color,
                    name,
                );
                addedShapes.push(shape);
            } else if (sub instanceof L.Marker) {
                tempLayer.removeLayer(sub);
                const latlng = sub.getLatLng();
                const marker = L.marker(latlng, {
                    icon: createPinIcon(color),
                    draggable: true,
                });
                const shape = registerDrawnMarker(
                    marker,
                    color,
                    existingId,
                    name,
                );
                addedShapes.push(shape);
            }
        }
    }

    if (addedShapes.length === 0) {
        return {
            success: false,
            message: "GeoJSON-ში ვალიდური პოლიგონი ან პინი ვერ მოიძებნა",
            count: 0,
        };
    }

    // Animate map camera to encompass newly restored items
    if (shouldFitBounds && map) {
        const bounds = L.latLngBounds([]);
        addedShapes.forEach((s) => {
            if (s.layer instanceof L.Marker) {
                bounds.extend(s.layer.getLatLng());
            } else if (s.layer instanceof L.Polygon) {
                bounds.extend(s.layer.getBounds());
            }
        });

        if (bounds.isValid()) {
            if (
                addedShapes.length === 1 &&
                addedShapes[0].layer instanceof L.Marker
            ) {
                map.flyTo(
                    (addedShapes[0].layer as L.Marker).getLatLng(),
                    Math.max(map.getZoom(), 18),
                    { duration: 0.8 },
                );
            } else {
                map.fitBounds(bounds, {
                    padding: [60, 60],
                    maxZoom: 19,
                    animate: true,
                });
            }
        }
    }

    const objectLabel =
        addedShapes.length === 1
            ? addedShapes[0].name
            : `${addedShapes.length} ობიექტი`;

    return {
        success: true,
        message: `✓ დაემატა (${objectLabel})`,
        count: addedShapes.length,
    };
}

/**
 * Sets up listeners for the GeoJSON input and restore section in the sidebar.
 */
function setupGeoJsonControls(): void {
    const input = document.getElementById(
        "geojson-input",
    ) as HTMLTextAreaElement | null;
    const addBtn = document.getElementById(
        "btn-draw-geojson",
    ) as HTMLButtonElement | null;
    const clearBtn = document.getElementById(
        "btn-clear-geojson",
    ) as HTMLButtonElement | null;
    const feedback = document.getElementById("geojson-feedback");

    const showFeedback = (msg: string, type: "error" | "success" | "none") => {
        if (!feedback) return;
        if (type === "none") {
            feedback.style.display = "none";
            feedback.className = "geojson-feedback";
            feedback.textContent = "";
            return;
        }
        feedback.style.display = "flex";
        feedback.className = `geojson-feedback ${type}`;
        feedback.textContent = msg;
    };

    const handleAdd = () => {
        if (!input) return;
        const raw = input.value.trim();

        if (!raw) {
            showFeedback("გთხოვთ შეიყვანოთ GeoJSON ტექსტი", "error");
            return;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            showFeedback("არასწორი JSON ფორმატი: სინტაქსი მცდარია", "error");
            return;
        }

        const res = restoreGeoJson(parsed, true);
        if (res.success) {
            showFeedback(res.message, "success");
            showToast(`${res.count} ობიექტი დაემატა რუკაზე`);
        } else {
            showFeedback(`✕ ${res.message}`, "error");
        }
    };

    if (addBtn) {
        addBtn.addEventListener("click", handleAdd);
    }

    if (input) {
        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleAdd();
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (input) {
                input.value = "";
            }
            showFeedback("", "none");
            showToast("ველი გასუფთავებულია");
        });
    }
}
