import type L from "leaflet";

export type ShapeType = "Polygon" | "Rectangle" | "Marker";

export interface TrackedShape {
    id: string;
    layer: L.Polygon | L.Marker;
    shapeType: ShapeType;
    name: string;
    area: number; // in square meters (0 for Marker)
    perimeter: number; // in meters (0 for Marker)
    color: string;
}

export interface RestoreResult {
    success: boolean;
    message: string;
    count: number;
}
