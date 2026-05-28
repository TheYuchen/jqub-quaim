import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { api } from "../lib/api";
import { getUserId } from "../lib/userId";
import { useApp } from "../lib/store";

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset transient state every time the modal reopens.
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
      setBusy(false);
      setDragOver(false);
    }
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload plugin"
      className="fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-surface border border-edge rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
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

        <div className="p-4 space-y-3">
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
            <div className="text-[12px] text-danger panel-alt p-2 border-danger/40 whitespace-pre-line">
              {error}
            </div>
          )}
          {success && (
            <div className="text-[12px] text-ok panel-alt p-2 border-ok/40">
              {success}
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
