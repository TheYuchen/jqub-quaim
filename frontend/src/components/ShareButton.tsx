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
}: {
  nodes: Node<QNodeData>[];
  edges: Edge[];
  sampleKey: string | null;
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
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
          <span className="hidden sm:inline">Copied</span>
        </>
      ) : (
        <>
          <LinkIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </button>
  );
}
