import { HelpCircle } from "lucide-react";
import type { NodeParamSpec } from "../lib/nodeCatalog";

/**
 * Inline parameter editor for a canvas node.
 *
 * Schema-driven: takes a `NodeParamSpec[]` from the node's catalog
 * entry and renders one labelled control per param. Exposes the
 * runtime values via the parent's `params` map and pushes edits back
 * through `onChange`. Supports two control types:
 *
 *   - `select` — native `<select>` with a known option list. If the
 *     stored value isn't recognised, an extra disabled "(unknown)"
 *     option surfaces it so the user can see what's stuck rather than
 *     silently snapping to a default.
 *   - `number` / `int` — `<input type="number">` with min/max/step
 *     constraints. We also clamp on the way in (defensive) so the
 *     stored value can never persist outside the declared range, even
 *     if the user types past the spinner buttons.
 *
 * Hints don't render inline — they live on a small ⓘ icon next to the
 * label, surfaced as a native browser tooltip on hover. Keeps the
 * block compact while still letting plain-language explanations be
 * arbitrarily long.
 *
 * `nodrag` on the wrapper is critical: without it, dragging a select
 * to make a choice or selecting text in the input would be intercepted
 * by React Flow as a node-move gesture.
 */
export function NodeParamEditor({
  spec,
  values,
  onChange,
}: {
  spec: NodeParamSpec[];
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="nodrag mt-2 pt-2 border-t border-edge/60 space-y-2">
      {spec.map((p) =>
        p.type === "select" ? (
          <SelectField
            key={p.key}
            spec={p}
            value={String(values[p.key] ?? "")}
            onChange={(v) => onChange({ [p.key]: v })}
          />
        ) : (
          <NumberField
            key={p.key}
            spec={p}
            value={
              typeof values[p.key] === "number"
                ? (values[p.key] as number)
                : Number(values[p.key])
            }
            onChange={(v) => onChange({ [p.key]: v })}
          />
        ),
      )}
    </div>
  );
}

function SelectField({
  spec,
  value,
  onChange,
}: {
  spec: Extract<NodeParamSpec, { type: "select" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const known = spec.options.some((o) => o.value === value);
  return (
    <label className="block text-[10px] text-mute">
      <FieldLabel label={spec.label} hint={spec.hint} />
      <select
        value={known ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[11px] bg-surface border border-edge rounded px-1.5 py-0.5 text-ink focus:outline-none focus:border-accent/60"
      >
        {!known && (
          <option value="" disabled>
            {value || "—"} (unknown)
          </option>
        )}
        {spec.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  spec,
  value,
  onChange,
}: {
  spec: Extract<NodeParamSpec, { type: "number" | "int" }>;
  value: number;
  onChange: (v: number) => void;
}) {
  const safe = Number.isFinite(value) ? value : (spec.min ?? 0);
  const precision =
    spec.displayPrecision ?? (spec.type === "int" ? 0 : 2);
  // Show range hint underneath if both bounds are set.
  const rangeText =
    spec.min !== undefined && spec.max !== undefined
      ? `${formatNum(spec.min, precision)} – ${formatNum(spec.max, precision)}`
      : null;

  return (
    <label className="block text-[10px] text-mute">
      <span className="flex items-baseline justify-between mb-0.5 gap-1">
        <FieldLabel label={spec.label} hint={spec.hint} />
        <span className="font-mono text-ink">
          {formatNum(safe, precision)}
        </span>
      </span>
      <input
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={safe}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          if (!Number.isFinite(raw)) return;
          let next = spec.type === "int" ? Math.round(raw) : raw;
          // Clamp on the way in so the stored value can't drift outside
          // the declared range — protects backends that trust the schema.
          if (spec.min !== undefined) next = Math.max(spec.min, next);
          if (spec.max !== undefined) next = Math.min(spec.max, next);
          onChange(next);
        }}
        className="w-full text-[11px] bg-surface border border-edge rounded px-1.5 py-0.5 text-ink font-mono focus:outline-none focus:border-accent/60"
      />
      {/* Range stays inline as a small mono cue (concrete bounds are
          worth glancing at every time). Long-form hint hides behind the
          ⓘ icon in FieldLabel above. */}
      {rangeText && (
        <span className="block mt-0.5 text-[10px] text-mute/70 font-mono text-right">
          range {rangeText}
        </span>
      )}
    </label>
  );
}

/** Field label with a small ⓘ icon when the param spec carries a hint.
 *
 *  Uses a CSS `group-hover` / `group-focus` tooltip — instant, no
 *  delay, works for keyboard tabs as well as mouse hovers.
 *
 *  Why no `aria-label` or `title` on the icon wrapper:
 *  - `title` has a 1-2 s display delay on macOS Chrome and races our
 *    own tooltip.
 *  - `aria-label` on a `cursor:help` element causes some browsers to
 *    fall back to the same delayed native tooltip, which is what
 *    gave users the "wait 2 seconds before anything shows up" bug.
 *
 *  Instead, the tooltip's own text is what screen readers read (it's
 *  a visible `<span role="tooltip">` containing the same words a
 *  sighted user sees). The icon itself is decorative
 *  (`aria-hidden="true"`).
 *
 *  Geometry: tooltip pops above the icon (`bottom-full mb-1`),
 *  anchored to the icon's center, capped at 14rem so it doesn't
 *  overflow narrow nodes, z-50 to clear React Flow's edge layer.
 *  `pointer-events-none` so the tooltip doesn't trap hovers.
 *
 *  `tabIndex={0}` makes the icon keyboard-focusable so users tabbing
 *  through the form can read each hint without using the mouse;
 *  `group-focus:block` reuses the same tooltip for the focus state.
 */
function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="truncate">{label}</span>
      {hint && (
        <span
          tabIndex={0}
          // Use a NAMED Tailwind group (`group/tip`) instead of plain
          // `group`. The QNode card already carries `group` to drive the
          // hover-reveal × delete button, and unnamed `group-hover:`
          // matches ANY ancestor `.group` — so a plain `group` here was
          // showing every tooltip whenever the user hovered the node
          // card at all. Named groups scope the hover/focus check to
          // exactly this wrapper.
          className="group/tip relative shrink-0 inline-flex items-center text-mute/70 hover:text-ink focus:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded-full cursor-help"
          onClick={(e) => {
            // Keep clicking the icon from focusing the wrapped input.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <HelpCircle
            className="w-3 h-3"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span
            role="tooltip"
            className="hidden group-hover/tip:block group-focus/tip:block pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 w-max max-w-[14rem] rounded-md border border-edge bg-surface text-ink shadow-lg px-2 py-1 text-[11px] leading-snug normal-case tracking-normal font-normal whitespace-normal text-left"
          >
            {hint}
          </span>
        </span>
      )}
    </span>
  );
}

function formatNum(n: number, precision: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(precision);
}
