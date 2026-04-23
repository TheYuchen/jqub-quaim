import { useApp } from "../lib/store";
import { Activity, HelpCircle, Zap } from "lucide-react";

export function TopBar({ onOpenTour }: { onOpenTour?: () => void }) {
  const health = useApp((s) => s.health);
  const liveOk = health?.live_ibm_allowed && health?.ibm_token_configured;

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
        <span
          className={`chip ${
            liveOk ? "!border-ok/50 !text-ok" : "!border-edge !text-mute"
          }`}
          title={
            liveOk
              ? "IBM Quantum Platform token detected; live noise lookups are enabled."
              : "No IBM token / live lookups disabled; QuBound will use the shipped 14-day cache."
          }
        >
          {liveOk ? "live ibm: on" : "live ibm: off (using cache)"}
        </span>
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
