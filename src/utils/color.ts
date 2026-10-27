/**
 * Darkens a hex color by a specified factor (e.g. 0.32 = 32% darker).
 */
export function darkenHexColor(hex: string, factor = 0.32): string {
    const clean = hex.replace("#", "");
    if (clean.length !== 6 && clean.length !== 3) return hex;
    const full =
        clean.length === 3
            ? clean
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : clean;
    const num = parseInt(full, 16);
    if (isNaN(num)) return hex;
    const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - factor)));
    const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - factor)));
    const b = Math.max(0, Math.floor((num & 255) * (1 - factor)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
