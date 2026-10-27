/**
 * Typed shortcut for `document.getElementById`.
 */
export function byId<T extends HTMLElement = HTMLElement>(
    id: string,
): T | null {
    return document.getElementById(id) as T | null;
}
