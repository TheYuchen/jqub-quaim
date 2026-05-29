// One-hook shorthand for the "popover / dropdown / menu" idiom used
// across the app:
//   - Listens for mousedown outside the container ref → closes
//   - Listens for Escape → closes
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
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, containerRef, onDismiss]);
}
