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
