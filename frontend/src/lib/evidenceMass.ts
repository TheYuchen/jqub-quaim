// Evidence-mass encoding (Wave J), lifted into a shared module by the
// IA-inversion wave: the lineage (RunHistory) and the Evidence-board
// card's expanded run-dots strip must size dots IDENTICALLY, or "dot
// area = shots of evidence" stops being one encoding.
//
// dot AREA ∝ √shots ⇒ radius ∝ shots^(1/4), against a FIXED 2048-shot
// reference (not view-normalized) so the same run keeps the same
// weight across sessions, panels and figures — the same stability
// argument as the hash→hue mapping. 512 shots ≈ 5px, 2048 ≈ 7px; an
// early stop at 512 of 2048 reads plainly lighter. Area (not radius)
// because dots read as quantities; √shots (not shots) so a 4096-shot
// run cannot visually swallow eight 512s.

export const R_MIN = 3; // radius floor (runs with no sampled evidence)
export const R_MAX = 7; // radius cap
export const SHOTS_REF = 2048; // shots that earn R_MAX = the default full budget

export function evidenceRadius(shots: number): number {
  if (!(shots > 0)) return R_MIN;
  return Math.max(
    R_MIN,
    Math.min(R_MAX, R_MAX * Math.pow(shots / SHOTS_REF, 0.25)),
  );
}
