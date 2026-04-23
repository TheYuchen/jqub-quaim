import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Mobile-only side drawer.
 *
 * Renders a full-height fixed panel that slides in from the chosen edge
 * when `open` is true, backed by a scrim that closes on click. Intended
 * for use at the `<md` breakpoint where the three-column desktop layout
 * would otherwise squeeze the canvas to zero.
 *
 * The caller is responsible for mounting/unmounting (so desktop layout
 * can skip it entirely). When rendered, we still respect `open` so the
 * slide-in animation plays on toggle.
 */
export function MobileDrawer({
  open,
  onClose,
  side,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  children: ReactNode;
}) {
  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const translate = open
    ? "translate-x-0"
    : side === "left"
      ? "-translate-x-full"
      : "translate-x-full";
  const sideClass = side === "left" ? "left-0 border-r" : "right-0 border-l";

  return (
    <>
      {/* Scrim. Transitioning opacity — pointer-events gated on `open`. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Panel. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed top-0 bottom-0 z-50 w-[86vw] max-w-[420px] bg-surface border-edge flex flex-col min-h-0 transition-transform duration-200 ease-out shadow-2xl ${sideClass} ${translate}`}
      >
        <div className="h-12 shrink-0 border-b border-edge px-3 flex items-center justify-between">
          <div className="text-sm font-medium text-ink">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="w-8 h-8 rounded-md border border-edge bg-surfaceAlt text-mute hover:text-ink hover:border-edge flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
