import L from "leaflet";
import { CONTOUR_COLOR_PAIRS } from "../config/constants";
import { state } from "../state";
import { renderMapPinHtml } from "../ui/icons";
import { darkenHexColor } from "../utils/color";

/**
 * Returns a UI specialist curated, slightly more prominent / deeper contour tone
 * of the inner fill color when opaque mode is enabled.
 * If opaque mode is disabled, the contour matches the fill color.
 */
export function getContourColor(fillColor: string): string {
    if (!state.isDrawnOpaque) return fillColor;
    const curated = CONTOUR_COLOR_PAIRS[fillColor.toLowerCase()];
    return curated ?? darkenHexColor(fillColor, 0.32);
}

export function getGeomanPathOptions(
    color = state.activeDrawColor,
): L.PathOptions {
    const opaque = state.isDrawnOpaque;
    return {
        color: getContourColor(color),
        weight: opaque ? 3 : 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: opaque ? 1.0 : 0.15,
        fill: true,
        dashArray: opaque ? undefined : "6, 6",
        lineCap: "round",
        lineJoin: "round",
    };
}

/**
 * Reference zoom level at which the pin marker has natural 100% scale (49x63px).
 */
export const PIN_REFERENCE_ZOOM = 19;
export const PIN_ZOOM_FACTOR = 1.22;
export const PIN_MIN_SCALE = 0.16;
export const PIN_MAX_SCALE = 1.05;

/**
 * Calculates a smooth, perceptually balanced pin scale factor for a given map zoom level.
 *
 * Zoom mapping:
 * - Zoom >= 19: Full size (1.0 - 1.05) - perfect for rooftop building inspection.
 * - Zoom 16: ~0.55 (initial map zoom) - nicely proportioned for street/neighborhood blocks.
 * - Zoom 14: ~0.37 - compact city district pin.
 * - Zoom 12: ~0.25 - clean metropolitan dot.
 * - Zoom <= 10: 0.16 (clamped floor) - visible pinpoint, never dominates regional map.
 */
export function getPinScaleForZoom(zoom: number): number {
    const rawScale = Math.pow(PIN_ZOOM_FACTOR, zoom - PIN_REFERENCE_ZOOM);
    return Math.min(PIN_MAX_SCALE, Math.max(PIN_MIN_SCALE, rawScale));
}

/**
 * Applies the calculated scale for the current map zoom to the map container and root document.
 */
export function updatePinScale(map?: L.Map): void {
    const currentMap = map || state.map;
    if (!currentMap) return;
    const zoom = currentMap.getZoom();
    const scale = getPinScaleForZoom(zoom);
    const scaleStr = scale.toFixed(3);
    document.documentElement.style.setProperty("--pin-scale", scaleStr);
    currentMap.getContainer()?.style.setProperty("--pin-scale", scaleStr);
}

/**
 * Creates custom high-visibility vector SVG pin marker icon.
 */
export function createPinIcon(color = state.activeDrawColor): L.DivIcon {
    return L.divIcon({
        className: "building-pin-wrapper",
        html: renderMapPinHtml(color),
        iconSize: [49, 63],
        iconAnchor: [24.5, 59],
    });
}

/**
 * Geoman global options that depend on the active color / opaque mode
 * (drawing guide lines, polygon style and pin marker style).
 */
export function getDrawingStyleOptions(): Partial<L.PM.GlobalOptions> {
    const color = state.activeDrawColor;
    const contour = getContourColor(color);
    return {
        snappable: state.isSnappingEnabled,
        templineStyle: {
            color: contour,
            weight: state.isDrawnOpaque ? 3 : 2,
            dashArray: state.isDrawnOpaque ? undefined : [6, 6],
        },
        hintlineStyle: {
            color: contour,
            dashArray: [5, 5],
        },
        pathOptions: getGeomanPathOptions(color),
        markerStyle: {
            icon: createPinIcon(color),
            draggable: true,
        },
    };
}
