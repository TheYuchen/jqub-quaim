import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Sparkles, Upload, X, Zap } from "lucide-react";
import { api } from "../lib/api";
import { bumpPluginsRev, getUserId } from "../lib/userId";
import { useApp } from "../lib/store";

type Example = {
  name: string;
  label: string;
  family: string;
  tagline: string;
  color: string;
  size_bytes: number;
};

/**
 * Plugin upload modal. Accepts a .zip drag-drop or click-to-select,
 * POSTs it to /api/plugins/upload, refreshes the in-store plugin list
 * on success.
 *
 * Validation errors from the backend are surfaced verbatim (they're
 * already written for an end user: "Zip is X bytes; max is Y",
 * "kind 'input_circuit' collides with a built-in block", etc).
 */

export function UploadPluginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setPlugins = useApp((s) => s.setPlugins);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);
  const [installingExample, setInstallingExample] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset transient state every time the modal reopens.
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
      setBusy(false);
      setDragOver(false);
      setInstallingExample(null);
    }
  }, [open]);

  // Fetch the example catalog once per open. We keep this best-effort —
  // if the backend doesn't expose examples (older deploy / catalog
  // empty), the section just hides itself.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .listExamplePlugins()
      .then((list) => {
        if (!cancelled) setExamples(list);
      })
      .catch(() => {
        if (!cancelled) setExamples([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    if (busy) return;
    setError(null);
    setSuccess(null);

    // Light client-side checks so the user doesn't have to wait for
    // an HTTP round trip for obviously-wrong inputs.
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Please pick a .zip file.");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      setError(`File is ${(file.size / 1024).toFixed(0)} KB; max is 1024 KB.`);
      return;
    }

    setBusy(true);
    try {
      const userId = getUserId();
      const manifest = await api.uploadPlugin(userId, file);
      setSuccess(`Installed ${manifest.label} (kind=${manifest.kind}).`);
      // Refresh the global plugin list so NodePalette + BlockPicker
      // pick the new block up immediately.
      const list = await api.listPlugins(userId);
      setPlugins(list);
      bumpPluginsRev();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  /** Pull the bundled example zip from the backend and pipe it straight
   *  into the same install path as a manual upload. Saves the user one
   *  download + drag step when they just want to try the plugin
   *  workflow end-to-end. */
  const installExample = async (ex: Example) => {
    if (busy) return;
    setError(null);
    setSuccess(null);
    setInstallingExample(ex.name);
    setBusy(true);
    try {
      const res = await fetch(api.exampleZipUrl(ex.name));
      if (!res.ok) {
        throw new Error(`Could not fetch example: HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const file = new File([blob], `${ex.name}.zip`, { type: "application/zip" });
      const userId = getUserId();
      const manifest = await api.uploadPlugin(userId, file);
      setSuccess(
        `Installed ${manifest.label} (kind=${manifest.kind}). Find it in the block strip on the canvas.`,
      );
      const list = await api.listPlugins(userId);
      setPlugins(list);
      bumpPluginsRev();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // The duplicate-install case is friendly here — the user already
      // has this example, no action needed. Frame it as a hint rather
      // than an error.
      if (/already have a plugin/i.test(msg)) {
        setSuccess(
          `${ex.label} is already installed in this browser — look for it in the block strip.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
      setInstallingExample(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload plugin"
      className="fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-surface border border-edge rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">
              Upload your own block
            </div>
            <div className="text-[11px] text-mute">
              Add a custom source/algorithm/metric/sink to your catalog. Only
              you see it.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-mute hover:text-ink p-1 rounded disabled:opacity-50"
            aria-label="Close upload dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-accent bg-accent/5"
                : "border-edge hover:border-accent/60 hover:bg-surfaceAlt"
            } ${busy ? "opacity-60 pointer-events-none" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {busy ? (
              <div className="flex flex-col items-center gap-2 text-mute">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Uploading and validating…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-mute">
                <Upload className="w-6 h-6" />
                <span className="text-sm">
                  Drop your <span className="text-ink font-medium">.zip</span> here,
                  or click to browse.
                </span>
                <span className="text-[10px] text-mute/70">
                  Max 1 MB · up to 5 plugins per browser
                </span>
              </div>
            )}
          </label>

          {error && (
            <div
              role="alert"
              className="text-[12px] text-danger panel-alt p-2 border-danger/40 whitespace-pre-line"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              aria-live="polite"
              className="text-[12px] text-ok panel-alt p-2 border-ok/40"
            >
              {success}
            </div>
          )}

          {examples.length > 0 && (
            <div className="panel-alt p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-mute">
                <Sparkles className="w-3 h-3 text-accent2" />
                Try with a sample
              </div>
              <div className="text-[11px] text-mute/80 leading-relaxed">
                Install a bundled example to see how a plugin looks in your
                catalog — or download the .zip to crack it open as a
                starting point for your own.
              </div>
              <ul className="space-y-1.5">
                {examples.map((ex) => {
                  const installing = installingExample === ex.name;
                  return (
                    <li
                      key={ex.name}
                      className="flex items-start gap-2 p-2 rounded-md border border-edge bg-surface"
                    >
                      <span
                        className="inline-flex items-center justify-center text-[10px] font-bold text-white rounded shrink-0"
                        style={{
                          backgroundColor: ex.color,
                          width: "1.75rem",
                          height: "1.75rem",
                        }}
                        aria-hidden
                      >
                        {ex.label.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-[12px] font-medium text-ink truncate">
                            {ex.label}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-mute/70 border border-edge rounded px-1">
                            {ex.family}
                          </span>
                        </div>
                        <div className="text-[11px] text-mute leading-snug truncate">
                          {ex.tagline}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => installExample(ex)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-accent2/15 text-accent2 hover:bg-accent2/25 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Fetch the example zip and install it directly"
                          aria-label={
                            installing
                              ? `Installing ${ex.label}`
                              : `Install ${ex.label} example plugin`
                          }
                        >
                          {installing ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          ) : (
                            <Zap className="w-3 h-3" aria-hidden />
                          )}
                          Install
                        </button>
                        <a
                          href={api.exampleZipUrl(ex.name)}
                          download={`${ex.name}.zip`}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] text-mute hover:text-ink hover:bg-surfaceAlt ${
                            busy ? "pointer-events-none opacity-50" : ""
                          }`}
                          title="Download the .zip to your computer"
                          aria-label={`Download ${ex.label} as .zip`}
                        >
                          <Download className="w-3 h-3" aria-hidden />
                          .zip
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <details className="text-[11px] text-mute">
            <summary className="cursor-pointer hover:text-ink">
              What's in a plugin .zip?
            </summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>Two files at the top level of the zip:</p>
              <ul className="list-disc list-inside ml-1 space-y-1">
                <li>
                  <span className="text-ink font-mono">manifest.json</span> —
                  block name, family (source/backend/algorithm/metric/sink),
                  color, tunable parameters.
                </li>
                <li>
                  <span className="text-ink font-mono">handler.py</span> —
                  defines{" "}
                  <span className="font-mono text-ink">
                    def run(inputs, params): ...
                  </span>
                  ; the subprocess that runs it can take up to 10 min, uses
                  ≤ 1 GB RAM, and never sees IBM secrets.
                </li>
              </ul>
              <p>
                See <span className="text-ink font-mono">PLUGIN_SDK.md</span>{" "}
                in the GitHub repo for the full spec + an example.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
