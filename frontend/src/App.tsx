import { useEffect, useState } from "react";
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

export default function App() {
  const setHealth = useApp((s) => s.setHealth);
  const [ready, setReady] = useState(false);
  const [tourOpen, setTourOpen] = useFirstVisitTour();

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
        <aside className="w-[280px] shrink-0 border-r border-edge flex flex-col min-h-0">
          <CircuitPicker />
          <NodePalette />
        </aside>
        <main className="flex-1 min-w-0 flex flex-col">
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
        </main>
        <aside className="w-[400px] shrink-0 border-l border-edge flex flex-col min-h-0">
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
