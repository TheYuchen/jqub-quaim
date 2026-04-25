import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "./lib/api";
import { useApp } from "./lib/store";
import { useIsDesktop } from "./lib/useMediaQuery";
import { TopBar } from "./components/TopBar";
import { NodePalette } from "./components/NodePalette";
import { FlowCanvas } from "./components/FlowCanvas";
import { ResultsPane } from "./components/ResultsPane";
import { CircuitPicker } from "./components/CircuitPicker";
import { MobileDrawer } from "./components/MobileDrawer";
import { WelcomeTour, useFirstVisitTour } from "./components/WelcomeTour";

// Default + clamp bounds for the two side panels. The middle canvas flexes.
const LEFT_DEFAULT = 320;
const LEFT_MIN = 220;
const LEFT_MAX = 560;
const RIGHT_DEFAULT = 400;
const RIGHT_MIN = 300;
const RIGHT_MAX = 720;
const COLLAPSED_W = 32;

const LS_LEFT = "jqub.leftPaneWidth";
const LS_RIGHT = "jqub.rightPaneWidth";
const LS_LEFT_COLLAPSED = "jqub.leftPaneCollapsed";
const LS_RIGHT_COLLAPSED = "jqub.rightPaneCollapsed";

function loadWidth(key: string, def: number, min: number, max: number): number {
  if (typeof window === "undefined") return def;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return def;
    const n = Number(raw);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  } catch {
    return def;
  }
}

function loadBool(key: string, def: boolean): boolean {
  if (typeof window === "undefined") return def;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return def;
    return raw === "1";
  } catch {
    return def;
  }
}

export default function App() {
  const setHealth = useApp((s) => s.setHealth);
  const running = useApp((s) => s.running);
  const [ready, setReady] = useState(false);
  const [tourOpen, setTourOpen] = useFirstVisitTour();
  const isDesktop = useIsDesktop();

  // Desktop pane widths — unused on mobile (drawers take over there).
  const [leftW, setLeftW] = useState<number>(() =>
    loadWidth(LS_LEFT, LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
  );
  const [rightW, setRightW] = useState<number>(() =>
    loadWidth(LS_RIGHT, RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
  );
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() =>
    loadBool(LS_LEFT_COLLAPSED, false),
  );
  // Right pane (results) defaults to collapsed on first visit so the
  // canvas reads cleanly and matches the mobile drawer (also closed by
  // default). Once the user runs a pipeline, the run-start effect below
  // expands it; user's preference thereafter is persisted in
  // localStorage so a power user who likes it permanently expanded
  // doesn't have to re-expand every visit.
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() =>
    loadBool(LS_RIGHT_COLLAPSED, true),
  );

  // Mobile drawer state — unused on desktop.
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  // Persist user's preferred widths (desktop only; the values are loaded
  // at mount either way so that toggling screen size restores them).
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_LEFT, String(leftW));
    } catch {
      /* ignore quota errors */
    }
  }, [leftW]);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_RIGHT, String(rightW));
    } catch {
      /* ignore quota errors */
    }
  }, [rightW]);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_LEFT_COLLAPSED, leftCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [leftCollapsed]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        LS_RIGHT_COLLAPSED,
        rightCollapsed ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [rightCollapsed]);

  // Auto-expand the right pane (desktop) or pop the right drawer (mobile)
  // when a pipeline run kicks off, so the user sees progress. Only on the
  // false→true edge — repeat runs while already expanded are a no-op.
  const prevRunningRef = useRef(running);
  useEffect(() => {
    if (running && !prevRunningRef.current) {
      if (isDesktop) {
        if (rightCollapsed) setRightCollapsed(false);
      } else {
        setRightDrawerOpen(true);
      }
    }
    prevRunningRef.current = running;
  }, [running, rightCollapsed, isDesktop]);

  // Close any open drawer as soon as we leave mobile layout, so switching
  // from portrait to landscape doesn't leave a floating panel hanging.
  useEffect(() => {
    if (isDesktop) {
      setLeftDrawerOpen(false);
      setRightDrawerOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [setHealth]);

  const leftWidth = leftCollapsed ? COLLAPSED_W : leftW;
  const rightWidth = rightCollapsed ? COLLAPSED_W : rightW;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar
        onOpenTour={() => setTourOpen(true)}
        mobile={!isDesktop}
        onOpenLeftDrawer={() => setLeftDrawerOpen(true)}
        onOpenRightDrawer={() => setRightDrawerOpen(true)}
      />
      {isDesktop ? (
        /* =====================  Desktop  ===================== */
        <div className="flex-1 flex min-h-0">
          <aside
            style={{ width: leftWidth }}
            className={`shrink-0 border-r border-edge flex flex-col min-h-0 transition-[width] duration-150 ${
              leftCollapsed ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            {leftCollapsed ? (
              <CollapsedStrip
                label="Pipeline input"
                side="left"
                onExpand={() => setLeftCollapsed(false)}
              />
            ) : (
              <CircuitPicker onCollapse={() => setLeftCollapsed(true)} />
            )}
          </aside>
          {!leftCollapsed && (
            <PaneResizer
              onResize={(dx) =>
                setLeftW((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + dx)))
              }
              onDoubleClick={() => setLeftW(LEFT_DEFAULT)}
              ariaLabel="Resize pipeline input pane"
            />
          )}
          <main className="flex-1 min-w-0 flex flex-col min-h-0">
            <NodePalette />
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
          </main>
          {!rightCollapsed && (
            <PaneResizer
              onResize={(dx) =>
                setRightW((w) =>
                  Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w - dx)),
                )
              }
              onDoubleClick={() => setRightW(RIGHT_DEFAULT)}
              ariaLabel="Resize results pane"
            />
          )}
          <aside
            style={{ width: rightWidth }}
            className={`shrink-0 border-l border-edge flex flex-col min-h-0 transition-[width] duration-150 ${
              rightCollapsed ? "overflow-hidden" : ""
            }`}
          >
            {rightCollapsed ? (
              <CollapsedStrip
                label="Results"
                side="right"
                onExpand={() => setRightCollapsed(false)}
              />
            ) : (
              <ResultsPane onCollapse={() => setRightCollapsed(true)} />
            )}
          </aside>
        </div>
      ) : (
        /* =====================  Mobile  ====================== */
        <div className="flex-1 flex flex-col min-h-0">
          <main className="flex-1 min-w-0 flex flex-col min-h-0">
            <NodePalette />
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
          </main>
          <MobileDrawer
            open={leftDrawerOpen}
            onClose={() => setLeftDrawerOpen(false)}
            side="left"
            title="Pipeline input"
          >
            <CircuitPicker />
          </MobileDrawer>
          <MobileDrawer
            open={rightDrawerOpen}
            onClose={() => setRightDrawerOpen(false)}
            side="right"
            title="Results"
          >
            <ResultsPane />
          </MobileDrawer>
        </div>
      )}
      {!ready && (
        <div className="absolute inset-0 bg-canvas/80 flex items-center justify-center backdrop-blur">
          <div className="text-mute text-sm">Connecting to quantum backend…</div>
        </div>
      )}
      <WelcomeTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}

/**
 * Narrow vertical strip shown when an aside pane is collapsed.
 *
 * Clicking anywhere on it expands the pane. The chevron sits near the top
 * and the label is rotated 90° to fill the strip. `side` controls which
 * edge the chevron points towards — a left-side strip points right (come
 * back out to the right) and a right-side strip points left.
 */
function CollapsedStrip({
  label,
  side,
  onExpand,
}: {
  label: string;
  side: "left" | "right";
  onExpand: () => void;
}) {
  const Chevron = side === "left" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`Expand ${label}`}
      aria-label={`Expand ${label}`}
      className="flex flex-col items-center gap-2 py-2 px-0 w-full h-full text-mute hover:text-ink hover:bg-surfaceAlt transition-colors"
    >
      <Chevron className="w-4 h-4 shrink-0" />
      <span
        className="text-[11px] uppercase tracking-wider whitespace-nowrap select-none"
        style={{ writingMode: "vertical-rl" }}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * 4-px wide vertical drag handle between two panes.
 *
 * - Report deltas in page pixels via onResize(dx) where dx is the movement
 *   relative to the mousedown position. The parent decides whether to add
 *   or subtract dx depending on which edge the handle sits on.
 * - Double-click snaps the parent's width back to its default.
 */
function PaneResizer({
  onResize,
  onDoubleClick,
  ariaLabel,
}: {
  onResize: (dx: number) => void;
  onDoubleClick?: () => void;
  ariaLabel: string;
}) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (dx !== 0) onResize(dx);
    },
    [onResize],
  );

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      title="Drag to resize. Double-click to reset."
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="group shrink-0 w-1 cursor-col-resize bg-edge/40 hover:bg-accent/60 active:bg-accent transition-colors"
    />
  );
}
