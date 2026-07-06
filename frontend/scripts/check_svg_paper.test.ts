// Unit-style verification of the Illustrator-grade SVG export core
// (lib/svgPaper.ts) — pure functions, so this runs in plain node with
// no DOM/jsdom:  node --experimental-strip-types scripts/check_svg_paper.test.ts
//
// What is verified:
//   1. the presentation inliner resolves the constructs Illustrator
//      cannot handle (var()-bearing computed values arrive resolved
//      from getComputedStyle; the inliner must emit them literally,
//      normalize px lengths away, and force a concrete font stack);
//   2. the string finalizer strips class attributes + <style> blocks
//      and prepends the standalone XML declaration;
//   3. the safety audit flags every banned construct and passes a
//      correctly finalized document with zero findings.

import assert from "node:assert/strict";
import {
  PAPER_FONT_BUMP,
  auditIllustratorSafety,
  concreteFontStack,
  finalizeSvgMarkup,
  inlinePresentation,
  stripPx,
  stripPxList,
} from "../src/lib/svgPaper.ts";

const attrs = (pairs: Array<[string, string]>): Record<string, string> =>
  Object.fromEntries(pairs);

// -- font stacks -------------------------------------------------------------
assert.equal(
  concreteFontStack('ui-sans-serif, system-ui, "Segoe UI", Roboto'),
  "Helvetica, Arial, sans-serif",
);
assert.equal(
  concreteFontStack("ui-monospace, monospace"),
  "Menlo, Consolas, 'Courier New', monospace",
);
assert.equal(concreteFontStack("Menlo"), "Menlo, Consolas, 'Courier New', monospace");

// -- length normalization ----------------------------------------------------
assert.equal(stripPx("2.5px"), "2.5");
assert.equal(stripPx("middle"), "middle");
assert.equal(stripPxList("5px, 3px"), "5, 3");

// -- inliner: text element ----------------------------------------------------
{
  // Simulated getComputedStyle: browser has ALREADY resolved
  // fill="rgb(var(--color-ink))" to a literal — the inliner's job is
  // to write that literal as a presentation attribute.
  const computed: Record<string, string> = {
    fill: "rgb(31, 41, 55)",
    "fill-opacity": "1",
    stroke: "none",
    opacity: "1",
    "font-family": "ui-sans-serif, system-ui",
    "font-size": "11px",
    "font-weight": "600",
    "font-style": "normal",
    "text-anchor": "middle",
    "dominant-baseline": "auto",
    "letter-spacing": "normal",
  };
  const a = attrs(inlinePresentation("text", (p) => computed[p] ?? ""));
  assert.equal(a.fill, "rgb(31, 41, 55)");
  assert.equal(a["font-family"], "Helvetica, Arial, sans-serif");
  assert.equal(a["font-size"], String(11 * PAPER_FONT_BUMP)); // paper bump
  assert.equal(a["font-weight"], "600");
  assert.equal(a["text-anchor"], "middle");
  assert.ok(!("dominant-baseline" in a), "default dominant-baseline omitted");
  assert.ok(!("opacity" in a), "opacity 1 omitted");
  assert.ok(!("stroke" in a), "stroke none omitted");
}

// -- inliner: dashed line ------------------------------------------------------
{
  const computed: Record<string, string> = {
    fill: "rgb(0, 0, 0)",
    stroke: "rgb(217, 119, 6)",
    "stroke-width": "1.5px",
    "stroke-dasharray": "5px, 3px",
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
    "stroke-opacity": "1",
    opacity: "0.9",
  };
  const a = attrs(inlinePresentation("line", (p) => computed[p] ?? ""));
  assert.ok(!("fill" in a), "fill meaningless on <line>");
  assert.equal(a.stroke, "rgb(217, 119, 6)");
  assert.equal(a["stroke-width"], "1.5");
  assert.equal(a["stroke-dasharray"], "5, 3");
  assert.equal(a.opacity, "0.9");
  assert.ok(!("stroke-linecap" in a), "default linecap omitted");
}

// -- inliner: filled polygon keeps explicit fill="none" on polyline ------------
{
  const a = attrs(
    inlinePresentation("polyline", (p) =>
      ({ fill: "none", stroke: "rgb(30, 64, 175)", "stroke-width": "1px" })[p] ?? "",
    ),
  );
  assert.equal(a.fill, "none", "explicit none must survive");
  assert.equal(a["stroke-width"], "1");
}

// -- inliner: gradient stop -----------------------------------------------------
{
  const a = attrs(
    inlinePresentation("stop", (p) =>
      ({ "stop-color": "rgb(16, 185, 129)", "stop-opacity": "0.4" })[p] ?? "",
    ),
  );
  assert.equal(a["stop-color"], "rgb(16, 185, 129)");
  assert.equal(a["stop-opacity"], "0.4");
}

// -- inliner: group carries only opacity ----------------------------------------
{
  const a = attrs(
    inlinePresentation("g", (p) => ({ opacity: "0.55", fill: "rgb(1,2,3)" })[p] ?? ""),
  );
  assert.deepEqual(a, { opacity: "0.55" });
}

// -- finalizer + audit -----------------------------------------------------------
{
  const dirty =
    '<svg xmlns="http://www.w3.org/2000/svg" class="evidence-theater" viewBox="0 0 10 10">' +
    "<style>.chip{fill:red}</style>" +
    '<text class="t" fill="rgb(var(--color-ink))" stroke="currentColor">hi</text></svg>';

  const before = auditIllustratorSafety(dirty);
  assert.deepEqual(before, [
    "unresolved var() reference",
    "unresolved currentColor",
    "class attribute survived",
    "<style> block survived",
  ]);

  const finalized = finalizeSvgMarkup(dirty);
  assert.ok(finalized.startsWith('<?xml version="1.0"'), "XML declaration");
  assert.ok(!finalized.includes("class="), "classes stripped");
  assert.ok(!finalized.includes("<style"), "<style> stripped");
  // var()/currentColor are NOT string-fixable — they must be resolved
  // by the DOM inliner. The audit still reports them:
  assert.deepEqual(auditIllustratorSafety(finalized), [
    "unresolved var() reference",
    "unresolved currentColor",
  ]);

  const clean = finalizeSvgMarkup(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="7.5pt" height="7.5pt">' +
      '<text fill="rgb(31, 41, 55)" font-family="Helvetica, Arial, sans-serif" font-size="13.75">hi</text></svg>',
  );
  assert.deepEqual(auditIllustratorSafety(clean), []);
}

console.log("svgPaper: all Illustrator-safety checks passed");
