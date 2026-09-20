"use client";

import { useEffect, useRef, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { AgentFileContext, PendingChange } from "@/lib/agent/useAgent";
import { useAgent } from "@/lib/agent/useAgent";
import { getEditorLanguage } from "@/lib/languageMap";

interface AgentPanelProps {
  ctx: AgentFileContext;
  /** Scopes the persisted conversation to one project/folder — see useAgent. */
  storageKey: string;
  /** Lets a parent show a "still working" indicator (e.g. a badge on the Agent activity-bar icon) even when this panel isn't the visible one. */
  onRunningChange?: (running: boolean) => void;
}

export default function AgentPanel({ ctx, storageKey, onRunningChange }: AgentPanelProps) {
  const { log, running, run, stop, reset, pending, decide, autoApprove, setAutoApprove } = useAgent(ctx, storageKey);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [log]);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  const submit = () => {
    const task = input.trim();
    if (!task || running) return;
    setInput("");
    void run(task);
  };

  return (
    <div className="h-full flex flex-col bg-(--surface-editor) text-neutral-200">
      {log.length > 0 && (
        <div className="flex justify-end px-2.5 h-7 items-center border-b border-white/10 shrink-0">
          <button
            onClick={() => !running && reset()}
            disabled={running}
            title="Clear this conversation"
            className="text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 font-(family-name:--font-ui)"
          >
            Clear
          </button>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 text-[12.5px]">
        {log.length === 0 && pending.length === 0 && (
          <div className="text-neutral-600 font-(family-name:--font-ui) leading-relaxed">
            Ask it to explain, find, fix, or check something in this project. It can read files, run code, and propose file changes for you to review. Conversations are saved per project, so reloading the page won&apos;t lose them.
          </div>
        )}
        {log.map((entry) => <LogLine key={entry.id} entry={entry} />)}
        {running && pending.length === 0 && <ThinkingIndicator />}
      </div>

      {/* Rendered outside the scrollable log, not inside it — a long
          proposal above it must never push the Approve/Reject buttons
          somewhere the user has to go looking for. */}
      {pending.length > 0 && (
        <div className="border-t border-(--accent)/40 max-h-[60%] overflow-y-auto px-3 py-2.5 flex flex-col gap-2 shrink-0 bg-black/10">
          {pending.map((change) => (
            <PendingChangeCard key={change.id} change={change} onDecide={(approved) => decide(change.id, approved)} />
          ))}
        </div>
      )}

      <div className="border-t border-white/10 px-2.5 py-2 flex items-center gap-2 shrink-0">
        <label className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-(family-name:--font-ui) select-none">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="accent-(--accent)"
          />
          Auto-apply changes (skip review)
        </label>
      </div>

      <div className="border-t border-white/10 p-2.5 flex gap-2 shrink-0">
        <input
          value={input}
          disabled={running}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask the agent…"
          className="flex-1 bg-white/[.06] border border-white/10 rounded-md px-2.5 h-8 text-[12.5px] text-neutral-100 outline-none focus-visible:border-(--accent) placeholder:text-neutral-600 disabled:opacity-50 font-(family-name:--font-ui)"
        />
        {running ? (
          <button
            onClick={stop}
            className="h-8 px-3 rounded-md text-[12.5px] font-medium bg-(--accent-stop) text-white hover:brightness-110 font-(family-name:--font-ui) flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!input.trim()}
            className="h-8 px-3 rounded-md text-[12.5px] font-medium bg-(--accent) text-white hover:brightness-110 disabled:opacity-40 font-(family-name:--font-ui)"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}

// A visibly-alive "still working" indicator — three dots bouncing in
// sequence, the universal "someone is typing" signal, so a slow step reads
// as "in progress" rather than "frozen".
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 text-neutral-500 font-(family-name:--font-ui)">
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      Working…
    </div>
  );
}

function LogLine({ entry }: { entry: { kind: string; text: string } }) {
  if (entry.kind === "user") {
    return <div className="text-neutral-100 font-medium break-words font-(family-name:--font-ui)">{entry.text}</div>;
  }
  if (entry.kind === "text") {
    return <div className="text-neutral-200 whitespace-pre-wrap break-words leading-relaxed font-(family-name:--font-ui)">{entry.text}</div>;
  }
  if (entry.kind === "tool-call") {
    return <div className="text-sky-400 whitespace-pre-wrap break-words font-(family-name:--font-mono) text-[11.5px]">→ {entry.text}</div>;
  }
  if (entry.kind === "tool-result") {
    return <div className="text-neutral-500 whitespace-pre-wrap break-words font-(family-name:--font-mono) text-[11px]">{entry.text}</div>;
  }
  return <div className="text-(--accent-stop) break-words font-(family-name:--font-ui)">{entry.text}</div>;
}

function PendingChangeCard({ change, onDecide }: { change: PendingChange; onDecide: (approved: boolean) => void }) {
  const isDelete = change.kind === "delete";
  return (
    <div className="border border-(--accent)/40 rounded-lg overflow-hidden bg-black/20">
      <div className="flex items-center justify-between px-2.5 h-7 bg-(--accent)/10 text-[11.5px] font-(family-name:--font-ui)">
        <span className="truncate">
          {isDelete ? "Delete " : change.before === null ? "Create " : "Edit "}
          <span className="font-(family-name:--font-mono) text-neutral-200">{change.path}</span>
        </span>
      </div>
      <div style={{ height: 180 }}>
        <DiffEditor
          original={change.before ?? ""}
          modified={change.after ?? ""}
          language={getEditorLanguage(change.path)}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: false,
            minimap: { enabled: false },
            fontSize: 11.5,
            scrollBeyondLastLine: false,
            lineNumbers: "off",
          }}
        />
      </div>
      <div className="flex justify-end gap-2 px-2.5 py-2 bg-black/20">
        <button
          onClick={() => onDecide(false)}
          className="h-7 px-3 rounded-md text-[12px] text-neutral-200 hover:bg-white/10 font-(family-name:--font-ui)"
        >
          Reject
        </button>
        <button
          onClick={() => onDecide(true)}
          className={`h-7 px-3 rounded-md text-[12px] font-medium text-white hover:brightness-110 font-(family-name:--font-ui) ${
            isDelete ? "bg-(--accent-stop)" : "bg-(--accent-run)"
          }`}
        >
          {isDelete ? "Delete" : "Approve"}
        </button>
      </div>
    </div>
  );
}
