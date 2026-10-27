import { state } from "../state";
import { showToast } from "./toast";

/**
 * Applies the current UI visibility flag to the document body.
 */
export function applyUiVisibility(): void {
    document.body.classList.toggle("ui-hidden", state.isUiHidden);
}

/**
 * Toggles visibility of UI overlay elements (Sidebar, Zoom controls, Geoman toolbar, Copyright).
 */
export function toggleUiVisibility(): void {
    state.isUiHidden = !state.isUiHidden;
    applyUiVisibility();
    showToast(
        state.isUiHidden
            ? "ინტერფეისი დამალულია • დააჭირე H-ს გამოსაჩენად"
            : "ინტერფეისი გამოჩენილია",
    );
}
