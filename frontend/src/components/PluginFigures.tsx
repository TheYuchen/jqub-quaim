/**
 * Renders a plugin step's rich figures. The backend
 * (plugin_runner._scrub_figures) has already validated each figure
 * and rejected anything unsafe — SVG with <script>/on* attributes,
 * markdown with raw HTML, oversized payloads. Each figure type has a
 * dedicated renderer below; unknown types fall through to a neutral
 * "unsupported figure" stub so a forward-compatible plugin still gets
 * acknowledged rather than silently dropped.
 */

import { useMemo } from "react";

type Figure =
  | { type: "markdown"; title?: string | null; content: string }
  | {
      type: "table";
      title?: string | null;
      headers: string[];
      rows: Array<Array<string | number | boolean | null>>;
    }
  | {
      type: "bar";
      title?: string | null;
      x_label?: string | null;
      y_label?: string | null;
      data: Array<{ label: string; value: number }>;
    }
  | { type: "svg"; title?: string | null; content: string }
  | { type: "image_png_b64"; title?: string | null; content: string };

export function PluginFigures({
  figures,
}: {
  figures: Array<Record<string, unknown>>;
}) {
  if (!figures || figures.length === 0) return null;
  return (
    <div className="mt-3 space-y-3">
      {figures.map((rawFig, i) => {
        const fig = rawFig as unknown as Figure;
        return <FigureFrame key={i} fig={fig} />;
      })}
    </div>
  );
}

function FigureFrame({ fig }: { fig: Figure }) {
  return (
    <div className="border border-edge rounded-md p-2 bg-surface/40">
      {fig.title && (
        <div className="text-[11px] uppercase tracking-wider text-mute mb-1.5">
          {fig.title}
        </div>
      )}
      <FigureBody fig={fig} />
    </div>
  );
}

function FigureBody({ fig }: { fig: Figure }) {
  switch (fig.type) {
    case "markdown":
      return <MarkdownBlock content={fig.content} />;
    case "table":
      return <TableBlock headers={fig.headers} rows={fig.rows} />;
    case "bar":
      return (
        <BarBlock
          data={fig.data}
          xLabel={fig.x_label ?? null}
          yLabel={fig.y_label ?? null}
        />
      );
    case "svg":
      return <SvgBlock content={fig.content} />;
    case "image_png_b64":
      return <PngBlock content={fig.content} alt={fig.title ?? "Plugin image"} />;
    default:
      return (
        <div className="text-[11px] text-mute italic">
          Unsupported figure type. Update your client or check the SDK.
        </div>
      );
  }
}

// ----- Markdown ---------------------------------------------------------
// Tiny safe renderer. Supports ATX headings (# … ######), unordered
// lists with `- `, ordered lists with `N. `, code blocks (```), inline
// code (`x`), bold (**x**), italics (*x*), and paragraph breaks. The
// backend already rejected any markdown containing raw HTML, so we
// don't need a sanitiser here; we just never emit dangerouslySet*.

function MarkdownBlock({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  return (
    <div className="text-[12px] leading-relaxed text-ink space-y-2">
      {blocks.map((b, i) => (
        <MarkdownBlockEl key={i} block={b} />
      ))}
    </div>
  );
}

type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; text: string; lang: string | null }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parseMarkdownBlocks(src: string): MdBlock[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing fence
      out.push({ kind: "code", text: buf.join("\n"), lang });
      continue;
    }
    // ATX heading
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      out.push({ kind: "heading", level, text: heading[2] });
      i++;
      continue;
    }
    // UL
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push({ kind: "ul", items });
      continue;
    }
    // OL
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push({ kind: "ol", items });
      continue;
    }
    // Paragraph: gobble until a blank line or special construct
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push({ kind: "paragraph", text: para.join(" ") });
  }
  return out;
}

function MarkdownBlockEl({ block }: { block: MdBlock }) {
  if (block.kind === "heading") {
    const sizes = {
      1: "text-base font-semibold",
      2: "text-sm font-semibold",
      3: "text-[13px] font-semibold",
      4: "text-[12px] font-semibold",
      5: "text-[11px] font-semibold",
      6: "text-[11px] font-semibold text-mute",
    } as const;
    return (
      <div className={`${sizes[block.level]} text-ink`}>
        <InlineMd text={block.text} />
      </div>
    );
  }
  if (block.kind === "code") {
    return (
      <pre className="text-[11px] bg-canvas/60 border border-edge rounded p-2 overflow-x-auto font-mono leading-relaxed">
        <code>{block.text}</code>
      </pre>
    );
  }
  if (block.kind === "ul") {
    return (
      <ul className="list-disc list-inside space-y-0.5 text-[12px]">
        {block.items.map((it, i) => (
          <li key={i}>
            <InlineMd text={it} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "ol") {
    return (
      <ol className="list-decimal list-inside space-y-0.5 text-[12px]">
        {block.items.map((it, i) => (
          <li key={i}>
            <InlineMd text={it} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <p>
      <InlineMd text={block.text} />
    </p>
  );
}

/** Inline-level markdown: **bold**, *italic*, `code`. No HTML. */
function InlineMd({ text }: { text: string }) {
  // Tokenise simple inline patterns in priority order. Bold first so
  // `**x*y**` reads as bold rather than nested italic.
  const tokens: Array<{
    kind: "bold" | "italic" | "code" | "text";
    value: string;
  }> = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: text.slice(last, m.index) });
    }
    if (m[1]) tokens.push({ kind: "bold", value: m[2] });
    else if (m[3]) tokens.push({ kind: "italic", value: m[4] });
    else if (m[5]) tokens.push({ kind: "code", value: m[6] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    tokens.push({ kind: "text", value: text.slice(last) });
  }
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === "bold") return <strong key={i}>{t.value}</strong>;
        if (t.kind === "italic") return <em key={i}>{t.value}</em>;
        if (t.kind === "code")
          return (
            <code
              key={i}
              className="px-1 py-0.5 rounded bg-canvas/60 border border-edge font-mono text-[11px]"
            >
              {t.value}
            </code>
          );
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}

// ----- Table ------------------------------------------------------------

function TableBlock({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-[12px] w-full">
        <thead>
          <tr className="text-left border-b border-edge text-mute">
            {headers.map((h, i) => (
              <th key={i} className="py-1 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-edge/40 last:border-0 text-ink"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="py-1 pr-3 font-mono text-[11px]">
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(c: string | number | boolean | null): string {
  if (c === null || c === undefined) return "—";
  if (typeof c === "number") {
    if (Number.isInteger(c)) return String(c);
    return c.toFixed(4).replace(/\.?0+$/, "");
  }
  if (typeof c === "boolean") return c ? "true" : "false";
  return String(c);
}

// ----- Bar chart --------------------------------------------------------
// Inline SVG (no dependency) — bar widths scale to the max value in
// the dataset. Vertical orientation, horizontal text labels under
// each bar. Handles negative values by clipping to 0.

function BarBlock({
  data,
  xLabel,
  yLabel,
}: {
  data: Array<{ label: string; value: number }>;
  xLabel: string | null;
  yLabel: string | null;
}) {
  // Layout geometry (in SVG user units == px).
  const padLeft = yLabel ? 44 : 28;
  const padRight = 8;
  const padTop = 8;
  const padBottom = xLabel ? 40 : 28;
  const chartH = 140;
  const barGap = 6;
  const minBarW = 14;
  const maxBarW = 36;
  // Always give each bar at least minBarW px. When N is large the
  // chart grows past the card width and the outer wrapper scrolls
  // horizontally — that's better than shrinking labels to 5px.
  const width = Math.max(
    260,
    padLeft + padRight + data.length * (minBarW + barGap),
  );

  const positiveValues = data.map((d) => Math.max(0, d.value));
  const maxV = Math.max(...positiveValues, 1);
  const barW = Math.min(
    maxBarW,
    Math.max(
      minBarW,
      (width - padLeft - padRight - data.length * barGap) / data.length,
    ),
  );

  // Screen-reader friendly summary of the chart. Without this, an
  // assistive-tech user just hears "Bar chart" and can't interrogate
  // the actual data. We keep it brief: count, max, top bar.
  const top = data.reduce(
    (acc, d) => (d.value > acc.value ? d : acc),
    data[0],
  );
  const ariaLabel = `Bar chart of ${data.length} value${
    data.length === 1 ? "" : "s"
  }. Maximum: ${formatBarValue(top.value)} at "${top.label}".`;

  return (
    <div className="overflow-x-auto">
    <svg
      viewBox={`0 0 ${width} ${chartH + padTop + padBottom}`}
      // No w-full here: when width > container, the parent
      // overflow-x-auto kicks in instead of squashing bars.
      width={width}
      height={chartH + padTop + padBottom}
      style={{ maxWidth: "100%" }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Y-axis label */}
      {yLabel && (
        <text
          x={12}
          y={padTop + chartH / 2}
          fill="currentColor"
          fontSize="10"
          opacity="0.55"
          transform={`rotate(-90 12 ${padTop + chartH / 2})`}
          textAnchor="middle"
        >
          {yLabel}
        </text>
      )}
      {/* Baseline */}
      <line
        x1={padLeft - 2}
        y1={padTop + chartH}
        x2={width - padRight}
        y2={padTop + chartH}
        stroke="currentColor"
        strokeOpacity="0.25"
      />
      {/* Bars */}
      {data.map((d, i) => {
        const v = Math.max(0, d.value);
        const h = (v / maxV) * chartH;
        const x = padLeft + i * (barW + barGap);
        const y = padTop + chartH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              fill="rgb(var(--color-accent2))"
              fillOpacity="0.8"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={padTop + chartH - h - 3}
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.7"
              textAnchor="middle"
            >
              {formatBarValue(d.value)}
            </text>
            <text
              x={x + barW / 2}
              y={padTop + chartH + 12}
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.65"
              textAnchor="middle"
            >
              {truncate(d.label, 10)}
            </text>
          </g>
        );
      })}
      {/* X-axis label */}
      {xLabel && (
        <text
          x={padLeft + (width - padLeft - padRight) / 2}
          y={padTop + chartH + padBottom - 6}
          fontSize="10"
          fill="currentColor"
          fillOpacity="0.55"
          textAnchor="middle"
        >
          {xLabel}
        </text>
      )}
    </svg>
    </div>
  );
}

function formatBarValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// ----- Raw SVG ----------------------------------------------------------
// The backend's _scrub_figures rejected anything containing <script>,
// javascript: URLs, <foreignObject>, event-handler attrs, etc. As
// defense-in-depth we still render inside a sandboxed iframe so a
// stage-2 bypass (CSS-injection, future SVG attack vectors) can't
// touch our DOM, cookies, or origin. The iframe has no allow-
// scripts, no allow-same-origin — even if SVG content somehow runs
// JS, it can't reach the parent page.

function SvgBlock({ content }: { content: string }) {
  // Wrap in minimal HTML so the iframe knows it's rendering SVG.
  // body padding 0 + neutral background matches the rest of the card.
  const srcdoc = useMemo(() => {
    const css = `
      html,body{margin:0;padding:0;background:transparent;color:inherit}
      body{overflow:auto;max-width:100%}
      svg{max-width:100%;height:auto;display:block}
    `;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${content}</body></html>`;
  }, [content]);
  // Try to extract an aspect ratio from the SVG's viewBox attribute so
  // the iframe gets a sensible height proportional to its content.
  // Without this, every plugin SVG got the same 288px box — short
  // figures wasted space, tall ones clipped. The sandbox prevents
  // postMessage so we can't auto-size from inside; this is the next
  // best thing.
  const aspect = useMemo(() => {
    // viewBox is `min-x min-y width height` separated by whitespace
    // OR commas. We don't care about min-x / min-y; capture the
    // trailing pair as width + height.
    const m = /viewBox\s*=\s*['"]\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*['"]/.exec(
      content,
    );
    if (m) {
      const w = parseFloat(m[1]);
      const h = parseFloat(m[2]);
      if (w > 0 && h > 0) return `${w} / ${h}`;
    }
    return "16 / 9";
  }, [content]);
  return (
    <iframe
      sandbox=""
      title="Plugin SVG figure"
      srcDoc={srcdoc}
      style={{ aspectRatio: aspect, maxHeight: "70vh" }}
      className="w-full border-0"
    />
  );
}

// ----- PNG image --------------------------------------------------------

function PngBlock({ content, alt }: { content: string; alt: string }) {
  return (
    <img
      src={`data:image/png;base64,${content}`}
      alt={alt}
      className="max-w-full h-auto rounded"
    />
  );
}
