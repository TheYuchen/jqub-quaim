import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "./lib/api";
import { useApp } from "./lib/store";
import { TopBar } from "./components/TopBar";
import { NodePalette } from "./components/NodePalette";
import { FlowCanvas } from "./components/FlowCanvas";
import { ResultsPane } from "./components/ResultsPane";
import { CircuitPicker } from "./components/CircuitPicker";
import { WelcomeTour, useFirstVisitTour } from "./components/WelcomeTour";

// Default + clamp bounds for the two side panels. The middle canvas flexes.
const LEFT_DEFAULT = 320;
const LEFT_MIN = 220;
const LEFT_MAX = 560;
const RIGHT_DEFAULT = 400;
const RIGHT_MIN = 300;
const RIGHT_MAX = 720;
const LS_LEFT = "jqub.leftPaneWidth";
const LS_RIGHT = "jqub.rightPaneWidth";

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

export default function App() {
  const setHealth = useApp((s) => s.setHealth);
  const [ready, setReady] = useState(false);
  const [tourOpen, setTourOpen] = useFirstVisitTour();

  const [leftW, setLeftW] = useState<number>(() =>
    loadWidth(LS_LEFT, LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
  );
  const [rightW, setRightW] = useState<number>(() =>
    loadWidth(LS_RIGHT, RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
  );

  // Persist user's preferred widths.
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
    api
      .health()
      .then((h) => {
        setHealth(h);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [setHealth]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar onOpenTour={() => setTourOpen(true)} />
      <div className="flex-1 flex min-h-0">
        <aside
          style={{ width: leftW }}
          className="shrink-0 border-r border-edge flex flex-col min-h-0 overflow-y-auto"
        >
          <CircuitPicker />
        </aside>
        <PaneResizer
          onResize={(dx) =>
            setLeftW((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + dx)))
          }
          onDoubleClick={() => setLeftW(LEFT_DEFAULT)}
          ariaLabel="Resize pipeline input pane"
        />
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <NodePalette />
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
        </main>
        <PaneResizer
          onResize={(dx) =>
            setRightW((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w - dx)))
          }
          onDoubleClick={() => setRightW(RIGHT_DEFAULT)}
          ariaLabel="Resize results pane"
        />
        <aside
          style={{ width: rightW }}
          className="shrink-0 border-l border-edge flex flex-col min-h-0"
        >
          <ResultsPane />
        </aside>
      </div>
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
