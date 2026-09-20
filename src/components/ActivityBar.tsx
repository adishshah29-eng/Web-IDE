"use client";

import {
  IconExplorer,
  IconConsoleActivity,
  IconPreviewActivity,
  IconAgentActivity,
  IconTerminalActivity,
} from "@/components/icons";

export type RightPanelKey = "console" | "preview" | "agent";

interface ActivityBarProps {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  rightPanelKey: RightPanelKey;
  rightPanelOpen: boolean;
  onSelectRightPanel: (panel: RightPanelKey) => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  previewDisabled?: boolean;
  /** Pulses the Agent icon so it's obvious the agent is still working even when that panel isn't the one showing. */
  agentBusy?: boolean;
}

const RIGHT_PANEL_ITEMS: { key: RightPanelKey; label: string; Icon: typeof IconExplorer }[] = [
  { key: "console", label: "Console", Icon: IconConsoleActivity },
  { key: "preview", label: "Preview", Icon: IconPreviewActivity },
  { key: "agent", label: "Agent", Icon: IconAgentActivity },
];

export default function ActivityBar({
  explorerOpen,
  onToggleExplorer,
  rightPanelKey,
  rightPanelOpen,
  onSelectRightPanel,
  terminalOpen,
  onToggleTerminal,
  previewDisabled,
  agentBusy,
}: ActivityBarProps) {
  return (
    <div className="w-12 shrink-0 flex flex-col items-center bg-(--activitybar-bg) border-r border-(--border-hairline)">
      <ActivityButton
        title="Explorer"
        active={explorerOpen}
        onClick={onToggleExplorer}
        Icon={IconExplorer}
      />

      <div className="w-6 h-px bg-white/10 my-1.5" />

      {RIGHT_PANEL_ITEMS.map(({ key, label, Icon }) => (
        <ActivityButton
          key={key}
          title={label}
          disabled={key === "preview" ? previewDisabled : false}
          active={rightPanelOpen && rightPanelKey === key}
          busy={key === "agent" && agentBusy}
          onClick={() => onSelectRightPanel(key)}
          Icon={Icon}
        />
      ))}

      <div className="w-6 h-px bg-white/10 my-1.5" />

      <ActivityButton
        title="Terminal"
        active={terminalOpen}
        onClick={onToggleTerminal}
        Icon={IconTerminalActivity}
      />
    </div>
  );
}

function ActivityButton({
  title,
  active,
  disabled,
  busy,
  onClick,
  Icon,
}: {
  title: string;
  active: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  Icon: (props: { className?: string }) => React.ReactElement;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative w-12 h-12 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? "text-(--activitybar-fg-active)" : "text-(--activitybar-fg) hover:text-(--activitybar-fg-active)"
      }`}
    >
      {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-(--activitybar-active-border)" />}
      <Icon className="w-[22px] h-[22px]" />
      {busy && (
        <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-(--accent-run) animate-pulse" />
      )}
    </button>
  );
}
