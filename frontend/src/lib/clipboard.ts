// Clipboard helper with a legacy fallback.
//
// `navigator.clipboard.writeText` is the modern path, but it can fail on
// insecure contexts (http://, some iframes) or when the browser hasn't
// granted clipboard permission yet. To keep "copy link" / "copy bibtex"
// buttons working everywhere the HF Space might run, we fall back to a
// transient off-screen textarea + `document.execCommand("copy")`.
//
// Returns `true` on success, `false` on failure. Callers typically use
// the success signal to briefly flash a "Copied" tick.

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
