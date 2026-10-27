import { state } from "../state";
import { byId } from "../utils/dom";
import { showToast } from "../ui/toast";
import { getDrawingStyleOptions, getGeomanPathOptions } from "./styles";
import { notifyShapesChanged, trackedShapes } from "./shapeRegistry";
import L from "leaflet";

/**
 * Pushes the current color / opaque-mode dependent style to Geoman,
 * so that future drawings pick it up.
 */
export function applyDrawingStyleToMap(): void {
    state.map?.pm.setGlobalOptions(getDrawingStyleOptions());
}

/**
 * Changes the active drawing color and synchronizes Geoman options.
 */
export function setActiveDrawColor(color: string): void {
    state.activeDrawColor = color;
    applyDrawingStyleToMap();
}

/**
 * Toggles opaque fill mode for marked shapes and synchronizes toolbar & map styles.
 */
export function toggleDrawnOpaque(): void {
    state.isDrawnOpaque = !state.isDrawnOpaque;

    // Update button active state on the on-map toolbar
    byId("map-btn-opaque-container")?.classList.toggle(
        "active",
        state.isDrawnOpaque,
    );

    // Update all existing tracked polygons on map
    for (const shape of trackedShapes.values()) {
        if (shape.layer instanceof L.Polygon) {
            shape.layer.setStyle(getGeomanPathOptions(shape.color));
        }
    }

    // Update global options for future drawings
    applyDrawingStyleToMap();
    notifyShapesChanged();

    showToast(
        state.isDrawnOpaque
            ? "შიგთავსი: გაუმჭვირვალე (კონტური გამოკვეთილია)"
            : "შიგთავსი: გამჭვირვალე (0.15)",
    );
}

/**
 * Toggles snapping mode for Geoman drawing tools and updates toolbar button state.
 */
export function toggleSnapping(): void {
    state.isSnappingEnabled = !state.isSnappingEnabled;

    byId("map-btn-snapping-container")?.classList.toggle(
        "active",
        state.isSnappingEnabled,
    );

    state.map?.pm.setGlobalOptions({ snappable: state.isSnappingEnabled });

    showToast(
        state.isSnappingEnabled
            ? "მიბმა (Snapping): ჩართულია"
            : "მიბმა (Snapping): გამორთულია",
    );
}
