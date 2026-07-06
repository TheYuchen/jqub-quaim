// Illustrator-grade SVG serialization helpers (paper figure pipeline).
//
// Adobe Illustrator (and most print toolchains) cannot resolve CSS
// custom properties, ignores <style> blocks with class selectors, and
// chokes on currentColor — everything a live web SVG leans on. The
// figure exporter therefore rewrites the exported subtree so that ALL
// presentation is carried by literal presentation ATTRIBUTES on the
// elements themselves. This module holds the pure decision logic
// (which attributes to write, with which normalized values) so it can
// be unit-tested in plain node (scripts/check_svg_paper.test.ts) —
// the DOM walking lives in figureExport.ts and simply feeds computed
// styles through these functions.
//
// Guarantees for an exported true-SVG figure:
//   * zero var(...) / currentColor / class="..." / <style> blocks;
//   * every color a literal rgb()/hsl()/hex resolved via
//     getComputedStyle at export time (under the forced light theme);
//   * all text as real <text>/<tspan> with a concrete font stack
//     ("Helvetica, Arial, sans-serif"; monospace text keeps a concrete
//     mono stack) — no ui-sans-serif/system-ui tokens AI can't map;
//   * lengths unitless (SVG user units) — "2.5px" → "2.5";
//   * viewBox plus explicit width/height in pt (1px = 0.75pt) and a
//     standalone XML declaration.

/** Paper transform: fonts bumped for print legibility (same factor the
 *  hybrid path applies via cloned cssText — keep the two in sync). */
export const PAPER_FONT_BUMP = 1.25;

/** Whitelisted presentation attributes the inliner may write. */
export const SVG_PRESENTATION_WHITELIST = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "stop-color",
  "stop-opacity",
] as const;

const TEXT_TAGS = new Set(["text", "tspan", "textpath"]);
const SHAPE_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "use",
  "image",
]);

/** Map a computed font-family (ui-sans-serif, system-ui, Inter var,
 *  ...) onto a stack every Illustrator install can resolve. Only the
 *  mono/proportional distinction survives — that is the one channel
 *  the views actually encode with (hashes/seeds are mono). */
export function concreteFontStack(computedFamily: string): string {
  return /mono|courier|consolas|menlo/i.test(computedFamily)
    ? "Menlo, Consolas, 'Courier New', monospace"
    : "Helvetica, Arial, sans-serif";
}

/** "2.5px" → "2.5" (SVG user units); non-numeric values pass through. */
export function stripPx(v: string): string {
  const t = v.trim();
  const m = /^(-?\d*\.?\d+)px$/.exec(t);
  return m ? m[1] : t;
}

/** "5px, 3px" → "5, 3" — computed stroke-dasharray comes back in px. */
export function stripPxList(v: string): string {
  return v
    .split(",")
    .map((s) => stripPx(s))
    .join(", ");
}

const trimNum = (n: number): string =>
  String(Math.round(n * 1000) / 1000);

/**
 * Decide the literal presentation attributes for one element.
 *
 * `computed` is a getter over the element's *computed* style (already
 * var()-resolved and currentColor-resolved by the browser); in tests
 * it is a plain lookup. Returns [attribute, value] pairs; defaults are
 * omitted to keep the file lean, EXCEPT fill, which is always written
 * on paintable elements (fill's implicit default is black — writing it
 * makes every element self-describing once class/style are stripped).
 */
export function inlinePresentation(
  tag: string,
  computed: (prop: string) => string,
): Array<[string, string]> {
  const t = tag.toLowerCase();
  const out: Array<[string, string]> = [];
  const isText = TEXT_TAGS.has(t);
  const isShape = SHAPE_TAGS.has(t) || isText;

  if (t === "stop") {
    const sc = computed("stop-color");
    if (sc) out.push(["stop-color", sc]);
    const so = computed("stop-opacity");
    if (so && so !== "1") out.push(["stop-opacity", so]);
    return out;
  }

  if (isShape) {
    // fill is meaningless on <line>; everywhere else write it always
    // (including explicit "none" — polylines/envelopes depend on it).
    if (t !== "line") {
      const fill = computed("fill");
      if (fill) out.push(["fill", fill]);
      const fo = computed("fill-opacity");
      if (fo && fo !== "1") out.push(["fill-opacity", fo]);
    }
    const stroke = computed("stroke");
    if (stroke && stroke !== "none") {
      out.push(["stroke", stroke]);
      const sw = computed("stroke-width");
      if (sw) out.push(["stroke-width", stripPx(sw)]);
      const dash = computed("stroke-dasharray");
      if (dash && dash !== "none")
        out.push(["stroke-dasharray", stripPxList(dash)]);
      const cap = computed("stroke-linecap");
      if (cap && cap !== "butt") out.push(["stroke-linecap", cap]);
      const join = computed("stroke-linejoin");
      if (join && join !== "miter") out.push(["stroke-linejoin", join]);
      const so = computed("stroke-opacity");
      if (so && so !== "1") out.push(["stroke-opacity", so]);
    }
  }

  // Group opacity is the one property that must live on <g> (it is NOT
  // the product of the children's own opacities).
  const op = computed("opacity");
  if (op && op !== "1") out.push(["opacity", op]);

  if (isText) {
    out.push(["font-family", concreteFontStack(computed("font-family"))]);
    const fs = parseFloat(computed("font-size"));
    if (Number.isFinite(fs) && fs > 0)
      out.push(["font-size", trimNum(fs * PAPER_FONT_BUMP)]);
    const fw = computed("font-weight");
    if (fw && fw !== "400" && fw !== "normal") out.push(["font-weight", fw]);
    const fst = computed("font-style");
    if (fst && fst !== "normal") out.push(["font-style", fst]);
    const ta = computed("text-anchor");
    if (ta && ta !== "start") out.push(["text-anchor", ta]);
    const db = computed("dominant-baseline");
    if (db && db !== "auto") out.push(["dominant-baseline", db]);
    const ls = computed("letter-spacing");
    if (ls && ls !== "normal") out.push(["letter-spacing", stripPx(ls)]);
  }
  return out;
}

/**
 * Final string-level pass over serialized SVG markup: prepend the
 * standalone XML declaration, drop every class attribute (all
 * presentation is inlined by now) and any <style> block (defense in
 * depth — the clone walker never emits one). Pure string → string so
 * it is trivially testable and never depends on a DOM.
 */
export function finalizeSvgMarkup(svg: string): string {
  const cleaned = svg
    .replace(/\s+class="[^"]*"/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${cleaned}`;
}

/**
 * Audit a finished SVG string for the constructs Illustrator cannot
 * handle. Returns human-readable violations (empty = AI-safe). The
 * exporter warns on violations rather than blocking the download —
 * a flawed figure you can inspect beats a failed export.
 */
export function auditIllustratorSafety(svg: string): string[] {
  const issues: string[] = [];
  if (svg.includes("var(")) issues.push("unresolved var() reference");
  if (/currentColor/.test(svg)) issues.push("unresolved currentColor");
  if (/\sclass="/.test(svg)) issues.push("class attribute survived");
  if (/<style\b/.test(svg)) issues.push("<style> block survived");
  return issues;
}
