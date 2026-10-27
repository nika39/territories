import L from "leaflet";
import { state } from "../state";
import type { RestoreResult, ShapeType, TrackedShape } from "../types";
import { createPinIcon, getGeomanPathOptions } from "./styles";
import { registerDrawnLayer, registerDrawnMarker } from "./shapeRegistry";

type Props = Record<string, unknown>;

interface ShapeMeta {
    color: string;
    name: string | undefined;
    existingId: string | undefined;
}

// ----------------------------------------------------------------------------
// Property extraction
// ----------------------------------------------------------------------------

/**
 * Extracts color hex or string from GeoJSON properties if present.
 */
function extractColorFromProperties(props: Props | null | undefined): string {
    if (!props) return state.activeDrawColor;
    const candidate =
        props.color ||
        props.fill ||
        props.stroke ||
        props["marker-color"] ||
        props["marker_color"];
    if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
    }
    return state.activeDrawColor;
}

/**
 * Extracts custom title/name from GeoJSON properties if present.
 */
function extractNameFromProperties(
    props: Props | null | undefined,
): string | undefined {
    if (!props) return undefined;
    const candidate = props.name || props.title || props.label;
    if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
    }
    return undefined;
}

function extractShapeMeta(props: Props): ShapeMeta {
    return {
        color: extractColorFromProperties(props),
        name: extractNameFromProperties(props),
        existingId:
            typeof props.id === "string" && props.id ? props.id : undefined,
    };
}

// ----------------------------------------------------------------------------
// Parsing
// ----------------------------------------------------------------------------

function isFeatureWithGeometry(value: unknown): value is GeoJSON.Feature {
    return Boolean(
        value &&
        typeof value === "object" &&
        "geometry" in value &&
        (value as { geometry: unknown }).geometry,
    );
}

function wrapGeometry(geometry: GeoJSON.Geometry): GeoJSON.Feature {
    return { type: "Feature", properties: {}, geometry };
}

/**
 * Parses raw JSON / object into an array of GeoJSON Features.
 * Fully compatible with geojson.io, FeatureCollection, single Feature,
 * array of features, or direct geometry objects (Polygon, MultiPolygon, Point).
 */
export function parseGeoJsonFeatures(data: unknown): GeoJSON.Feature[] {
    if (!data || typeof data !== "object") return [];

    const obj = data as Record<string, unknown>;

    // 1. FeatureCollection
    if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
        return obj.features.filter(isFeatureWithGeometry);
    }

    // 2. Single Feature
    if (obj.type === "Feature" && obj.geometry) {
        return [data as GeoJSON.Feature];
    }

    // 3. Array of Features or Geometries
    if (Array.isArray(data)) {
        const result: GeoJSON.Feature[] = [];
        for (const item of data) {
            if (!item || typeof item !== "object") continue;
            const itemObj = item as Record<string, unknown>;
            if (itemObj.type === "Feature" && itemObj.geometry) {
                result.push(item as GeoJSON.Feature);
            } else if (itemObj.type && itemObj.coordinates) {
                result.push(wrapGeometry(item as GeoJSON.Geometry));
            }
        }
        return result;
    }

    // 4. Direct geometry object (Polygon, MultiPolygon, Point, etc.)
    if (obj.type && obj.coordinates) {
        return [wrapGeometry(data as GeoJSON.Geometry)];
    }

    return [];
}

// ----------------------------------------------------------------------------
// Restoration
// ----------------------------------------------------------------------------

function failure(message: string): RestoreResult {
    return { success: false, message, count: 0 };
}

function restoreMarker(latlng: L.LatLngExpression, meta: ShapeMeta) {
    const marker = L.marker(latlng, {
        icon: createPinIcon(meta.color),
        draggable: true,
    });
    return registerDrawnMarker(marker, meta.color, meta.existingId, meta.name);
}

/**
 * Converts a GeoJSON Point into a Leaflet lat/lng, or null when invalid.
 */
function pointToLatLng(point: GeoJSON.Point): L.LatLngTuple | null {
    const coords = point.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (isNaN(lng) || isNaN(lat)) return null;
    return [lat, lng];
}

/**
 * Restores a single GeoJSON feature into tracked shapes (pins / polygons).
 */
function restoreFeature(feat: GeoJSON.Feature): TrackedShape[] {
    const geom = feat.geometry;
    if (!geom) return [];

    const props = (feat.properties || {}) as Props;
    const meta = extractShapeMeta(props);

    // 1. Point -> Pin / Marker
    if (geom.type === "Point") {
        const latlng = pointToLatLng(geom);
        return latlng ? [restoreMarker(latlng, meta)] : [];
    }

    // 2. Polygon, MultiPolygon or other 2D geometries
    const shapeType: Exclude<ShapeType, "Marker"> =
        props.shapeType === "Rectangle" ? "Rectangle" : "Polygon";
    const tempLayer = L.geoJSON(feat, {
        style: () => getGeomanPathOptions(meta.color),
    });

    const restored: TrackedShape[] = [];
    for (const sub of tempLayer.getLayers()) {
        if (sub instanceof L.Polygon) {
            tempLayer.removeLayer(sub);
            restored.push(
                registerDrawnLayer(
                    sub,
                    shapeType,
                    meta.existingId,
                    meta.color,
                    meta.name,
                ),
            );
        } else if (sub instanceof L.Marker) {
            tempLayer.removeLayer(sub);
            restored.push(restoreMarker(sub.getLatLng(), meta));
        }
    }
    return restored;
}

/**
 * Animates the map camera to encompass the given shapes.
 */
function fitMapToShapes(map: L.Map, shapes: TrackedShape[]): void {
    const bounds = L.latLngBounds([]);
    shapes.forEach((s) => {
        if (s.layer instanceof L.Marker) {
            bounds.extend(s.layer.getLatLng());
        } else {
            bounds.extend(s.layer.getBounds());
        }
    });
    if (!bounds.isValid()) return;

    const [first] = shapes;
    if (shapes.length === 1 && first.layer instanceof L.Marker) {
        map.flyTo(first.layer.getLatLng(), Math.max(map.getZoom(), 18), {
            duration: 0.8,
        });
    } else {
        map.fitBounds(bounds, {
            padding: [60, 60],
            maxZoom: 19,
            animate: true,
        });
    }
}

/**
 * Restores GeoJSON data directly into tracked shapes and pins.
 * Fully preserves color, coordinates, name, and ID as if drawn by the user.
 */
export function restoreGeoJson(
    geoJsonData: unknown,
    shouldFitBounds = true,
): RestoreResult {
    const map = state.map;
    if (!map || !state.drawnItemsGroup) {
        return failure("რუკა ჯერ არ არის ინიციალიზებული");
    }

    const features = parseGeoJsonFeatures(geoJsonData);
    if (features.length === 0) {
        return failure("GeoJSON-ში ვალიდური გეომეტრია ვერ მოიძებნა");
    }

    const addedShapes = features.flatMap(restoreFeature);
    if (addedShapes.length === 0) {
        return failure("GeoJSON-ში ვალიდური პოლიგონი ან პინი ვერ მოიძებნა");
    }

    if (shouldFitBounds) {
        fitMapToShapes(map, addedShapes);
    }

    const objectLabel =
        addedShapes.length === 1
            ? addedShapes[0].name
            : `${addedShapes.length} ობიექტი`;

    return {
        success: true,
        message: `✓ დაემატა (${objectLabel})`,
        count: addedShapes.length,
    };
}
