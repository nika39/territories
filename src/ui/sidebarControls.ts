import { exportAllDrawnGeoJson } from "../drawing/geojsonExport";
import { setActiveDrawColor } from "../drawing/drawingOptions";
import { deleteAllTrackedShapes, trackedShapes } from "../drawing/shapeRegistry";
import { downloadMap4KImage } from "../map/exportMap";
import { state } from "../state";

/**
 * Sets up the color picker chips in the sidebar.
 */
function setupColorChips(): void {
    const chips = document.querySelectorAll(
        "#drawing-color-chips .color-chip",
    );

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            const color = chip.getAttribute("data-color");
            if (!color) return;

            setActiveDrawColor(color);

            chips.forEach((c) => c.classList.toggle("active", c === chip));
        });
    });
}

/**
 * Sets up sidebar buttons and tools for Geoman (colors, export, clear all).
 */
export function setupGeomanSidebarControls(): void {
    setupColorChips();

    document
        .getElementById("btn-export-drawn-geojson")
        ?.addEventListener("click", exportAllDrawnGeoJson);

    document
        .getElementById("btn-clear-all-drawn")
        ?.addEventListener("click", () => {
            if (trackedShapes.size === 0) return;
            if (confirm("ნამდვილად გსურთ ყველა მონიშნული ტერიტორიის წაშლა?")) {
                deleteAllTrackedShapes();
                state.preservedDrawnGeoJson = null;
            }
        });

    document
        .getElementById("btn-download-4k-map")
        ?.addEventListener("click", () => {
            downloadMap4KImage();
        });
}
