# 🗺️ Territories Manager (`territories`)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-brightgreen.svg?logo=leaflet)](https://leafletjs.com/)
[![Webpack](https://img.shields.io/badge/Webpack-5.x-informational.svg?logo=webpack)](https://webpack.js.org/)
[![MapTiler](https://img.shields.io/badge/MapTiler-SDK-orange.svg)](https://www.maptiler.com/)
[![License: Unlicense](https://img.shields.io/badge/License-Unlicense-blue.svg)](https://unlicense.org/)

A high-performance, interactive geospatial web application designed for marking, organizing, and exporting territorial boundaries and points of interest across multiple cartographic providers (**Yandex Maps**, **Google Maps**, and **MapTiler**).

Engineered with modern **TypeScript**, **Leaflet**, **Leaflet-Geoman**, and **Webpack 5**, Territories Manager delivers desktop-grade vector drawing tools, dynamic tile filtering, automatic multi-projection handling (EPSG:3857 & EPSG:3395), and direct-to-clipboard ultra-high-resolution (4K+ / Canva frame) image exports.

---

## 🌟 Key Features

### 1. Multi-Provider Cartographic Engine
- **Seamless Provider Switching**: Hot-swap between **Yandex Maps**, **Google Maps**, and **MapTiler** in real time without losing active center coordinates, zoom levels, or drawn layers.
- **Automated CRS Resolution**: Transparently handles cartographic projection differences:
  - **Yandex Core-Renderer Tiles**: Rendered via Elliptical Mercator (`EPSG:3395`).
  - **Google Maps & MapTiler**: Rendered via Spherical Mercator (`EPSG:3857`).
- **High-DPI / Retina Tile Rendering**: Crisp, 512×512 Retina display output (`scale=2`) for both standard viewing and high-resolution export.

### 2. Custom Map Styling & Noise Reduction
- **Yandex Core-Renderer Tile Styling**:
  - **Filtered Mode**: Hides commercial noise, food/shopping establishments, entrance pins, and street labels while keeping administrative borders and transit stops intact.
  - **Full Mode**: Displays comprehensive city infrastructure and street names.
- **Google Maps (`mt1.google.com`)**:
  - **Filtered Mode**: Removes commercial POIs and street name noise; highlights transit stations with clean, desaturated monochrome base layers.
  - **Full Mode**: Standard road hierarchy and geographic labeling.
- **MapTiler Vector SDK**: Vector-rendered base maps with dynamic switching between full and minimal filtered label sets.

### 3. Precision Vector Drawing & Boundary Editing
- **Drawing Modes**:
  - Polygon creation (`drawPolygon`) for arbitrary boundaries.
  - Rectangle creation (`drawRectangle`) for zoned blocks.
  - Custom SVG Marker / Pin placement with dynamic thematic coloring.
- **Advanced Topology Tools**:
  - **Vertex Snapping**: Configurable magnetic snapping (`16px` tolerance) for exact polygon alignments and shared borders.
  - **Polygon Splitting / Cutting (`cutPolygon`)**: Cut out or partition existing territorial polygons.
  - **Transformations**: Real-time vertex editing, drag/translate mode, and object rotation (`rotateMode`).
  - **Stroke Customization**: Toggle between dashed and solid territorial borders.
- **Color Palette & Naming**:
  - 7 quick-select UI colors (Blue, Green, Orange, Red, Purple, Yellow, Cyan).
  - Automatic sequential naming and reindexing (`ტერიტორია #1`, `პინი #1`) with custom inline renaming.
  - Real-time area calculations (in $m^2$ and $km^2$) for every drawn polygon.

### 4. 4K+ & Canva-Framed Direct-to-Clipboard Export
- **One-Click Clipboard Copy**: Generates a crisp, high-resolution PNG image directly into the system clipboard with zero downloads required.
- **Canva Viewfinder Mode**:
  - Built-in on-screen framing overlay tuned to a **4384 × 2880 aspect ratio** (~1.5222).
  - When enabled, automatically crops and scales the exported viewport precisely to standard print and presentation template dimensions.
- **Zero-Tear Tile Synchronization**: The export pipeline awaits all asynchronous raster/vector tiles to resolve before rasterizing, guaranteeing complete imagery without blank tiles.

### 5. GeoJSON Import / Export Pipeline
- **Import**: Direct pasting of `FeatureCollection`, `Feature`, `Polygon`, or `MultiPolygon` geometries with instant canvas restoration and automatic bounding-box fitting.
- **Export**: One-click JSON extraction for individual shapes or the entire session.

### 6. Bilingual Keyboard Ergonomics
- Layout-independent keyboard shortcuts covering both **English (QWERTY)** and **Georgian** keyboard layouts.
- Quick shortcut to toggle UI visibility (`H` or `Cmd+Shift+H`) for instant, distraction-free map presentations.

---

## ⌨️ Keyboard Shortcuts

| Action | English Key | Georgian Key | Description |
| :--- | :---: | :---: | :--- |
| **Draw Polygon** | `P` or `1` | `პ` or `1` | Activate polygon drawing mode |
| **Place Pin / Marker** | `M` or `2` | `მ` or `2` | Place a customized coordinate pin |
| **Edit Mode** | `E` or `3` | `ე` or `3` | Move vertices or reshape polygons |
| **Drag / Move Mode** | `D`, `V`, or `4` | `დ`, `ვ`, or `4` | Translate shapes across the map |
| **Cancel / Exit Mode** | `Escape` | `Escape` | Deactivate active Geoman tool |
| **Toggle UI Visibility** | `H` or `⌘ + ⇧ + H` | `ჰ` or `Ctrl + Shift + H` | Hide/show all toolbars and panels |

---

## 🛠️ Tech Stack & Architecture

```
├── Webpack 5           # Module bundler with modern Babel pipeline & SCSS loading
├── TypeScript          # Strict type-safety across map state, Leaflet types & DOM events
├── Leaflet 1.9         # Core mapping library & layer management
├── @geoman-io          # Advanced vector drawing, snapping & polygon cutting
├── MapTiler SDK        # MapLibre-backed vector tile integration
├── html-to-image       # High-DPI DOM-to-Canvas rasterization for 4K exports
└── SCSS (Sass)         # Modern glassmorphism UI, responsive sidebar & animations
```

### Architectural Highlights
- **State Management (`src/state.ts`)**: Centralized application state tracking the active map instance, layer groups, preserved shapes, current provider, and UI mode flags.
- **Shape Registry (`src/drawing/shapeRegistry.ts`)**: Decoupled observer-pattern registry that synchronizes Leaflet map layers with the sidebar territory list and GeoJSON persistence.
- **Projection Bridge (`src/map/providers.ts`)**: Handles runtime recreation of Leaflet maps when transitioning between `EPSG:3395` (Yandex) and `EPSG:3857` (Google/MapTiler) to avoid projection distortion.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `pnpm` (recommended), `npm`, or `yarn`

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/<your-username>/territories.git
cd territories
pnpm install
```

### 2. Environment Configuration
Copy the sample environment file and configure your API credentials:
```bash
cp .env.example .env
```

Edit `.env` with your MapTiler API key (Yandex & Google raster tiles are accessed directly without requiring API keys):
```env
MAPTILER_API_KEY=your_maptiler_key_here
```

### 3. SSL Certificates (Local HTTPS)
The development server is preconfigured for HTTPS on `territories.localhost:443`.
Ensure your local certificates are placed in the `certs/` directory (or modify `config/webpack.dev.js` to your preferred local host/port):
- `certs/privkey.key`
- `certs/fullchain.crt`

*(Note: `certs/` is excluded from git tracking in `.gitignore`.)*

### 4. Running the Development Server
```bash
pnpm dev
# or
npm run dev
```
Open your browser and navigate to `https://territories.localhost` (or the configured dev server address).

---

## 📦 Build & Production

To compile an optimized, minified production bundle:
```bash
pnpm build
# or
npm run build
```
Production assets will be output to the `dist/` directory.

### Code Quality & Verification
```bash
# Type check without emitting files
pnpm typecheck

# Run ESLint across TypeScript and JavaScript source files
pnpm lint
```

### ⚡ Deploying to Cloudflare Pages
1. Connect your repository in the **Cloudflare Pages** dashboard.
2. Configure the build settings:
   - **Framework preset**: `None`
   - **Build command**: `pnpm build` (or `npm run build`)
   - **Build output directory**: `dist`
3. In **Settings → Environment Variables**, add:
   - `MAPTILER_API_KEY`: *(Your MapTiler key)*

---

## 🔒 Security & Privacy

- **API Keys**: Secrets such as `MAPTILER_API_KEY` are read from `.env` and kept strictly local. `.env` and SSL keys (`certs/`) are ignored in `.gitignore`.
- **Sanitized I/O**: GeoJSON inputs are validated and sanitized prior to layer creation.

---

## 📄 License

This project is released into the public domain under the [The Unlicense](LICENSE). You are completely free to use, modify, distribute, or sell this software for any purpose without any restrictions or attribution required.

