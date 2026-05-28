// Tour slide 4: "you're ready" CTA with two tip columns + a feature
// strip introducing the heavier workflow tools (Export .py).
//
// The "What to try first" items are clickable buttons that load the
// matching preset + sample in one shot via the Zustand quickStart
// bridge; the tour closes itself when the user picks one so they can
// see the canvas update.

import {
  Atom,
  CircleDot,
  Code2,
  LogIn,
  Package,
  Play,
  Sparkles,
} from "lucide-react";
import { useApp } from "../../lib/store";

interface QuickStart {
  preset: string;
  sample: string;
  blurb: string;
}

const QUICK_STARTS: QuickStart[] = [
  {
    preset: "qucad",
    sample: "bell_state",
    blurb: "bell_state + QuCAD — noise-aware parameter pruning end-to-end (instant, precomputed).",
  },
  {
    preset: "qubound",
    sample: "efficient_su2_4q",
    blurb: "efficient_su2_4q + QuBound — LSTM-predicted error bound.",
  },
  {
    preset: "compvqc",
    sample: "qaoa_maxcut_4",
    blurb: "qaoa_maxcut_4 + CompressVQC — see how many rotations fold.",
  },
  {
    preset: "qshot",
    sample: "ry_chain_6q",
    blurb: "ry_chain_6q + Qshot — recommended shot count for a target fidelity.",
  },
];

export function TrySlide({ onClose }: { onClose?: () => void } = {}) {
  const triggerQuickStart = useApp((s) => s.triggerQuickStart);

  const handlePick = (q: QuickStart) => {
    triggerQuickStart(q.preset, q.sample);
    onClose?.();
  };

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
          <div className="space-y-1.5">
            {QUICK_STARTS.map((q) => (
              <button
                key={`${q.preset}-${q.sample}`}
                type="button"
                onClick={() => handlePick(q)}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left text-[12px] text-mute hover:bg-surface hover:text-ink transition-colors group"
              >
                <Play className="w-3 h-3 mt-0.5 shrink-0 text-accent opacity-60 group-hover:opacity-100" />
                <span className="flex-1 leading-relaxed">{q.blurb}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-mute/60">
            Click any line to load that preset + circuit instantly.
          </div>
        </div>

        <div className="panel-alt p-4">
          <div className="flex items-center gap-2 text-accent2 mb-2">
            <Atom className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Build your own
            </span>
          </div>
          <ul className="text-[12px] text-mute space-y-1.5 leading-relaxed">
            <li>
              Drag blocks from the strip, or click{" "}
              <span className="kbd">Add blocks</span> for a multi-select list.
            </li>
            <li>
              Connect handles left-to-right, or hit{" "}
              <span className="kbd">Auto-connect</span> for a sensible chain
              in one click.
            </li>
            <li>
              Drag a block onto an existing edge to{" "}
              <span className="text-ink">splice it between</span> two
              connected blocks — the target edge lights up while
              you're hovering it.
            </li>
            <li>
              Hover a block to reveal the <span className="kbd">×</span>{" "}
              delete button.
            </li>
            <li>
              Upload your own Qiskit <span className="kbd">.qpy</span> or
              OpenQASM <span className="kbd">.qasm</span> via the{" "}
              <span className="text-ink">upload</span> link.
            </li>
          </ul>
        </div>
      </div>

      {/* Power-user features strip */}
      <div className="mt-4 panel-alt p-3">
        <div className="text-[10px] uppercase tracking-widest text-mute mb-2">
          Once you've got results
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-[12px]">
            <Code2 className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
            <span className="text-mute leading-relaxed">
              <span className="text-ink font-medium">Export .py</span> —
              download the current pipeline as a runnable Python script for
              your own Jupyter / slurm setup. Tweak parameters and re-run
              inside QuDA to compare a few values side by side.
            </span>
          </div>
          <div className="flex items-start gap-2 text-[12px]">
            <Package className="w-3.5 h-3.5 mt-0.5 text-accent2 shrink-0" />
            <span className="text-mute leading-relaxed">
              <span className="text-ink font-medium">Upload your own block</span>{" "}
              — drop a .zip with{" "}
              <span className="font-mono text-ink">manifest.json</span> +{" "}
              <span className="font-mono text-ink">handler.py</span> next to
              "Add blocks". Visible only to you. See{" "}
              <span className="font-mono text-ink">PLUGIN_SDK.md</span> in the
              repo for the spec.
            </span>
          </div>
          <div className="flex items-start gap-2 text-[12px]">
            <LogIn className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
            <span className="text-mute leading-relaxed">
              <span className="text-ink font-medium">Sign in with Hugging Face</span>{" "}
              (top-right) to keep your uploaded plugins across container
              restarts and sync them to any device you sign in on.
              Without signing in, plugins live only in this browser and
              vanish if the Space restarts or you clear browser data.
            </span>
          </div>
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
