// Tour slide 2: the algorithm blocks as cards with inline SVG visuals.
//
// Kicker and heading avoid a fixed count — the cards below are
// currently QuCAD, QuBound, CompressVQC, Qshot, but the lab ships new
// modules regularly. When you add a fifth+ block, bump the lg:grid-cols
// breakpoint so the cards don't get squeezed.

import { FileText, LineChart, Shrink, Target, Waypoints } from "lucide-react";
import { NODE_BY_KIND, type NodeKind } from "../../lib/nodeCatalog";

export function AlgorithmsSlide() {
  return (
    <div className="p-6 sm:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-mute mb-1">
          The algorithm blocks
        </div>
        <h2 className="text-xl font-semibold text-ink">
          One block per algorithm. Chain them any way you like.
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        <AlgoCard
          accent="text-warn"
          border="border-warn/40"
          bg="bg-warn/5"
          icon={<Target className="w-4 h-4" strokeWidth={2} />}
          name="Qshot"
          kind="qshot"
          oneLine="Recommended shot count, predicted."
          detail="Matches your circuit against ~3k pre-measured records to predict the smallest shot count that hits a target fidelity. Falls back to a dual-graph GNN for circuits outside the 5–8 qubit training range."
        >
          <QshotVisual />
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
      30 + 12 * Math.sin(i / 3) + 6 * Math.sin(i / 1.4) + (i > 36 ? 4 : 0);
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

function QshotVisual() {
  // Shows the F(s) = F_inf - a/s^b convergence curve, a horizontal
  // dashed target line at α × F_inf, and a vertical dashed marker at
  // the recommended shot count where the curve crosses target. Mirrors
  // the diagnostic plot Qshot itself emits via plot_recommendation().
  const W = 240;
  const H = 84;
  // f(s) = 0.985 - 1.6 / s^0.65 sampled across shots ∈ [40, 4000] in
  // log space → mapped onto the SVG viewport.
  const F_INF = 0.985;
  const A = 1.6;
  const B = 0.65;
  const SHOTS_MIN = 40;
  const SHOTS_MAX = 4000;
  const N = 50;
  const xOf = (s: number) =>
    16 + ((Math.log(s) - Math.log(SHOTS_MIN)) /
          (Math.log(SHOTS_MAX) - Math.log(SHOTS_MIN))) * (W - 28);
  const yOf = (f: number) => H - 14 - (f - 0.4) * (H - 22) / 0.6;
  const points = Array.from({ length: N }, (_, i) => {
    const s = SHOTS_MIN * Math.pow(SHOTS_MAX / SHOTS_MIN, i / (N - 1));
    const f = F_INF - A / Math.pow(s, B);
    return `${xOf(s).toFixed(1)},${yOf(f).toFixed(1)}`;
  }).join(" ");
  const target = 0.95 * F_INF; // α × F_inf
  // Solve F_inf - a/s^b = target → s = (a / (F_inf - target))^(1/b)
  const recommendedShots = Math.pow(A / (F_INF - target), 1 / B);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-label="Qshot fidelity-vs-shots curve">
      {/* axes */}
      <line x1="16" y1={H - 14} x2={W - 12} y2={H - 14} stroke="#1f2a4a" />
      <line x1="16" y1="6" x2="16" y2={H - 14} stroke="#1f2a4a" />
      {/* target horizontal dashed line + label */}
      <line
        x1="16"
        y1={yOf(target)}
        x2={W - 12}
        y2={yOf(target)}
        stroke="#f4a261"
        strokeDasharray="3 3"
        strokeOpacity="0.7"
      />
      <text x={W - 12} y={yOf(target) - 2} fill="#f4a261" fontSize="8"
            fontFamily="monospace" textAnchor="end">
        α·F∞
      </text>
      {/* recommended shots vertical dashed line + label */}
      <line
        x1={xOf(recommendedShots)}
        y1="6"
        x2={xOf(recommendedShots)}
        y2={H - 14}
        stroke="#f4a261"
        strokeDasharray="3 3"
        strokeOpacity="0.7"
      />
      {/* the convergence curve */}
      <polyline points={points} fill="none" stroke="#f4a261" strokeWidth="1.6" />
      {/* the recommended-shot point */}
      <circle cx={xOf(recommendedShots)} cy={yOf(target)} r="3" fill="#f4a261" />
      {/* axis labels */}
      <text x="20" y="16" fill="#8492c7" fontSize="8" fontFamily="monospace">
        fidelity →
      </text>
      <text x={W - 12} y={H - 4} fill="#8492c7" fontSize="8"
            fontFamily="monospace" textAnchor="end">
        shots (log) →
      </text>
      <text x={xOf(recommendedShots) + 4} y="14" fill="#f4a261" fontSize="8"
            fontFamily="monospace">
        recommended
      </text>
    </svg>
  );
}
