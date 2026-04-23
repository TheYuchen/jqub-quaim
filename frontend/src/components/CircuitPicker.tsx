import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { api, type CircuitInfo, type SampleCircuit } from "../lib/api";
import { useApp } from "../lib/store";

export function CircuitPicker() {
  const [samples, setSamples] = useState<SampleCircuit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mute">
          Circuit
        </h3>
        <button
          className="btn-ghost"
          onClick={() => fileRef.current?.click()}
          title="Upload a .qpy / .qasm file"
        >
          <FileUp className="w-3 h-3" /> upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".qpy,.qasm"
          hidden
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </div>

      <ActiveCircuitCard info={circuit} />

      <div className="mt-3 space-y-1">
        <div className="text-[11px] text-mute uppercase tracking-wider mb-1">Samples</div>
        {samples.map((s) => {
          const active = circuit?.name === s.display_name;
          return (
            <button
              key={s.key}
              onClick={() => pick(s.key)}
              className={`w-full text-left px-2 py-1.5 rounded-md border transition-colors ${
                active
                  ? "bg-accent/10 border-accent/50"
                  : "border-transparent hover:bg-surfaceAlt hover:border-edge"
              }`}
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
          );
        })}
      </div>
      {err && <div className="text-[11px] text-danger mt-2">{err}</div>}
    </div>
  );
}

function ActiveCircuitCard({ info }: { info: CircuitInfo | null }) {
  if (!info) {
    return (
      <div className="panel-alt px-3 py-3 text-xs text-mute">
        No circuit loaded. Pick a sample below or upload a .qpy file.
      </div>
    );
  }
  return (
    <div className="panel-alt px-3 py-3">
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
    </div>
  );
}
