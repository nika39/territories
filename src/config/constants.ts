import type { LatLngTuple } from "leaflet";

// Tbilisi initial coordinates
export const INITIAL_CENTER: LatLngTuple = [41.677763, 44.848284];
export const INITIAL_ZOOM = 16;

export const DEFAULT_PROVIDER = "maptiler";
export const DEFAULT_DRAW_COLOR = "#007aff";

export const TOAST_DURATION_MS = 1800;
export const LOADER_FALLBACK_MS = 3000;

export const MAPTILER_STYLE_FULL = "01a120ea-26f0-7a1d-b08e-4c63cf192ffd";
export const MAPTILER_STYLE_FILTERED = "01a183f3-3273-7288-9476-f489410fc9de";
export const MAPTILER_STYLE_ID = MAPTILER_STYLE_FULL;

// ----------------------------------------------------------------------------
// Google Maps tile styles
// ----------------------------------------------------------------------------

const GOOGLE_BASE_URL =
    "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ka";

export const GOOGLE_STYLE_FULL = GOOGLE_BASE_URL;

export const GOOGLE_STYLE_FILTERED = `${GOOGLE_BASE_URL}&apistyle=s.t:2|p.v:off,s.t:4|p.v:on`;

// ----------------------------------------------------------------------------
// Yandex tile styles (rules are joined with `~` inside a single `style=` param)
// ----------------------------------------------------------------------------

const YANDEX_BASE_URL =
    "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=";

const YANDEX_HIDE_ROAD_ICONS_RULE =
    "tags.any:road|tags.none:road_1|tags.none:road_2|tags.none:road_3|tags.none:road_4|tags.none:road_5|tags.none:road_6|tags.none:road_7|elements:label.icon|stylers.visibility:off";

function buildYandexStyleUrl(rules: string[]): string {
    return YANDEX_BASE_URL + rules.join("~");
}

export const YANDEX_STYLE_OLD = buildYandexStyleUrl([
    "tags.any:commercial_services|stylers.visibility:off",
    "tags.any:entrance|stylers.visibility:off",
    YANDEX_HIDE_ROAD_ICONS_RULE,
]);

export const YANDEX_STYLE_NEW = buildYandexStyleUrl([
    "tags.any:poi|tags.none:parking|tags.none:cemetery|stylers.visibility:off",
    "tags.any:entrance|stylers.visibility:off",
    "tags.any:food_and_drink|tags.any:shopping|tags.any:commercial_services|stylers.visibility:off",
    YANDEX_HIDE_ROAD_ICONS_RULE,
]);
