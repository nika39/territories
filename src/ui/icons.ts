/**
 * SVG / HTML markup snippets used across the UI.
 */

const STROKE_ICON_ATTRS =
    'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"';

export const FOCUS_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="13" height="13" ${STROKE_ICON_ATTRS}>
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>`;

export const COPY_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="13" height="13" ${STROKE_ICON_ATTRS}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;

export const DELETE_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="13" height="13" ${STROKE_ICON_ATTRS}>
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>`;

export const SOLID_LINE_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="18" height="18" ${STROKE_ICON_ATTRS}>
        <line x1="3" y1="8" x2="21" y2="8"></line>
        <line x1="3" y1="16" x2="21" y2="16" stroke-dasharray="3.5 3"></line>
    </svg>`;

export const OPACITY_ICON_SVG = SOLID_LINE_ICON_SVG;

export const SNAPPING_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="18" height="18" ${STROKE_ICON_ATTRS}>
        <path d="M6 3v7a6 6 0 0 0 12 0V3"></path>
        <line x1="4" y1="3" x2="8" y2="3"></line>
        <line x1="16" y1="3" x2="20" y2="3"></line>
    </svg>`;

export const DOWNLOAD_4K_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="18" height="18" ${STROKE_ICON_ATTRS}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>`;

/**
 * Small pin icon displayed in the sidebar list.
 */
export function renderListPinIcon(color: string): string {
    return `<span class="item-pin-icon" style="color: ${color};">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
        </svg>
    </span>`;
}

/**
 * High-visibility vector SVG pin marker used on the map.
 * Designed with a white outer border + drop shadow for maximum contrast
 * on any map tile or building roof in screenshots.
 */
export function renderMapPinHtml(color: string): string {
    return `
        <div class="building-pin-scaler">
            <div class="building-pin" style="--pin-color: ${color};">
                <svg viewBox="0 0 34 44" width="49" height="63" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 2C9.268 2 3 8.268 3 16C3 26.5 17 41 17 41C17 41 31 26.5 31 16C31 8.268 24.732 2 17 2Z" 
                          fill="${color}" 
                          stroke="#FFFFFF" 
                          stroke-width="2.4" 
                          stroke-linejoin="round"/>
                    <circle cx="17" cy="16" r="6.2" fill="#FFFFFF"/>
                    <circle cx="17" cy="16" r="3" fill="${color}"/>
                </svg>
            </div>
        </div>
    `;
}
