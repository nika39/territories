# AGENTS.md

## Yandex Core-Renderer Tiles Styling Rules & Gotchas

When using Yandex raster/vector tiles from `core-renderer-tiles.maps.yandex.net`:
- **Endpoint**: `https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=...`
- **Projection**: Elliptical Mercator (`EPSG:3395`), not Spherical Mercator (`EPSG:3857`).

### 1. Combining Multiple Style Rules
- **DO NOT** pass multiple `&style=` parameters in the URL (e.g. `&style=rule1&style=rule2`). The tile server **only evaluates the first `&style=` parameter** and silently ignores all subsequent ones.
- **DO** join multiple style rules using the **tilde (`~`)** delimiter within a single `style=` parameter:
  ```
  &style=<RULE_1>~<RULE_2>~<RULE_3>
  ```

### 2. Multi-value Tags Syntax (`tags.none`, `tags.any`, etc.)
- **DO NOT** use comma-separated lists for tags (e.g. `tags.none:road_1,road_2` will fail or be ignored).
- **DO** repeat the tag key for each value, separated by pipes (`|`):
  ```
  tags.any:road|tags.none:road_1|tags.none:road_2|tags.none:road_3...
  ```

### 3. Rule Structure Mapping (JSON to URL Parameter)
Each JSON rule block:
```json
{
  "tags": {
    "any": ["road"],
    "none": ["road_1", "road_2"]
  },
  "elements": "label.icon",
  "stylers": {
    "visibility": "off"
  }
}
```
translates into:
```
tags.any:road|tags.none:road_1|tags.none:road_2|elements:label.icon|stylers.visibility:off
```

### Full Example in Leaflet:
```typescript
const yandexLayer = L.tileLayer(
  "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ka_GE&style=" +
  "tags.any:commercial_services|stylers.visibility:off~" +
  "tags.any:traffic_light|stylers.visibility:off~" +
  "tags.any:entrance|stylers.visibility:off~" +
  "tags.any:road|tags.none:road_1|tags.none:road_2|tags.none:road_3|tags.none:road_4|tags.none:road_5|tags.none:road_6|tags.none:road_7|elements:label.icon|stylers.visibility:off",
  {
    maxZoom: 19,
    attribution: "&copy; Yandex",
  }
);
```

## Google Maps Tiles Styling Rules & Gotchas (mt1.google.com)

When using Google Maps raster tiles from `mt{0-3}.google.com/vt`:
- **Endpoint**: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ka&apistyle=...`
- **Projection**: Spherical Mercator (`EPSG:3857`).

### 1. Style Parameter Syntax (`apistyle`)
- Styles are passed via the **`apistyle=`** query parameter.
- Each rule follows the syntax: `s.t:<featureType>|s.e:<elementType>|p.<property>:<value>`
- **Multiple rules delimiter**: Join separate rules with a **comma (`,`)**:
  ```
  apistyle=<RULE_1>,<RULE_2>,<RULE_3>
  ```

### 2. Common Feature Types (`s.t`)
- `s.t:0` — `all` (entire map)
- `s.t:2` — `poi` (all Points of Interest: businesses, schools, parks, hospitals, etc.)
- `s.t:33` — `poi.business` (commercial businesses, shops, restaurants, gas stations)
- `s.t:40` — `poi.park` (parks & gardens)
- `s.t:35` — `poi.school` (schools & universities)
- `s.t:3` — `road` (roads, street labels, house numbers)
- `s.t:4` — `transit` (public transport, bus stops, metro stations)

### 3. Practical Examples

#### A. Completely Clean Map (Only stops & addresses, no establishments)
Hides all POIs (businesses, gyms, hospitals, churches) while keeping public transit stations:
```
apistyle=s.t:2|p.v:off,s.t:4|p.v:on
```

#### B. Hide Commercial Noise (Keeps parks, schools, public institutions & transit)
Only hides businesses/restaurants/gas stations, leaving parks, schools, and hospitals intact:
```
apistyle=s.t:33|p.v:off
```

#### C. Grayscale / Muted Map
Turns map black & white by setting saturation to -100:
```
apistyle=p.s:-100
```

### Full Example in Leaflet:
```typescript
// Filtered: only transit stops and addresses (no commercial POIs)
const googleFilteredLayer = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ka&apistyle=s.t:2|p.v:off,s.t:4|p.v:on",
  {
    maxZoom: 21,
    attribution: "&copy; Google",
  }
);
```

## MapTiler SDK & Styles

- **Projection**: Spherical Mercator (`EPSG:3857`).
- **Styles**:
  - `MAPTILER_STYLE_FULL`: `01a120ea-26f0-7a1d-b08e-4c63cf192ffd` (all labels)
  - `MAPTILER_STYLE_FILTERED`: `01a183f3-3273-7288-9476-f489410fc9de` (filtered, street labels hidden)
- **Dynamic switching**: Use `maptilerLayer.setStyle(styleId)` without destroying the Leaflet map.
- **Teardown**: Guard against MapLibre's `setStyle(null)` inside `configureMaptilerSdkMap` to delegate null teardown to MapLibre's prototype setStyle.


