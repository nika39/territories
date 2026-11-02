import type L from "leaflet";
import { INITIAL_CENTER, INITIAL_ZOOM } from "../config/constants";
import { byId } from "../utils/dom";
import { copyToClipboard } from "../utils/clipboard";
import { showToast } from "./toast";
import { state } from "../state";

/**
 * Formats a coordinate number to 6 decimal places (approx. 11cm accuracy).
 */
function formatCoord(coord: number): string {
    return coord.toFixed(6);
}

/**
 * Formats a zoom level (integer or up to 2 decimal places for fractional zoom).
 */
function formatZoom(zoom: number): string {
    const rounded = Math.round(zoom * 100) / 100;
    return rounded.toString();
}

let currentCenterLat = INITIAL_CENTER[0];
let currentCenterLng = INITIAL_CENTER[1];
let currentZoom = INITIAL_ZOOM;

/**
 * Updates the Center coordinates and Zoom level in the sidebar UI.
 */
export function updateCenterAndZoomDisplay(map: L.Map): void {
    const center = map.getCenter();
    const zoom = map.getZoom();

    currentCenterLat = center.lat;
    currentCenterLng = center.lng;
    currentZoom = zoom;

    const centerEl = byId("coord-center-value");
    if (centerEl) {
        centerEl.textContent = `${formatCoord(center.lat)}, ${formatCoord(center.lng)}`;
    }

    const zoomEl = byId("coord-zoom-value");
    if (zoomEl) {
        zoomEl.textContent = formatZoom(zoom);
    }
}

/**
 * Attaches real-time coordinate and zoom event listeners to a Leaflet map instance.
 */
export function attachCoordinatesToMap(map: L.Map): void {
    updateCenterAndZoomDisplay(map);

    map.on("move zoom viewreset", () => {
        updateCenterAndZoomDisplay(map);
    });
}

/**
 * Sets up button clicks and interactive copy handlers for the coordinates footer.
 */
export function setupCoordinatesControls(): void {
    // Copy Center Coordinates in format "41.677763,44.848284"
    const copyCenter = async (e?: Event) => {
        e?.stopPropagation();
        const map = state.map;
        if (map) {
            const c = map.getCenter();
            currentCenterLat = c.lat;
            currentCenterLng = c.lng;
        }

        const text = `${formatCoord(currentCenterLat)},${formatCoord(currentCenterLng)}`;
        const ok = await copyToClipboard(text);
        if (ok) {
            showToast(`კოორდინატები დაკოპირდა: ${text}`);
        }
    };

    byId("btn-copy-center-coords")?.addEventListener("click", copyCenter);
    byId("box-center-coords")?.addEventListener("click", copyCenter);

    // Copy Zoom Level
    const copyZoom = async (e?: Event) => {
        e?.stopPropagation();
        const map = state.map;
        if (map) {
            currentZoom = map.getZoom();
        }
        const text = formatZoom(currentZoom);
        const ok = await copyToClipboard(text);
        if (ok) {
            showToast(`ზუმი დაკოპირდა: ${text}`);
        }
    };

    byId("btn-copy-zoom")?.addEventListener("click", copyZoom);
    byId("box-zoom")?.addEventListener("click", copyZoom);
}
