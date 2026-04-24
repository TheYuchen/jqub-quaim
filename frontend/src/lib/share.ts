// Share-link (de)serialization.
//
// Packs the current canvas state — graph topology, per-node params, and
// the selected sample circuit — into a base64url-encoded JSON string
// that's carried on the URL fragment (e.g. `/#s=<payload>`).
//
// Why the URL fragment and not a query param: fragments don't hit the
// server, which is nice for the HF Space setup (no backend route needs
// to know about it) and means the link works on any page the SPA
// already serves.
//
// Compact JSON keys (`n`/`e`/`sk`/...) keep the payload short so even
// a ~20-node pipeline fits comfortably under the 2 KB informal URL
// length limit most messaging apps tolerate.
//
// User-uploaded circuits can't be shared (the recipient has no access
// to the file); we omit `sk` in that case and the loader falls back to
// the default sample so at least the graph still loads.

import type { Edge, Node } from "@xyflow/react";
import type { QNodeData } from "../components/QNode";
import type { NodeKind } from "./nodeCatalog";

export interface ShareNode {
  i: string;               // id
  k: NodeKind;             // kind
  p?: Record<string, unknown>; // params (omitted if empty)
  x: number;               // position.x
  y: number;               // position.y
}

export interface ShareEdge {
  s: string;               // source
  t: string;               // target
}

export interface SharePayload {
  /** Sample circuit key, or null if the user uploaded their own. */
  sk?: string | null;
  n: ShareNode[];
  e: ShareEdge[];
  /** Schema version — bump if we change the shape. */
  v: 1;
}

/**
 * Turn a base64url-safe string into a regular base64 string (and vice
 * versa). URL-safe base64 swaps `+`/`/` for `-`/`_` and drops the `=`
 * padding so the payload can sit in a fragment without being encoded.
 */
function b64ToB64url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToB64(b64url: string): string {
  const s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return s + pad;
}

export function encodeSharePayload(payload: SharePayload): string {
  // `JSON.stringify` + UTF-8 + base64 is the simplest round-trippable
  // transport; nothing fancier needed at these sizes.
  const json = JSON.stringify(payload);
  const utf8 = new TextEncoder().encode(json);
  let bin = "";
  utf8.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return b64ToB64url(btoa(bin));
}

export function decodeSharePayload(b64url: string): SharePayload | null {
  try {
    const bin = atob(b64urlToB64(b64url));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj == null) return null;
    if (obj.v !== 1) return null;
    if (!Array.isArray(obj.n) || !Array.isArray(obj.e)) return null;
    return obj as SharePayload;
  } catch {
    return null;
  }
}

export function buildSharePayload(
  nodes: Node<QNodeData>[],
  edges: Edge[],
  sampleKey: string | null,
): SharePayload {
  return {
    v: 1,
    sk: sampleKey,
    n: nodes.map((n) => {
      const d = n.data as QNodeData;
      const params = d.params ?? {};
      const entry: ShareNode = {
        i: n.id,
        k: d.kind,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      };
      if (Object.keys(params).length > 0) entry.p = params;
      return entry;
    }),
    e: edges.map((ed) => ({ s: ed.source, t: ed.target })),
  };
}

/**
 * Read the current URL hash and, if it looks like a share link,
 * return the decoded payload. Non-destructive — leaves the URL alone
 * so the user can re-copy or refresh.
 */
export function readHashPayload(): SharePayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash;
  if (!raw || !raw.startsWith("#")) return null;
  // Support both bare `#...` (legacy) and `#s=...` forms. Preferred is
  // `#s=...` because it leaves room for other fragment params later
  // without breaking existing shared links.
  let body = raw.slice(1);
  if (body.startsWith("s=")) body = body.slice(2);
  return decodeSharePayload(body);
}

/**
 * Build an absolute URL for a share payload. Uses the current origin
 * + pathname so local dev and prod both produce a link you can paste.
 */
export function buildShareUrl(payload: SharePayload): string {
  const encoded = encodeSharePayload(payload);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#s=${encoded}`;
}
