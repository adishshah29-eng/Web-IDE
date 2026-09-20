"use client";

import { IconConsole, IconFile, IconFolder } from "@/components/icons";

export type MobilePanel = "files" | "editor" | "console";

interface MobileTabBarProps {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  hasDirty: boolean;
}

/**
 * Bottom tab bar shown only below the `md` breakpoint — replaces the
 * side-by-side sidebar/editor/console layout with one full-screen pane at a
 * time, since there's no room for three columns on a phone.
 */
export default function MobileTabBar({ active, onChange, hasDirty }: MobileTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Workspace panels"
      className="md:hidden flex items-stretch h-14 border-t border-(--border-hairline) bg-(--surface-toolbar) shrink-0"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <TabButton label="Files" active={active === "files"} onClick={() => onChange("files")}>
        <IconFolder className="w-5 h-5" />
      </TabButton>
      <TabButton label="Editor" active={active === "editor"} onClick={() => onChange("editor")} dot={hasDirty}>
        <IconFile className="w-5 h-5" />
      </TabButton>
      <TabButton label="Output" active={active === "console"} onClick={() => onChange("console")}>
        <IconConsole className="w-5 h-5" />
      </TabButton>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  children,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
        active ? "text-(--accent)" : "text-(--text-tertiary)"
      }`}
    >
      <span className="relative">
        {children}
        {dot && <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-(--accent)" />}
      </span>
      {label}
    </button>
  );
}
