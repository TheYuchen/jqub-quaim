// Claims→features map (marker: claims-map).
//
// A reader arriving from the paper (or a reviewer skimming the live
// deployment) should not have to rediscover where each claim lives.
// This is a small STATIC overlay: one row per paper claim — claim,
// where to see it in the UI, and the one-URL scenario that boots the
// exact seeded state the claim's figure is exported from. Content
// mirrors the shipped list in docs/EVIDENCE_WORKBENCH.md; if a claim
// changes there, change it here.
//
// Self-contained by design (trigger + overlay in one component, local
// state only): the TopBar mounts it next to the Tour button and no
// other surface needs to know it exists.

import React, { useEffect, useState } from "react";
import { ListChecks, X } from "lucide-react";
import { APP_NAME } from "../lib/anon";

interface ClaimRow {
  claim: string;
  where: string;
  scenarios: string[]; // scenario keys, rendered as ?scenario= links
}

/** Rows grouped under the paper's three contributions (mirrors the
 *  contribution map at the top of docs/EVIDENCE_WORKBENCH.md — if a
 *  claim moves there, move it here). */
interface ClaimSection {
  id: string;
  label: string;
  rows: ClaimRow[];
}

const SECTIONS: ClaimSection[] = [
  {
    id: "C1",
    label: "C1 — one funnel grammar, three scales (evidence steering)",
    rows: [
      {
        claim: "Scale 1, within a run — the 95% interval narrows live; a precision target stops the run",
        where: "Evidence Theater (auto-opens on streaming runs; “expand · theater” on the funnel card); toolbar “target ±pp”",
        scenarios: ["F0", "F3"],
      },
      {
        claim: "Scale 2, across replicates — same rule, different draws: two replays of one configuration overlaid",
        where: "“Between configurations” tab → “overlay in theater” (same configuration, both runs traced)",
        scenarios: ["F7"],
      },
      {
        claim: "Scale 3, between configurations — the interval of the difference Δ(B−A) accumulates across replicates",
        where: "“Between configurations” tab: difference funnel below the interval bars",
        scenarios: ["F8"],
      },
      {
        claim: "Multiverse analysis — every configuration as a small multiple with Δ vs the baseline (the scale-3 portfolio)",
        where: "Multiverse workspace (toggle top-left of the canvas)",
        scenarios: ["F2"],
      },
    ],
  },
  {
    id: "C2",
    label: "C2 — stochastic-provenance substrate",
    rows: [
      {
        claim: "Seeded replay — every run is archived with its root seed and replays bit-exactly",
        where: "“This configuration” tab: replay (⚲) any row; seed chip on the fidelity card",
        scenarios: ["F4"],
      },
      {
        claim: "Uncertainty in provenance — lineage nodes are distributions (evidence mass, certainty funnels)",
        where: "“This configuration” tab: dot area = shots executed, replicate bands with pooled-CI funnels, fork edges",
        scenarios: ["F4"],
      },
      {
        claim: "Transformation vocabulary — uniform before→after signatures define what “a configuration” is, plugins included",
        where: "Delta-strip glyphs on canvas nodes and result cards; gate-level circuit diff in the signature card",
        scenarios: ["F1", "F5"],
      },
    ],
  },
  {
    id: "C3",
    label: "C3 — honesty devices",
    rows: [
      {
        claim: "Honest comparison — intervals instead of scalars; overlap is called out as not-evidence",
        where: "“Between configurations” tab (tick two runs in This configuration, or A/B two multiverse cards)",
        scenarios: ["F6"],
      },
      {
        claim: "Provenance-backed figures — every export regenerates bit-exactly from its own metadata",
        where: "Camera buttons on the canvas, multiverse board, evidence pane and theater (SVG + PNG + sidecar)",
        scenarios: ["F0"],
      },
    ],
  },
];

export function ClaimsMapButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setOpen(true)}
        title="Map of the system's research claims: what each one is, where to see it, and the scenario URL that boots its figure state"
        aria-label="Open claims-to-features map"
      >
        <ListChecks className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Claims</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${APP_NAME} claims-to-features map`}
          data-marker="claims-map"
        >
          <div
            className="absolute inset-0 bg-canvas/85 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative panel w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-edge shrink-0">
              <ListChecks className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-ink">
                Claims → where to see them
              </span>
              <span className="text-[11px] text-mute hidden sm:inline">
                each scenario URL boots the exact seeded state
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close claims map"
                className="ml-auto w-8 h-8 rounded-md border border-edge bg-surface/80 text-mute hover:text-ink transition flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-[12px] leading-relaxed">
                <thead>
                  <tr className="text-mute text-left text-[10px] uppercase tracking-wider">
                    <th className="font-normal pb-1.5 pr-3">claim</th>
                    <th className="font-normal pb-1.5 pr-3">where</th>
                    <th className="font-normal pb-1.5">boot</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((sec) => (
                    <React.Fragment key={sec.id}>
                      <tr className="border-t border-edge/50">
                        <td
                          colSpan={3}
                          className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-accent"
                        >
                          {sec.label}
                        </td>
                      </tr>
                      {sec.rows.map((r) => (
                        <tr
                          key={r.claim}
                          className="border-t border-edge/50 align-top"
                        >
                          <td className="py-2 pr-3 text-ink">{r.claim}</td>
                          <td className="py-2 pr-3 text-mute">{r.where}</td>
                          <td className="py-2 whitespace-nowrap">
                            {r.scenarios.map((k, i) => (
                              <a
                                key={k}
                                href={`?scenario=${k}`}
                                className="text-accent hover:underline font-mono"
                                title={`Boot ?scenario=${k} (reloads the app into that figure state)`}
                              >
                                {i > 0 ? " · " : ""}
                                {k}
                              </a>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-mute">
                Full design rationale and the encoding decisions behind each
                view: <span className="font-mono">docs/EVIDENCE_WORKBENCH.md</span> in the repository.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
