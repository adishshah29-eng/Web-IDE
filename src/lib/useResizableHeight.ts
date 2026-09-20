"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A draggable panel height, persisted per-browser in localStorage — the
 * vertical counterpart to useResizableWidth, for a bottom-docked panel
 * (e.g. the terminal) whose drag handle sits above it.
 */
export function useResizableHeight(storageKey: string, initial: number, min: number, max: number) {
  const [height, setHeight] = useState(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const n = Number(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a per-viewer stored preference on mount
        if (Number.isFinite(n)) setHeight(Math.min(max, Math.max(min, n)));
      }
    } catch {
      // localStorage unavailable (private mode, etc) — fall back to initial height
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only read the stored height once, on mount
  }, []);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const onMove = (ev: MouseEvent) => {
        // The handle sits above the panel, so dragging up (negative delta) grows it.
        const delta = startY - ev.clientY;
        setHeight(Math.min(max, Math.max(min, startHeight + delta)));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setHeight((h) => {
          try {
            localStorage.setItem(storageKey, String(h));
          } catch {
            // ignore — persistence is a nicety, not required for the drag itself
          }
          return h;
        });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height, min, max, storageKey]
  );

  return { height, startDrag };
}
