/**
 * Safely copies text to the system clipboard, with fallback for environments
 * without Permissions API or non-secure contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fallback to legacy execCommand below
    }

    try {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = text;
        tempTextArea.style.position = "fixed";
        tempTextArea.style.left = "-9999px";
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(tempTextArea);
        return successful;
    } catch {
        return false;
    }
}
