import type L from "leaflet";
import {
    GOOGLE_STYLE_FILTERED,
    GOOGLE_STYLE_FULL,
    YANDEX_STYLE_NEW,
    YANDEX_STYLE_OLD,
} from "../config/constants";
import { googleStreetLayer, yandexLayer } from "../map/providers";
import { state } from "../state";
import { byId } from "../utils/dom";
import { showToast } from "./toast";

/**
 * Describes a map provider that exposes several selectable tile styles.
 */
interface StyleProviderConfig {
    prefix: "yandex" | "google";
    /** Provider id as used by `data-provider` and the `layers` record. */
    providerKey: "yandex" | "google-street";
    dataAttr: "data-yandex-style" | "data-google-style";
    title: string;
    layer: L.TileLayer;
    /** Tile URL for each selectable style. */
    urls: Record<string, string>;
    activeStyle: string;
}

const STYLE_PROVIDERS: StyleProviderConfig[] = [
    {
        prefix: "yandex",
        providerKey: "yandex",
        dataAttr: "data-yandex-style",
        title: "Yandex",
        layer: yandexLayer,
        urls: { old: YANDEX_STYLE_OLD, new: YANDEX_STYLE_NEW },
        activeStyle: "old",
    },
    {
        prefix: "google",
        providerKey: "google-street",
        dataAttr: "data-google-style",
        title: "Google Maps",
        layer: googleStreetLayer,
        urls: { full: GOOGLE_STYLE_FULL, filtered: GOOGLE_STYLE_FILTERED },
        activeStyle: "full",
    },
];

/**
 * Shows only the style switcher that belongs to the given provider.
 */
export function updateStyleSwitcherVisibility(provider: string): void {
    STYLE_PROVIDERS.forEach((cfg) => {
        const el = byId(`${cfg.prefix}-style-switcher`);
        if (el) {
            el.style.display = cfg.providerKey === provider ? "block" : "none";
        }
    });
}

/**
 * Synchronizes the style switcher UI (active button, badge text, and toast notification)
 * using the HTML DOM elements as the single source of truth.
 */
function syncStyleSwitcherUi(cfg: StyleProviderConfig, style: string): void {
    const activeBtn = document.querySelector<HTMLElement>(
        `.${cfg.prefix}-style-btn[${cfg.dataAttr}="${style}"]`,
    );

    // 1. Toggle active state on buttons
    document.querySelectorAll(`.${cfg.prefix}-style-btn`).forEach((btn) => {
        btn.classList.toggle("active", btn === activeBtn);
    });

    if (!activeBtn) return;

    // 2. Derive badge label directly from button text
    const badge = byId(`${cfg.prefix}-style-badge`);
    const label = activeBtn
        .querySelector("span:not(.dot)")
        ?.textContent?.trim();
    if (badge && label) {
        badge.textContent = label;
    }

    // 3. Derive toast notification directly from button title
    const titleText = activeBtn.getAttribute("title");
    if (titleText) {
        showToast(`${cfg.title}: ${titleText}`);
    }
}

/**
 * Switches the map to the given provider by clicking its switcher button.
 */
function activateProvider(providerKey: string): void {
    document
        .querySelector<HTMLButtonElement>(
            `.switcher-btn[data-provider="${providerKey}"]`,
        )
        ?.click();
}

/**
 * Applies a tile style to its provider layer and updates the UI.
 */
function switchStyle(cfg: StyleProviderConfig, style: string): void {
    if (
        cfg.activeStyle === style &&
        state.currentProvider === cfg.providerKey
    ) {
        return;
    }
    cfg.activeStyle = style;

    cfg.layer.setUrl(cfg.urls[style]);
    syncStyleSwitcherUi(cfg, style);

    // If not currently on this provider, switch the map to it
    if (state.currentProvider !== cfg.providerKey) {
        activateProvider(cfg.providerKey);
    }
}

/**
 * Sets up the style toggle buttons for every provider that supports styles.
 */
export function setupStyleSwitchers(): void {
    updateStyleSwitcherVisibility(state.currentProvider);

    STYLE_PROVIDERS.forEach((cfg) => {
        document.querySelectorAll(`.${cfg.prefix}-style-btn`).forEach((btn) => {
            btn.addEventListener("click", () => {
                const style = btn.getAttribute(cfg.dataAttr);
                if (style && Object.hasOwn(cfg.urls, style)) {
                    switchStyle(cfg, style);
                }
            });
        });
    });
}
