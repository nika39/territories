import L from "leaflet";
import { toCanvas } from "html-to-image";
import {
    EXPORT_CANVA_HEIGHT,
    EXPORT_CANVA_WIDTH,
    EXPORT_TARGET_WIDTH,
} from "../config/constants";
import { state } from "../state";
import { getCanvaFrameRect } from "../ui/canvaFrame";
import { showToast } from "../ui/toast";
import { copyBlobToClipboard } from "../utils/clipboard";
import { getActiveMaptilerLayer } from "./providers";

let isExporting = false;

/** UI chrome living inside the map container that must not end up in the image. */
const EXCLUDED_CLASSES = [
    "leaflet-control-container",
    "maplibregl-control-container",
];

const isExportableNode = (node: HTMLElement): boolean =>
    !(node.classList && EXCLUDED_CLASSES.some((c) => node.classList.contains(c)));

const withTimeout = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves once the active base layer (raster tiles or MapTiler vector canvas)
 * has finished loading, so the snapshot doesn't capture half-loaded tiles.
 */
async function waitForBaseMap(map: L.Map): Promise<void> {
    const pending: Promise<void>[] = [];

    map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer && layer.isLoading()) {
            pending.push(new Promise((r) => layer.once("load", () => r())));
        }
    });

    const maptilerMap = getActiveMaptilerLayer()?.getMaptilerSDKMap?.();
    if (state.currentProvider === "maptiler" && maptilerMap && !maptilerMap.loaded()) {
        pending.push(new Promise((r) => maptilerMap.once("idle", () => r())));
    }

    if (pending.length > 0) {
        await Promise.race([Promise.all(pending), withTimeout(3000)]);
    }
}

/**
 * Copies a crisp high resolution PNG of the current map view (base map, polygons,
 * rectangles and pins) to the system clipboard.
 *
 * The map DOM is rendered as-is by `html-to-image`, so base map and user shapes are
 * guaranteed to stay aligned for every provider - no manual projection math needed.
 */
export async function copyMapImage(): Promise<void> {
    if (isExporting) return;
    const map = state.map;
    if (!map) {
        showToast("რუკა არ არის ინიციალიზებული");
        return;
    }

    const mapContainer = map.getContainer();
    const { clientWidth, clientHeight } = mapContainer;
    if (clientWidth === 0 || clientHeight === 0) return;

    isExporting = true;
    showToast("მაღალი ხარისხის სურათი მზადდება...");

    const copyBtn = document.getElementById("map-btn-copy-4k");
    copyBtn?.classList.add("loading");

    try {
        const frame = state.isCanvaFrameActive
            ? getCanvaFrameRect(clientWidth, clientHeight)
            : null;

        // Output size and the zoom factor between screen pixels and output pixels
        const outWidth = frame ? EXPORT_CANVA_WIDTH : Math.max(
            EXPORT_TARGET_WIDTH,
            Math.round(clientWidth * (window.devicePixelRatio || 1)),
        );
        const pixelRatio = outWidth / (frame ? frame.width : clientWidth);

        await waitForBaseMap(map);

        const full = await toCanvas(mapContainer, {
            pixelRatio,
            backgroundColor: "#f8f9fa",
            filter: isExportableNode,
            skipFonts: true,
            // Yandex tiles differ only by query string (tiles?x=..&y=..); without this
            // html-to-image would cache them under one key and repeat a single tile.
            includeQueryParams: true,
        });

        let result = full;
        if (frame) {
            // Crop the Canva frame region out of the full snapshot
            result = document.createElement("canvas");
            result.width = EXPORT_CANVA_WIDTH;
            result.height = EXPORT_CANVA_HEIGHT;
            result
                .getContext("2d")
                ?.drawImage(
                    full,
                    frame.left * pixelRatio,
                    frame.top * pixelRatio,
                    frame.width * pixelRatio,
                    frame.height * pixelRatio,
                    0,
                    0,
                    EXPORT_CANVA_WIDTH,
                    EXPORT_CANVA_HEIGHT,
                );
        }

        const blob = await new Promise<Blob | null>((resolve) =>
            result.toBlob(resolve, "image/png"),
        );
        if (!blob || !(await copyBlobToClipboard(blob))) {
            throw new Error("Clipboard copy failed");
        }

        showToast(
            frame
                ? `სურათი დაკოპირდა Canva-ს ზომით (${result.width}x${result.height})`
                : `სურათი წარმატებით დაკოპირდა (${result.width}x${result.height})`,
        );
    } catch (err) {
        console.error("Map Export Error:", err);
        showToast("სურათის კოპირება ვერ მოხერხდა");
    } finally {
        isExporting = false;
        copyBtn?.classList.remove("loading");
    }
}
