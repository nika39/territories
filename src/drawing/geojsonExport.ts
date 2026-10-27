import { trackedShapes } from "./shapeRegistry";
import type { TrackedShape } from "../types";
import { showToast } from "../ui/toast";
import { copyToClipboard } from "../utils/clipboard";

/**
 * Converts an internal TrackedShape into a standardized GeoJSON Feature with properties.
 */
export function shapeToGeoJsonFeature(shape: TrackedShape): GeoJSON.Feature {
    const feat = shape.layer.toGeoJSON();
    feat.properties = {
        id: shape.id,
        name: shape.name,
        shapeType: shape.shapeType,
        color: shape.color,
        area: shape.area,
        perimeter: shape.perimeter,
    };
    return feat;
}

/**
 * Builds a FeatureCollection out of all currently tracked shapes.
 */
export function buildFeatureCollection(): GeoJSON.FeatureCollection {
    return {
        type: "FeatureCollection",
        features: Array.from(trackedShapes.values()).map(
            shapeToGeoJsonFeature,
        ),
    };
}

/**
 * Copies GeoJSON feature of a single marked shape to clipboard.
 */
export async function copySingleShapeGeoJson(id: string): Promise<void> {
    const shape = trackedShapes.get(id);
    if (!shape) return;

    const text = JSON.stringify(shapeToGeoJsonFeature(shape), null, 2);
    const copied = await copyToClipboard(text);
    showToast(
        copied ? `${shape.name}-ს GeoJSON დაკოპირდა` : "კოპირება ვერ მოხერხდა",
    );
}

/**
 * Exports all drawn shapes into GeoJSON format and copies to clipboard.
 */
export async function exportAllDrawnGeoJson(): Promise<void> {
    if (trackedShapes.size === 0) {
        showToast("მონიშნული ტერიტორიები არ არის");
        return;
    }

    const text = JSON.stringify(buildFeatureCollection(), null, 2);
    const copied = await copyToClipboard(text);
    showToast(
        copied ? "GeoJSON დაკოპირდა ბუფერში" : "GeoJSON კოპირება ვერ მოხერხდა",
    );
}
