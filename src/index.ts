import "./styles.scss";
import L from "leaflet";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";

// Tbilisi initial coordinates (Avlabari/Isani area)
const initialCenter: L.LatLngTuple = [41.674333, 44.875718];
const initialZoom = 17;

// Global map reference and active provider state
let map: L.Map | null = null;
let currentProvider = "google-street";

// Define tile layers
const maptilerApiKey: string = process.env.MAPTILER_API_KEY || "";

// Vector MapTiler layer using @maptiler/leaflet-maptilersdk
// Custom map style ID: 019e9cdf-f7aa-7512-9abc-8773a51fd486
const maptilerLayer = new MaptilerLayer({
    apiKey: maptilerApiKey,
    style: "019e9cdf-f7aa-7512-9abc-8773a51fd486",
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
    // "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=tags.any:poi|stylers.visibility:off",
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
    // Initialize default Google Maps view (EPSG:3857)
    recreateMap(L.CRS.EPSG3857, initialCenter, initialZoom, "google-street");

    // Set up switcher and global side panel listeners once
    setupMapSwitcher();
    setupGlobalSidebarControls();

    // Fallback load overlay fade-out after 3 seconds
    setTimeout(() => {
        const loader = document.getElementById("app-loader");
        if (loader && !loader.classList.contains("fade-out")) {
            loader.classList.add("fade-out");
        }
    }, 3000);
});
