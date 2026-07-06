import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

/**
 * Small ⓘ help icon with a portal-rendered tooltip.
 *
 * Reused wherever a UI element has a short label that some users
 * (especially non-quantum readers) might not recognise — block family
 * badges, status chips, terse stat labels in the pipeline pane.
 *
 * Why this looks the way it does (in detail because the previous
 * iterations had a few subtle gotchas):
 *
 *  - **`createPortal` to `document.body`, not a CSS-only bubble.** The
 *    old absolutely-positioned bubble was clipped by every
 *    `overflow: hidden/auto` ancestor — inside the Evidence pane's
 *    scroll body a tooltip near the pane edge was simply cut off.
 *    Rendering on `document.body` with `position: fixed`, placed from
 *    the trigger's `getBoundingClientRect()`, escapes all clipping
 *    contexts. Placement flips above/below by available viewport
 *    space (the `position` prop is the preferred side) and clamps
 *    horizontally to the viewport.
 *
 *  - **Scroll/resize close the tooltip.** A fixed-position bubble does
 *    not travel with a scrolling anchor; recomputing per scroll frame
 *    is wasted work for a hover hint, so any scroll (capture phase —
 *    nested scrollers like the Evidence pane body included) or resize
 *    just dismisses it.
 *
 *  - **Accessibility unchanged.** The trigger keeps `tabIndex={0}`
 *    (keyboard users tab onto the icon; focus/blur mirror
 *    hover/unhover) and carries an `sr-only` copy of the hint as its
 *    accessible content — screen readers read it without caring where
 *    the visual bubble lives. The portal bubble is `aria-hidden` so
 *    the text is never announced twice. No `aria-label`/`title`: when
 *    a `cursor:help` element carries `aria-label`, browsers (notably
 *    macOS Chrome) fall back to a delayed native tooltip that races
 *    our own.
 *
 *  - **`pointer-events-none` on the bubble.** Moving the cursor onto
 *    the tooltip itself doesn't extend its visibility — once the
 *    cursor leaves the icon, the tooltip closes immediately. Keeps it
 *    a pure read-only affordance.
 *
 *  - **Figure export**: the trigger is tagged `data-export-strip` (the
 *    paper transform removes it), and the bubble lives on
 *    `document.body` — outside any subtree a camera clones — so an
 *    open tooltip can never leak into an exported figure.
 *
 *  - The `onClick` blocks both default and propagation, so clicking
 *    the icon inside a `<label>` doesn't redirect focus to the
 *    label's wrapped `<input>`.
 */
export function TipIcon({
  hint,
  className = "",
  size = 12,
  position = "above",
}: {
  hint: string;
  /** Extra classes on the wrapper (e.g. for inline alignment). */
  className?: string;
  /** Pixel size of the icon. Defaults to 12 to match small inline labels. */
  size?: number;
  /** PREFERRED tooltip direction; the portal flips it when the viewport
   *  has no room on that side (e.g. `"above"` on a TopBar chip). */
  position?: "above" | "below";
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  // null while the bubble hasn't been measured yet — it renders
  // invisible for one layout pass so we can size-aware place it.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const r = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const GAP = 4; // trigger ↔ bubble
    const PAD = 8; // viewport safety margin
    let above = position === "above";
    // Flip when the preferred side lacks room (and the other has it).
    if (above && r.top - b.height - GAP < PAD) above = false;
    else if (!above && r.bottom + b.height + GAP > window.innerHeight - PAD)
      above = true;
    setPos({
      top: above ? r.top - b.height - GAP : r.bottom + GAP,
      left: Math.min(
        Math.max(r.left + r.width / 2 - b.width / 2, PAD),
        window.innerWidth - b.width - PAD,
      ),
    });
  }, [position]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, place]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      data-export-strip
      className={`relative shrink-0 inline-flex items-center text-mute/70 hover:text-ink focus:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded-full cursor-help ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <HelpCircle
        style={{ width: size, height: size }}
        strokeWidth={2}
        aria-hidden="true"
      />
      {/* Accessible copy of the hint — stays a DOM descendant of the
          focusable trigger so screen readers announce it naturally. */}
      <span className="sr-only">{hint}</span>
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            role="tooltip"
            aria-hidden="true"
            data-export-strip
            style={{
              position: "fixed",
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              visibility: pos ? "visible" : "hidden",
              backgroundColor: "rgb(var(--color-surface))",
            }}
            className="pointer-events-none z-[100] block w-max max-w-[16rem] rounded-md border border-edge text-ink shadow-lg px-2 py-1 text-[11px] leading-snug normal-case tracking-normal font-normal whitespace-normal text-left"
          >
            {hint}
          </span>,
          document.body,
        )}
    </span>
  );
}
