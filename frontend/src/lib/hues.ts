// Shared config-hash → hue mapping.
//
// One configuration must be the SAME color everywhere it appears —
// timeline dots, config chips, multiverse cards, distribution strips —
// across panels, sessions and screenshots. Both the lineage view
// (RunHistory) and the MultiverseBoard import from here so the mapping
// can never drift between the two.

/** Stable pastel per config hash so replicate groups pop visually.
 *
 *  Collision disclosure (audit S3): 360 hue buckets ⇒ by the birthday
 *  bound, ~50% chance of two configurations sharing a hue once ~23
 *  are archived (and nearby hues blur earlier than that). Acceptable
 *  because hue is a RECOGNITION aid, never an identity: every surface
 *  that colors by hue also prints the #hash chip or tooltip. */
export function hashHue(hash: string): number {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** House style for group hues (same recipe the config chips used). */
export function hueCss(hue: number, alpha = 1): string {
  return `hsl(${hue} 60% 55% / ${alpha})`;
}
