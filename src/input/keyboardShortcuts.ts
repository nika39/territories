import {
    disableActiveGeomanModes,
    toggleGeomanToolbarMode,
    type GeomanToggleMode,
} from "../drawing/geomanModes";
import { toggleUiVisibility } from "../ui/uiVisibility";

interface KeyMatcher {
    /** `KeyboardEvent.code` values (layout independent). */
    codes: string[];
    /** Lowercased `KeyboardEvent.key` values (covers Georgian layout). */
    keys: string[];
}

interface ToolShortcut {
    match: KeyMatcher;
    mode: GeomanToggleMode;
    label: string;
}

const H_KEY: KeyMatcher = { codes: ["KeyH"], keys: ["h", "ჰ"] };

const TOOL_SHORTCUTS: ToolShortcut[] = [
    {
        // Polygon: 'P' or '1'
        match: { codes: ["KeyP", "Digit1", "Numpad1"], keys: ["p", "პ", "1"] },
        mode: "drawPolygon",
        label: "პოლიგონის დახაზვა",
    },
    {
        // Pin / Marker: 'M' or '2'
        match: { codes: ["KeyM", "Digit2", "Numpad2"], keys: ["m", "მ", "2"] },
        mode: "drawMarker",
        label: "პინის დასმა",
    },
    {
        // Edit Mode: 'E' or '3'
        match: { codes: ["KeyE", "Digit3", "Numpad3"], keys: ["e", "ე", "3"] },
        mode: "editMode",
        label: "ობიექტების რედაქტირება",
    },
    {
        // Drag / Move Mode: 'D', 'V', or '4'
        match: {
            codes: ["KeyD", "KeyV", "Digit4", "Numpad4"],
            keys: ["d", "v", "დ", "ვ", "4"],
        },
        mode: "dragMode",
        label: "ობიექტების გადაადგილება",
    },
];

function matchesKey(e: KeyboardEvent, matcher: KeyMatcher): boolean {
    return (
        matcher.codes.includes(e.code) ||
        matcher.keys.includes(e.key.toLowerCase())
    );
}

function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return Boolean(
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.isContentEditable,
    );
}

/**
 * ESC: disables any active Geoman drawing / editing mode.
 * Returns true if the event was consumed.
 */
function handleEscape(e: KeyboardEvent): boolean {
    if (e.key !== "Escape" && e.code !== "Escape") return false;
    if (!disableActiveGeomanModes()) return false;

    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    return true;
}

/**
 * H: toggles UI visibility.
 * Restricted strictly to Ctrl+Shift+H (or Cmd+Shift+H on Mac) and solo 'h' (when not in an input).
 */
function handleToggleUi(e: KeyboardEvent, isInputField: boolean): boolean {
    if (!matchesKey(e, H_KEY)) return false;

    const isCmdShiftH = (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey;
    const isSoloH =
        !isInputField && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
    if (!isCmdShiftH && !isSoloH) return false;

    e.preventDefault();
    toggleUiVisibility();
    return true;
}

/**
 * Tool shortcuts: Polygon, Pin, Edit, Drag/Move.
 */
function handleToolShortcut(e: KeyboardEvent): boolean {
    const shortcut = TOOL_SHORTCUTS.find((s) => matchesKey(e, s.match));
    if (!shortcut) return false;

    e.preventDefault();
    toggleGeomanToolbarMode(shortcut.mode, shortcut.label);
    return true;
}

/**
 * Sets up keyboard shortcuts for toggling UI overlays and canceling/toggling active Geoman modes.
 */
export function setupKeyboardShortcuts(): void {
    window.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
            const isInputField = isTypingTarget(e.target);

            if (handleEscape(e)) return;
            if (handleToggleUi(e, isInputField)) return;

            // Ignore tool shortcuts when typing or when modifier keys are held
            if (isInputField || e.ctrlKey || e.metaKey || e.altKey) return;

            handleToolShortcut(e);
        },
        true,
    );
}
