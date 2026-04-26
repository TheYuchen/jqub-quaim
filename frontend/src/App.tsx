import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PanelLeft, PanelRight } from "lucide-react";
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

// Minimum width we ever want to leave for the canvas (NodePalette + React
// Flow). Below this, NodePalette tiles (each fixed at 108px and shrink-0)
// start overflowing horizontally because `<main>` has no overflow clip —
// they visually escape the canvas column and cover whatever's in the
// right pane. The dynamic clamp in the resize handler caps the side
// panes so this never happens, regardless of viewport size.
const MIN_CANVAS_W = 280;
// Reserve the side resizer's footprint when computing the canvas budget.
const RESIZER_W = 4;

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

  // True while a PaneResizer drag is in flight. We use it to suppress the
  // CSS `transition-[width]` during dragging: setRightW / setLeftW fire on
  // every mousemove, so each value change would otherwise kick off a 150ms
  // animation, causing the visible aside width to lag behind the inner
  // content's layout — the cards would briefly overflow the aside while it
  // animates. With the transition off during drag, width tracks the cursor
  // exactly; we re-enable it for the smooth collapse/expand toggles.
  const [isResizing, setIsResizing] = useState(false);

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

  // Window resize → shrink oversized panes back into the safe zone.
  // The drag-time clamp keeps users from making things too wide; this
  // covers the case where the user shrinks the window after panes were
  // already wide. Without it, current widths could exceed the dynamic
  // max for the new viewport, and NodePalette tiles would overflow into
  // the side panes again.
  useEffect(() => {
    if (!isDesktop) return;
    const onResize = () => {
      const ww = window.innerWidth;
      const leftFoot = leftCollapsed ? COLLAPSED_W : 0; // pane footprint computed below
      const rightFoot = rightCollapsed ? COLLAPSED_W : 0;
      // Headroom each pane has, given the *other* pane and resizers.
      const maxLeft = Math.min(
        LEFT_MAX,
        ww - (rightCollapsed ? rightFoot : rightW + RESIZER_W) - RESIZER_W - MIN_CANVAS_W,
      );
      const maxRight = Math.min(
        RIGHT_MAX,
        ww - (leftCollapsed ? leftFoot : leftW + RESIZER_W) - RESIZER_W - MIN_CANVAS_W,
      );
      setLeftW((w) => Math.max(LEFT_MIN, Math.min(w, Math.max(LEFT_MIN, maxLeft))));
      setRightW((w) => Math.max(RIGHT_MIN, Math.min(w, Math.max(RIGHT_MIN, maxRight))));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isDesktop, leftCollapsed, rightCollapsed, leftW, rightW]);

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
            className={`shrink-0 border-r border-edge flex flex-col min-h-0 ${
              isResizing ? "" : "transition-[width] duration-150"
            } ${leftCollapsed ? "overflow-hidden" : "overflow-x-hidden overflow-y-auto"}`}
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
                setLeftW((w) => {
                  // Dynamic upper bound: never push left pane so wide that
                  // the canvas falls below MIN_CANVAS_W. Account for the
                  // right pane's current footprint (collapsed strip when
                  // collapsed, full width otherwise) and both resizers.
                  const rightFoot = rightCollapsed ? COLLAPSED_W : rightW + RESIZER_W;
                  const dynamicMax = Math.min(
                    LEFT_MAX,
                    window.innerWidth - rightFoot - RESIZER_W - MIN_CANVAS_W,
                  );
                  return Math.min(
                    Math.max(LEFT_MIN, dynamicMax),
                    Math.max(LEFT_MIN, w + dx),
                  );
                })
              }
              onDoubleClick={() => setLeftW(LEFT_DEFAULT)}
              onDragChange={setIsResizing}
              ariaLabel="Resize pipeline input pane"
            />
          )}
          <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-x-hidden">
            <NodePalette />
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
          </main>
          {!rightCollapsed && (
            <PaneResizer
              onResize={(dx) =>
                setRightW((w) => {
                  // Dynamic upper bound: never push right pane so wide
                  // that the canvas falls below MIN_CANVAS_W. Mirror
                  // logic of the left resizer.
                  const leftFoot = leftCollapsed ? COLLAPSED_W : leftW + RESIZER_W;
                  const dynamicMax = Math.min(
                    RIGHT_MAX,
                    window.innerWidth - leftFoot - RESIZER_W - MIN_CANVAS_W,
                  );
                  return Math.min(
                    Math.max(RIGHT_MIN, dynamicMax),
                    Math.max(RIGHT_MIN, w - dx),
                  );
                })
              }
              onDoubleClick={() => setRightW(RIGHT_DEFAULT)}
              onDragChange={setIsResizing}
              ariaLabel="Resize results pane"
            />
          )}
          <aside
            style={{ width: rightWidth }}
            className={`shrink-0 border-l border-edge flex flex-col min-h-0 overflow-x-hidden ${
              isResizing ? "" : "transition-[width] duration-150"
            } ${rightCollapsed ? "overflow-hidden" : ""}`}
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
          <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-x-hidden">
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
  // Use the same panel-toggle icons the mobile TopBar uses for its
  // drawer toggles, so the visual cue for "open this side panel" is
  // consistent across breakpoints. PanelLeft = left edge highlight;
  // PanelRight = right edge highlight — picks the one that points
  // *toward* the pane that's about to slide open.
  const Icon = side === "left" ? PanelLeft : PanelRight;
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`Expand ${label}`}
      aria-label={`Expand ${label}`}
      className="flex flex-col items-center gap-2 py-2 px-0 w-full h-full text-mute hover:text-ink hover:bg-surfaceAlt transition-colors"
    >
      <Icon className="w-5 h-5 shrink-0" strokeWidth={1.8} />
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
 * - onDragChange (optional) fires once with `true` on mousedown and once
 *   with `false` on mouseup. App.tsx uses it to suppress the
 *   `transition-[width]` on the aside while dragging — every mousemove
 *   updates state, and an active CSS transition would lag the visual
 *   width behind the cursor while the inner content is already laid out
 *   at the new width, briefly overflowing the aside.
 */
function PaneResizer({
  onResize,
  onDoubleClick,
  onDragChange,
  ariaLabel,
}: {
  onResize: (dx: number) => void;
  onDoubleClick?: () => void;
  onDragChange?: (resizing: boolean) => void;
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
    onDragChange?.(false);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove, onDragChange]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    onDragChange?.(true);
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
