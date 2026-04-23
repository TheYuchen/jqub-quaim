import { useApp } from "../lib/store";
import { Activity, HelpCircle, Zap } from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function TopBar({ onOpenTour }: { onOpenTour?: () => void }) {
  const health = useApp((s) => s.health);
  const useLiveIbm = useApp((s) => s.useLiveIbm);
  const setUseLiveIbm = useApp((s) => s.setUseLiveIbm);

  // Server can go live only when it has both the IBM token and the admin
  // has flipped ALLOW_LIVE_IBM=true in env. If either is missing we grey
  // the chip out and make it read-only.
  const serverCanGoLive =
    !!health?.live_ibm_allowed && !!health?.ibm_token_configured;
  const effectiveLive = serverCanGoLive && useLiveIbm;

  let chipLabel: string;
  let chipClass: string;
  let chipTitle: string;
  if (!serverCanGoLive) {
    chipLabel = "live ibm: unavailable";
    chipClass = "!border-edge !text-mute opacity-70 cursor-not-allowed";
    chipTitle =
      "Server has no IBM Quantum Platform token configured, so QuBound is using the shipped 14-day calibration cache (real IBM Fez data, just not refreshed live). To enable live mode, set IBM_QUANTUM_TOKEN + ALLOW_LIVE_IBM=true in the HF Space secrets.";
  } else if (effectiveLive) {
    chipLabel = "live ibm: on";
    chipClass =
      "!border-warn/50 !text-warn cursor-pointer hover:!border-warn hover:!text-warn";
    chipTitle =
      "Live mode ON. QuBound will fetch fresh IBM Quantum Platform calibration on each run (+5-15s per run, counts against rate limits). Click to switch back to cache mode.";
  } else {
    chipLabel = "live ibm: off (using cache)";
    chipClass =
      "!border-edge !text-mute cursor-pointer hover:!text-ink hover:!border-accent/40";
    chipTitle =
      "Using the shipped 14-day IBM Fez calibration cache. This is fine for demos. Click to switch to live mode (fresh IBM calibration per run).";
  }

  return (
    <header className="h-14 shrink-0 border-b border-edge px-5 flex items-center justify-between gap-4 bg-canvas/60 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-glow">
          <Zap className="w-4 h-4 text-canvas" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-ink font-semibold tracking-tight">JQub Quantum Flow</div>
          <div className="text-mute text-xs">
            Visual pipeline for noise-aware VQC experiments
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="chip">
          <Activity className="w-3 h-3" />
          {health
            ? `qiskit ${health.qiskit_version} · torch ${health.torch_version}`
            : "loading…"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (serverCanGoLive) setUseLiveIbm(!useLiveIbm);
          }}
          disabled={!serverCanGoLive}
          aria-pressed={effectiveLive}
          className={`chip transition-colors ${chipClass}`}
          title={chipTitle}
        >
          {chipLabel}
        </button>
        <ThemeSwitcher />
        {onOpenTour && (
          <button
            onClick={onOpenTour}
            className="btn-ghost"
            title="Show the intro tour"
            aria-label="Show the intro tour"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour</span>
          </button>
        )}
      </div>
    </header>
  );
}
