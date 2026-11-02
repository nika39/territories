import L from "leaflet";
import { state } from "../state";
import {
    CANVA_FRAME_ICON_SVG,
    COPY_4K_ICON_SVG,
    SNAPPING_ICON_SVG,
    SOLID_LINE_ICON_SVG,
} from "../ui/icons";
import { copyMapImage } from "../map/exportMap";
import { toggleSolidLines, toggleSnapping } from "./drawingOptions";
import { toggleCanvaFrame } from "../ui/canvaFrame";

interface OptionButton {
    containerId: string;
    buttonId: string;
    title: string;
    icon: string;
    isActive: () => boolean;
    onClick: () => void;
}

function getOptionButtons(): OptionButton[] {
    return [
        {
            containerId: "map-btn-solid-lines-container",
            buttonId: "map-btn-toggle-solid-lines",
            title: "სწორხაზოვანი კონტური",
            icon: SOLID_LINE_ICON_SVG,
            isActive: () => state.isSolidLines,
            onClick: toggleSolidLines,
        },
        {
            containerId: "map-btn-snapping-container",
            buttonId: "map-btn-toggle-snapping",
            title: "კუთხეების მიბმა (Snapping)",
            icon: SNAPPING_ICON_SVG,
            isActive: () => state.isSnappingEnabled,
            onClick: toggleSnapping,
        },
        {
            containerId: "map-btn-canva-frame-container",
            buttonId: "map-btn-toggle-canva-frame",
            title: "Canva ჩარჩო (4384×2880)",
            icon: CANVA_FRAME_ICON_SVG,
            isActive: () => state.isCanvaFrameActive,
            onClick: toggleCanvaFrame,
        },
        {
            containerId: "map-btn-copy-4k-container",
            buttonId: "map-btn-copy-4k",
            title: state.isCanvaFrameActive
                ? "რუკის კოპირება Canva-სთვის (4384×2880)"
                : "რუკის მაღალი ხარისხით კოპირება (4384px)",
            icon: COPY_4K_ICON_SVG,
            isActive: () => false,
            onClick: () => {
                copyMapImage();
            },
        },
    ];
}

/**
 * Custom Opacity and Snapping controls placed at the end of the right toolbar.
 */
const GeomanOptionsControl = L.Control.extend({
    options: {
        position: "topright" as L.ControlPosition,
    },
    onAdd: function () {
        const container = L.DomUtil.create(
            "div",
            "leaflet-pm-toolbar leaflet-bar pm-options-toolbar",
        );
        const buttons = getOptionButtons();

        container.innerHTML = buttons
            .map(
                (btn) => `
                <div class="button-container ${btn.isActive() ? "active" : ""}" id="${btn.containerId}">
                    <a class="leaflet-buttons-control-button" id="${btn.buttonId}" title="${btn.title}" role="button">
                        ${btn.icon}
                    </a>
                </div>`,
            )
            .join("");

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        buttons.forEach((btn) => {
            container
                .querySelector(`#${btn.buttonId}`)
                ?.addEventListener("click", (e) => {
                    e.preventDefault();
                    btn.onClick();
                });
        });

        return container;
    },
});

export function addGeomanOptionsControl(mapInstance: L.Map): void {
    new GeomanOptionsControl().addTo(mapInstance);
}
