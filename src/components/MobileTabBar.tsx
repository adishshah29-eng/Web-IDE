"use client";

import {
  IconExplorer,
  IconFile,
  IconConsoleActivity,
  IconPreviewActivity,
  IconAgentActivity,
  IconTerminalActivity,
} from "@/components/icons";

export type MobilePanel = "files" | "editor" | "console" | "preview" | "agent" | "terminal";

interface MobileTabBarProps {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  hasDirty: boolean;
  previewDisabled?: boolean;
  /** Pulses a dot on the Agent tab so it's obvious it's still working while another pane is showing. */
  agentBusy?: boolean;
}

/**
 * Bottom tab bar shown only below the `md` breakpoint — replaces the
 * side-by-side sidebar/editor/panel layout with one full-screen pane at a
 * time, since there's no room for multiple columns on a phone. One tab per
 * desktop panel, so nothing the desktop layout offers is unreachable here.
 */
export default function MobileTabBar({ active, onChange, hasDirty, previewDisabled, agentBusy }: MobileTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Workspace panels"
      className="md:hidden flex items-stretch h-14 border-t border-(--border-hairline) bg-(--activitybar-bg) shrink-0"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <TabButton label="Files" active={active === "files"} onClick={() => onChange("files")}>
        <IconExplorer className="w-5 h-5" />
      </TabButton>
      <TabButton label="Editor" active={active === "editor"} onClick={() => onChange("editor")} dot={hasDirty}>
        <IconFile className="w-5 h-5" />
      </TabButton>
      <TabButton label="Console" active={active === "console"} onClick={() => onChange("console")}>
        <IconConsoleActivity className="w-5 h-5" />
      </TabButton>
      <TabButton
        label="Preview"
        active={active === "preview"}
        disabled={previewDisabled}
        onClick={() => onChange("preview")}
      >
        <IconPreviewActivity className="w-5 h-5" />
      </TabButton>
      <TabButton label="Agent" active={active === "agent"} onClick={() => onChange("agent")} dot={agentBusy} dotPulse>
        <IconAgentActivity className="w-5 h-5" />
      </TabButton>
      <TabButton label="Terminal" active={active === "terminal"} onClick={() => onChange("terminal")}>
        <IconTerminalActivity className="w-5 h-5" />
      </TabButton>
    </div>
  );
}

function TabButton({
  label,
  active,
  disabled,
  onClick,
  children,
  dot,
  dotPulse,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: boolean;
  dotPulse?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 text-[10px] font-medium disabled:opacity-30 ${
        active ? "text-(--activitybar-fg-active)" : "text-(--activitybar-fg)"
      }`}
    >
      <span className="relative">
        {children}
        {dot && (
          <span
            className={`absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full ${
              dotPulse ? "bg-(--accent-run) animate-pulse" : "bg-(--accent)"
            }`}
          />
        )}
      </span>
      {label}
    </button>
  );
}
