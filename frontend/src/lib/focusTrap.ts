// Small focus-trap hook for modal dialogs and drawers.
//
// When ``active`` is true:
//   1. On the first effect run, focus moves into the container so
//      keyboard users can immediately interact with the dialog.
//   2. Tab + Shift+Tab cycle within the container's focusable
//      elements; Tab from the last one wraps to the first, and
//      Shift+Tab from the first wraps to the last.
//   3. On deactivation, focus is NOT restored here — callers handle
//      that explicitly so they can decide what to focus next
//      (typically the trigger that opened the dialog).
//
// We use a tabbable-elements query that mirrors WAI-ARIA Authoring
// Practices: links with href, buttons that aren't disabled, inputs
// that aren't disabled, etc. Elements with tabindex="-1" are
// explicitly excluded so they can be programmatically focused but
// won't appear in the Tab cycle.

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null);
}

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  containerRef: RefObject<T | null>,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Move focus into the dialog on open. Prefer the container itself
    // (with tabIndex=-1 set by the caller) over the first focusable
    // child so screen readers announce the dialog before reading the
    // first control.
    const tabIdx = container.getAttribute("tabindex");
    if (tabIdx === "-1") {
      container.focus();
    } else {
      const focusables = getFocusable(container);
      if (focusables.length) focusables[0].focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      // Tab from the last focusable wraps to first; Shift+Tab from
      // the first wraps to the last. We also defensively handle the
      // case where focus has somehow left the container — Tab is
      // routed to the first focusable.
      if (!activeEl || !container.contains(activeEl)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, containerRef]);
}
