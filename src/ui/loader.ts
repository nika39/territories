import { byId } from "../utils/dom";

/**
 * Fades out the initial loader overlay (idempotent).
 */
export function hideAppLoader(): void {
    byId("app-loader")?.classList.add("fade-out");
}
