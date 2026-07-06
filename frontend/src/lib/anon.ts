// Double-anonymous review mode (IEEE VIS is double-blind).
//
// Two activation paths, matching how the artifact is deployed:
//
//   1. Build-time: `VITE_ANON=1 npm run build` bakes the flag into the
//      bundle. This is the path the actual submission uses — a FRESH
//      anonymous Space is built with this flag, so identifying strings
//      (lab, university, author names, paper bibtex, funding) are not
//      just hidden but ABSENT from the served JS (the `BUILD_ANON`
//      constant below folds to a literal at build time, so minification
//      dead-code-eliminates the branches that carry them).
//
//   2. Runtime fallback: `?anon=1` on the URL, persisted to
//      localStorage so subsequent navigations stay anonymous (`?anon=0`
//      clears it). This exists so the flag can be exercised/reviewed on
//      the regular deployment; note the regular Space's URL itself is
//      identifying — the runtime flag removes in-app identifiers only.
//      Submission MUST use path 1 on a fresh Space.
//
// Everything user-visible that identifies the group routes through the
// constants below. Internal identifiers (localStorage keys like
// "quda.*", the IndexedDB name "quda-provenance", CSS theme selectors)
// are deliberately NOT renamed: they are invisible in the rendered UI
// and renaming them would orphan returning users' persisted state.

/** True when the flag was baked in at build time. Statically foldable. */
export const BUILD_ANON: boolean = import.meta.env.VITE_ANON === "1";

function runtimeAnon(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("anon");
    if (q === "1") {
      window.localStorage.setItem("quda.anonMode", "1");
      return true;
    }
    if (q === "0") {
      window.localStorage.removeItem("quda.anonMode");
      return false;
    }
    return window.localStorage.getItem("quda.anonMode") === "1";
  } catch {
    return false;
  }
}

/** The effective anonymous-mode flag. Evaluated once at module load —
 *  scenario/anon boot state should not flip mid-session. */
export const ANON: boolean = BUILD_ANON || runtimeAnon();

/** Neutral codename under anonymity; real name otherwise. */
export const APP_NAME = ANON ? "EvidenceQ" : "QuDA Studio";

/** One-line tagline under the app name in the header. Task language,
 *  no lab/university branding in either mode (de-product, Wave P). */
export const APP_TAGLINE = ANON
  ? "Evidence workbench for stochastic pipeline experiments"
  : "Quantum Design Automation Studio";
