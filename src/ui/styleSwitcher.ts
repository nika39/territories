import {
    GOOGLE_STYLE_FILTERED,
    GOOGLE_STYLE_FULL,
    MAPTILER_STYLE_FILTERED,
    MAPTILER_STYLE_FULL,
    YANDEX_STYLE_NEW,
    YANDEX_STYLE_OLD,
} from "../config/constants";
import {
    getActiveMaptilerLayer,
    googleStreetLayer,
    setActiveMaptilerStyle,
    yandexLayer,
} from "../map/providers";
import type { LabelStyleMode } from "../state";
import { state } from "../state";
import { byId } from "../utils/dom";
import { showToast } from "./toast";

/**
 * Describes a map provider that exposes selectable tile styles for label modes.
 */
interface StyleProviderConfig {
    prefix: "yandex" | "google" | "maptiler";
    /** Provider id as used by `data-provider` and the `layers` record. */
    providerKey: "yandex" | "google-street" | "maptiler";
    dataAttr: "data-yandex-style" | "data-google-style" | "data-maptiler-style";
    title: string;
    styleKeyByMode: Record<LabelStyleMode, string>;
    applyStyle: (mode: LabelStyleMode) => void;
}

const YANDEX_URLS: Record<string, string> = {
    old: YANDEX_STYLE_OLD,
    new: YANDEX_STYLE_NEW,
};

const GOOGLE_URLS: Record<string, string> = {
    full: GOOGLE_STYLE_FULL,
    filtered: GOOGLE_STYLE_FILTERED,
};

const MAPTILER_URLS: Record<string, string> = {
    full: MAPTILER_STYLE_FULL,
    filtered: MAPTILER_STYLE_FILTERED,
};

const STYLE_PROVIDERS: StyleProviderConfig[] = [
    {
        prefix: "yandex",
        providerKey: "yandex",
        dataAttr: "data-yandex-style",
        title: "Yandex",
        styleKeyByMode: {
            all: "old",
            filtered: "new",
        },
        applyStyle: (mode) => {
            const key = mode === "filtered" ? "new" : "old";
            yandexLayer.setUrl(YANDEX_URLS[key]);
        },
    },
    {
        prefix: "google",
        providerKey: "google-street",
        dataAttr: "data-google-style",
        title: "Google Maps",
        styleKeyByMode: {
            all: "full",
            filtered: "filtered",
        },
        applyStyle: (mode) => {
            const key = mode === "filtered" ? "filtered" : "full";
            googleStreetLayer.setUrl(GOOGLE_URLS[key]);
        },
    },
    {
        prefix: "maptiler",
        providerKey: "maptiler",
        dataAttr: "data-maptiler-style",
        title: "MapTiler",
        styleKeyByMode: {
            all: "full",
            filtered: "filtered",
        },
        applyStyle: (mode) => {
            const key = mode === "filtered" ? "filtered" : "full";
            const styleId = MAPTILER_URLS[key];
            setActiveMaptilerStyle(styleId);
            if (state.currentProvider === "maptiler") {
                getActiveMaptilerLayer()?.setStyle(styleId);
            }
        },
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
 * Updates the shared label style mode across all providers, syncing
 * their layers and their corresponding switcher UI controls.
 */
export function setLabelStyleMode(
    mode: LabelStyleMode,
    notifyProviderKey?: string,
): void {
    state.labelStyleMode = mode;

    STYLE_PROVIDERS.forEach((cfg) => {
        const styleKey = cfg.styleKeyByMode[mode];
        cfg.applyStyle(mode);

        const activeBtn = document.querySelector<HTMLElement>(
            `.${cfg.prefix}-style-btn[${cfg.dataAttr}="${styleKey}"]`,
        );

        // 1. Toggle active state on buttons
        document.querySelectorAll(`.${cfg.prefix}-style-btn`).forEach((btn) => {
            btn.classList.toggle("active", btn === activeBtn);
        });

        // 2. Derive badge label directly from button text
        const badge = byId(`${cfg.prefix}-style-badge`);
        const label = activeBtn
            ?.querySelector("span:not(.dot)")
            ?.textContent?.trim();
        if (badge && label) {
            badge.textContent = label;
        }

        // 3. Derive toast notification if this is the active provider being notified
        if (notifyProviderKey === cfg.providerKey && activeBtn) {
            const titleText = activeBtn.getAttribute("title");
            if (titleText) {
                showToast(`${cfg.title}: ${titleText}`);
            }
        }
    });
}

/**
 * Sets up the style toggle buttons for every provider that supports styles.
 */
export function setupStyleSwitchers(): void {
    // Synchronize all providers and switcher UI to the initial state
    setLabelStyleMode(state.labelStyleMode);
    updateStyleSwitcherVisibility(state.currentProvider);

    STYLE_PROVIDERS.forEach((cfg) => {
        document.querySelectorAll(`.${cfg.prefix}-style-btn`).forEach((btn) => {
            btn.addEventListener("click", () => {
                const style = btn.getAttribute(cfg.dataAttr);
                if (!style) return;

                const mode: LabelStyleMode =
                    style === cfg.styleKeyByMode.filtered ? "filtered" : "all";

                if (
                    mode === state.labelStyleMode &&
                    state.currentProvider === cfg.providerKey
                ) {
                    return;
                }

                setLabelStyleMode(mode, cfg.providerKey);

                if (state.currentProvider !== cfg.providerKey) {
                    activateProvider(cfg.providerKey);
                }
            });
        });
    });
}
