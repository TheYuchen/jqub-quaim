import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import type { Edge, Node } from "@xyflow/react";
import type { QNodeData } from "./QNode";
import { buildSharePayload, buildShareUrl } from "../lib/share";
import { copyToClipboard } from "../lib/clipboard";

/**
 * "Share" button: copies a URL carrying the current canvas state on its
 * fragment. Shows a short "Copied" confirmation so the user knows it
 * landed; no modal, no toast, no dropdown — this is a one-click action.
 * Clipboard quirks are handled by `lib/clipboard.ts`.
 */
export function ShareButton({
  nodes,
  edges,
  sampleKey,
  className = "",
  labelBreakpoint = "sm",
}: {
  nodes: Node<QNodeData>[];
  edges: Edge[];
  sampleKey: string | null;
  /** Extra classes on the wrapper button — used by the parent toolbar
   *  for responsive visibility (e.g. `hidden md:inline-flex`). */
  className?: string;
  /** Tailwind breakpoint above which the "Share" / "Copied" label shows.
   *  The parent toolbar uses `lg` to hide the label at medium widths; the
   *  default stays at `sm` for standalone usage. */
  labelBreakpoint?: "sm" | "md" | "lg";
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const payload = buildSharePayload(nodes, edges, sampleKey);
    const url = buildShareUrl(payload);
    const ok = await copyToClipboard(url);
    if (!ok) return;
    // Also reflect the new hash in the address bar so a refresh works
    // and the user can bookmark the link directly.
    try {
      window.history.replaceState(null, "", url);
    } catch {
      /* some embedded iframes block this; ignore */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Map the `labelBreakpoint` prop to the matching Tailwind `hidden <bp>:inline`
  // literal (must be spelled out — Tailwind's JIT can't see variable classes).
  const labelVisibility = {
    sm: "hidden sm:inline",
    md: "hidden md:inline",
    lg: "hidden lg:inline",
  }[labelBreakpoint];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${className}`}
      title={
        sampleKey
          ? "Copy a link that restores this pipeline"
          : "Copy a link that restores this pipeline (uploaded circuit will fall back to the default sample for recipients)"
      }
      aria-label="Copy share link"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-ok" />
          <span className={labelVisibility}>Copied</span>
        </>
      ) : (
        <>
          <LinkIcon className="w-3.5 h-3.5" />
          <span className={labelVisibility}>Share</span>
        </>
      )}
    </button>
  );
}
