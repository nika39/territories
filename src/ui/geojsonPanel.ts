import { restoreGeoJson } from "../drawing/geojsonImport";
import { byId } from "../utils/dom";
import { showToast } from "./toast";

type FeedbackType = "error" | "success" | "none";

/**
 * Sets up listeners for the GeoJSON input and restore section in the sidebar.
 */
export function setupGeoJsonControls(): void {
    const input = byId<HTMLTextAreaElement>("geojson-input");
    const addBtn = byId<HTMLButtonElement>("btn-draw-geojson");
    const clearBtn = byId<HTMLButtonElement>("btn-clear-geojson");
    const feedback = byId("geojson-feedback");

    const showFeedback = (msg: string, type: FeedbackType) => {
        if (!feedback) return;
        if (type === "none") {
            feedback.style.display = "none";
            feedback.className = "geojson-feedback";
            feedback.textContent = "";
            return;
        }
        feedback.style.display = "flex";
        feedback.className = `geojson-feedback ${type}`;
        feedback.textContent = msg;
    };

    const handleAdd = () => {
        if (!input) return;
        const raw = input.value.trim();

        if (!raw) {
            showFeedback("გთხოვთ შეიყვანოთ GeoJSON ტექსტი", "error");
            return;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            showFeedback("არასწორი JSON ფორმატი: სინტაქსი მცდარია", "error");
            return;
        }

        const res = restoreGeoJson(parsed, true);
        if (res.success) {
            showFeedback(res.message, "success");
            showToast(`${res.count} ობიექტი დაემატა რუკაზე`);
        } else {
            showFeedback(`✕ ${res.message}`, "error");
        }
    };

    addBtn?.addEventListener("click", handleAdd);

    input?.addEventListener("keydown", (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    });

    clearBtn?.addEventListener("click", () => {
        if (input) {
            input.value = "";
        }
        showFeedback("", "none");
        showToast("ველი გასუფთავებულია");
    });
}
