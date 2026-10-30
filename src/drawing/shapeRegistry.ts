import L from "leaflet";
import { state } from "../state";
import type { ShapeType, TrackedShape } from "../types";
import { showToast } from "../ui/toast";
import { measurePolygon } from "../utils/geometry";
import { createPinIcon, getGeomanPathOptions } from "./styles";

export const trackedShapes = new Map<string, TrackedShape>();

// ----------------------------------------------------------------------------
// Change notifications (decouples the registry from the sidebar UI)
// ----------------------------------------------------------------------------

type ShapesListener = () => void;
const listeners = new Set<ShapesListener>();

/**
 * Subscribes to any change of the tracked shapes collection.
 * Returns an unsubscribe function.
 */
export function onShapesChanged(listener: ShapesListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function notifyShapesChanged(): void {
    listeners.forEach((listener) => listener());
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

const POLYGON_NAME_REGEX = /^ტერიტორია #\d+$/;
const PIN_NAME_REGEX = /^პინი #\d+$/;

function generateShapeId(prefix: string, existingId?: string): string {
    if (existingId && !trackedShapes.has(existingId)) return existingId;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function addToDrawnGroup(layer: L.Layer): void {
    const group = state.drawnItemsGroup;
    if (group && !group.hasLayer(layer)) {
        group.addLayer(layer);
    }
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
            if (!shape.name || PIN_NAME_REGEX.test(shape.name)) {
                shape.name = `პინი #${pinIdx}`;
            }
            pinIdx++;
        } else {
            if (!shape.name || POLYGON_NAME_REGEX.test(shape.name)) {
                shape.name = `ტერიტორია #${polyIdx}`;
            }
            polyIdx++;
        }
    }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Registers a newly created or restored polygon layer in the tracking system.
 */
export function registerDrawnLayer(
    layer: L.Polygon,
    shapeType: Exclude<ShapeType, "Marker">,
    existingId?: string,
    customColor?: string,
    customName?: string,
): TrackedShape {
    const id = generateShapeId("bld", existingId);
    const color = customColor || state.activeDrawColor;

    layer.setStyle(getGeomanPathOptions(color));
    layer.options.snapIgnore = !state.isSnappingEnabled;
    layer.pm?.setOptions({ snappable: state.isSnappingEnabled });

    const shape: TrackedShape = {
        id,
        layer,
        shapeType,
        name: customName || `ტერიტორია #${trackedShapes.size + 1}`,
        ...measurePolygon(layer),
        color,
    };

    trackedShapes.set(id, shape);
    addToDrawnGroup(layer);

    // Always maintain clean sequential numbering (1, 2, 3...)
    reindexTrackedShapes();

    // Update measurements on edit, drag or rotate (no popups)
    const refreshMeasurements = () => {
        Object.assign(shape, measurePolygon(layer));
        notifyShapesChanged();
    };
    layer.on("pm:edit", refreshMeasurements);
    layer.on("pm:dragend", refreshMeasurements);
    layer.on("pm:rotateend", refreshMeasurements);

    notifyShapesChanged();
    return shape;
}

/**
 * Registers a newly created or restored building marker (Pin) in the tracking system.
 */
export function registerDrawnMarker(
    marker: L.Marker,
    customColor?: string,
    existingId?: string,
    customName?: string,
): TrackedShape {
    const id = generateShapeId("pin", existingId);
    const color = customColor || state.activeDrawColor;

    marker.setIcon(createPinIcon(color));
    marker.dragging?.enable();
    marker.options.snapIgnore = !state.isSnappingEnabled;
    marker.pm?.setOptions({ snappable: state.isSnappingEnabled });

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
    addToDrawnGroup(marker);
    reindexTrackedShapes();

    // Right-click directly on pin deletes it immediately
    marker.on("contextmenu", (e) => {
        L.DomEvent.stopPropagation(e);
        deleteTrackedShape(id);
    });

    marker.on("dragend", notifyShapesChanged);

    notifyShapesChanged();
    return shape;
}

/**
 * Deletes a tracked shape by ID and reindexes remaining shapes.
 */
export function deleteTrackedShape(id: string, notify = true): void {
    const shape = trackedShapes.get(id);
    if (!shape) return;

    const deletedName = shape.name;

    state.drawnItemsGroup?.removeLayer(shape.layer);
    if (state.map?.hasLayer(shape.layer)) {
        state.map.removeLayer(shape.layer);
    }

    trackedShapes.delete(id);
    reindexTrackedShapes();
    notifyShapesChanged();

    if (notify) {
        showToast(`${deletedName} წაიშალა`);
    }

    // Automatically exit removal mode if active
    if (state.map?.pm?.globalRemovalModeEnabled()) {
        state.map.pm.disableGlobalRemovalMode();
    }
}

/**
 * Updates the color of an existing tracked shape and refreshes its layer on the map.
 */
export function updateShapeColor(id: string, newColor: string): void {
    const shape = trackedShapes.get(id);
    if (!shape) return;

    if (shape.color.toLowerCase() === newColor.toLowerCase()) {
        showToast(`${shape.name} უკვე ამ ფერისაა`);
        return;
    }

    shape.color = newColor;

    if (shape.layer instanceof L.Polygon) {
        shape.layer.setStyle(getGeomanPathOptions(newColor));
    } else if (shape.layer instanceof L.Marker) {
        shape.layer.setIcon(createPinIcon(newColor));
    }

    notifyShapesChanged();
    showToast(`${shape.name}-ს ფერი შეიცვალა`);
}

/**
 * Deletes every tracked shape without per-item notifications.
 */
export function deleteAllTrackedShapes(): void {
    Array.from(trackedShapes.keys()).forEach((id) =>
        deleteTrackedShape(id, false),
    );
}
