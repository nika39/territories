import "./styles.scss";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";

// Tbilisi initial coordinates (Avlabari/Isani area)
const initialCenter: L.LatLngTuple = [41.674333, 44.875718];
const initialZoom = 17;

// Global map reference and active provider state
let map: L.Map | null = null;
let currentProvider = "yandex";

// Active GeoJSON polygon layer and stored data (persists across map recreations)
let activeGeoJsonLayer: L.GeoJSON | null = null;
let currentGeoJsonData: Parameters<typeof L.geoJSON>[0] = null;

// Polygon styling state for imported GeoJSON (contour-only vs opaque fill)
let isOnlyContour = false;

function getPolygonStyle(): L.PathOptions {
    return {
        color: "#FF6D70",
        weight: 2,
        opacity: 1,
        fillColor: "#FF3B30",
        fillOpacity: isOnlyContour ? 0.8 : 1,
        fill: true,
        lineCap: "round",
        lineJoin: "round",
    };
}

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

const yandexLayer = L.tileLayer(
    "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=tags.any:commercial_services|stylers.visibility:off~tags.any:entrance|stylers.visibility:off~tags.any:road|tags.none:road_1|tags.none:road_2|tags.none:road_3|tags.none:road_4|tags.none:road_5|tags.none:road_6|tags.none:road_7|elements:label.icon|stylers.visibility:off",
    {
        maxZoom: 19,
        attribution: "&copy; Yandex",
    },
);

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
    layer: L.Polygon;
    shapeType: "Polygon" | "Rectangle";
    name: string;
    area: number; // in square meters
    perimeter: number; // in meters
    color: string;
}

let drawnItemsGroup: L.FeatureGroup | null = null;
const trackedShapes = new Map<string, TrackedShape>();
let activeDrawColor = "#007aff";
let isSnappingEnabled = true;
let preservedDrawnGeoJson: GeoJSON.FeatureCollection | null = null;

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getGeomanPathOptions(color = activeDrawColor): L.PathOptions {
    return {
        color: color,
        weight: 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.35,
        fill: true,
        lineCap: "round",
        lineJoin: "round",
    };
}

function getPolygonLatLngs(layer: L.Polygon): L.LatLng[] {
    const latlngs = layer.getLatLngs();
    if (Array.isArray(latlngs)) {
        if (Array.isArray(latlngs[0])) {
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
 * Re-indexes all tracked shapes sequentially (ტერიტორია #1, ტერიტორია #2, ...)
 * so that numbering never skips and always stays in order.
 */
function reindexTrackedShapes(): void {
    let idx = 1;
    for (const shape of trackedShapes.values()) {
        shape.name = `ტერიტორია #${idx}`;
        idx++;
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
): TrackedShape {
    const id =
        existingId ||
        `bld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const color = customColor || activeDrawColor;

    const latlngs = getPolygonLatLngs(layer);
    const area = calculatePolygonArea(latlngs);
    const perimeter = calculatePolygonPerimeter(latlngs);

    layer.setStyle(getGeomanPathOptions(color));

    const shape: TrackedShape = {
        id,
        layer,
        shapeType,
        name: `ტერიტორია #${trackedShapes.size + 1}`,
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
 * Updates the sidebar list and count badge.
 */
function updateDrawnShapesUI(): void {
    const countBadge = document.getElementById("drawn-count-badge");
    const emptyState = document.getElementById("empty-drawn-state");
    const listContainer = document.getElementById("drawn-objects-list");
    const batchActions = document.getElementById("drawn-batch-actions");

    const shapes = Array.from(trackedShapes.values());
    const count = shapes.length;

    if (countBadge) {
        countBadge.textContent = count.toString();
    }

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

            card.innerHTML = `
                <div class="item-left">
                    <span class="item-color-dot" style="background-color: ${shape.color}; color: ${shape.color};"></span>
                    <div class="item-info">
                        <span class="item-title" title="${escapeHtml(shape.name)}">${escapeHtml(shape.name)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button type="button" class="item-btn focus-btn" title="ტერიტორიის ნახვა რუკაზე">
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

            // Focus on territory without opening any popup
            card.querySelector(".focus-btn")?.addEventListener("click", () => {
                if (!map) return;
                const bounds = shape.layer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, {
                        padding: [80, 80],
                        maxZoom: 19,
                        animate: true,
                    });
                    showToast(shape.name);
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
    // 1. Configure Geoman on-map toolbar (topright under zoom control)
    mapInstance.pm.addControls({
        position: "topright",
        drawPolygon: true,
        drawRectangle: true,
        editMode: true,
        dragMode: true,
        cutPolygon: true,
        removalMode: true,
        rotateMode: true,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawCircle: false,
        drawText: false,
        oneBlock: false,
    });

    // 2. Localize Geoman tooltips and actions into Georgian
    mapInstance.pm.setLang(
        "ka" as unknown as L.PM.SupportLocales,
        {
            tooltips: {
                firstVertex: "დააჭირეთ პირველი წერტილის დასასმელად",
                continueLine: "დააჭირეთ შემდეგი წერტილის დასასმელად",
                finishPoly: "დააჭირეთ პირველ წერტილს ან დასრულებას დასახურად",
                finishRect: "დააჭირეთ მართკუთხედის დასასრულებლად",
            },
            actions: {
                finish: "დასრულება",
                cancel: "გაუქმება",
                removeLastVertex: "ბოლო წერტილის წაშლა",
            },
            buttonTitles: {
                drawPolyButton: "პოლიგონის დახაზვა (შენობა / არეალი)",
                drawRectButton: "მართკუთხედის დახაზვა",
                editButton: "ობიექტების რედაქტირება",
                dragButton: "ობიექტების გადაადგილება",
                cutButton: "პოლიგონის ამოჭრა (შიდა ეზო)",
                deleteButton: "ობიექტების წაშლა",
                rotateButton: "ობიექტების შემობრუნება",
                snappingButton: "მიბმის (Snapping) ჩართვა/გამორთვა",
            },
        },
        "en",
    );

    // 3. Set global drawing styles and snapping configuration
    mapInstance.pm.setGlobalOptions({
        snappable: isSnappingEnabled,
        snapDistance: 16,
        allowSelfIntersection: false,
        templineStyle: {
            color: activeDrawColor,
        },
        hintlineStyle: {
            color: activeDrawColor,
            dashArray: [5, 5],
        },
        pathOptions: getGeomanPathOptions(activeDrawColor),
    });

    // 4. Create and attach drawn items FeatureGroup
    drawnItemsGroup = L.featureGroup().addTo(mapInstance);

    // 5. Restore previously drawn shapes if map was recreated
    if (preservedDrawnGeoJson && preservedDrawnGeoJson.features.length > 0) {
        trackedShapes.clear();
        preservedDrawnGeoJson.features.forEach((feature) => {
            const tempLayer = L.geoJSON(feature, {
                style: () =>
                    getGeomanPathOptions(
                        feature.properties?.color || activeDrawColor,
                    ),
            });
            const sublayer = tempLayer.getLayers()[0] as L.Polygon | undefined;
            if (sublayer) {
                const shapeType =
                    feature.properties?.shapeType === "Rectangle"
                        ? "Rectangle"
                        : "Polygon";
                const color = feature.properties?.color || activeDrawColor;
                registerDrawnLayer(
                    sublayer,
                    shapeType,
                    feature.properties?.id,
                    color,
                );
            }
        });
    }

    // 6. Map event bindings for Geoman
    mapInstance.on("pm:create", (e) => {
        const shapeType = e.shape === "Rectangle" ? "Rectangle" : "Polygon";
        const layer = e.layer as L.Polygon;
        const shape = registerDrawnLayer(layer, shapeType);
        showToast(`${shape.name} მოინიშნა`);
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
 * Sets up sidebar buttons and tools for Geoman.
 */
function setupGeomanSidebarControls(): void {
    const snappingBtn = document.getElementById("btn-toggle-snapping");
    const exportDrawnBtn = document.getElementById("btn-export-drawn-geojson");
    const clearAllDrawnBtn = document.getElementById("btn-clear-all-drawn");
    const colorChips = document.querySelectorAll(
        "#drawing-color-chips .color-chip",
    );

    // Toggle snapping
    snappingBtn?.addEventListener("click", () => {
        isSnappingEnabled = !isSnappingEnabled;
        snappingBtn.classList.toggle("active", isSnappingEnabled);
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
    });

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
                    templineStyle: { color: activeDrawColor },
                    hintlineStyle: {
                        color: activeDrawColor,
                        dashArray: [5, 5],
                    },
                    pathOptions: getGeomanPathOptions(activeDrawColor),
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

    // Add zoom control to top-right
    L.control
        .zoom({
            position: "topright",
        })
        .addTo(map);

    // Bind coordinate display on move
    map.on("move", () => {
        if (!map) return;
        const c = map.getCenter();
        const coordDisplay = document.getElementById("coord-display");
        if (coordDisplay) {
            coordDisplay.textContent = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
        }
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

    // Set initial coordinates display
    const coordDisplay = document.getElementById("coord-display");
    if (coordDisplay) {
        coordDisplay.textContent = `${center[0].toFixed(6)}, ${center[1].toFixed(6)}`;
    }

    // Re-render active GeoJSON polygon if present
    if (currentGeoJsonData) {
        renderGeoJson(currentGeoJsonData, false);
    }
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
 * Sets up keyboard shortcuts for toggling UI overlays.
 */
function setupKeyboardShortcuts(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const isInputField =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target?.isContentEditable;

        const isHKey =
            e.code === "KeyH" || e.key.toLowerCase() === "h" || e.key === "ჰ";

        if (!isHKey) return;

        const isCmdShiftH = (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey;
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
    });
}

/**
 * Sets up map provider switcher behavior.
 */
function setupMapSwitcher(): void {
    const buttons = document.querySelectorAll(".switcher-btn");
    const subtitle = document.querySelector(".logo-title .sub-title");

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

            currentProvider = provider;
        });
    });
}

/**
 * Configures sidebar interactive elements.
 */
function setupGlobalSidebarControls(): void {
    const searchInput = document.getElementById(
        "search-input",
    ) as HTMLInputElement;
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const query = searchInput.value.trim();
                const coordPattern = /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/;
                const match = query.match(coordPattern);

                if (match && map) {
                    const lat = parseFloat(match[1]);
                    const lng = parseFloat(match[2]);

                    map.flyTo([lat, lng], 17, {
                        duration: 1.5,
                    });

                    const coordDisplay =
                        document.getElementById("coord-display");
                    if (coordDisplay) {
                        coordDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    }
                } else {
                    console.log(
                        `Searching for: ${query} (Geocoding not implemented)`,
                    );
                }
            }
        });
    }
}

// Initial initialization when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    // Initialize default Yandex Maps view (EPSG:3395)
    recreateMap(L.CRS.EPSG3395, initialCenter, initialZoom, "yandex");

    // Set up listeners once
    setupMapSwitcher();
    setupGlobalSidebarControls();
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

/**
 * Renders GeoJSON data onto the active Leaflet map.
 */
function renderGeoJson(
    geoJsonData: Parameters<typeof L.geoJSON>[0],
    shouldFitBounds = true,
): { success: boolean; message: string; count: number } {
    if (!map) {
        return {
            success: false,
            message: "რუკა ჯერ არ არის ინიციალიზებული",
            count: 0,
        };
    }

    if (activeGeoJsonLayer) {
        map.removeLayer(activeGeoJsonLayer);
        activeGeoJsonLayer = null;
    }

    try {
        const layer = L.geoJSON(geoJsonData, {
            style: () => getPolygonStyle(),
            onEachFeature: (_, featureLayer) => {
                const pathLayer = featureLayer as L.Path;
                if (pathLayer.pm) {
                    pathLayer.pm.enable();
                    pathLayer.pm.disable();
                }
            },
        });

        const layerCount = layer.getLayers().length;
        if (layerCount === 0) {
            return {
                success: false,
                message: "GeoJSON-ში ვალიდური გეომეტრია ვერ მოიძებნა",
                count: 0,
            };
        }

        layer.addTo(map);
        activeGeoJsonLayer = layer;
        currentGeoJsonData = geoJsonData;

        if (shouldFitBounds) {
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 18,
                    animate: true,
                });
            }
        }

        return {
            success: true,
            message: `წარმატებით დაემატა (${layerCount} ობიექტი)`,
            count: layerCount,
        };
    } catch (err) {
        console.error("Failed to render GeoJSON:", err);
        return {
            success: false,
            message: `შეცდომა: ${(err as Error).message || "დამუშავება ვერ მოხერხდა"}`,
            count: 0,
        };
    }
}

/**
 * Clears the active GeoJSON layer from the map and resets state.
 */
function clearGeoJson(): void {
    if (activeGeoJsonLayer && map) {
        map.removeLayer(activeGeoJsonLayer);
    }
    activeGeoJsonLayer = null;
    currentGeoJsonData = null;
}

/**
 * Sets up listeners for the GeoJSON polygon section in the sidebar.
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
    const toggleFillBtn = document.getElementById(
        "btn-toggle-fill",
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

    if (toggleFillBtn) {
        toggleFillBtn.addEventListener("click", () => {
            isOnlyContour = !isOnlyContour;
            toggleFillBtn.classList.toggle("active", isOnlyContour);

            if (activeGeoJsonLayer) {
                activeGeoJsonLayer.setStyle(getPolygonStyle());
            }

            showToast(
                isOnlyContour
                    ? "გამჭვირვალე შეფერვა (0.8)"
                    : "გაუმჭვირვალე შეფერვა (1.0)",
            );
        });
    }

    const handleAdd = () => {
        if (!input) return;
        const raw = input.value.trim();

        if (!raw) {
            showFeedback("გთხოვთ შეიყვანოთ GeoJSON ტექსტი", "error");
            return;
        }

        let parsed: Parameters<typeof L.geoJSON>[0];
        try {
            parsed = JSON.parse(raw);
        } catch {
            showFeedback("არასწორი JSON ფორმატი: სინტაქსი მცდარია", "error");
            return;
        }

        const res = renderGeoJson(parsed, true);
        if (res.success) {
            showFeedback(
                `✓ პოლიგონი დაემატა (${res.count} ობიექტი)`,
                "success",
            );
            showToast("პოლიგონი დაემატა რუკაზე");
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
            clearGeoJson();
            if (input) {
                input.value = "";
            }
            showFeedback("პოლიგონი გასუფთავებულია", "success");
            showToast("პოლიგონი წაიშალა");
            setTimeout(() => {
                showFeedback("", "none");
            }, 2000);
        });
    }
}
