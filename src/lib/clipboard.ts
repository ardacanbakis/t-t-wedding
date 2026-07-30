// Copy text to the clipboard, working on both secure (HTTPS) and insecure
// (plain HTTP, e.g. before "Enforce HTTPS" is on) origins. The modern
// navigator.clipboard API is only available in a secure context, so we fall
// back to a hidden-textarea + execCommand("copy"), which works over HTTP
// during a user gesture. Returns true if the copy succeeded — callers only
// need the prompt() popup as a last resort.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
