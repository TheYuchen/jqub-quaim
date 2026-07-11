// One-hook shorthand for the "popover / dropdown / menu" idiom used
// across the app:
//   - Listens for pointerdown outside the container ref → closes
//     (pointerdown covers mouse, touch and pen with one listener; the
//     old mousedown missed direct touch on some mobile browsers).
//   - Listens for Escape → closes AND hands focus back to whatever
//     was focused when the popover opened (normally the trigger
//     button), so keyboard users aren't dropped at the document root.
//   - Both listeners only attach while `open` is true, and detach on
//     close / unmount, so they don't pile up.
//
// Replaces the ~20-line useEffect block that was copy-pasted into 8
// components (AuthButton, ThemeSwitcher, MoreMenu, PapersPopover,
// SupportPopover, DevelopersPopover, BlockPicker, PresetPicker). The
// behaviour is intentionally identical to that block so a `git blame`
// on the old call sites still reads coherently.

import { useEffect, type RefObject } from "react";

export function useDismissOn(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    // Captured at open time — usually the trigger button (the click
    // that opened the popover focused it). Escape returns focus there.
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const onDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        opener?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, containerRef, onDismiss]);
}
