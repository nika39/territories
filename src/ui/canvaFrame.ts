import { state } from "../state";
import { EXPORT_CANVA_ASPECT_RATIO } from "../config/constants";
import { showToast } from "./toast";

export interface FrameRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/**
 * Calculates the centered bounding box matching the 4384x2880 aspect ratio within the given container.
 */
export function getCanvaFrameRect(
    containerWidth: number,
    containerHeight: number,
): FrameRect {
    if (containerWidth <= 0 || containerHeight <= 0) {
        return {
            left: 0,
            top: 0,
            width: Math.max(0, containerWidth),
            height: Math.max(0, containerHeight),
        };
    }

    const containerAspect = containerWidth / containerHeight;

    if (containerAspect > EXPORT_CANVA_ASPECT_RATIO) {
        // Container is wider than target aspect ratio -> letterbox left and right
        const height = containerHeight;
        const width = Math.round(height * EXPORT_CANVA_ASPECT_RATIO);
        const left = Math.round((containerWidth - width) / 2);
        return { left, top: 0, width, height };
    } else {
        // Container is taller than target aspect ratio -> letterbox top and bottom
        const width = containerWidth;
        const height = Math.round(width / EXPORT_CANVA_ASPECT_RATIO);
        const top = Math.round((containerHeight - height) / 2);
        return { left: 0, top, width, height };
    }
}

/**
 * Updates the position and size of the on-screen Canva guide frame.
 */
export function updateCanvaFramePosition(): void {
    const box = document.getElementById("canva-frame-box");
    const container = document.getElementById("map-container");
    if (!box || !container) return;

    const rect = container.getBoundingClientRect();
    const frame = getCanvaFrameRect(rect.width, rect.height);

    box.style.left = `${frame.left}px`;
    box.style.top = `${frame.top}px`;
    box.style.width = `${frame.width}px`;
    box.style.height = `${frame.height}px`;
}

/**
 * Synchronizes the visibility of the frame and toolbar button state.
 */
export function syncCanvaFrameVisibility(): void {
    const frameContainer = document.getElementById("canva-frame-container");
    if (frameContainer) {
        frameContainer.style.display = state.isCanvaFrameActive ? "block" : "none";
    }

    const btnContainer = document.getElementById("map-btn-canva-frame-container");
    btnContainer?.classList.toggle("active", state.isCanvaFrameActive);

    const copyBtn = document.getElementById("map-btn-copy-4k");
    if (copyBtn) {
        copyBtn.title = state.isCanvaFrameActive
            ? "რუკის კოპირება Canva-სთვის (4384×2880)"
            : "რუკის მაღალი ხარისხით კოპირება (4384px)";
    }

    if (state.isCanvaFrameActive) {
        updateCanvaFramePosition();
    }
}

/**
 * Toggles the Canva Frame mode on or off.
 */
export function toggleCanvaFrame(): void {
    state.isCanvaFrameActive = !state.isCanvaFrameActive;
    syncCanvaFrameVisibility();

    showToast(
        state.isCanvaFrameActive
            ? "Canva ჩარჩო (4384×2880) ჩართულია"
            : "Canva ჩარჩო გამორთულია",
    );
}

/**
 * Sets up resize listeners and initializes the Canva frame guide.
 */
export function setupCanvaFrame(): void {
    window.addEventListener("resize", () => {
        if (state.isCanvaFrameActive) {
            updateCanvaFramePosition();
        }
    });

    syncCanvaFrameVisibility();
}

