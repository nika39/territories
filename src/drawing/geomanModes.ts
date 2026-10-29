import { state } from "../state";
import { showToast } from "../ui/toast";

type PMMap = L.Map["pm"];

type ModeGroup = "draw" | "cut" | "edit" | "drag" | "removal" | "rotate";

interface ModeDescriptor {
    isEnabled: (pm: PMMap) => boolean;
    disable: (pm: PMMap) => void;
    /** Human-readable Georgian label (evaluated before the mode is disabled). */
    label: (pm: PMMap) => string;
}

const DRAW_LABELS: Record<string, string> = {
    Marker: "პინის დასმა",
    Rectangle: "მართკუთხედის დახაზვა",
    Polygon: "პოლიგონის დახაზვა",
    Cut: "ამოჭრა",
};

/**
 * Geoman global modes, in the order they are inspected when deactivating.
 */
const MODES: Record<ModeGroup, ModeDescriptor> = {
    draw: {
        isEnabled: (pm) => pm.globalDrawModeEnabled(),
        disable: (pm) => pm.disableDraw(),
        label: (pm) =>
            DRAW_LABELS[pm.Draw.getActiveShape()] ?? "დახაზვის რეჟიმი",
    },
    cut: {
        isEnabled: (pm) => pm.globalCutModeEnabled(),
        disable: (pm) => pm.disableGlobalCutMode(),
        label: () => "ამოჭრა",
    },
    edit: {
        isEnabled: (pm) => pm.globalEditModeEnabled(),
        disable: (pm) => pm.disableGlobalEditMode(),
        label: () => "რედაქტირება",
    },
    drag: {
        isEnabled: (pm) => pm.globalDragModeEnabled(),
        disable: (pm) => pm.disableGlobalDragMode(),
        label: () => "გადაადგილება",
    },
    removal: {
        isEnabled: (pm) => pm.globalRemovalModeEnabled(),
        disable: (pm) => pm.disableGlobalRemovalMode(),
        label: () => "წაშლა",
    },
    rotate: {
        isEnabled: (pm) => pm.globalRotateModeEnabled(),
        disable: (pm) => pm.disableGlobalRotateMode(),
        label: () => "შემობრუნება",
    },
};

/**
 * Deactivates any currently active Leaflet Geoman drawing or editing mode.
 * Returns the human-readable Georgian label of the first deactivated mode,
 * or null if no mode was active.
 */
export function disableActiveGeomanModes(): string | null {
    const map = state.map;
    if (!map || !map.pm) return null;

    let deactivatedName: string | null = null;

    for (const mode of Object.values(MODES)) {
        if (!mode.isEnabled(map.pm)) continue;
        deactivatedName ??= mode.label(map.pm);
        mode.disable(map.pm);
    }

    // Ensure any layer-level Geoman mode is disabled as well
    state.drawnItemsGroup?.eachLayer((layer) => {
        const l = layer as L.Path | L.Marker;
        if (l.pm && typeof l.pm.enabled === "function" && l.pm.enabled()) {
            deactivatedName ??= "რედაქტირება";
            l.pm.disable();
        }
    });

    if (deactivatedName) {
        showToast(`${deactivatedName} გაითიშა`);
    }

    return deactivatedName;
}

// ----------------------------------------------------------------------------
// Toolbar mode toggling
// ----------------------------------------------------------------------------

export type GeomanToggleMode =
    | "drawPolygon"
    | "drawMarker"
    | "editMode"
    | "dragMode";

interface ToggleConfig {
    group: ModeGroup;
    isActive: (pm: PMMap) => boolean;
    enable: (pm: PMMap) => void;
}

const TOGGLE_CONFIGS: Record<GeomanToggleMode, ToggleConfig> = {
    drawPolygon: {
        group: "draw",
        isActive: (pm) =>
            pm.globalDrawModeEnabled() &&
            pm.Draw.getActiveShape() === "Polygon",
        enable: (pm) =>
            pm.enableDraw("Polygon", { snappable: state.isSnappingEnabled }),
    },
    drawMarker: {
        group: "draw",
        isActive: (pm) =>
            pm.globalDrawModeEnabled() && pm.Draw.getActiveShape() === "Marker",
        enable: (pm) =>
            pm.enableDraw("Marker", { snappable: state.isSnappingEnabled }),
    },
    editMode: {
        group: "edit",
        isActive: (pm) => pm.globalEditModeEnabled(),
        enable: (pm) =>
            pm.enableGlobalEditMode({ snappable: state.isSnappingEnabled }),
    },
    dragMode: {
        group: "drag",
        isActive: (pm) => pm.globalDragModeEnabled(),
        enable: (pm) => pm.enableGlobalDragMode(),
    },
};

/** Modes that are mutually exclusive with the toolbar toggles. */
const EXCLUSIVE_GROUPS: ModeGroup[] = [
    "draw",
    "edit",
    "drag",
    "removal",
    "rotate",
];

/**
 * Toggles a Geoman mode via its official map.pm APIs, providing clear toast feedback.
 */
export function toggleGeomanToolbarMode(
    controlName: GeomanToggleMode,
    modeNameGeo: string,
): void {
    const map = state.map;
    if (!map || !map.pm) return;

    const pm = map.pm;
    const config = TOGGLE_CONFIGS[controlName];
    const willBeActive = !config.isActive(pm);

    if (willBeActive) {
        // Switch off every other mode first (enableDraw swaps draw shapes itself)
        EXCLUSIVE_GROUPS.filter((group) => group !== config.group).forEach(
            (group) => {
                if (MODES[group].isEnabled(pm)) MODES[group].disable(pm);
            },
        );
        config.enable(pm);
    } else {
        MODES[config.group].disable(pm);
    }

    showToast(`${modeNameGeo} ${willBeActive ? "გააქტიურდა" : "გაითიშა"}`);
}
