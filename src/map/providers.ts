import L from "leaflet";
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import {
    GOOGLE_STYLE_FULL,
    MAPTILER_STYLE_FULL,
    YANDEX_STYLE_OLD,
} from "../config/constants";

const maptilerApiKey: string = process.env.MAPTILER_API_KEY || "";

let activeMaptilerLayer: InstanceType<typeof MaptilerLayer> | null = null;
let currentMaptilerStyle: string = MAPTILER_STYLE_FULL;

export function getActiveMaptilerLayer(): InstanceType<typeof MaptilerLayer> | null {
    return activeMaptilerLayer;
}

export function getActiveMaptilerStyle(): string {
    return currentMaptilerStyle;
}

export function setActiveMaptilerStyle(styleId: string): void {
    currentMaptilerStyle = styleId;
}

export function createMaptilerLayer(styleId?: string): InstanceType<typeof MaptilerLayer> {
    const style = styleId ?? currentMaptilerStyle;
    activeMaptilerLayer = new MaptilerLayer({
        apiKey: maptilerApiKey,
        style,
    });
    return activeMaptilerLayer;
}

export const googleStreetLayer = L.tileLayer(GOOGLE_STYLE_FULL, {
    maxZoom: 21,
    attribution: "&copy; Google",
});

export const yandexLayer = L.tileLayer(YANDEX_STYLE_OLD, {
    maxZoom: 20,
    attribution: "&copy; Yandex",
});

/**
 * Tile layers keyed by provider id (matches `data-provider` in the markup).
 * `maptiler` creates a fresh instance each time to avoid reusing destroyed WebGL contexts.
 */
export const layers: Record<string, L.Layer> = {
    get maptiler() {
        return createMaptilerLayer();
    },
    "google-street": googleStreetLayer,
    yandex: yandexLayer,
};

export function getLayerForProvider(provider: string): L.Layer | null {
    if (provider === "maptiler") {
        return createMaptilerLayer();
    }
    return layers[provider] ?? null;
}

/**
 * Yandex tiles use Elliptical Mercator (EPSG:3395), the rest Spherical Mercator.
 */
export function getCrsForProvider(provider: string): L.CRS {
    return provider === "yandex" ? L.CRS.EPSG3395 : L.CRS.EPSG3857;
}
