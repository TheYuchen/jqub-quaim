import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PanelLeft, PanelRight } from "lucide-react";
import { api } from "./lib/api";
import { getUserId } from "./lib/userId";
import { useApp } from "./lib/store";
import { ensureDemoArchive } from "./lib/demoArchive";
import { useIsDesktop, useMediaQuery } from "./lib/useMediaQuery";
import { TopBar } from "./components/TopBar";
import { NodePalette } from "./components/NodePalette";
import { FlowCanvas } from "./components/FlowCanvas";
import { ResultsPane } from "./components/ResultsPane";
import { MultiverseBoard } from "./components/MultiverseBoard";
import { EvidenceTheater } from "./components/EvidenceTheater";
import { CircuitPicker } from "./components/CircuitPicker";
import { MobileDrawer } from "./components/MobileDrawer";
import { WelcomeTour, useFirstVisitTour } from "./components/WelcomeTour";
import { activateScenario } from "./lib/scenarios";

// ---------------------------------------------------------------------------
// RESPONSIVE CONTRACT (no horizontal page scroll at ANY width ≥ 768px)
//
//   <768px       mobile: both side panes become MobileDrawers; the Run
//                FAB replaces the toolbar Run button.
//   768–1199px   compact desktop ("the band"): the left pane stays in
//                flow (its clamps account for the strip), but the
//                Evidence pane NEVER takes layout width — it boots
//                collapsed to its 32px strip and, when expanded, opens
//                as a right-anchored OVERLAY over the center column
//                (bandEvidenceOpen: session state, never persisted).
//                Rationale: LEFT_MIN + RIGHT_MIN + MIN_CANVAS_W + two
//                resizers = 808px, so hosting both panes in flow is
//                impossible at 768px and cramped through ~1200px.
//   ≥1200px      full desktop: three columns, both panes resizable,
//                widths + collapsed preferences persisted.
//
// Two width guards keep the columns inside the viewport: the drag-time
// clamp in each PaneResizer, and the mount+resize clamp effect below —
// it MUST run on mount, not just on resize events, because persisted
// widths from a wider monitor would otherwise overflow the first paint
// into horizontal scroll. The center column owns all remaining width
// (flex-1 + min-w-0 down to the board grid, whose auto-fill tracks are
// minmax(min(240px,100%),1fr)); the board/theater overlays are
// absolutely positioned inside it, so nothing can widen the page.
// ---------------------------------------------------------------------------

// Default + clamp bounds for the two side panels. The middle canvas flexes.
const LEFT_DEFAULT = 320;
const LEFT_MIN = 220;
const LEFT_MAX = 560;
const RIGHT_DEFAULT = 400;
const RIGHT_MIN = 300;
const RIGHT_MAX = 720;
const COLLAPSED_W = 32;
// Full-desktop threshold — below this (and ≥768px) is "the band".
const WIDE_QUERY = "(min-width: 1200px)";

// Minimum width we ever want to leave for the canvas (NodePalette + React
// Flow). Below this, NodePalette tiles (each fixed at 108px and shrink-0)
// start overflowing horizontally because `<main>` has no overflow clip —
// they visually escape the canvas column and cover whatever's in the
// right pane. The dynamic clamp in the resize handler caps the side
// panes so this never happens, regardless of viewport size.
const MIN_CANVAS_W = 280;
// Reserve the side resizer's footprint when computing the canvas budget.
const RESIZER_W = 4;

const LS_LEFT = "quda.leftPaneWidth";
const LS_RIGHT = "quda.rightPaneWidth";
const LS_LEFT_COLLAPSED = "quda.leftPaneCollapsed";
const LS_RIGHT_COLLAPSED = "quda.rightPaneCollapsed";

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
  const workspaceMode = useApp((s) => s.workspaceMode);
  const theaterOpen = useApp((s) => s.theaterOpen);
  const [ready, setReady] = useState(false);
  const isDesktop = useIsDesktop();
  const isWide = useMediaQuery(WIDE_QUERY);
  // 768–1199px compact-desktop band (see RESPONSIVE CONTRACT above).
  const band = isDesktop && !isWide;

  // Welcome tour: auto-opens on the first visit (skipped under
  // ?scenario= boots), re-openable from the TopBar Tour button.
  const [tourOpen, setTourOpen] = useFirstVisitTour();

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

  // Band (768–1199px) Evidence overlay — session-only, never
  // persisted: the band boots collapsed-by-default regardless of the
  // ≥1200px preference, and expanding here must not rewrite it.
  const [bandEvidenceOpen, setBandEvidenceOpen] = useState(false);
  useEffect(() => {
    if (!band) setBandEvidenceOpen(false);
  }, [band]);

  // FlowCanvas can ask us to surface the CircuitPicker when the user
  // tries to run without a circuit selected.
  const hintExpandLeftPane = useApp((s) => s.hintExpandLeftPane);
  useEffect(() => {
    if (hintExpandLeftPane === 0) return;
    if (isDesktop) setLeftCollapsed(false);
    else setLeftDrawerOpen(true);
  }, [hintExpandLeftPane, isDesktop]);

  // Same bridge for the right (Evidence) pane — scenario boots use it
  // to make sure the funnel / lineage / comparison the figure needs is
  // actually on screen.
  const hintExpandRightPane = useApp((s) => s.hintExpandRightPane);
  useEffect(() => {
    if (hintExpandRightPane === 0) return;
    if (!isDesktop) setRightDrawerOpen(true);
    else if (band) setBandEvidenceOpen(true);
    else setRightCollapsed(false);
  }, [hintExpandRightPane, isDesktop, band]);

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
      if (!isDesktop) {
        setRightDrawerOpen(true);
      } else if (band) {
        // Band: surface progress as the overlay — the in-flow pane
        // must not take layout width here (RESPONSIVE CONTRACT).
        setBandEvidenceOpen(true);
      } else if (rightCollapsed) {
        setRightCollapsed(false);
      }
    }
    prevRunningRef.current = running;
  }, [running, rightCollapsed, isDesktop, band]);

  // Close any open drawer as soon as we leave mobile layout, so switching
  // from portrait to landscape doesn't leave a floating panel hanging.
  useEffect(() => {
    if (isDesktop) {
      setLeftDrawerOpen(false);
      setRightDrawerOpen(false);
    }
  }, [isDesktop]);

  // Mount + window-resize clamp → shrink oversized panes back into
  // the safe zone (RESPONSIVE CONTRACT). The drag-time clamp keeps
  // users from making things too wide while dragging; this covers (a)
  // the user shrinking the window afterwards and (b) BOOTING at a
  // narrower viewport than the persisted widths came from — (b) is why
  // it runs once immediately, not only on resize events.
  useEffect(() => {
    if (!isDesktop) return;
    const clamp = () => {
      const ww = window.innerWidth;
      // In the band the right pane is always its strip in flow (the
      // expanded pane is an overlay, costing no layout width).
      const rightInFlow =
        band || rightCollapsed ? COLLAPSED_W : rightW + RESIZER_W;
      const leftInFlow = leftCollapsed ? COLLAPSED_W : leftW + RESIZER_W;
      // Headroom each pane has, given the *other* pane's in-flow
      // footprint, its own resizer and the canvas floor.
      const maxLeft = Math.min(
        LEFT_MAX,
        ww - rightInFlow - RESIZER_W - MIN_CANVAS_W,
      );
      const maxRight = Math.min(
        RIGHT_MAX,
        ww - leftInFlow - RESIZER_W - MIN_CANVAS_W,
      );
      setLeftW((w) => Math.max(LEFT_MIN, Math.min(w, Math.max(LEFT_MIN, maxLeft))));
      setRightW((w) => Math.max(RIGHT_MIN, Math.min(w, Math.max(RIGHT_MIN, maxRight))));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [isDesktop, band, leftCollapsed, rightCollapsed, leftW, rightW]);

  const setPlugins = useApp((s) => s.setPlugins);
  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setReady(true);
      })
      .catch(() => setReady(true));

    // Fetch this browser's plugin manifests (the plugin protocol is a
    // paper claim — the execution path stays fully functional even
    // though the upload UI was removed in Wave P; uploads go via API).
    const refreshPlugins = () => {
      api
        .listPlugins(getUserId())
        .then(setPlugins)
        .catch(() => {
          /* ignore */
        });
    };
    refreshPlugins();
    // Multi-tab sync: an upload/delete in tab A bumps pluginsRev →
    // tab B refetches its plugin list.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "quda.pluginsRev") refreshPlugins();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setHealth, setPlugins]);

  // Boot sequencing: (1) first visit seeds the browser's empty run
  // archive with the bundled demo evidence (real seeded runs; see
  // lib/demoArchive.ts); (2) a ?scenario=Fn URL (Wave P figure
  // states) takes over the whole UI state afterwards. IA inversion
  // (board = home): the Evidence board is the STORE's default
  // workspace — a first visit has no quda.workspaceMode preference
  // and the mode is read synchronously at store creation, so the
  // board paints from the very first frame and the demo import no
  // longer forces a landing (the fresh-import path and the plain
  // first-visit path are the same path). Returning users boot into
  // their persisted mode the same way. A scenario's mode write lands
  // after this effect resolves, so scenario still wins over both.
  useEffect(() => {
    const scenarioKey = new URLSearchParams(window.location.search).get(
      "scenario",
    );
    void ensureDemoArchive().then(async () => {
      if (scenarioKey) await activateScenario(scenarioKey);
    });
  }, []);

  const leftWidth = leftCollapsed ? COLLAPSED_W : leftW;
  // In the band the Evidence pane's in-flow footprint is ALWAYS the
  // strip; the expanded pane is an overlay (RESPONSIVE CONTRACT).
  const rightStrip = band || rightCollapsed;
  const rightWidth = rightStrip ? COLLAPSED_W : rightW;

  return (
    // h-[100dvh] uses the dynamic viewport height — iOS Safari shrinks
    // 100vh by the address bar, clipping ~80px of UI off the bottom.
    // 100dvh tracks the actually-visible area. We keep w-screen since
    // viewport WIDTH isn't dynamic.
    <div
      className="w-screen flex flex-col overflow-hidden"
      style={{ height: "100dvh", minHeight: "100dvh" }}
    >
      <TopBar
        mobile={!isDesktop}
        onOpenLeftDrawer={() => setLeftDrawerOpen(true)}
        onOpenRightDrawer={() => setRightDrawerOpen(true)}
        onOpenTour={() => setTourOpen(true)}
      />
      {isDesktop ? (
        /* =====================  Desktop  ===================== */
        <div className="relative flex-1 flex min-h-0">
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
                  const rightFoot = rightStrip ? COLLAPSED_W : rightW + RESIZER_W;
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
          <main className="relative flex-1 min-w-0 flex flex-col min-h-0 overflow-x-hidden">
            <NodePalette />
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
            {/* Multiverse overlay: FlowCanvas stays mounted underneath so
                the in-progress graph and its pendingRestore watcher
                survive mode flips (the board's Open action depends on
                that watcher firing while the canvas is covered). */}
            {workspaceMode === "multiverse" && (
              <div className="absolute inset-0 z-20 bg-canvas flex flex-col min-h-0">
                <MultiverseBoard />
              </div>
            )}
            {/* Evidence theater: the steering view, overlaid above BOTH
                the canvas and the multiverse board (z-30 > z-20) —
                auto-opens on the first progress frame of a streaming
                sampled step; the canvas stays mounted underneath so the
                run keeps streaming into it. */}
            {theaterOpen && (
              <div className="absolute inset-0 z-30 bg-canvas flex flex-col min-h-0">
                <EvidenceTheater />
              </div>
            )}
          </main>
          {!rightStrip && (
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
              ariaLabel="Resize evidence pane"
            />
          )}
          <aside
            style={{ width: rightWidth }}
            className={`shrink-0 border-l border-edge flex flex-col min-h-0 overflow-x-hidden ${
              isResizing ? "" : "transition-[width] duration-150"
            } ${rightStrip ? "overflow-hidden" : ""}`}
          >
            {rightStrip ? (
              <CollapsedStrip
                label="Evidence"
                side="right"
                onExpand={() =>
                  band ? setBandEvidenceOpen(true) : setRightCollapsed(false)
                }
              />
            ) : (
              <ResultsPane onCollapse={() => setRightCollapsed(true)} />
            )}
          </aside>
          {/* Band Evidence overlay (RESPONSIVE CONTRACT): expanded
              Evidence floats over the center column instead of taking
              layout width, so the canvas/board keep computing layout
              from real viewport space and the page can never scroll
              horizontally. Width: the persisted pane width, capped so
              a sliver of the center column stays visible. */}
          {band && bandEvidenceOpen && (
            <div
              role="complementary"
              aria-label="Evidence pane (overlay)"
              className="absolute inset-y-0 right-0 z-30 flex flex-col min-h-0 bg-canvas border-l border-edge shadow-xl overflow-x-hidden"
              style={{
                width: `min(${rightW}px, calc(100vw - ${COLLAPSED_W + 48}px))`,
              }}
            >
              <ResultsPane onCollapse={() => setBandEvidenceOpen(false)} />
            </div>
          )}
        </div>
      ) : (
        /* =====================  Mobile  ====================== */
        <div className="flex-1 flex flex-col min-h-0">
          <main className="relative flex-1 min-w-0 flex flex-col min-h-0 overflow-x-hidden">
            <NodePalette />
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
            {/* Multiverse overlay: FlowCanvas stays mounted underneath so
                the in-progress graph and its pendingRestore watcher
                survive mode flips (the board's Open action depends on
                that watcher firing while the canvas is covered). */}
            {workspaceMode === "multiverse" && (
              <div className="absolute inset-0 z-20 bg-canvas flex flex-col min-h-0">
                <MultiverseBoard />
              </div>
            )}
            {/* Evidence theater: the steering view, overlaid above BOTH
                the canvas and the multiverse board (z-30 > z-20) —
                auto-opens on the first progress frame of a streaming
                sampled step; the canvas stays mounted underneath so the
                run keeps streaming into it. */}
            {theaterOpen && (
              <div className="absolute inset-0 z-30 bg-canvas flex flex-col min-h-0">
                <EvidenceTheater />
              </div>
            )}
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
            title="Evidence"
          >
            <ResultsPane />
          </MobileDrawer>
        </div>
      )}
      <WelcomeTour open={tourOpen} onClose={() => setTourOpen(false)} />
      {!ready && (
        <div className="absolute inset-0 bg-canvas/80 flex items-center justify-center backdrop-blur">
          <div className="text-mute text-sm">Connecting to compute backend…</div>
        </div>
      )}
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
