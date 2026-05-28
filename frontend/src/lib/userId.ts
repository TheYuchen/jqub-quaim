// Browser/account identifier used as the user_id query parameter on
// plugin API calls. Two flavours:
//
//   * For a guest (no HF session): a per-browser anonymous UUID
//     persisted in localStorage. Plugins stored under this id live in
//     /tmp on the Space (volatile, per-browser).
//   * For a signed-in HF user: never read by getUserId() directly —
//     the server overrides the query value with the session-derived
//     hf_<username> whenever it sees a session cookie. We still send
//     the anon UUID as a fallback so the route works without cookies.
//
// In other words: the frontend always sends the anon UUID. The server
// decides which namespace to operate on (session > query).

import { useApp } from "./store";

const LS_KEY = "quda.userId";

/** Read the current anonymous user id, or mint one on first visit.
 *
 * Even when the user is signed in, we still surface the anon id —
 * the server treats it as the fallback namespace for unauthenticated
 * routes. The actual logged-in namespace is server-derived, not
 * client-controlled (anti-spoofing).
 */
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

/** Convenience: the namespace label the server is currently treating
 *  the caller as. Returns "hf_<username>" when signed in, the anon
 *  UUID otherwise. Used only for display (e.g. tooltips); the actual
 *  authoritative resolution happens on the server. */
export function displayUserId(): string {
  const session = useApp.getState().session;
  if (session?.username) return `hf_${session.username}`;
  return getUserId();
}

/** Bump a localStorage counter so other tabs' `storage` listeners fire.
 *  Plugin lists themselves live in Zustand (in-memory per tab); this
 *  counter is the only thing that crosses the localStorage boundary
 *  for cross-tab sync. */
export function bumpPluginsRev(): void {
  bumpRev("quda.pluginsRev");
}

/** Same idea, but for session changes (login / logout). Without this
 *  Tab B's avatar stays in the wrong state for up to 5 min after
 *  Tab A signs in or out (we still poll /me on that cadence as a
 *  belt). */
export function bumpSessionRev(): void {
  bumpRev("quda.sessionRev");
}

function bumpRev(key: string): void {
  try {
    const prev = Number(localStorage.getItem(key) || "0");
    localStorage.setItem(
      key,
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
