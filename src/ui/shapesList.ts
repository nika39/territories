import L from "leaflet";
import { deleteTrackedShape, trackedShapes } from "../drawing/shapeRegistry";
import { copySingleShapeGeoJson } from "../drawing/geojsonExport";
import { getContourColor } from "../drawing/styles";
import { state } from "../state";
import type { TrackedShape } from "../types";
import { byId } from "../utils/dom";
import { escapeHtml } from "../utils/html";
import {
    COPY_ICON_SVG,
    DELETE_ICON_SVG,
    FOCUS_ICON_SVG,
    renderListPinIcon,
} from "./icons";
import { showToast } from "./toast";

function renderShapeIcon(shape: TrackedShape): string {
    if (shape.shapeType === "Marker") {
        return renderListPinIcon(shape.color);
    }
    const border = state.isDrawnOpaque
        ? getContourColor(shape.color)
        : "transparent";
    const dotStyle = `background-color: ${shape.color}; border: 2px solid ${border};`;
    return `<span class="item-color-dot" style="${dotStyle}"></span>`;
}

/**
 * Smoothly moves the camera to the given shape without opening any popup.
 */
function focusShape(shape: TrackedShape): void {
    const map = state.map;
    if (!map) return;

    if (shape.layer instanceof L.Marker) {
        map.flyTo(shape.layer.getLatLng(), Math.max(map.getZoom(), 19), {
            duration: 1.0,
        });
        showToast(shape.name);
        return;
    }

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

function createShapeCard(shape: TrackedShape): HTMLElement {
    const card = document.createElement("div");
    card.className = "drawn-item-card";

    const safeName = escapeHtml(shape.name);
    card.innerHTML = `
        <div class="item-left">
            ${renderShapeIcon(shape)}
            <div class="item-info">
                <span class="item-title" title="${safeName}">${safeName}</span>
            </div>
        </div>
        <div class="item-actions">
            <button type="button" class="item-btn focus-btn" title="ობიექტის ნახვა რუკაზე">${FOCUS_ICON_SVG}</button>
            <button type="button" class="item-btn copy-btn" title="GeoJSON-ის კოპირება">${COPY_ICON_SVG}</button>
            <button type="button" class="item-btn danger delete-btn" title="წაშლა">${DELETE_ICON_SVG}</button>
        </div>
    `;

    const bindAction = (selector: string, handler: () => void) =>
        card.querySelector(selector)?.addEventListener("click", handler);

    bindAction(".focus-btn", () => focusShape(shape));
    bindAction(".copy-btn", () => copySingleShapeGeoJson(shape.id));
    bindAction(".delete-btn", () => deleteTrackedShape(shape.id));

    return card;
}

/**
 * Re-renders the sidebar list of marked territories.
 */
export function renderShapesList(): void {
    const emptyState = byId("empty-drawn-state");
    const listContainer = byId("drawn-objects-list");
    const batchActions = byId("drawn-batch-actions");
    if (!emptyState || !listContainer || !batchActions) return;

    const hasShapes = trackedShapes.size > 0;
    emptyState.style.display = hasShapes ? "none" : "flex";
    listContainer.style.display = hasShapes ? "flex" : "none";
    batchActions.style.display = hasShapes ? "flex" : "none";

    listContainer.innerHTML = "";
    trackedShapes.forEach((shape) => {
        listContainer.appendChild(createShapeCard(shape));
    });
}
