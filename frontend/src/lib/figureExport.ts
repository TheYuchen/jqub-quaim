// Figure export with embedded provenance (Wave P).
//
// One-click "camera" on each major view turns the live DOM into a
// paper-ready figure. The point is not the pixels — it is that every
// exported figure carries, inside the file, everything needed to
// regenerate it bit-exactly: app version, export time, the run_ids +
// root_seeds + config_hashes of every run visible in the view, and the
// current graph SharePayload. A figure in the paper is thus a
// *provenance-backed* artifact, not a screenshot.
//
// Serialization paths (per view):
//   * TRUE-SVG — when the export target IS an <svg> element (the
//     SVG-native views: lineage gutter, outcome/pipeline strips,
//     signature glyphs, ribbon edge layer). The svg subtree is cloned
//     with all computed styles inlined (CSS variables don't survive
//     serialization) and written out as standalone vector SVG.
//   * HYBRID — for HTML-heavy composite views (whole canvas, the
//     Multiverse board, the Evidence pane). foreignObject-in-SVG is
//     produced (vector text, correct in browsers) BUT some renderers
//     (older Inkscape/rsvg, some LaTeX toolchains) don't rasterize
//     foreignObject, so a high-resolution PNG (2.5× device pixels) is
//     exported alongside as the always-works fallback.
//   Both paths also download a `<name>.provenance.json` sidecar with
//   the same JSON that is embedded in the SVG <metadata> element.
//
// Paper styling transform applied to the clone:
//   * forced light/white background (the theme attribute is lifted for
//     one frame so computed styles resolve against the print theme);
//   * font sizes bumped 1.25× (short labels; dense chips may truncate
//     slightly — boxes stay pinned so layout cannot smear);
//   * interactive chrome stripped: buttons, form controls, scrollbars,
//     React Flow controls/minimap/attribution, tooltips, toasts, and
//     anything tagged data-export-strip.

import type { SharePayload } from "./share";
import { APP_NAME } from "./anon";
import { useApp } from "./store";
import { listRuns } from "./runStore";

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

export interface FigureProvenance {
  app: string;
  app_version: string | null;
  exported_at: string;
  view: string;
  /** Every run visible in the exported view. */
  runs: {
    run_id: string;
    root_seed: number | null;
    config_hash: string | null;
  }[];
  /** The canvas graph at export time (share-link payload — paste it
   *  after `#s=` on any deployment to rebuild the pipeline). */
  graph: SharePayload | null;
  regenerate: string;
}

/** Which archived/live runs are visible in a given view. */
async function runsForView(
  view: string,
): Promise<FigureProvenance["runs"]> {
  const st = useApp.getState();
  if (view === "multiverse" || view === "evidence-history") {
    const all = await listRuns(500);
    return all.map((r) => ({
      run_id: r.run_id,
      root_seed: r.root_seed,
      config_hash: r.config_hash,
    }));
  }
  if (view === "evidence-compare") {
    const all = await listRuns(500);
    return all
      .filter((r) => st.compareIds.includes(r.run_id))
      .map((r) => ({
        run_id: r.run_id,
        root_seed: r.root_seed,
        config_hash: r.config_hash,
      }));
  }
  // canvas / evidence-current: the live run, if any.
  const run = st.run;
  if (run?.run_id) {
    return [
      {
        run_id: run.run_id,
        root_seed: run.root_seed ?? null,
        config_hash: st.lastConfigHash,
      },
    ];
  }
  return [];
}

export async function collectProvenance(
  view: string,
  graph: SharePayload | null,
): Promise<FigureProvenance> {
  const st = useApp.getState();
  return {
    app: APP_NAME,
    app_version: st.run?.app_version ?? st.health?.version ?? null,
    exported_at: new Date().toISOString(),
    view,
    runs: await runsForView(view),
    graph,
    regenerate:
      "Rebuild the pipeline via '#s=' + base64url(graph) on any deployment; " +
      "pin a run's root_seed to replay its draws bit-exactly; " +
      "?scenario=F1..F6 boots the paper's scripted figure states.",
  };
}

// ---------------------------------------------------------------------------
// DOM cloning with inlined computed styles
// ---------------------------------------------------------------------------

const STRIP_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "[data-export-strip]",
  '[role="tooltip"]',
  '[role="alert"]',
  '[role="status"]',
  ".react-flow__controls",
  ".react-flow__minimap",
  ".react-flow__attribution",
  ".react-flow__panel",
].join(",");

function shouldStrip(el: Element): boolean {
  try {
    return el.matches(STRIP_SELECTOR);
  } catch {
    return false;
  }
}

const FONT_BUMP = 1.25;

/** Recursively clone `src`, baking every computed style property into
 *  inline styles (theme CSS variables and Tailwind classes don't exist
 *  outside the app's stylesheet) and applying the paper transform. */
function cloneWithStyles(src: Element): Element | null {
  if (shouldStrip(src)) return null;
  const clone = src.cloneNode(false) as Element;
  const isStylable =
    src instanceof HTMLElement || src instanceof SVGElement;
  if (isStylable) {
    const cs = window.getComputedStyle(src);
    const style = (clone as HTMLElement | SVGElement).style;
    let css = "";
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      css += `${prop}:${cs.getPropertyValue(prop)};`;
    }
    style.cssText = css;
    // Paper transform: larger type for print legibility.
    const fs = parseFloat(cs.fontSize);
    if (Number.isFinite(fs) && fs > 0) {
      style.fontSize = `${fs * FONT_BUMP}px`;
      const lh = parseFloat(cs.lineHeight);
      if (Number.isFinite(lh) && lh > 0) {
        style.lineHeight = `${lh * FONT_BUMP}px`;
      }
    }
    // No scrollbars in figures.
    if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
      style.overflowY = "hidden";
    }
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
      style.overflowX = "hidden";
    }
  }
  for (const child of Array.from(src.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const c = cloneWithStyles(child as Element);
      if (c) clone.appendChild(c);
    } else {
      clone.appendChild(child.cloneNode(true));
    }
  }
  return clone;
}

/** Lift the theme attribute so computed styles resolve against the
 *  light (print) theme, run `fn`, then restore. Two RAFs let the
 *  browser recompute styles before we read them. */
async function withLightTheme<T>(fn: () => Promise<T> | T): Promise<T> {
  const html = document.documentElement;
  const saved = html.dataset.theme;
  if (saved) delete html.dataset.theme;
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  try {
    return await fn();
  } finally {
    if (saved) html.dataset.theme = saved;
  }
}

function makeMetadata(provenance: FigureProvenance): SVGMetadataElement {
  const meta = document.createElementNS(
    SVG_NS,
    "metadata",
  ) as SVGMetadataElement;
  meta.setAttribute("id", "provenance");
  // XMLSerializer escapes the text content, so raw JSON is safe here.
  meta.textContent = JSON.stringify(provenance, null, 2);
  return meta;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Give the browser a beat before revoking (Safari races otherwise).
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------------------
// Serialization paths
// ---------------------------------------------------------------------------

/** TRUE-SVG path: the target is already vector — clone, inline styles,
 *  white background rect, metadata, standalone header. */
function serializeSvgNative(
  target: SVGSVGElement,
  provenance: FigureProvenance,
): string {
  const clone = cloneWithStyles(target) as SVGSVGElement;
  clone.setAttribute("xmlns", SVG_NS);
  const r = target.getBoundingClientRect();
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
  }
  clone.setAttribute("width", String(Math.ceil(r.width)));
  clone.setAttribute("height", String(Math.ceil(r.height)));
  const vb = (clone.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", String(vb[0] ?? 0));
  bg.setAttribute("y", String(vb[1] ?? 0));
  bg.setAttribute("width", String(vb[2] ?? r.width));
  bg.setAttribute("height", String(vb[3] ?? r.height));
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);
  clone.insertBefore(makeMetadata(provenance), clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

/** HYBRID path: HTML subtree → foreignObject SVG string. */
function serializeHtmlHybrid(
  target: HTMLElement,
  provenance: FigureProvenance,
): { svg: string; width: number; height: number } {
  const r = target.getBoundingClientRect();
  const W = Math.ceil(r.width);
  const H = Math.ceil(r.height);
  const clone = cloneWithStyles(target) as HTMLElement;
  clone.style.margin = "0";
  clone.style.position = "static";
  clone.style.width = `${W}px`;
  clone.style.height = `${H}px`;
  clone.style.backgroundColor = "#ffffff";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.appendChild(makeMetadata(provenance));
  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", String(W));
  bg.setAttribute("height", String(H));
  bg.setAttribute("fill", "#ffffff");
  svg.appendChild(bg);
  const fo = document.createElementNS(SVG_NS, "foreignObject");
  fo.setAttribute("width", String(W));
  fo.setAttribute("height", String(H));
  const wrap = document.createElementNS(XHTML_NS, "div");
  wrap.appendChild(clone);
  fo.appendChild(wrap);
  svg.appendChild(fo);
  return { svg: new XMLSerializer().serializeToString(svg), width: W, height: H };
}

/** Rasterize an SVG string to a PNG blob via canvas. Only safe for
 *  self-contained SVG (all styles inlined, no external resources) —
 *  which is exactly what the serializers above produce. */
function rasterize(
  svgString: string,
  width: number,
  height: number,
  scale = 2.5,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("PNG encode failed"));
        }, "image/png");
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG rasterization failed"));
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Export `target` as a paper figure. Downloads:
 *   <name>.svg              — vector (true-SVG or foreignObject hybrid)
 *   <name>.png              — high-res raster (hybrid targets only)
 *   <name>.provenance.json  — the same provenance embedded in the SVG
 */
export async function exportFigure(
  target: HTMLElement | SVGSVGElement,
  opts: { name: string; view: string; graph?: SharePayload | null },
): Promise<void> {
  const provenance = await collectProvenance(opts.view, opts.graph ?? null);
  await withLightTheme(async () => {
    if (target instanceof SVGSVGElement) {
      const svgString = serializeSvgNative(target, provenance);
      download(
        new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
        `${opts.name}.svg`,
      );
    } else {
      const { svg, width, height } = serializeHtmlHybrid(target, provenance);
      download(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        `${opts.name}.svg`,
      );
      try {
        const png = await rasterize(svg, width, height);
        download(png, `${opts.name}.png`);
      } catch {
        // foreignObject rasterization can fail on exotic browsers —
        // the SVG + sidecar still landed, so don't fail the export.
      }
    }
  });
  download(
    new Blob([JSON.stringify(provenance, null, 2)], {
      type: "application/json",
    }),
    `${opts.name}.provenance.json`,
  );
}
