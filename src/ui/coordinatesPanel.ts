import type L from "leaflet";
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

let currentCenterLat = 0;
let currentCenterLng = 0;
let currentZoom = 0;

let currentCursorLat: number | null = null;
let currentCursorLng: number | null = null;

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
 * Updates the Cursor coordinates in the sidebar UI.
 */
export function updateCursorDisplay(latlng: L.LatLng | null): void {
    const cursorEl = byId("coord-cursor-value");
    const cursorBtn = byId("btn-copy-cursor-coords");

    if (!latlng) {
        currentCursorLat = null;
        currentCursorLng = null;
        if (cursorEl) {
            cursorEl.textContent = "—";
        }
        if (cursorBtn) {
            cursorBtn.style.display = "none";
        }
        return;
    }

    currentCursorLat = latlng.lat;
    currentCursorLng = latlng.lng;

    if (cursorEl) {
        cursorEl.textContent = `${formatCoord(latlng.lat)}, ${formatCoord(latlng.lng)}`;
    }
    if (cursorBtn) {
        cursorBtn.style.display = "inline-flex";
    }
}

/**
 * Attaches real-time coordinate and zoom event listeners to a Leaflet map instance.
 */
export function attachCoordinatesToMap(map: L.Map): void {
    updateCenterAndZoomDisplay(map);
    updateCursorDisplay(null);

    map.on("move zoom viewreset", () => {
        updateCenterAndZoomDisplay(map);
    });

    map.on("mousemove", (e: L.LeafletMouseEvent) => {
        if (e.latlng) {
            updateCursorDisplay(e.latlng);
        }
    });

    map.on("mouseout", () => {
        updateCursorDisplay(null);
    });

    const container = map.getContainer();
    if (container) {
        container.addEventListener("mouseleave", () => {
            updateCursorDisplay(null);
        });
    }
}

/**
 * Sets up button clicks and interactive copy handlers for the coordinates section.
 */
export function setupCoordinatesControls(): void {
    // Copy Center Coordinates
    const copyCenter = async (e?: Event) => {
        e?.stopPropagation();
        const map = state.map;
        if (map) {
            const c = map.getCenter();
            currentCenterLat = c.lat;
            currentCenterLng = c.lng;
        }

        const text = `[${formatCoord(currentCenterLat)}, ${formatCoord(currentCenterLng)}]`;
        const ok = await copyToClipboard(text);
        if (ok) {
            showToast(`ცენტრის კოორდინატები დაკოპირდა: ${text}`);
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

    // Copy Cursor Coordinates
    const copyCursor = async (e?: Event) => {
        e?.stopPropagation();
        if (currentCursorLat === null || currentCursorLng === null) {
            showToast("კურსორი რუკაზე არ არის");
            return;
        }
        const text = `[${formatCoord(currentCursorLat)}, ${formatCoord(currentCursorLng)}]`;
        const ok = await copyToClipboard(text);
        if (ok) {
            showToast(`კურსორის კოორდინატები დაკოპირდა: ${text}`);
        }
    };

    byId("btn-copy-cursor-coords")?.addEventListener("click", copyCursor);
    byId("box-cursor-coords")?.addEventListener("click", copyCursor);

    // Copy All Coordinates Summary (Center + Zoom)
    const copyAll = async () => {
        const map = state.map;
        if (map) {
            const c = map.getCenter();
            currentCenterLat = c.lat;
            currentCenterLng = c.lng;
            currentZoom = map.getZoom();
        }
        const centerStr = `[${formatCoord(currentCenterLat)}, ${formatCoord(currentCenterLng)}]`;
        const zoomStr = formatZoom(currentZoom);
        const text = `${centerStr}, zoom: ${zoomStr}`;
        const ok = await copyToClipboard(text);
        if (ok) {
            showToast(`კოორდინატები და ზუმი დაკოპირდა: ${text}`);
        }
    };

    byId("btn-copy-all-coords")?.addEventListener("click", copyAll);
}

