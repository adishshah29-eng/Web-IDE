"use client";

import type { CursorPosition } from "@/components/Editor";
import { getLangConfig } from "@/lib/languageMap";
import { displayLanguage } from "@/lib/fileIcons";

interface StatusBarProps {
  filename: string | null;
  cursor: CursorPosition | null;
}

export default function StatusBar({ filename, cursor }: StatusBarProps) {
  const lang = filename ? (getLangConfig(filename)?.label ?? displayLanguage(filename)) : null;

  return (
    <div className="h-[22px] w-full flex items-center justify-between px-2.5 bg-(--statusbar-bg) text-(--statusbar-fg) text-[12px] shrink-0 select-none">
      <span className="opacity-90">{lang ?? (filename ? "Plain Text" : "")}</span>
      {filename && cursor && (
        <span className="opacity-90">
          Ln {cursor.line}, Col {cursor.col} · UTF-8
        </span>
      )}
    </div>
  );
}
