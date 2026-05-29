import { useCallback, useRef, useState } from "react";
import { useDismissOn } from "../lib/useDismissOn";

/** Compact NSF globe mark — a blue circle with white "NSF" lettering.
 *  Captures the essence of the official NSF logo without depending on
 *  an external image URL. */
function NsfMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="NSF"
      className="shrink-0"
    >
      <circle cx="20" cy="20" r="19" fill="#2160a8" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#fff"
        letterSpacing="0.5"
      >
        NSF
      </text>
    </svg>
  );
}

/**
 * Popover listing the NSF awards that fund the lab's research.
 *
 * Same open/close UX as the Papers and Developers popovers
 * (outside-click + Escape dismiss). Each award links to the NSF
 * award-search page. A small disclaimer at the bottom carries the
 * standard NSF acknowledgment language.
 */

interface Award {
  id: string;
  shortName: string;
  title: string;
  period: string;
  url: string;
}

const AWARDS: Award[] = [
  {
    id: "2507948",
    shortName: "SPV",
    title: "Synthesis, Profiling, and Verification of Quantum Circuits",
    period: "2025–2028",
    url: "https://www.nsf.gov/awardsearch/showAward?AWD_ID=2507948",
  },
  {
    id: "2513431",
    shortName: "QuAIM",
    title:
      "QuAIM: A Quantum Cyberinfrastructure with Automated Implementation Toolkits for Scientific Discovery",
    period: "2025–2028",
    url: "https://www.nsf.gov/awardsearch/showAward?AWD_ID=2513431",
  },
  {
    id: "2440637",
    shortName: "AutoQC",
    title:
      "Efficient and Scalable Deployment Automation for Quantum-Centric Computing",
    period: "2025–2030",
    url: "https://www.nsf.gov/awardsearch/showAward?AWD_ID=2440637",
  },
  {
    id: "2311949",
    shortName: "TeReQuLe",
    title:
      "An Integrated Framework for Enabling Temporal-Reliable Quantum Learning on NISQ-era Devices",
    period: "2023–2027",
    url: "https://www.nsf.gov/awardsearch/showAward?AWD_ID=2311949",
  },
  {
    id: "2320957",
    shortName: "QuacyTrain",
    title:
      "Quantum Research Workforce Development on End-to-End Quantum Systems Integration",
    period: "2023–2026",
    url: "https://www.nsf.gov/awardsearch/showAward?AWD_ID=2320957",
  },
];

export function SupportPopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismissOn(open, rootRef, useCallback(() => setOpen(false), []));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        title="Funding acknowledgments"
        aria-label="Support"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <NsfMark size={16} />
        <span className="hidden sm:inline">Support</span>
      </button>
      {open && (
        <div
          role="menu"
          className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-full sm:mt-1 rounded-lg border border-edge bg-surface shadow-xl z-40 p-3 w-[min(26rem,calc(100vw-1.5rem))]"
        >
          <div className="text-xs uppercase tracking-wider text-mute mb-2">
            Supported by NSF
          </div>
          <div className="space-y-1.5">
            {AWARDS.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-2 py-1.5 rounded-md hover:bg-surfaceAlt transition-colors group"
              >
                <span className="text-[12px] text-ink line-clamp-1 group-hover:underline decoration-accent/40 underline-offset-2">
                  {a.title}
                </span>
                <span className="block text-[10px] text-mute mt-0.5">
                  NSF #{a.id}{" "}
                  <span className="font-mono text-accent">({a.shortName})</span>
                  {" · "}{a.period}
                </span>
              </a>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-edge text-[10px] text-mute leading-relaxed">
            This material is based upon work supported by the National Science
            Foundation. Any opinions, findings, and conclusions or
            recommendations expressed in this material are those of the
            author(s) and do not necessarily reflect the views of the National
            Science Foundation.
          </div>
        </div>
      )}
    </div>
  );
}
