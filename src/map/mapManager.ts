import L from "leaflet";
import { buildFeatureCollection } from "../drawing/geojsonExport";
import { setupGeomanOnMap } from "../drawing/geomanSetup";
import { trackedShapes } from "../drawing/shapeRegistry";
import { state } from "../state";
import { hideAppLoader } from "../ui/loader";
import { applyUiVisibility } from "../ui/uiVisibility";
import { layers } from "./providers";

/**
 * Snapshots drawn shapes so they survive the destruction of the map instance.
 */
function preserveDrawnShapes(): void {
    state.preservedDrawnGeoJson =
        trackedShapes.size > 0 ? buildFeatureCollection() : null;
}

/**
 * Recreates the Leaflet map instance with the appropriate CRS projection.
 */
export function recreateMap(
    crs: L.CRS,
    center: L.LatLngTuple,
    zoom: number,
    provider: string,
): void {
    if (state.map) {
        preserveDrawnShapes();
        state.map.remove();
    }

    const map = L.map("map-container", {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
        crs,
    });
    state.map = map;

    // Ensure UI visibility class remains consistent on body
    applyUiVisibility();

    // Attach selected layer
    const layer = layers[provider];
    if (layer) {
        layer.addTo(map);
        // Hide loader overlay once tiles are loaded
        layer.on("load", hideAppLoader);
    }

    // Initialize Geoman on the newly created map
    setupGeomanOnMap(map);
}
