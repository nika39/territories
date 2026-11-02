import type L from "leaflet";
import { DEFAULT_DRAW_COLOR, DEFAULT_PROVIDER } from "./config/constants";

export type LabelStyleMode = "all" | "filtered";

/**
 * Shared mutable application state.
 * Kept in a single object so that every module reads/writes the same
 * live values (ES module `let` exports cannot be reassigned from outside).
 */
export interface AppState {
    map: L.Map | null;
    currentProvider: string;
    labelStyleMode: LabelStyleMode;
    isUiHidden: boolean;
    drawnItemsGroup: L.FeatureGroup | null;
    activeDrawColor: string;
    isSnappingEnabled: boolean;
    isSolidLines: boolean;
    isDrawnOpaque: boolean;
    isCanvaFrameActive: boolean;
    preservedDrawnGeoJson: GeoJSON.FeatureCollection | null;
}

export const state: AppState = {
    map: null,
    currentProvider: DEFAULT_PROVIDER,
    labelStyleMode: "filtered",
    isUiHidden: false,
    drawnItemsGroup: null,
    activeDrawColor: DEFAULT_DRAW_COLOR,
    isSnappingEnabled: true,
    isSolidLines: false,
    isCanvaFrameActive: false,
    get isDrawnOpaque() {
        return this.isSolidLines;
    },
    set isDrawnOpaque(val: boolean) {
        this.isSolidLines = val;
    },
    preservedDrawnGeoJson: null,
};
