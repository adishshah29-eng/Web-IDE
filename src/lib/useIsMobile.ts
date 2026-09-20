"use client";

import { useSyncExternalStore } from "react";

// Matches Tailwind's `md` breakpoint (768px): below it the workspace shows
// one full-screen pane at a time instead of side-by-side columns.
const QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", onChange);
      // The media-query `change` event alone isn't reliably delivered in
      // every environment (seen with an emulated/resized viewport), so also
      // re-check on resize. useSyncExternalStore ignores a re-check that
      // yields the same value, so the double subscription costs nothing.
      window.addEventListener("resize", onChange);
      return () => {
        mql.removeEventListener("change", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
