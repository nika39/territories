import L from "leaflet";
import type { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import { buildFeatureCollection } from "../drawing/geojsonExport";
import { setupGeomanOnMap } from "../drawing/geomanSetup";
import { trackedShapes } from "../drawing/shapeRegistry";
import { updatePinScale } from "../drawing/styles";
import { state } from "../state";
import { attachCoordinatesToMap } from "../ui/coordinatesPanel";
import { hideAppLoader } from "../ui/loader";
import { applyUiVisibility } from "../ui/uiVisibility";
import { getLayerForProvider } from "./providers";

/**
 * Snapshots drawn shapes so they survive the destruction of the map instance.
 */
function preserveDrawnShapes(): void {
    state.preservedDrawnGeoJson =
        trackedShapes.size > 0 ? buildFeatureCollection() : null;
}

/**
 * Configures MapTiler SDK map instance to gracefully handle missing sprite icons
 * and work around SDK teardown bugs when Leaflet destroys the map.
 */
function configureMaptilerSdkMap(
    maptilerLayer: InstanceType<typeof MaptilerLayer>,
): void {
    const maptilerMap = maptilerLayer.getMaptilerSDKMap();
    if (!maptilerMap) return;

    // Ensure high-DPI rendering from the start
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (maptilerMap as any).setPixelRatio === "function") {
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (maptilerMap as any).setPixelRatio(dpr);
    }

    // 1. Transparent 1x1 fallback pixel to prevent console errors for missing POI icons in custom sprite
    const transparentPixel = {
        width: 1,
        height: 1,
        data: new Uint8Array(4),
    };
    maptilerMap.on("styleimagemissing", (e: { id: string }) => {
        if (e?.id && !maptilerMap.hasImage(e.id)) {
            maptilerMap.addImage(e.id, transparentPixel);
        }
    });

    // 2. Teardown bug workaround: MapLibre's remove() calls this.setStyle(null).
    // MapTiler SDK's setStyle wrapper doesn't guard against null/empty style, falling back
    // to deprecated "Streets Default v2" and logging "[Map.setStyle]: Invalid style".
    // We delegate null style teardown directly to MapLibre's prototype setStyle.
    const parentProto = Object.getPrototypeOf(
        Object.getPrototypeOf(maptilerMap),
    );
    const maplibreSetStyle = parentProto?.setStyle;
    const originalSetStyle = maptilerMap.setStyle.bind(maptilerMap);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (maptilerMap as any).setStyle = (style: any, options?: any) => {
        if (!style && maplibreSetStyle) {
            return maplibreSetStyle.call(maptilerMap, null, options);
        }
        return originalSetStyle(style, options);
    };
}

/**
 * Recreates the Leaflet map instance with the appropriate CRS projection.
 */
export function recreateMap(
    crs: L.CRS,
    center: L.LatLngTuple,
    zoom: number,
    provider: string,
): void {
    if (state.map) {
        preserveDrawnShapes();
        state.map.remove();
    }

    state.currentProvider = provider;

    const isMaptiler = provider === "maptiler";
    const targetZoom = isMaptiler ? zoom : Math.round(zoom);

    const map = L.map("map-container", {
        center,
        zoom: targetZoom,
        zoomControl: false,
        attributionControl: true,
        crs,
        maxZoom: 22,
        zoomSnap: isMaptiler ? 0.5 : 1,
        zoomDelta: isMaptiler ? 0.5 : 1,
        zoomAnimation: !isMaptiler,
    });
    state.map = map;

    // Synchronize pin scale with current zoom level
    updatePinScale(map);
    map.on("zoom zoomend viewreset", () => updatePinScale(map));

    // Ensure UI visibility class remains consistent on body
    applyUiVisibility();

    // Attach selected layer
    const layer = getLayerForProvider(provider);
    if (layer) {
        layer.addTo(map);

        if (isMaptiler) {
            configureMaptilerSdkMap(
                layer as InstanceType<typeof MaptilerLayer>,
            );
            layer.once("ready", hideAppLoader);
        } else {
            // Hide loader overlay once tiles are loaded
            layer.on("load", hideAppLoader);
        }
    }

    // Initialize Geoman on the newly created map
    setupGeomanOnMap(map);

    // Track real-time coordinates and zoom on the sidebar
    attachCoordinatesToMap(map);
}
