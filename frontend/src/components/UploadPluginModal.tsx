import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Upload, X, Zap } from "lucide-react";
import { api } from "../lib/api";
import { bumpPluginsRev, getUserId } from "../lib/userId";
import { useApp } from "../lib/store";
import { FAMILY_HINTS } from "../lib/familyHints";
import { useFocusTrap } from "../lib/focusTrap";
import type { NodeSpec } from "../lib/nodeCatalog";

type Example = {
  name: string;
  label: string;
  family: string;
  tagline: string;
  color: string;
  size_bytes: number;
};

// Wraps a string lookup against FAMILY_HINTS without TS complaining when
// the backend returns a family value not in the union (e.g. someone
// shipped a custom family). Falls back to a generic blurb.
function familyHint(fam: string): string {
  return (
    (FAMILY_HINTS as Record<string, string>)[fam] ??
    `A "${fam}" block in the pipeline.`
  );
}

// Delay after a successful install before the modal auto-closes.
// Long enough for the user to register the success banner; short enough
// that they don't lose focus on the canvas they're about to use.
const AUTOCLOSE_MS = 1600;

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
  const installedPlugins = useApp((s) => s.plugins);
  const session = useApp((s) => s.session);
  const authStatus = useApp((s) => s.authStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);
  const [installingExample, setInstallingExample] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoCloseRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // While the modal is open, trap Tab inside it so keyboard users
  // don't tab out into the obscured background controls.
  useFocusTrap(open, dialogRef);

  // Reset transient state every time the modal reopens, and cancel any
  // pending auto-close from a previous open cycle. Also remember the
  // element that had focus when we opened so we can put focus back on
  // close — without this, keyboard / screen-reader users land at the
  // top of the document after closing.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
      setBusy(false);
      setDragOver(false);
      setInstallingExample(null);
      openerRef.current = (document.activeElement as HTMLElement) || null;
    } else if (openerRef.current) {
      // Defer one frame so React has flushed; otherwise we focus the
      // element before the modal's portal unmounts and focus jumps.
      const target = openerRef.current;
      requestAnimationFrame(() => {
        try {
          target.focus();
        } catch {
          /* element may be gone */
        }
      });
      openerRef.current = null;
    }
    return () => {
      if (autoCloseRef.current !== null) {
        window.clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    };
  }, [open]);

  // Schedule a soft auto-close after a fresh successful install so the
  // user lands back on the canvas instead of staring at a dialog. We
  // skip auto-close for the "already installed" hint so the user can
  // read it.
  const scheduleAutoClose = () => {
    if (autoCloseRef.current !== null) {
      window.clearTimeout(autoCloseRef.current);
    }
    autoCloseRef.current = window.setTimeout(() => {
      autoCloseRef.current = null;
      onClose();
    }, AUTOCLOSE_MS);
  };

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
      setSuccess(
        `Installed ${manifest.label} — find it in the ${manifest.family} row of the block strip.`,
      );
      // Refresh the global plugin list so NodePalette + BlockPicker
      // pick the new block up immediately.
      const list = await api.listPlugins(userId);
      setPlugins(list);
      bumpPluginsRev();
      scheduleAutoClose();
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
      const res = await fetch(api.exampleZipUrl(ex.name), {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Could not fetch example: HTTP ${res.status}`);
      }
      // Belt-and-suspenders: a captive-portal or proxy could serve a
      // 200 HTML interstitial. Bail with a clear error before sending
      // it to the upload endpoint, which would surface a confusing
      // "not a valid zip" message.
      const ct = res.headers.get("Content-Type") || "";
      if (ct && !ct.includes("zip") && !ct.includes("octet-stream")) {
        throw new Error(
          `Example download returned ${ct.split(";")[0]}, not a .zip. ` +
            "Check your network — a captive portal may be intercepting traffic.",
        );
      }
      const blob = await res.blob();
      const file = new File([blob], `${ex.name}.zip`, { type: "application/zip" });
      const userId = getUserId();
      const manifest = await api.uploadPlugin(userId, file);
      setSuccess(
        `Installed ${manifest.label} — find it in the ${manifest.family} row of the block strip.`,
      );
      const list = await api.listPlugins(userId);
      setPlugins(list);
      bumpPluginsRev();
      scheduleAutoClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only the exact "kind X already exists" message gets the
      // friendly success-styled hint. The 5-plugin cap also starts
      // with "You already have …" so we match on the kind= marker
      // to avoid swallowing cap errors as if they were idempotent.
      if (/already have a plugin with kind=/i.test(msg)) {
        // Don't schedule auto-close — give the user time to read.
        setSuccess(
          `${ex.label} is already installed in this browser — look for it in the block strip after you close this dialog.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
      setInstallingExample(null);
    }
  };

  // First-time users (no plugins installed yet) benefit most from
  // seeing the bundled examples first — the empty drop zone is
  // meaningless to them. Once they have at least one plugin we trust
  // them to prefer the drop zone, which is what power users want.
  const examplesFirst = installedPlugins.length === 0 && examples.length > 0;

  const dropZone = (
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
            Max 1 MB · {installedPlugins.length}/5 plugins used ·{" "}
            {session?.persistence_enabled
              ? "saved to your HF account"
              : "stays on this device"}
          </span>
        </div>
      )}
    </label>
  );

  const examplesSection = examples.length > 0 && (
    <div className="panel-alt p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-mute">
        <Sparkles className="w-3 h-3 text-accent2" />
        Try with a sample
      </div>
      <div className="text-[11px] text-mute/80 leading-relaxed">
        One-click install a bundled block to see how plugins look in
        your catalog, or save the .zip as a starting point for your own.
      </div>
      <ul className="space-y-1.5">
        {examples.map((ex) => {
          const installing = installingExample === ex.name;
          return (
            <li
              key={ex.name}
              className="flex items-center gap-2 p-2 rounded-md border border-edge bg-surface"
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: ex.color }}
                aria-hidden
              >
                {ex.label.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[12px] font-medium text-ink truncate">
                    {ex.label}
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-wider text-mute/70 border border-edge rounded px-1 cursor-help"
                    title={familyHint(ex.family as NodeSpec["family"])}
                  >
                    {ex.family}
                  </span>
                </div>
                <div className="text-[11px] text-mute leading-snug truncate">
                  {ex.tagline}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => installExample(ex)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-accent2/15 text-accent2 hover:bg-accent2/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className={`text-[10px] text-mute/70 hover:text-ink underline-offset-2 hover:underline ${
                    busy ? "pointer-events-none opacity-50" : ""
                  }`}
                  title="Download the .zip to your computer"
                  aria-label={`Download ${ex.label} as .zip`}
                >
                  or save .zip
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload plugin"
      className="fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-surface border border-edge rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">
              Upload your own block
            </div>
            <div className="text-[11px] text-mute">
              {session?.persistence_enabled ? (
                <>
                  Add a custom source/algorithm/metric/sink. Saved to
                  your folder under{" "}
                  <span className="font-mono">{session.user_data_repo}</span>{" "}
                  — survives restarts and follows you across devices.
                </>
              ) : (
                <>
                  Add a custom source/algorithm/metric/sink to your
                  catalog. Only you see it.
                </>
              )}
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
          {/* Guest-mode banner — only when the deployment has OAuth
              wired up but the user hasn't signed in. We don't want to
              show this on dev deployments where OAuth is off. */}
          {!session && authStatus?.oauth_enabled && (
            <div className="panel-alt border-accent/40 p-3 text-[11px] leading-relaxed">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-ink font-medium mb-0.5">Guest mode</div>
                  <div className="text-mute">
                    Plugins you upload here live only in this browser
                    and disappear when the Space restarts (~24 h) or you
                    clear browser data.{" "}
                    <a
                      href={api.authLoginUrl()}
                      className="text-accent underline hover:no-underline"
                    >
                      Sign in with Hugging Face
                    </a>{" "}
                    to keep them across restarts and devices.
                  </div>
                </div>
              </div>
            </div>
          )}
          {examplesFirst ? (
            <>
              {examplesSection}
              {dropZone}
            </>
          ) : (
            <>
              {dropZone}
              {examplesSection}
            </>
          )}

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
                  ; runs in an isolated sandbox with a 10-minute
                  wall-clock cap and a 1 GB memory cap.
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
