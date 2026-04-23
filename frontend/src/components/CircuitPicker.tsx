import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff, FileUp, Loader2 } from "lucide-react";
import { api, type CircuitInfo, type SampleCircuit } from "../lib/api";
import { useApp } from "../lib/store";

export function CircuitPicker({ onCollapse }: { onCollapse?: () => void } = {}) {
  const [samples, setSamples] = useState<SampleCircuit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const circuit = useApp((s) => s.circuit);
  const setCircuit = useApp((s) => s.setCircuit);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .listSamples()
      .then(setSamples)
      .catch((e: Error) => setErr(e.message));
  }, []);

  async function pick(key: string) {
    setBusy(key);
    setErr(null);
    try {
      const info = await api.loadSample(key);
      setCircuit(info);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onUpload(f: File) {
    setBusy("__upload__");
    setErr(null);
    try {
      const info = await api.upload(f);
      setCircuit(info);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-3 border-b border-edge">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="shrink-0 text-mute hover:text-ink rounded hover:bg-surfaceAlt p-0.5 -ml-0.5"
              title="Collapse pipeline input pane"
              aria-label="Collapse pipeline input pane"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mute truncate">
            Pipeline input
          </h3>
        </div>
        <button
          className="btn-ghost shrink-0"
          onClick={() => fileRef.current?.click()}
          title="Upload your own .qpy (Qiskit) or .qasm (OpenQASM 2/3) file"
        >
          <FileUp className="w-3 h-3" /> upload .qpy / .qasm
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".qpy,.qasm,.qasm2,.qasm3"
          hidden
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </div>

      <ActiveCircuitCard info={circuit} />

      <div className="mt-3 space-y-1">
        <div className="text-[11px] text-mute leading-snug mb-2">
          Pick a sample circuit below. It becomes the{" "}
          <span className="text-ink">Input circuit</span> block in your pipeline.
          Or <button
            type="button"
            className="underline decoration-dotted hover:text-ink"
            onClick={() => fileRef.current?.click()}
          >
            upload your own
          </button>{" "}
          (Qiskit <span className="font-mono">.qpy</span> or OpenQASM{" "}
          <span className="font-mono">.qasm</span>).{" "}
          <span className="text-mute/70">
            You can{" "}
            <a
              className="underline decoration-dotted hover:text-ink"
              href="/api/circuits/samples/bell_state/download"
              download="bell_state.qpy"
              title="Downloads bell_state.qpy so you can try the upload flow with a known-good file."
            >
              download a sample .qpy
            </a>{" "}
            to try the upload flow.
          </span>
        </div>
        <div className="text-[11px] text-mute uppercase tracking-wider mb-1">Samples</div>
        {samples.map((s) => {
          const active = circuit?.name === s.display_name;
          const previewOpen = openPreview === s.key;
          return (
            <div
              key={s.key}
              className={`rounded-md border transition-colors ${
                active
                  ? "bg-accent/10 border-accent/50"
                  : "border-transparent hover:bg-surfaceAlt hover:border-edge"
              }`}
            >
              <div className="flex items-stretch">
                <button
                  onClick={() => pick(s.key)}
                  className="flex-1 text-left px-2 py-1.5 min-w-0"
                  disabled={busy === s.key}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${
                        active ? "text-ink" : "text-ink/90"
                      }`}
                    >
                      {s.display_name}
                    </span>
                    {busy === s.key ? (
                      <Loader2 className="w-3 h-3 animate-spin text-mute" />
                    ) : (
                      <span className="text-[10px] font-mono text-mute shrink-0">
                        {s.num_qubits}q
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <div className="text-[11px] text-mute leading-snug mt-0.5">
                      {s.description}
                    </div>
                  )}
                </button>
                {s.diagram_text && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenPreview(previewOpen ? null : s.key);
                    }}
                    className="shrink-0 px-2 text-mute hover:text-ink hover:bg-surfaceAlt/80 rounded-r-md border-l border-edge/40 flex items-center"
                    title={previewOpen ? "Hide circuit diagram" : "Preview circuit diagram"}
                    aria-label={previewOpen ? "Hide circuit diagram" : "Preview circuit diagram"}
                  >
                    {previewOpen ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              {previewOpen && s.diagram_text && (
                <div className="px-2 pb-2">
                  <div className="flex items-center gap-1 mb-1 text-[10px] text-mute">
                    <span className="chip">{s.num_qubits}q</span>
                    <span className="chip">depth {s.depth}</span>
                    <span className="chip">{s.size} gates</span>
                    {s.num_parameters > 0 && (
                      <span className="chip !border-accent2/40 !text-accent2">
                        {s.num_parameters} params
                      </span>
                    )}
                  </div>
                  <pre className="text-[10px] font-mono text-ink/90 bg-surface/60 border border-edge/60 rounded p-2 overflow-x-auto leading-tight whitespace-pre">
{s.diagram_text}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {err && <div className="text-[11px] text-danger mt-2">{err}</div>}
    </div>
  );
}

function ActiveCircuitCard({ info }: { info: CircuitInfo | null }) {
  // Default the diagram visible — most of the time that's what the user
  // wants to glance at after loading a circuit. They can still hide it if
  // the ASCII art is cluttering the sidebar.
  const [showDiagram, setShowDiagram] = useState(true);
  if (!info) {
    return (
      <div className="panel-alt px-3 py-3 text-xs text-mute leading-relaxed">
        No circuit loaded. Pick a sample below, or upload your own Qiskit{" "}
        <span className="font-mono">.qpy</span> / OpenQASM{" "}
        <span className="font-mono">.qasm</span> file.
        <div className="mt-1 text-[10px] text-mute/80">
          Not sure what a <span className="font-mono">.qpy</span> looks like?
          You can{" "}
          <a
            className="underline decoration-dotted hover:text-ink"
            href="/api/circuits/samples/bell_state/download"
            download="bell_state.qpy"
          >
            download a sample
          </a>{" "}
          and re-upload it as a sanity check.
        </div>
      </div>
    );
  }
  const hasDiagram = !!info.diagram_text;
  return (
    <div className="panel-alt px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-mute/80 mb-0.5">
          Loaded
        </div>
        {hasDiagram && (
          <button
            type="button"
            onClick={() => setShowDiagram((v) => !v)}
            className="text-[10px] text-mute hover:text-ink flex items-center gap-1"
            title={showDiagram ? "Hide circuit diagram" : "Show circuit diagram"}
          >
            {showDiagram ? (
              <>
                <EyeOff className="w-3 h-3" /> hide diagram
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" /> show diagram
              </>
            )}
          </button>
        )}
      </div>
      <div className="font-medium text-ink text-sm truncate">{info.name}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <span className="chip">{info.num_qubits}q</span>
        <span className="chip">depth {info.depth}</span>
        <span className="chip">{info.size} gates</span>
        {info.num_parameters > 0 && (
          <span className="chip !border-accent2/40 !text-accent2">
            {info.num_parameters} params
          </span>
        )}
      </div>
      {showDiagram && hasDiagram && (
        <pre className="mt-2 text-[10px] font-mono text-ink/90 bg-surface/60 border border-edge/60 rounded p-2 overflow-x-auto leading-tight whitespace-pre">
{info.diagram_text}
        </pre>
      )}
    </div>
  );
}
