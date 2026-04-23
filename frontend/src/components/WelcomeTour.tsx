/**
 * Multi-slide onboarding overlay.
 *
 * Shown automatically on the first visit (flag persisted in localStorage)
 * and re-openable via the help button in the TopBar. Illustrations are all
 * native SVG so no extra deps.
 */

import { useEffect, useState } from "react";
import {
  Atom,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  LineChart,
  Play,
  Shrink,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { NODE_BY_KIND, type NodeKind } from "../lib/nodeCatalog";

const TOUR_FLAG = "jqub-tour-seen-v1";

type Slide = "welcome" | "algorithms" | "pipeline" | "try";
const ORDER: Slide[] = ["welcome", "algorithms", "pipeline", "try"];

export function WelcomeTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [slide, setSlide] = useState<Slide>("welcome");

  // Reset to the first slide every time the tour opens.
  useEffect(() => {
    if (open) setSlide("welcome");
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slide]);

  if (!open) return null;

  const idx = ORDER.indexOf(slide);
  const isFirst = idx === 0;
  const isLast = idx === ORDER.length - 1;
  function goNext() {
    if (!isLast) setSlide(ORDER[idx + 1]);
  }
  function goPrev() {
    if (!isFirst) setSlide(ORDER[idx - 1]);
  }
  function dismiss() {
    try {
      localStorage.setItem(TOUR_FLAG, "1");
    } catch {
      /* ignore */
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-canvas/85 backdrop-blur-sm"
        onClick={dismiss}
      />
      {/* Card */}
      <div className="relative panel w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md border border-edge bg-surface/80 text-mute hover:text-ink hover:border-edge transition flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-y-auto">
          {slide === "welcome" && <WelcomeSlide />}
          {slide === "algorithms" && <AlgorithmsSlide />}
          {slide === "pipeline" && <PipelineSlide />}
          {slide === "try" && <TrySlide />}
        </div>

        {/* Footer: progress dots + nav */}
        <div className="h-14 shrink-0 border-t border-edge px-4 flex items-center justify-between bg-surface/40">
          <div className="flex items-center gap-1.5">
            {ORDER.map((s, i) => (
              <button
                key={s}
                onClick={() => setSlide(s)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  s === slide ? "w-8 bg-accent" : "w-2 bg-edge hover:bg-mute"
                }`}
              />
            ))}
            <span className="ml-3 text-[11px] text-mute font-mono">
              {idx + 1} / {ORDER.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className="btn disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            {isLast ? (
              <button onClick={dismiss} className="btn-primary">
                <Play className="w-3.5 h-3.5" /> Get started
              </button>
            ) : (
              <button onClick={goNext} className="btn-primary">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*                         SLIDE 1                                */
/* ============================================================ */
function WelcomeSlide() {
  return (
    <div className="p-8 sm:p-10 flex flex-col sm:flex-row gap-8 items-center">
      <div className="flex-1 min-w-0">
        <div className="chip mb-3 !text-accent !border-accent/40">
          <Sparkles className="w-3 h-3" /> JQub Lab · GMU ECE
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-ink leading-tight mb-3">
          Welcome to <span className="bg-gradient-to-r from-accent via-accent2 to-accent3 bg-clip-text text-transparent">JQub Quantum Flow</span>
        </h1>
        <p className="text-mute leading-relaxed mb-4">
          A visual playground for three research algorithms from the{" "}
          <a
            href="https://jqub.ece.gmu.edu/"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            JQub lab
          </a>{" "}
          at George Mason University (QuCAD, QuBound, and CompressVQC),
          applied to a quantum circuit of your choice.
        </p>
        <p className="text-sm text-mute leading-relaxed">
          Build a pipeline by dragging blocks, hit <span className="kbd">Run</span>,
          and see what happens when each algorithm meets real IBM hardware
          noise.
        </p>
      </div>
      <div className="shrink-0">
        <HeroSVG />
      </div>
    </div>
  );
}

function HeroSVG() {
  return (
    <svg
      width="220"
      height="220"
      viewBox="0 0 220 220"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="JQub atom emblem"
    >
      <defs>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4cc9f0" stopOpacity="1" />
          <stop offset="60%" stopColor="#7b5cff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0b1020" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orbit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4cc9f0" />
          <stop offset="50%" stopColor="#7b5cff" />
          <stop offset="100%" stopColor="#f72585" />
        </linearGradient>
      </defs>
      <circle cx="110" cy="110" r="90" fill="url(#core)" />
      {[0, 60, 120].map((rot) => (
        <ellipse
          key={rot}
          cx="110"
          cy="110"
          rx="85"
          ry="30"
          fill="none"
          stroke="url(#orbit)"
          strokeWidth="1.5"
          transform={`rotate(${rot} 110 110)`}
          opacity="0.9"
        />
      ))}
      {/* electrons */}
      {[0, 60, 120].map((rot, i) => (
        <g key={i} transform={`rotate(${rot} 110 110)`}>
          <circle cx="195" cy="110" r="3.5" fill="#4cc9f0">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 110 110"
              to="360 110 110"
              dur={`${5 + i}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}
      <circle cx="110" cy="110" r="10" fill="#e6ebff" />
    </svg>
  );
}

/* ============================================================ */
/*                         SLIDE 2                                */
/* ============================================================ */
function AlgorithmsSlide() {
  return (
    <div className="p-6 sm:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-mute mb-1">
          The three algorithms
        </div>
        <h2 className="text-xl font-semibold text-ink">
          One block each. Chain them any way you like.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AlgoCard
          accent="text-accent2"
          border="border-accent2/40"
          bg="bg-accent2/5"
          icon={<Waypoints className="w-4 h-4" strokeWidth={2} />}
          name="QuCAD"
          kind="qucad"
          oneLine="Noise-aware VQC sparsification."
          detail="Prunes parameters that don't survive hardware noise, via ADMM with a stochastic-mask regulariser. Fewer gates, same answer."
        >
          <QuCADVisual />
        </AlgoCard>
        <AlgoCard
          accent="text-accent3"
          border="border-accent3/40"
          bg="bg-accent3/5"
          icon={<LineChart className="w-4 h-4" strokeWidth={2} />}
          name="QuBound"
          kind="qubound"
          oneLine="Today's error bound, predicted."
          detail="Trains an LSTM on 14 days of real IBM Fez calibration data to predict a tight fidelity bound for your circuit, without running it."
        >
          <QuBoundVisual />
        </AlgoCard>
        <AlgoCard
          accent="text-accent4"
          border="border-accent4/40"
          bg="bg-accent4/5"
          icon={<Shrink className="w-4 h-4" strokeWidth={2} />}
          name="CompressVQC"
          kind="compvqc"
          oneLine="QAOA-optimized circuit folding."
          detail="Builds a lookup table of equivalent gate sequences, then solves a QUBO to fold redundant rotations on Heron-family hardware."
        >
          <CompVQCVisual />
        </AlgoCard>
      </div>
      <div className="mt-5 panel-alt p-3 text-[12px] text-mute leading-relaxed">
        These aren't toy demos. Each block wraps the actual code from the
        lab's research publications. Runs happen server-side with Qiskit +
        PyTorch.
      </div>
    </div>
  );
}

function AlgoCard({
  accent,
  border,
  bg,
  icon,
  name,
  kind,
  oneLine,
  detail,
  children,
}: {
  accent: string;
  border: string;
  bg: string;
  icon: React.ReactNode;
  name: string;
  kind: NodeKind;
  oneLine: string;
  detail: string;
  children: React.ReactNode;
}) {
  const paper = NODE_BY_KIND[kind]?.paper;
  return (
    <div className={`panel-alt p-4 border ${border} ${bg} flex flex-col`}>
      <div className={`flex items-center gap-2 ${accent}`}>
        <span
          className={`w-7 h-7 rounded-md border ${border} bg-surface flex items-center justify-center shrink-0`}
        >
          {icon}
        </span>
        <div className="font-semibold text-ink">{name}</div>
      </div>
      <div className="mt-2 text-[13px] text-ink">{oneLine}</div>
      <div className="mt-1 text-[11px] text-mute leading-relaxed">{detail}</div>
      {paper && (
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-mute hover:text-ink transition-colors self-start"
          title={paper.title}
        >
          <FileText className="w-3 h-3" strokeWidth={2} />
          <span className="underline decoration-edge underline-offset-2 hover:decoration-accent">
            {paper.venue}
          </span>
        </a>
      )}
      <div className="mt-3 h-[84px] flex items-center justify-center">{children}</div>
    </div>
  );
}

function QuCADVisual() {
  // Parameter-magnitude bars: pre-prune (tall) vs post-prune (many zero).
  const pre = [0.7, 0.9, 0.45, 0.82, 0.55, 0.65, 0.92, 0.38, 0.7, 0.6];
  const post = [0.72, 0.92, 0.0, 0.85, 0.0, 0.0, 0.95, 0.0, 0.71, 0.0];
  return (
    <svg viewBox="0 0 240 80" width="100%" height="80" aria-label="QuCAD sparsity">
      {pre.map((h, i) => (
        <g key={i}>
          <rect
            x={10 + i * 22}
            y={70 - h * 60}
            width={8}
            height={h * 60}
            fill="#7b5cff"
            opacity="0.25"
          />
          <rect
            x={20 + i * 22}
            y={70 - post[i] * 60}
            width={8}
            height={post[i] * 60}
            fill="#7b5cff"
            opacity={post[i] === 0 ? 0.15 : 1}
          >
            <animate
              attributeName="height"
              from={pre[i] * 60}
              to={post[i] * 60}
              dur="1.8s"
              repeatCount="indefinite"
              values={`${pre[i] * 60};${post[i] * 60};${pre[i] * 60}`}
              keyTimes="0;0.5;1"
            />
            <animate
              attributeName="y"
              from={70 - pre[i] * 60}
              to={70 - post[i] * 60}
              dur="1.8s"
              repeatCount="indefinite"
              values={`${70 - pre[i] * 60};${70 - post[i] * 60};${70 - pre[i] * 60}`}
              keyTimes="0;0.5;1"
            />
          </rect>
        </g>
      ))}
      <line x1="0" y1="70" x2="240" y2="70" stroke="#1f2a4a" strokeWidth="1" />
    </svg>
  );
}

function QuBoundVisual() {
  // A wavy calibration history followed by a flat predicted bound.
  const pts = Array.from({ length: 48 }, (_, i) => {
    const x = i * 4 + 8;
    const noise =
      30 +
      12 * Math.sin(i / 3) +
      6 * Math.sin(i / 1.4) +
      (i > 36 ? 4 : 0);
    return `${x},${80 - noise * 1.2}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 220 80" width="100%" height="80" aria-label="QuBound LSTM prediction">
      <line x1="150" y1="0" x2="150" y2="80" stroke="#1f2a4a" strokeDasharray="2 3" />
      <polyline
        points={pts}
        fill="none"
        stroke="#f72585"
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* prediction zone */}
      <rect x="150" y="22" width="64" height="8" fill="#f72585" opacity="0.18" />
      <line
        x1="150"
        y1="26"
        x2="214"
        y2="26"
        stroke="#f72585"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <text x="155" y="18" fill="#f72585" fontSize="8" fontFamily="monospace">
        bound
      </text>
      <text x="8" y="14" fill="#8492c7" fontSize="8" fontFamily="monospace">
        14-day noise →
      </text>
    </svg>
  );
}

function CompVQCVisual() {
  // "Before" and "after" gate sequences; some gates dimmed out (folded).
  const before = [0, 1, 2, 3, 4, 5, 6];
  const folded = new Set([1, 3, 5]);
  return (
    <svg viewBox="0 0 240 84" width="100%" height="84" aria-label="CompressVQC folding">
      {/* two qubit lines */}
      <line x1="10" y1="22" x2="230" y2="22" stroke="#1f2a4a" />
      <line x1="10" y1="62" x2="230" y2="62" stroke="#1f2a4a" />
      {before.map((i) => (
        <g key={i}>
          <rect
            x={20 + i * 28}
            y={14}
            width={16}
            height={16}
            rx={3}
            fill={folded.has(i) ? "transparent" : "#06d6a0"}
            stroke="#06d6a0"
            strokeWidth={folded.has(i) ? 1 : 0}
            opacity={folded.has(i) ? 0.35 : 1}
          />
          {folded.has(i) && (
            <>
              <line
                x1={20 + i * 28}
                y1={14}
                x2={36 + i * 28}
                y2={30}
                stroke="#f72585"
                strokeWidth="1"
                opacity="0.6"
              />
              <line
                x1={20 + i * 28}
                y1={30}
                x2={36 + i * 28}
                y2={14}
                stroke="#f72585"
                strokeWidth="1"
                opacity="0.6"
              />
            </>
          )}
          <rect
            x={20 + i * 28}
            y={54}
            width={16}
            height={16}
            rx={3}
            fill={folded.has(i) ? "transparent" : "#06d6a0"}
            stroke="#06d6a0"
            strokeWidth={folded.has(i) ? 1 : 0}
            opacity={folded.has(i) ? 0.35 : 1}
          />
        </g>
      ))}
      <text x="10" y="80" fill="#8492c7" fontSize="8" fontFamily="monospace">
        3 of 7 rotations folded
      </text>
    </svg>
  );
}

/* ============================================================ */
/*                         SLIDE 3                                */
/* ============================================================ */
function PipelineSlide() {
  return (
    <div className="p-6 sm:p-8">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-mute mb-1">
          How pipelines work
        </div>
        <h2 className="text-xl font-semibold text-ink">
          Topologically sorted, executed server-side.
        </h2>
      </div>

      <div className="panel-alt p-5 mb-4">
        <PipelineSVG />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px] leading-relaxed">
        <div className="panel-alt p-3">
          <div className="text-accent font-semibold mb-0.5">Nodes you drag</div>
          <span className="text-mute">
            Each block wraps one stage: a circuit source, a backend, an
            algorithm, a metric, or a sink. Parameters are editable on the
            block itself.
          </span>
        </div>
        <div className="panel-alt p-3">
          <div className="text-accent2 font-semibold mb-0.5">Edges you draw</div>
          <span className="text-mute">
            Connect block handles left-to-right. The runner topologically
            sorts the graph; cycles are rejected before execution.
          </span>
        </div>
        <div className="panel-alt p-3">
          <div className="text-accent3 font-semibold mb-0.5">
            State between blocks
          </div>
          <span className="text-mute">
            Each algorithm block may mutate the circuit in-place (CompressVQC,
            QuCAD) or emit a metric attached to the output (QuBound, Fidelity).
          </span>
        </div>
        <div className="panel-alt p-3">
          <div className="text-accent4 font-semibold mb-0.5">
            Offline by default
          </div>
          <span className="text-mute">
            QuBound uses a 14-day cached calibration pickle; no IBM token
            needed. Flip <span className="kbd">ALLOW_LIVE_IBM</span> to fetch
            fresh history.
          </span>
        </div>
      </div>
    </div>
  );
}

function PipelineSVG() {
  return (
    <svg
      viewBox="0 0 680 140"
      width="100%"
      height="140"
      aria-label="Pipeline: circuit → backend → algorithm → output"
    >
      <defs>
        <linearGradient id="edgegrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4cc9f0" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#4cc9f0" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* edges with animated particles */}
      {[
        [135, 390],
        [305, 560],
        [475, 680],
      ].map(([x0, x1], i) => (
        <g key={i}>
          <line
            x1={x0}
            y1={70}
            x2={x1}
            y2={70}
            stroke="#1f2a4a"
            strokeWidth="2"
            strokeDasharray="3 4"
          />
          <circle r="3.5" fill="#4cc9f0">
            <animate
              attributeName="cx"
              from={x0}
              to={x1}
              dur="2.2s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              from={70}
              to={70}
              dur="2.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}

      <PipelineNode x={20} y={40} color="#4cc9f0" label="Input circuit" sub="SOURCE" kind="circuit" />
      <PipelineNode x={190} y={40} color="#4cc9f0" label="Noisy simulator" sub="BACKEND" kind="backend" />
      <PipelineNode x={360} y={40} color="#f72585" label="QuBound" sub="ALGORITHM" kind="algo" />
      <PipelineNode x={530} y={40} color="#e6ebff" label="Output" sub="SINK" kind="out" />
    </svg>
  );
}

function PipelineNode({
  x,
  y,
  color,
  label,
  sub,
  kind,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  sub: string;
  kind: "circuit" | "backend" | "algo" | "out";
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width="120"
        height="60"
        rx="8"
        fill="#111830"
        stroke={color}
        strokeOpacity="0.55"
      />
      <g transform="translate(12, 12)">
        <rect width="28" height="28" rx="6" fill="#0b1020" stroke={color} strokeOpacity="0.5" />
        {kind === "circuit" && <CircuitGlyph color={color} />}
        {kind === "backend" && <BackendGlyph color={color} />}
        {kind === "algo" && <AlgoGlyph color={color} />}
        {kind === "out" && <OutGlyph color={color} />}
      </g>
      <text x="50" y="25" fontSize="11" fill="#e6ebff" fontFamily="ui-sans-serif">
        {label}
      </text>
      <text x="50" y="40" fontSize="8" fill="#8492c7" fontFamily="monospace" letterSpacing="1">
        {sub}
      </text>
      {/* handles */}
      <circle cx="0" cy="30" r="3" fill="#0b1020" stroke={color} />
      <circle cx="120" cy="30" r="3" fill="#0b1020" stroke={color} />
    </g>
  );
}

function CircuitGlyph({ color }: { color: string }) {
  return (
    <g stroke={color} fill="none" strokeWidth="1.3">
      <line x1="4" y1="10" x2="24" y2="10" />
      <line x1="4" y1="20" x2="24" y2="20" />
      <rect x="8" y="6" width="6" height="8" fill={color} opacity="0.3" />
      <circle cx="18" cy="20" r="2" fill={color} />
    </g>
  );
}
function BackendGlyph({ color }: { color: string }) {
  return (
    <g stroke={color} fill="none" strokeWidth="1.3">
      <rect x="4" y="4" width="20" height="8" rx="1" />
      <rect x="4" y="16" width="20" height="8" rx="1" />
      <circle cx="8" cy="8" r="1" fill={color} />
      <circle cx="8" cy="20" r="1" fill={color} />
    </g>
  );
}
function AlgoGlyph({ color }: { color: string }) {
  return (
    <g stroke={color} fill="none" strokeWidth="1.3">
      <polyline points="4,22 10,12 16,18 24,6" />
      <circle cx="10" cy="12" r="1.5" fill={color} />
      <circle cx="24" cy="6" r="1.5" fill={color} />
    </g>
  );
}
function OutGlyph({ color }: { color: string }) {
  return (
    <g stroke={color} fill="none" strokeWidth="1.3">
      <rect x="5" y="5" width="18" height="18" rx="2" />
      <polyline points="9,14 13,18 20,10" />
    </g>
  );
}

/* ============================================================ */
/*                         SLIDE 4                                */
/* ============================================================ */
function TrySlide() {
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
          <span className="kbd">Run pipeline</span> in the canvas toolbar. The
          first run trains an LSTM on 14 days of calibration, so plan for
          about two minutes on the shared HF CPU. Don't close the tab while
          it's running.
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
              <span className="text-ink">bell_state</span> + QuBound →
              fast, shows the noise-bound predictor end-to-end.
            </li>
            <li>
              <span className="text-ink">efficient_su2_4q</span> + QuCAD →
              watch sparsity climb over ADMM iterations.
            </li>
            <li>
              <span className="text-ink">qaoa_maxcut_4</span> + CompressVQC →
              see how many rotations can be folded.
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
            <li>
              Drag blocks from the strip at the top of the canvas.
            </li>
            <li>Connect their handles left-to-right.</li>
            <li>
              Hover a block to reveal the <span className="kbd">×</span>{" "}
              delete button.
            </li>
            <li>
              Upload your own <span className="kbd">.qpy</span> circuit via
              the <span className="text-ink">upload</span> link.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-mute">
        <Sparkles className="w-3 h-3 text-accent" />
        You can re-open this tour any time from the{" "}
        <span className="text-ink">help</span> button in the top-right.
      </div>
    </div>
  );
}

/* ============================================================ */
/*                      First-visit hook                           */
/* ============================================================ */
export function useFirstVisitTour(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_FLAG)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  return [open, setOpen];
}
