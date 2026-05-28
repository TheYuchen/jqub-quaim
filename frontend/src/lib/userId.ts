// Anonymous browser-scoped identifier. Used as a namespace key for
// per-user plugin storage on the server. Generated on first visit
// and persisted in localStorage; not tied to any actual user account.

const LS_KEY = "quda.userId";

/** Read the current user id, or mint one on first visit. */
export function getUserId(): string {
  try {
    const existing = localStorage.getItem(LS_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
  } catch {
    /* ignore — fall through to mint */
  }
  const fresh = mintUserId();
  try {
    localStorage.setItem(LS_KEY, fresh);
  } catch {
    /* if storage is blocked the id is still valid for this tab */
  }
  return fresh;
}

/** Bump a localStorage counter so other tabs' `storage` listeners fire.
 *  Plugin lists themselves live in Zustand (in-memory per tab); this
 *  counter is the only thing that crosses the localStorage boundary
 *  for cross-tab sync. */
export function bumpPluginsRev(): void {
  try {
    const prev = Number(localStorage.getItem("quda.pluginsRev") || "0");
    localStorage.setItem(
      "quda.pluginsRev",
      String(Number.isFinite(prev) ? prev + 1 : 1),
    );
  } catch {
    /* storage blocked — multi-tab sync is best-effort */
  }
}

/** RFC4122-ish random hex, no hyphens — fits the backend regex
 *  `[a-zA-Z0-9_-]{8,64}` without ambiguity. */
function mintUserId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: Math.random based. Not cryptographically strong but the
  // ID is just a namespace separator, not a secret.
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  ).padEnd(16, "0").slice(0, 32);
}
