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
        fillOpacity: opaque ? 1.0 : 0.1,
        fill: true,
        dashArray: opaque ? undefined : "6, 6",
        lineCap: "round",
        lineJoin: "round",
    };
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
