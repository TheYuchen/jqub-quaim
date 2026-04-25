import { HelpCircle } from "lucide-react";

/**
 * Small ⓘ help icon with a CSS-only tooltip.
 *
 * Reused wherever a UI element has a short label that some users
 * (especially non-quantum readers) might not recognise — block family
 * badges, status chips, terse stat labels in the pipeline pane.
 *
 * Why this looks the way it does (in detail because the previous
 * iterations had a few subtle gotchas):
 *
 *  - **Named Tailwind group (`group/tip`).** The wrapping span carries
 *    `group/tip` and the tooltip carries `group-hover/tip:block` /
 *    `group-focus/tip:block`. An unnamed `group` would be matched by
 *    every ancestor that also uses unnamed `group` — including
 *    QNode's `node-card` — so hovering anywhere on a node card would
 *    pop every tooltip simultaneously.
 *
 *  - **No `aria-label` or `title`.** When a `cursor:help` element
 *    carries `aria-label`, browsers (notably macOS Chrome) fall back
 *    to a delayed native tooltip that races our own. The visible
 *    `<span role="tooltip">` *is* the accessible name — screen readers
 *    read its text.
 *
 *  - **`tabIndex={0}` + `group-focus/tip`.** Keyboard users can tab
 *    onto the icon and read the hint without a mouse.
 *
 *  - **`pointer-events-none` on the bubble.** Moving the cursor onto
 *    the tooltip itself doesn't extend its visibility — once the
 *    cursor leaves the icon, the tooltip closes immediately. Keeps it
 *    a pure read-only affordance.
 *
 *  - The `onClick` blocks both default and propagation, so clicking
 *    the icon inside a `<label>` doesn't redirect focus to the
 *    label's wrapped `<input>`.
 */
export function TipIcon({
  hint,
  className = "",
  size = 12,
}: {
  hint: string;
  /** Extra classes on the wrapper (e.g. for inline alignment). */
  className?: string;
  /** Pixel size of the icon. Defaults to 12 to match small inline labels. */
  size?: number;
}) {
  return (
    <span
      tabIndex={0}
      className={`group/tip relative shrink-0 inline-flex items-center text-mute/70 hover:text-ink focus:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded-full cursor-help ${className}`}
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
      <span
        role="tooltip"
        className="hidden group-hover/tip:block group-focus/tip:block pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 w-max max-w-[16rem] rounded-md border border-edge bg-surface text-ink shadow-lg px-2 py-1 text-[11px] leading-snug normal-case tracking-normal font-normal whitespace-normal text-left"
      >
        {hint}
      </span>
    </span>
  );
}
