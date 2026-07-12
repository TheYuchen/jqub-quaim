// Cross-surface completion flags for the two learn tracks. Three
// surfaces need them far from where they are written (the TopBar
// Learn menu's checkmarks, the LessonCard's own progress list, the
// LearnLab handoff), so the localStorage keys live here — one source,
// same private-mode tolerance as the rest of the app's persistence.

import { LESSONS } from "./lessons";

/** "1" once the learn-from-zero track's step 5 hands off (any of its
 *  exit buttons — the two handoff actions or the frame's Done). */
export const LEARN_LAB_DONE_LS = "quda.learnLabDone";
/** JSON array of completed LessonKeys — written by LessonCard. */
export const LESSONS_DONE_LS = "quda.lessonsDone";

export function markLearnLabDone(): void {
  try {
    localStorage.setItem(LEARN_LAB_DONE_LS, "1");
  } catch {
    /* private mode — session-scoped progress is fine */
  }
}

export function isLearnLabDone(): boolean {
  try {
    return localStorage.getItem(LEARN_LAB_DONE_LS) === "1";
  } catch {
    return false;
  }
}

/** True when EVERY guided lesson is done (the track-level checkmark —
 *  per-lesson state stays LessonCard's business). */
export function areLessonsDone(): boolean {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(LESSONS_DONE_LS) ?? "[]",
    );
    return (
      Array.isArray(raw) && LESSONS.every((l) => raw.includes(l.key))
    );
  } catch {
    return false;
  }
}
