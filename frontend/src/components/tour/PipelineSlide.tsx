// Tour slide 3: how pipelines work. Inline SVG pipeline + four tip cards.

export function PipelineSlide() {
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
          <div className="text-accent font-semibold mb-0.5">Blocks you drag</div>
          <span className="text-mute">
            Each block wraps one stage: a circuit source, a backend, an
            algorithm, a metric, or a sink. Parameters are editable on the
            block itself.
          </span>
        </div>
        <div className="panel-alt p-3">
          <div className="text-accent2 font-semibold mb-0.5">Links you draw</div>
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
            Each algorithm block either rewrites the circuit (QuCAD,
            CompressVQC) or attaches a number to the output (QuBound's
            error bound, Qshot's shot count, Fidelity).
          </span>
        </div>
        <div className="panel-alt p-3">
          <div className="text-accent4 font-semibold mb-0.5">Offline by default</div>
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
      <PipelineNode x={360} y={40} color="#7b5cff" label="QuCAD" sub="ALGORITHM" kind="algo" />
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
