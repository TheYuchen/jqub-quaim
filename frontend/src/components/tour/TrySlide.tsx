// Tour slide 4: "you're ready" CTA with two tip columns.

import { Atom, CircleDot, Sparkles } from "lucide-react";

export function TrySlide() {
  return (
    <div className="p-6 sm:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-mute mb-1">
          You're ready
        </div>
        <h2 className="text-xl font-semibold text-ink mb-1">
          A default pipeline is already loaded.
        </h2>
        <p className="text-mute text-sm">
          Pick one of the sample circuits on the left, then hit{" "}
          <span className="kbd">Run pipeline</span> in the canvas toolbar.
          Default pipelines on the built-in samples hit a precomputed cache
          and return instantly. A cold{" "}
          <span className="text-ink">QuBound</span> (LSTM training) or{" "}
          <span className="text-ink">Qshot</span> (HDBSCAN warmup + pilot
          measurements) run on HF's shared CPU can take 1–3&nbsp;minutes —
          don't close the tab.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="panel-alt p-4">
          <div className="flex items-center gap-2 text-accent mb-2">
            <CircleDot className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              What to try first
            </span>
          </div>
          <ul className="text-[12px] text-mute space-y-1.5 leading-relaxed">
            <li>
              <span className="text-ink">bell_state</span> + QuCAD →
              instant (precomputed), shows noise-aware parameter pruning
              end-to-end.
            </li>
            <li>
              <span className="text-ink">efficient_su2_4q</span> + QuBound →
              see the LSTM-predicted error bound fall out.
            </li>
            <li>
              <span className="text-ink">qaoa_maxcut_4</span> + CompressVQC →
              see how many rotations can be folded.
            </li>
            <li>
              <span className="text-ink">ry_chain_6q</span> + Qshot →
              get a recommended shot count for a target fidelity.
            </li>
          </ul>
        </div>

        <div className="panel-alt p-4">
          <div className="flex items-center gap-2 text-accent2 mb-2">
            <Atom className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Build your own
            </span>
          </div>
          <ul className="text-[12px] text-mute space-y-1.5 leading-relaxed">
            <li>Drag blocks from the strip at the top of the canvas.</li>
            <li>
              Connect their handles left-to-right, or hit{" "}
              <span className="kbd">Auto-connect</span> in the toolbar to
              wire a sensible chain in one click.
            </li>
            <li>
              Hover a block to reveal the <span className="kbd">×</span>{" "}
              delete button.
            </li>
            <li>
              Upload your own Qiskit <span className="kbd">.qpy</span> or
              OpenQASM <span className="kbd">.qasm</span> circuit via the{" "}
              <span className="text-ink">upload</span> link.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-mute">
        <Sparkles className="w-3 h-3 text-accent" />
        You can re-open this tour any time from the{" "}
        <span className="text-ink">Tour</span> button in the top-right.
      </div>
    </div>
  );
}
