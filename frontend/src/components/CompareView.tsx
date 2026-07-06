// Composition comparison — two archived runs side by side.
//
// This answers the cross-composition question ("A vs B, what actually
// differs and what did it buy me?") that single-run cards cannot:
//   * configuration diff — which node params differ between the two
//     graphs (computed structurally, not by node id);
//   * step-by-step alignment with each side's transformation
//     signature and headline metric;
//   * fidelity deltas as INTERVALS, not scalars — when both sides
//     carry a sampled distribution the two Wilson CIs render on one
//     0-1 scale, and overlap is called out, because "0.462 < 0.475"
//     is not evidence when both intervals span the difference.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { StepResult } from "../lib/api";
import { useApp } from "../lib/store";
import { getRun, type RunRecord } from "../lib/runStore";
import { SignatureGlyph, transformationOf } from "./TransformationSignature";

function sigText(step: StepResult | undefined): string {
  const t = transformationOf(step);
  if (!t || !t.changed) return "·";
  const parts: string[] = [];
  const d = t.delta;
  if (d.depth) parts.push(`D${d.depth > 0 ? "+" : ""}${d.depth}`);
  if (d.size) parts.push(`G${d.size > 0 ? "+" : ""}${d.size}`);
  if (d.num_parameters) parts.push(`P${d.num_parameters > 0 ? "+" : ""}${d.num_parameters}`);
  if (d.num_qubits) parts.push(`Q${d.num_qubits > 0 ? "+" : ""}${d.num_qubits}`);
  return parts.join(" ") || "·";
}

/** Table cell: the shared delta-strip glyph, one per side per step.
 *  Rendering the strip even for pass-through steps (all faint ticks)
 *  keeps every row the same shape, so scanning a column reads as
 *  aligned small multiples; sigText survives as the hover tooltip
 *  carrying the exact numbers. Steps with no circuit in scope at all
 *  fall back to the old middot. */
function SigCell({ step }: { step: StepResult | undefined }) {
  const t = transformationOf(step);
  if (!t) return <span className="font-mono text-mute">·</span>;
  return (
    <span className="inline-block align-middle" title={sigText(step)}>
      <SignatureGlyph t={t} size="tile" />
    </span>
  );
}

interface StepPair {
  a: StepResult | undefined;
  b: StepResult | undefined;
}

/** One aligned step row. `divergence` marks the first row where the
 *  two compositions part ways — accent left border + tiny label, so
 *  the eye lands exactly where the evidence starts. */
function CompareRow({
  pair,
  divergence = false,
}: {
  pair: StepPair;
  divergence?: boolean;
}) {
  const { a, b } = pair;
  return (
    <tr className="border-t border-edge/40">
      <td
        className={`py-0.5 text-ink ${
          divergence ? "border-l-2 border-l-accent/70 pl-1.5" : ""
        }`}
      >
        {a?.label ?? b?.label ?? "—"}
        {a && b && a.node_type !== b.node_type && (
          <span className="text-warn ml-1" title={`A: ${a.node_type}, B: ${b.node_type}`}>≠</span>
        )}
        {divergence && (
          <span
            className="ml-1.5 text-[8px] uppercase tracking-wider text-accent"
            title="First step where the two compositions differ (node kind, params, or transformation signature). Everything above is shared prefix."
          >
            divergence point
          </span>
        )}
      </td>
      <td className="py-0.5 pr-2"><SigCell step={a} /></td>
      <td className="py-0.5 pr-2"><SigCell step={b} /></td>
      <td className="py-0.5 font-mono text-mute">
        {a?.status ?? "—"} / {b?.status ?? "—"}
      </td>
    </tr>
  );
}

function fidelityStep(r: RunRecord): StepResult | undefined {
  for (let i = r.response.steps.length - 1; i >= 0; i--) {
    const s = r.response.steps[i];
    if (s.node_type === "fidelity" && s.status === "ok") return s;
  }
  return undefined;
}

/** Structural param diff between the two graphs: nodes are matched by
 *  (kind, occurrence index in a canonically sorted list), the same
 *  convention configHash uses, so layout and node ids don't matter. */
function paramDiff(a: RunRecord, b: RunRecord): Array<{ where: string; left: string; right: string }> {
  const canon = (r: RunRecord) =>
    [...r.graph.n]
      .map((n) => ({ kind: n.k, params: n.p ?? {} }))
      .sort((x, y) => {
        const kx = `${x.kind}|${JSON.stringify(x.params)}`;
        const ky = `${y.kind}|${JSON.stringify(y.params)}`;
        return kx < ky ? -1 : kx > ky ? 1 : 0;
      });
  const A = canon(a);
  const B = canon(b);
  const out: Array<{ where: string; left: string; right: string }> = [];
  const byKind = (list: typeof A) => {
    const m = new Map<string, Array<Record<string, unknown>>>();
    list.forEach((n) => {
      const arr = m.get(n.kind) ?? [];
      arr.push(n.params);
      m.set(n.kind, arr);
    });
    return m;
  };
  const mA = byKind(A);
  const mB = byKind(B);
  const kinds = new Set([...mA.keys(), ...mB.keys()]);
  kinds.forEach((kind) => {
    const la = mA.get(kind) ?? [];
    const lb = mB.get(kind) ?? [];
    const n = Math.max(la.length, lb.length);
    for (let i = 0; i < n; i++) {
      const pa = la[i];
      const pb = lb[i];
      if (pa === undefined || pb === undefined) {
        out.push({
          where: kind,
          left: pa === undefined ? "(absent)" : "(present)",
          right: pb === undefined ? "(absent)" : "(present)",
        });
        continue;
      }
      const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
      keys.forEach((k) => {
        const va = JSON.stringify(pa[k] ?? null);
        const vb = JSON.stringify(pb[k] ?? null);
        if (va !== vb) out.push({ where: `${kind}.${k}`, left: va, right: vb });
      });
    }
  });
  if (a.sample_key !== b.sample_key) {
    out.unshift({
      where: "circuit",
      left: a.sample_key ?? a.circuit_name ?? "upload",
      right: b.sample_key ?? b.circuit_name ?? "upload",
    });
  }
  return out;
}

function ciOf(s: StepResult | undefined): [number, number] | null {
  const d = s?.distribution as { ci95?: [number, number] } | null | undefined;
  return d?.ci95 ?? null;
}

export function CompareView() {
  const compareIds = useApp((s) => s.compareIds);
  const clearCompare = useApp((s) => s.clearCompare);
  const [recs, setRecs] = useState<[RunRecord, RunRecord] | null>(null);

  useEffect(() => {
    if (compareIds.length !== 2) {
      setRecs(null);
      return;
    }
    let cancelled = false;
    Promise.all([getRun(compareIds[0]), getRun(compareIds[1])]).then(([a, b]) => {
      if (!cancelled && a && b) setRecs([a, b]);
    });
    return () => {
      cancelled = true;
    };
  }, [compareIds]);

  if (compareIds.length !== 2 || !recs) return null;
  const [A, B] = recs;
  const diffs = paramDiff(A, B);
  const fa = fidelityStep(A);
  const fb = fidelityStep(B);
  const va = A.headline_value;
  const vb = B.headline_value;
  const ciA = ciOf(fa);
  const ciB = ciOf(fb);
  const overlap =
    ciA && ciB ? Math.max(0, Math.min(ciA[1], ciB[1]) - Math.max(ciA[0], ciB[0])) > 0 : null;

  const n = Math.max(A.response.steps.length, B.response.steps.length);
  const rows: StepPair[] = Array.from({ length: n }, (_, i) => ({
    a: A.response.steps[i],
    b: B.response.steps[i],
  }));

  // ---- shared-prefix folding -------------------------------------
  // The analytical question a comparison answers is "where do these
  // compositions part ways, and what did it cost?" Leading steps that
  // are identical on both sides carry no part of that answer — they
  // only push the divergence point (where the evidence lives) below
  // the fold. A leading row folds when (1) both sides run the same
  // node kind, (2) the structural param diff above found nothing for
  // that kind, and (3) both sides' transformation signatures report
  // the same delta. Such rows collapse into one expandable "shared
  // prefix" row; the first row that breaks any condition is the
  // divergence point and gets an accent marker.
  const diffTouchesKind = (kind: string): boolean =>
    diffs.some(
      (d) =>
        d.where === kind ||
        d.where.startsWith(`${kind}.`) ||
        // the circuit-level diff is reported as `where: "circuit"`
        // but structurally belongs to the input step
        (d.where === "circuit" && kind === "input_circuit"),
    );
  const sameSignature = (x?: StepResult, y?: StepResult): boolean => {
    const sx = transformationOf(x);
    const sy = transformationOf(y);
    if (!sx && !sy) return true; // both signature-less (analysis-only steps)
    if (!sx || !sy) return false;
    return (["depth", "size", "num_parameters", "num_qubits"] as const).every(
      (k) => sx.delta[k] === sy.delta[k],
    );
  };
  let prefixLen = 0;
  while (prefixLen < rows.length) {
    const { a, b } = rows[prefixLen];
    if (!a || !b || a.node_type !== b.node_type) break;
    if (diffTouchesKind(a.node_type)) break;
    if (!sameSignature(a, b)) break;
    prefixLen++;
  }
  if (prefixLen < 2) prefixLen = 0; // folding a single row saves nothing
  const divergenceIdx =
    prefixLen > 0 && prefixLen < rows.length ? prefixLen : -1;

  return (
    <div className="panel-alt p-3 space-y-2 border !border-accent/40">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-ink">Comparing two runs</span>
        <span className="chip">A · {new Date(A.created_at).toLocaleTimeString()}</span>
        <span className="chip">B · {new Date(B.created_at).toLocaleTimeString()}</span>
        {A.config_hash === B.config_hash ? (
          <span className="chip !border-ok/40 !text-ok" title="Identical circuit + graph + params — any metric difference is run-to-run variation (shot noise, training stochasticity).">
            same configuration — differences are noise
          </span>
        ) : (
          <span className="chip !border-warn/40 !text-warn">
            {diffs.length} setting{diffs.length === 1 ? "" : "s"} differ
          </span>
        )}
        <button
          type="button"
          className="ml-auto p-0.5 text-mute hover:text-ink rounded hover:bg-surfaceAlt"
          onClick={clearCompare}
          aria-label="Close comparison"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {diffs.length > 0 && (
        <div className="space-y-0.5">
          {diffs.slice(0, 8).map((d, i) => (
            <div key={i} className="text-[10px] font-mono flex gap-2">
              <span className="text-mute w-32 truncate" title={d.where}>{d.where}</span>
              <span className="text-ink truncate" title={d.left}>{d.left}</span>
              <span className="text-mute">→</span>
              <span className="text-accent truncate" title={d.right}>{d.right}</span>
            </div>
          ))}
          {diffs.length > 8 && (
            <div className="text-[10px] text-mute">…and {diffs.length - 8} more</div>
          )}
        </div>
      )}

      {/* Fidelity: intervals, not scalars */}
      {va != null && vb != null && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-mute">fidelity</div>
          <div className="relative h-6 rounded bg-surfaceAlt" aria-hidden>
            {ciA && (
              <div className="absolute top-1 h-1.5 bg-accent/30 rounded"
                style={{ left: `${ciA[0] * 100}%`, width: `${Math.max(0.5, (ciA[1] - ciA[0]) * 100)}%` }} />
            )}
            <div className="absolute top-0.5 h-2.5 w-0.5 bg-accent" style={{ left: `${va * 100}%` }} title={`A: ${(va * 100).toFixed(2)}%`} />
            {ciB && (
              <div className="absolute bottom-1 h-1.5 bg-warn/30 rounded"
                style={{ left: `${ciB[0] * 100}%`, width: `${Math.max(0.5, (ciB[1] - ciB[0]) * 100)}%` }} />
            )}
            <div className="absolute bottom-0.5 h-2.5 w-0.5 bg-warn" style={{ left: `${vb * 100}%` }} title={`B: ${(vb * 100).toFixed(2)}%`} />
          </div>
          <div className="text-[10px] text-mute font-mono">
            A {(va * 100).toFixed(2)}% · B {(vb * 100).toFixed(2)}% · Δ(B−A){" "}
            {((vb - va) * 100).toFixed(2)}pp
            {overlap === true && (
              <span className="text-warn ml-1" title="The two 95% intervals overlap — at these shot counts this view cannot distinguish the difference from run-to-run noise (overlap is a conservative screen, not a hypothesis test: a formal test could still detect a smaller real difference). Run more replicates or raise shots before reading anything into it.">
                — intervals overlap: not evidence
              </span>
            )}
            {overlap === false && (
              <span className="text-ok ml-1">— intervals separated</span>
            )}
          </div>
        </div>
      )}

      {/* step-by-step */}
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-mute text-left">
            <th className="font-normal pb-0.5">step</th>
            <th className="font-normal pb-0.5">A sig</th>
            <th className="font-normal pb-0.5">B sig</th>
            <th className="font-normal pb-0.5">A / B status</th>
          </tr>
        </thead>
        <tbody>
          {prefixLen > 0 && (
            <tr className="border-t border-edge/40">
              <td colSpan={4} className="py-0.5">
                <details>
                  <summary className="cursor-pointer select-none text-mute hover:text-ink">
                    shared prefix · {prefixLen} steps
                    <span className="ml-1 text-mute/60">
                      (identical kind, params and signature on both sides)
                    </span>
                  </summary>
                  <table className="w-full mt-0.5">
                    <tbody>
                      {rows.slice(0, prefixLen).map((pair, i) => (
                        <CompareRow key={i} pair={pair} />
                      ))}
                    </tbody>
                  </table>
                </details>
              </td>
            </tr>
          )}
          {rows.slice(prefixLen).map((pair, i) => (
            <CompareRow
              key={prefixLen + i}
              pair={pair}
              divergence={divergenceIdx !== -1 && i === 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
