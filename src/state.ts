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
    isDrawnOpaque: boolean;
    preservedDrawnGeoJson: GeoJSON.FeatureCollection | null;
}

export const state: AppState = {
    map: null,
    currentProvider: DEFAULT_PROVIDER,
    labelStyleMode: "all",
    isUiHidden: false,
    drawnItemsGroup: null,
    activeDrawColor: DEFAULT_DRAW_COLOR,
    isSnappingEnabled: true,
    isDrawnOpaque: false,
    preservedDrawnGeoJson: null,
};
