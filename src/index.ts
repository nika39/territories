import "./styles.scss";
import {
    DEFAULT_PROVIDER,
    INITIAL_CENTER,
    INITIAL_ZOOM,
    LOADER_FALLBACK_MS,
} from "./config/constants";
import { onShapesChanged } from "./drawing/shapeRegistry";
import { setupKeyboardShortcuts } from "./input/keyboardShortcuts";
import { recreateMap } from "./map/mapManager";
import { getCrsForProvider } from "./map/providers";
import { setupGeoJsonControls } from "./ui/geojsonPanel";
import { hideAppLoader } from "./ui/loader";
import { setupMapSwitcher } from "./ui/mapSwitcher";
import { renderShapesList } from "./ui/shapesList";
import { setupGeomanSidebarControls } from "./ui/sidebarControls";
import { setupStyleSwitchers } from "./ui/styleSwitcher";

export {
    GOOGLE_STYLE_FULL,
    GOOGLE_STYLE_FILTERED,
    YANDEX_STYLE_OLD,
    YANDEX_STYLE_NEW,
} from "./config/constants";

function bootstrap(): void {
    // Keep the sidebar list in sync with the tracked shapes
    onShapesChanged(renderShapesList);

    // Initialize default map provider
    recreateMap(
        getCrsForProvider(DEFAULT_PROVIDER),
        INITIAL_CENTER,
        INITIAL_ZOOM,
        DEFAULT_PROVIDER,
    );

    // Set up listeners once
    setupMapSwitcher();
    setupStyleSwitchers();
    setupKeyboardShortcuts();
    setupGeoJsonControls();
    setupGeomanSidebarControls();

    // Fallback load overlay fade-out
    setTimeout(hideAppLoader, LOADER_FALLBACK_MS);
}

document.addEventListener("DOMContentLoaded", bootstrap);
