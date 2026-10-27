import { getCrsForProvider } from "../map/providers";
import { recreateMap } from "../map/mapManager";
import { state } from "../state";
import { updateStyleSwitcherVisibility } from "./styleSwitcher";

/**
 * Sets up map provider switcher behavior.
 */
export function setupMapSwitcher(): void {
    const buttons = document.querySelectorAll(".switcher-btn");
    const subtitle = document.querySelector(".logo-title .sub-title");

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const provider = btn.getAttribute("data-provider") || "osm";
            const map = state.map;
            if (provider === state.currentProvider || !map) return;

            buttons.forEach((b) => b.classList.toggle("active", b === btn));

            const { lat, lng } = map.getCenter();
            recreateMap(
                getCrsForProvider(provider),
                [lat, lng],
                map.getZoom(),
                provider,
            );

            const providerLabel = btn.textContent?.trim();
            if (subtitle && providerLabel) {
                subtitle.textContent = `${providerLabel} ინტეგრაცია`;
            }

            updateStyleSwitcherVisibility(provider);
            state.currentProvider = provider;
        });
    });
}
