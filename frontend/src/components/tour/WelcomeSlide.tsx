// Tour slide 1: intro. Big title + tagline + animated atom emblem.
//
// Copy avoids hard-coding a specific number of algorithms ("three") — the
// lab ships new research modules regularly, so anything we write here
// should survive adding a fourth/fifth block without copy edits.

import { Sparkles } from "lucide-react";

export function WelcomeSlide() {
  return (
    <div className="p-8 sm:p-10 flex flex-col sm:flex-row gap-8 items-center">
      <div className="flex-1 min-w-0">
        <div className="chip mb-3 !text-accent !border-accent/40">
          <Sparkles className="w-3 h-3" /> JQub Lab · GMU ECE
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-ink leading-tight mb-3">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-accent via-accent2 to-accent3 bg-clip-text text-transparent">
            QuAIM
          </span>
        </h1>
        <p className="text-mute leading-relaxed mb-4">
          A visual playground for research algorithms from the{" "}
          <a
            href="https://jqub.ece.gmu.edu/"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            JQub lab
          </a>{" "}
          at George Mason University — currently QuCAD, QuBound, and
          CompressVQC, with more to come — applied to a quantum circuit
          of your choice.
        </p>
        <p className="text-sm text-mute leading-relaxed">
          Build a pipeline by dragging blocks, hit{" "}
          <span className="kbd">Run pipeline</span>, and see what happens when
          each algorithm meets real IBM hardware noise.
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
