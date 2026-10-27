import type L from "leaflet";

export function getPolygonLatLngs(layer: L.Polygon): L.LatLng[] {
    const latlngs = layer.getLatLngs();
    if (Array.isArray(latlngs)) {
        if (Array.isArray(latlngs[0])) {
            if (Array.isArray(latlngs[0][0])) {
                return latlngs[0][0] as L.LatLng[];
            }
            return latlngs[0] as L.LatLng[];
        }
        return latlngs as L.LatLng[];
    }
    return [];
}

/**
 * Calculates geodesic polygon area on WGS84 ellipsoid in square meters.
 */
export function calculatePolygonArea(latlngs: L.LatLng[]): number {
    const RADIUS = 6378137;
    if (latlngs.length < 3) return 0;
    let area = 0;
    const len = latlngs.length;
    for (let i = 0; i < len; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[(i + 1) % len];
        area +=
            (p2.lng - p1.lng) *
            (Math.PI / 180) *
            (2 +
                Math.sin(p1.lat * (Math.PI / 180)) +
                Math.sin(p2.lat * (Math.PI / 180)));
    }
    area = (area * RADIUS * RADIUS) / 2.0;
    return Math.abs(area);
}

/**
 * Calculates perimeter in meters.
 */
export function calculatePolygonPerimeter(latlngs: L.LatLng[]): number {
    if (latlngs.length < 2) return 0;
    let perimeter = 0;
    const len = latlngs.length;
    for (let i = 0; i < len; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[(i + 1) % len];
        perimeter += p1.distanceTo(p2);
    }
    return perimeter;
}

/**
 * Measures area (m²) and perimeter (m) of a polygon layer.
 */
export function measurePolygon(layer: L.Polygon): {
    area: number;
    perimeter: number;
} {
    const latlngs = getPolygonLatLngs(layer);
    return {
        area: calculatePolygonArea(latlngs),
        perimeter: calculatePolygonPerimeter(latlngs),
    };
}
