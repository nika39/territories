import { TOAST_DURATION_MS } from "../config/constants";
import { byId } from "../utils/dom";

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Displays a sleek temporary toast for visual feedback.
 */
export function showToast(message: string): void {
    let toast = byId("map-status-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "map-status-toast";
        toast.className = "map-status-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    toastTimeout = setTimeout(() => {
        toast?.classList.remove("visible");
    }, TOAST_DURATION_MS);
}
