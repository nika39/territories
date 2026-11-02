import L from "leaflet";
import { state } from "../state";
import {
    DOWNLOAD_4K_ICON_SVG,
    SNAPPING_ICON_SVG,
    SOLID_LINE_ICON_SVG,
} from "../ui/icons";
import { downloadMap4KImage } from "../map/exportMap";
import { toggleSolidLines, toggleSnapping } from "./drawingOptions";

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
            containerId: "map-btn-download-4k-container",
            buttonId: "map-btn-download-4k",
            title: "რუკის მაღალი ხარისხით გადმოწერა (4384px)",
            icon: DOWNLOAD_4K_ICON_SVG,
            isActive: () => false,
            onClick: () => {
                downloadMap4KImage();
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
