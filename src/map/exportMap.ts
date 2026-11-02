import L from "leaflet";
import { EXPORT_TARGET_WIDTH } from "../config/constants";
import { trackedShapes } from "../drawing/shapeRegistry";
import { getPinScaleForZoom } from "../drawing/styles";
import { state } from "../state";
import { showToast } from "../ui/toast";
import { getActiveMaptilerLayer } from "./providers";

let isExporting = false;

/**
 * Normalizes Leaflet Polygon coordinates into an array of polygons,
 * each containing an array of linear rings (ring 0: outer boundary, rings 1+: holes).
 */
function normalizePolygonRings(
    rawLatLngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][],
): L.LatLng[][][] {
    if (!Array.isArray(rawLatLngs) || rawLatLngs.length === 0) return [];

    const first = rawLatLngs[0];
    if (first instanceof L.LatLng || typeof (first as { lat?: unknown })?.lat === "number") {
        return [[rawLatLngs as L.LatLng[]]];
    }

    if (Array.isArray(first)) {
        const firstInner = first[0];
        if (
            firstInner instanceof L.LatLng ||
            typeof (firstInner as { lat?: unknown })?.lat === "number"
        ) {
            return [rawLatLngs as L.LatLng[][]];
        }
        return rawLatLngs as L.LatLng[][][];
    }

    return [];
}

/**
 * Waits for any pending raster tiles currently loading in the DOM to complete.
 */
async function waitForPendingTiles(mapContainer: HTMLElement): Promise<void> {
    const tileElements = Array.from(
        mapContainer.querySelectorAll<HTMLImageElement>(
            ".leaflet-tile-pane img.leaflet-tile",
        ),
    );

    const pending = tileElements
        .filter((img) => !img.complete && img.src)
        .map(
            (img) =>
                new Promise<void>((resolve) => {
                    img.addEventListener("load", () => resolve(), { once: true });
                    img.addEventListener("error", () => resolve(), { once: true });
                    setTimeout(resolve, 1500);
                }),
        );

    if (pending.length > 0) {
        await Promise.all(pending);
    }
}

/**
 * Renders the underlying base map (MapTiler WebGL vector canvas or Google/Yandex raster tiles)
 * onto the target canvas context.
 */
async function renderBaseMap(
    map: L.Map,
    ctx: CanvasRenderingContext2D,
    targetWidth: number,
    targetHeight: number,
    scaleFactor: number,
    offsetX: number,
    offsetY: number,
): Promise<void> {
    const provider = state.currentProvider;
    const mapContainer = map.getContainer();

    if (provider === "maptiler") {
        const activeLayer = getActiveMaptilerLayer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maptilerMap = activeLayer?.getMaptilerSDKMap?.() as any;

        if (maptilerMap && typeof maptilerMap.setPixelRatio === "function") {
            const originalPixelRatio = maptilerMap.getPixelRatio();

            maptilerMap.setPixelRatio(scaleFactor);
            maptilerMap.redraw();

            await new Promise<void>((resolve) => {
                let resolved = false;
                const done = () => {
                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                };
                maptilerMap.once("render", done);
                setTimeout(done, 500);
            });

            const canvas = mapContainer.querySelector<HTMLCanvasElement>(
                ".maplibregl-canvas",
            );
            if (canvas) {
                const drawWidth = mapContainer.clientWidth * scaleFactor;
                const drawHeight = mapContainer.clientHeight * scaleFactor;
                ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);
            }

            maptilerMap.setPixelRatio(originalPixelRatio);
            maptilerMap.redraw();
            return;
        }

        const fallbackCanvas = mapContainer.querySelector<HTMLCanvasElement>(
            ".maplibregl-canvas",
        );
        if (fallbackCanvas) {
            const drawWidth = mapContainer.clientWidth * scaleFactor;
            const drawHeight = mapContainer.clientHeight * scaleFactor;
            ctx.drawImage(fallbackCanvas, offsetX, offsetY, drawWidth, drawHeight);
            return;
        }
    }

    // Google Street or Yandex (Raster tiles)
    await waitForPendingTiles(mapContainer);

    const tileElements = Array.from(
        mapContainer.querySelectorAll<HTMLImageElement>(
            ".leaflet-tile-pane img.leaflet-tile",
        ),
    );

    const mapRect = mapContainer.getBoundingClientRect();

    tileElements.forEach((img) => {
        if (!img.complete || img.naturalWidth === 0) return;
        if (img.style.display === "none" || img.style.visibility === "hidden") {
            return;
        }

        const opacity = parseFloat(img.style.opacity);
        if (opacity === 0) return;

        const tileRect = img.getBoundingClientRect();
        const x = (tileRect.left - mapRect.left) * scaleFactor + offsetX;
        const y = (tileRect.top - mapRect.top) * scaleFactor + offsetY;
        const w = tileRect.width * scaleFactor;
        const h = tileRect.height * scaleFactor;

        if (x + w <= 0 || y + h <= 0 || x >= targetWidth || y >= targetHeight) {
            return;
        }

        ctx.save();
        if (!isNaN(opacity) && opacity < 1) {
            ctx.globalAlpha = opacity;
        }
        try {
            ctx.drawImage(img, x, y, w + 0.5, h + 0.5);
        } catch {
            // Gracefully ignore any cross-origin error on stray tiles
        }
        ctx.restore();
    });
}

/**
 * Draws all user-added polygons, rectangles, and pins onto the target canvas.
 */
function renderUserShapes(
    map: L.Map,
    ctx: CanvasRenderingContext2D,
    scaleFactor: number,
    offsetX: number,
    offsetY: number,
): void {
    const isSolid = state.isSolidLines;

    trackedShapes.forEach((shape) => {
        // Polygons and Rectangles
        if (
            (shape.shapeType === "Polygon" || shape.shapeType === "Rectangle") &&
            shape.layer instanceof L.Polygon
        ) {
            const raw = shape.layer.getLatLngs() as
                | L.LatLng[]
                | L.LatLng[][]
                | L.LatLng[][][];
            const polygons = normalizePolygonRings(raw);

            polygons.forEach((polyRings) => {
                ctx.save();
                ctx.beginPath();

                polyRings.forEach((ring) => {
                    if (!Array.isArray(ring) || ring.length < 3) return;
                    for (let i = 0; i < ring.length; i++) {
                        const pt = map.latLngToContainerPoint(ring[i]);
                        const x = pt.x * scaleFactor + offsetX;
                        const y = pt.y * scaleFactor + offsetY;
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.closePath();
                });

                const fillOpacity = isSolid ? 0 : 0.1;
                if (fillOpacity > 0) {
                    ctx.fillStyle = shape.color;
                    ctx.globalAlpha = fillOpacity;
                    ctx.fill("evenodd");
                }

                ctx.globalAlpha = 1;
                ctx.strokeStyle = shape.color;
                ctx.lineWidth = Math.max(2, 2 * scaleFactor);
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                if (!isSolid) {
                    ctx.setLineDash([6 * scaleFactor, 6 * scaleFactor]);
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();

                ctx.restore();
            });
        }

        // Pins (Markers)
        if (shape.shapeType === "Marker" && shape.layer instanceof L.Marker) {
            const latLng = shape.layer.getLatLng();
            const pt = map.latLngToContainerPoint(latLng);
            const zoomPinScale = getPinScaleForZoom(map.getZoom());

            // Base SVG viewbox is 34x44, base pin dimensions are 49x63 (scale = 49/34)
            // Tip anchor is at (17, 41) in SVG coordinates.
            const s = (49 / 34) * zoomPinScale * scaleFactor;

            ctx.save();
            ctx.translate(pt.x * scaleFactor + offsetX, pt.y * scaleFactor + offsetY);
            ctx.scale(s, s);
            ctx.translate(-17, -41);

            // Drop shadow
            ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;

            // Outer Pin Body
            const pinPath = new Path2D(
                "M17 2C9.268 2 3 8.268 3 16C3 26.5 17 41 17 41C17 41 31 26.5 31 16C31 8.268 24.732 2 17 2Z",
            );
            ctx.fillStyle = shape.color;
            ctx.fill(pinPath);

            // White border
            ctx.shadowColor = "transparent";
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2.4;
            ctx.lineJoin = "round";
            ctx.stroke(pinPath);

            // Outer white circle
            ctx.beginPath();
            ctx.arc(17, 16, 6.2, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();

            // Inner colored circle
            ctx.beginPath();
            ctx.arc(17, 16, 3, 0, Math.PI * 2);
            ctx.fillStyle = shape.color;
            ctx.fill();

            ctx.restore();
        }
    });
}

/**
 * Downloads a crisp ultra-high resolution (4384px width, preserving exact screen aspect ratio)
 * PNG image of the current map view including all drawn polygons, rectangles, and pins,
 * without stretching and without cropping any visible content.
 */
export async function downloadMapImage(): Promise<void> {
    if (isExporting) return;
    const map = state.map;
    if (!map) {
        showToast("რუკა არ არის ინიციალიზებული");
        return;
    }

    const mapContainer = map.getContainer();
    const rect = mapContainer.getBoundingClientRect();
    const clientWidth = rect.width;
    const clientHeight = rect.height;

    if (clientWidth === 0 || clientHeight === 0) return;

    isExporting = true;
    showToast("მაღალი ხარისხის სურათი მზადდება...");

    const downloadBtn = document.getElementById("map-btn-download-4k");
    downloadBtn?.classList.add("loading");

    try {
        const aspectRatio = clientWidth / clientHeight;
        const targetWidth = Math.max(
            EXPORT_TARGET_WIDTH,
            Math.round(clientWidth * (window.devicePixelRatio || 1)),
        );
        const targetHeight = Math.round(targetWidth / aspectRatio);
        const scaleFactor = targetWidth / clientWidth;

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: false });

        if (!ctx) {
            throw new Error("Canvas context could not be created");
        }

        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 1. Draw base map layer (MapTiler / Google / Yandex)
        await renderBaseMap(
            map,
            ctx,
            targetWidth,
            targetHeight,
            scaleFactor,
            0,
            0,
        );

        // 2. Draw user added rectangles, polygons, and pins
        renderUserShapes(map, ctx, scaleFactor, 0, 0);

        // 3. Export to PNG Blob and trigger browser download
        await new Promise<void>((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Blob generation failed"));
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const dateStr = new Date()
                        .toISOString()
                        .replace(/[:.]/g, "-")
                        .slice(0, 19);
                    a.download = `map-${targetWidth}x${targetHeight}-${state.currentProvider}-${dateStr}.png`;
                    a.href = url;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    showToast(`სურათი წარმატებით ჩამოიტვირთა (${targetWidth}x${targetHeight})`);
                    resolve();
                },
                "image/png",
                1.0,
            );
        });
    } catch (err) {
        console.error("Map Export Error:", err);
        showToast("სურათის გადმოწერა ვერ მოხერხდა");
    } finally {
        isExporting = false;
        downloadBtn?.classList.remove("loading");
    }
}

export const downloadMap4KImage = downloadMapImage;
