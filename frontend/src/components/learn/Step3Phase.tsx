import { useEffect, useRef, useState } from "react";
import { Eye, RotateCcw, Wand2 } from "lucide-react";
import { gloss } from "../../lib/glossary";
import {
  applyH1,
  applyX1,
  measureOnce,
  mulberry32,
  zero1,
  type State1,
} from "../../lib/quantumToy";
import { TipIcon } from "../TipIcon";
import { CircleState } from "./CircleState";
import { Tally } from "./Tally";
import { useDrawLoop } from "./useDrawLoop";

/**
 * Frame step 4 (of 7) — "The hidden direction". NOTE the file keeps
 * the spec name Step3Phase; component file names are stage names,
 * not frame positions (Step3Bell now sits at frame step 5).
 *
 * Act 1 — two circles side by side, prepared |+⟩ (recipe [H]) and
 * |−⟩ (recipe [X, H]); both dials cast the SAME 50/50 shadow. Every
 * look draws one outcome from EACH circle (seeded, exact sim), and
 * the two tallies scatter around fifty-fifty identically — the
 * DISTRIBUTIONS are identical (asserted in the node lane), so no
 * amount of measuring can tell the circles apart. (The tallies are
 * finite samples, so their counts differ draw to draw — the copy
 * says "twins to measurement", never "identical counts".)
 *
 * Act 2 — "apply H to both": left snaps to 0, right snaps to 1,
 * deterministically (H|+⟩ = |0⟩, H|−⟩ = |1⟩ exactly — sign
 * cancellation, the same interference that powers step 3's H·H).
 * A gate separates what measurement never could: the hidden
 * direction is real. Applying H resets the seeded tallies (new
 * distribution → fresh deterministic replay, the track-wide rule).
 *
 * Act 3 — THE SPHERE (PhaseSphere below): the honest full map. Our
 * gates walk one highlighted great circle of it; the sideways
 * directions are more of the same hidden dial (complex phase, which
 * the toy defers — see lib/quantumToy.ts header).
 */
const SEED = 20260713;
const PLUS = applyH1(zero1()); // |+⟩
const MINUS = applyH1(applyX1(zero1())); // |−⟩ — computed from its shown recipe [X, H]

const EMPTY = { "0": 0, "1": 0 };

export function Step3Phase() {
  const [hApplied, setHApplied] = useState(false);
  const [countsL, setCountsL] = useState<Record<string, number>>({ ...EMPTY });
  const [countsR, setCountsR] = useState<Record<string, number>>({ ...EMPTY });
  const [snapL, setSnapL] = useState<0 | 1 | null>(null);
  const [snapR, setSnapR] = useState<0 | 1 | null>(null);
  const rng = useRef(mulberry32(SEED));
  const unsnap = useRef<ReturnType<typeof setTimeout> | null>(null);

  const left: State1 = hApplied ? applyH1(PLUS) : PLUS;
  const right: State1 = hApplied ? applyH1(MINUS) : MINUS;

  useEffect(
    () => () => {
      if (unsnap.current) clearTimeout(unsnap.current);
    },
    [],
  );

  const settle = () => {
    if (unsnap.current) clearTimeout(unsnap.current);
    unsnap.current = setTimeout(() => {
      setSnapL(null);
      setSnapR(null);
    }, 380);
  };

  const { running, run, stop } = useDrawLoop(() => {
    const a = measureOnce(left, rng.current) === "1" ? 1 : 0;
    const b = measureOnce(right, rng.current) === "1" ? 1 : 0;
    setCountsL((c) => ({ ...c, [String(a)]: (c[String(a)] ?? 0) + 1 }));
    setCountsR((c) => ({ ...c, [String(b)]: (c[String(b)] ?? 0) + 1 }));
    setSnapL(a);
    setSnapR(b);
    settle();
  });

  const clearTallies = () => {
    stop();
    if (unsnap.current) clearTimeout(unsnap.current);
    setSnapL(null);
    setSnapR(null);
    setCountsL({ ...EMPTY });
    setCountsR({ ...EMPTY });
    rng.current = mulberry32(SEED);
  };

  const reset = () => {
    clearTallies();
    setHApplied(false);
  };

  const applyH = () => {
    if (hApplied || running) return;
    setHApplied(true);
    clearTallies(); // new distribution → fresh deterministic tally
  };

  const totalL = (countsL["0"] ?? 0) + (countsL["1"] ?? 0);
  const total = totalL + (countsR["0"] ?? 0) + (countsR["1"] ?? 0);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Acts 1 & 2 — the pair of circles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {[
          {
            recipe: hApplied ? ["H", "H"] : ["H"],
            state: left,
            counts: countsL,
            snap: snapL,
            side: "left circle",
          },
          {
            recipe: hApplied ? ["X", "H", "H"] : ["X", "H"],
            state: right,
            counts: countsR,
            snap: snapR,
            side: "right circle",
          },
        ].map((c) => (
          <div key={c.side} className="panel-alt p-3 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1" aria-label={`${c.side} recipe`}>
              <span className="text-[10px] uppercase tracking-wider text-mute">recipe</span>
              {c.recipe.map((g, i) => (
                <span
                  key={i}
                  className={`w-6 h-6 rounded-md border font-mono text-[11px] flex items-center justify-center ${
                    hApplied && i === c.recipe.length - 1
                      ? "border-warn/60 bg-warn/10 text-warn"
                      : "border-accent/50 bg-accent/10 text-accent"
                  }`}
                >
                  {g}
                </span>
              ))}
            </div>
            <CircleState state={c.state} snapped={c.snap} size={150} />
            <div className="w-full max-w-[190px]">
              <Tally counts={c.counts} order={["0", "1"]} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => run(1)}
        >
          <Eye className="w-3.5 h-3.5" /> measure both ×1
        </button>
        <button
          type="button"
          className="btn !px-2.5 !py-1 text-xs disabled:opacity-40"
          disabled={running}
          onClick={() => run(100)}
        >
          ×100
        </button>
        <button
          type="button"
          className={`btn !px-2.5 !py-1 text-xs disabled:opacity-40 ${
            hApplied ? "" : "!border-accent/60"
          }`}
          disabled={running || hApplied}
          onClick={applyH}
          title="Append one H to both recipes — watch the needles"
        >
          <Wand2 className="w-3.5 h-3.5" /> apply H to both
        </button>
        <button
          type="button"
          className="btn-ghost text-xs disabled:opacity-40"
          disabled={running || (total === 0 && !hApplied)}
          onClick={reset}
          aria-label="Reset tallies and remove the extra H"
        >
          <RotateCcw className="w-3 h-3" /> reset
        </button>
      </div>

      <p className="text-[11px] text-mute text-center tabular-nums max-w-md" aria-live="polite">
        {hApplied ? (
          <>
            one H and they split:{" "}
            <span className="text-ink">
              left swung to 0, right swung to 1 — with certainty.
            </span>{" "}
            A gate told them apart; measurement never could. That difference is
            the hidden direction{" "}
            <TipIcon hint={gloss("phase")} size={10} />
          </>
        ) : total === 0 ? (
          <>
            two recipes, two circles — same 50/50 shadow. Measure both: can any
            tally tell them apart?
          </>
        ) : (
          <>
            after {totalL} look{totalL === 1 ? "" : "s"} each: both tallies
            scatter around fifty-fifty —{" "}
            <span className="text-ink">
              to measurement these two states are twins
            </span>
            … so try the extra H
          </>
        )}
      </p>

      {/* Act 3 — the sphere */}
      <div className="w-full border-t border-edge/60 pt-3 mt-1 flex flex-col items-center gap-1.5">
        <div className="text-[10px] uppercase tracking-wider text-mute">
          the full map
        </div>
        <PhaseSphere />
        <p className="text-[11px] leading-snug text-mute border-l-2 border-accent/50 pl-2 max-w-md">
          The full map of one qubit is a <span className="text-ink">sphere</span>.
          Our gates walk the one highlighted circle of it — 0 on top, 1 at the
          bottom, plus-way and minus-way on the sides. The sideways directions
          are more of the same hidden dial: phase{" "}
          <TipIcon hint={gloss("phase")} size={10} /> — every point on the
          equator casts the same 50/50 shadow, and only gates can tell them
          apart.
        </p>
      </div>
    </div>
  );
}

/**
 * Act 3's pseudo-3D sphere (SVG, no dependencies): orthographic
 * projection with a fixed ~18° downward tilt plus a user-controlled
 * spin φ around the vertical |0⟩–|1⟩ axis. Drag horizontally to
 * rotate; otherwise it slowly auto-rotates (~50s/turn) unless
 * prefers-reduced-motion, in which case it holds a fixed φ that
 * still shows depth. The great circle the lessons travel (the X–Z
 * meridian carrying |0⟩, |+⟩, |1⟩, |−⟩) is highlighted, split into a
 * solid front arc and a dashed back arc; a second, unlabeled faint
 * meridian and two latitude rings give the spin its depth cue —
 * they are the "more of the same hidden dial" the caption points at.
 */
const TAU = 0.32; // fixed tilt, radians
const SR = 74; // sphere radius in viewBox units
const SCX = 110;
const SCY = 112;

function project(x: number, y: number, z: number, phi: number) {
  // spin around the vertical (z) axis, then tilt about the screen x-axis
  const x1 = x * Math.cos(phi) + y * Math.sin(phi);
  const y1 = -x * Math.sin(phi) + y * Math.cos(phi);
  const up = z * Math.cos(TAU) + y1 * Math.sin(TAU);
  const depth = -z * Math.sin(TAU) + y1 * Math.cos(TAU);
  return {
    sx: SCX + SR * x1,
    sy: SCY - SR * up,
    front: depth <= 0,
  };
}

/** A 3D circle → its front (solid) and back (dashed) polyline points. */
function arcs(
  pts: { sx: number; sy: number; front: boolean }[],
): { front: string[]; back: string[] } {
  const front: string[] = [];
  const back: string[] = [];
  let cf: string[] = [];
  let cb: string[] = [];
  for (const p of pts) {
    const s = `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
    if (p.front) {
      if (cb.length > 1) back.push(cb.join(" "));
      cb = [];
      cf.push(s);
    } else {
      if (cf.length > 1) front.push(cf.join(" "));
      cf = [];
      cb.push(s);
    }
  }
  if (cf.length > 1) front.push(cf.join(" "));
  if (cb.length > 1) back.push(cb.join(" "));
  return { front, back };
}

function PhaseSphere() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [phi, setPhi] = useState(reduced ? 0.55 : 0);
  const [dragging, setDragging] = useState(false);
  const lastX = useRef(0);

  useEffect(() => {
    if (reduced || dragging) return;
    const t = setInterval(() => setPhi((p) => p + 0.0063), 50);
    return () => clearInterval(t);
  }, [reduced, dragging]);

  // our great circle: the X–Z meridian, θ clockwise from |0⟩
  const N = 72;
  const travel = arcs(
    Array.from({ length: N + 1 }, (_, i) => {
      const th = (2 * Math.PI * i) / N;
      return project(Math.sin(th), 0, Math.cos(th), phi);
    }),
  );
  // depth cues: one faint sideways meridian (the hidden dial's plane)
  const side = arcs(
    Array.from({ length: N + 1 }, (_, i) => {
      const th = (2 * Math.PI * i) / N;
      return project(0, Math.sin(th), Math.cos(th), phi);
    }),
  );
  // two latitude rings (spin-invariant ellipses — drawn directly)
  const lats = [0.55, -0.55].map((z0) => {
    const rho = Math.sqrt(1 - z0 * z0);
    return {
      cy: SCY - SR * z0 * Math.cos(TAU),
      rx: SR * rho,
      ry: SR * rho * Math.sin(TAU),
    };
  });

  const marks = [
    { th: 0, t: "0", dx: 0, dy: -8 },
    { th: Math.PI / 2, t: "+", dx: 10, dy: 3 },
    { th: Math.PI, t: "1", dx: 0, dy: 15 },
    { th: (3 * Math.PI) / 2, t: "−", dx: -10, dy: 3 },
  ].map((m) => ({
    ...m,
    ...project(Math.sin(m.th), 0, Math.cos(m.th), phi),
  }));

  return (
    <svg
      viewBox="0 0 220 226"
      width={210}
      height={216}
      role="img"
      aria-label="the sphere of all one-qubit states, with the circle our gates travel highlighted through 0, plus-way, 1 and minus-way; drag sideways to rotate"
      className={dragging ? "cursor-grabbing" : "cursor-grab"}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        lastX.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        setPhi((p) => p + (e.clientX - lastX.current) / 90);
        lastX.current = e.clientX;
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {/* body + limb */}
      <circle
        cx={SCX}
        cy={SCY}
        r={SR}
        style={{ fill: "rgb(var(--color-accent))", opacity: 0.05 }}
      />
      {/* latitude rings + sideways meridian — the "more sphere" texture */}
      {lats.map((l, i) => (
        <ellipse
          key={i}
          cx={SCX}
          cy={l.cy}
          rx={l.rx}
          ry={l.ry}
          fill="none"
          strokeWidth="1"
          style={{ stroke: "rgb(var(--color-mute))", opacity: 0.3 }}
        />
      ))}
      {[...side.front, ...side.back].map((pts, i) => (
        <polyline
          key={`s${i}`}
          points={pts}
          fill="none"
          strokeWidth="1"
          style={{ stroke: "rgb(var(--color-mute))", opacity: 0.3 }}
        />
      ))}
      <circle
        cx={SCX}
        cy={SCY}
        r={SR}
        fill="none"
        strokeWidth="1.5"
        style={{ stroke: "rgb(var(--color-edge))" }}
      />
      {/* the vertical axis the shadow falls on */}
      <line
        x1={SCX}
        y1={SCY - SR * Math.cos(TAU)}
        x2={SCX}
        y2={SCY + SR * Math.cos(TAU)}
        strokeWidth="1"
        strokeDasharray="3 3"
        style={{ stroke: "rgb(var(--color-mute))", opacity: 0.45 }}
      />
      {/* the great circle we travel: back dashed, front solid */}
      {travel.back.map((pts, i) => (
        <polyline
          key={`b${i}`}
          points={pts}
          fill="none"
          strokeWidth="2"
          strokeDasharray="4 4"
          style={{ stroke: "rgb(var(--color-accent))", opacity: 0.35 }}
        />
      ))}
      {travel.front.map((pts, i) => (
        <polyline
          key={`f${i}`}
          points={pts}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ stroke: "rgb(var(--color-accent))", opacity: 0.9 }}
        />
      ))}
      {/* the four states the lessons visit */}
      {marks.map((m) => (
        <g key={m.t} style={{ opacity: m.front ? 1 : 0.35 }}>
          <circle cx={m.sx} cy={m.sy} r={4} style={{ fill: "rgb(var(--color-accent))" }} />
          <text
            x={m.sx + m.dx}
            y={m.sy + m.dy}
            textAnchor="middle"
            fontSize="12"
            className="font-mono"
            style={{ fill: "rgb(var(--color-ink))" }}
          >
            {m.t}
          </text>
        </g>
      ))}
      <text
        x={SCX}
        y={222}
        textAnchor="middle"
        fontSize="9"
        style={{ fill: "rgb(var(--color-mute))" }}
      >
        drag to rotate
      </text>
    </svg>
  );
}
