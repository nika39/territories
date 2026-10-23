import "./styles.scss";
import L from "leaflet";
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

// Polygon styling state (contour-only vs opaque fill)
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

// Vector MapTiler layer using @maptiler/leaflet-maptilersdk
// Custom map style ID: 019e9cdf-f7aa-7512-9abc-8773a51fd486
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
 * Displays a sleek temporary toast for visual feedback when toggling UI.
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
 * Toggles visibility of UI overlay elements (Sidebar, Zoom controls, Copyright).
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
 * Sets up keyboard shortcuts for toggling UI overlays (Sidebar, Zoom, Copyright).
 * Supported shortcuts (layout-independent via e.code):
 * - Cmd + Shift + H (or Ctrl + Shift + H)
 * - 'h' key (when not focused in an input field)
 */
function setupKeyboardShortcuts(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const isInputField =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target?.isContentEditable;

        // Use e.code === "KeyH" to ensure it works across all keyboard layouts (Georgian, English, etc.)
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

            // Update UI active class
            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            // Get current view from active map
            const center = map.getCenter();
            const lat = center.lat;
            const lng = center.lng;
            const zoom = map.getZoom();

            // Determine CRS: Yandex uses EPSG3395, OSM/Google use EPSG3857
            const crs = provider === "yandex" ? L.CRS.EPSG3395 : L.CRS.EPSG3857;

            // Recreate map with new CRS and layer
            recreateMap(crs, [lat, lng], zoom, provider);

            // Update subtitle
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
 * Configures sidebar interactive elements (search bar, add zone) ONCE globally.
 */
function setupGlobalSidebarControls(): void {
    // 1. Search Box parser (fly to coordinates if format matches "lat, lng")
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

                    // Update dynamic coordinates display immediately
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

    // Set up switcher and global side panel listeners once
    setupMapSwitcher();
    setupGlobalSidebarControls();
    setupKeyboardShortcuts();
    setupGeoJsonControls();

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

    // Remove existing GeoJSON layer if present
    if (activeGeoJsonLayer) {
        map.removeLayer(activeGeoJsonLayer);
        activeGeoJsonLayer = null;
    }

    try {
        const layer = L.geoJSON(geoJsonData, {
            style: () => getPolygonStyle(),
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

    // Toggle fill transparency (only contour vs filled)
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

    // Add Polygon handler
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

    // Support Cmd+Enter or Ctrl+Enter in textarea
    if (input) {
        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleAdd();
            }
        });
    }

    // Clear polygon handler
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
