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
      <span className="block mb-0.5">{spec.label}</span>
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
      {spec.hint && (
        <span className="block mt-0.5 text-[10px] text-mute/80 leading-tight">
          {spec.hint}
        </span>
      )}
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
      <span className="flex items-baseline justify-between mb-0.5">
        <span>{spec.label}</span>
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
      {(rangeText || spec.hint) && (
        <span className="flex justify-between mt-0.5 text-[10px] text-mute/80 leading-tight gap-2">
          {spec.hint && <span className="truncate">{spec.hint}</span>}
          {rangeText && (
            <span className="font-mono shrink-0">{rangeText}</span>
          )}
        </span>
      )}
    </label>
  );
}

function formatNum(n: number, precision: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(precision);
}
