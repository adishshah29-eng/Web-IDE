"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { WebContainerProcess } from "@webcontainer/api";
import { getWebContainer } from "@/lib/webcontainer/instance";
import { buildFileSystemTree, type FileSource } from "@/lib/webcontainer/fileTree";
import { watchAndSync, type SyncTarget } from "@/lib/webcontainer/sync";

interface TerminalPanelProps {
  source: FileSource & Pick<SyncTarget, "applyWrite" | "applyDelete">;
  onSync?: () => void;
}

export default function TerminalPanel({ source, onSync }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const procRef = useRef<WebContainerProcess | null>(null);
  const [status, setStatus] = useState<"booting" | "ready" | "error">("booting");
  const [errorMsg, setErrorMsg] = useState("");

  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });
  const onSyncRef = useRef(onSync);
  useEffect(() => {
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    let disposed = false;
    let stopSync: (() => void) | null = null;
    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      fontFamily: "var(--font-mono), monospace",
      theme: { background: "#1e1e1e", foreground: "#d4d4d4" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    if (containerRef.current) term.open(containerRef.current);
    try {
      fit.fit();
    } catch {
      // container not laid out yet — the ResizeObserver below will fit again
    }

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        procRef.current?.resize({ cols: term.cols, rows: term.rows });
      } catch {
        // ignore transient resize errors during teardown
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // Snapshot of the project's files at the moment the terminal is first
    // opened — intentionally not kept in sync with later edits made in the
    // editor. Re-open the tab (or run a shell command like `ls`) to see
    // where things stand; that's a acceptable tradeoff for not rebooting
    // the shell on every keystroke elsewhere in the app.
    (async () => {
      try {
        term.writeln("Booting WebContainer…");
        const wc = await getWebContainer();
        if (disposed) return;

        term.writeln("Loading project files…");
        const files = await buildFileSystemTree(source);
        await wc.mount(files);
        if (disposed) return;

        const shell = await wc.spawn("jsh", [], {
          terminal: { cols: term.cols, rows: term.rows },
        });
        if (disposed) {
          shell.kill();
          return;
        }
        procRef.current = shell;

        shell.output.pipeTo(
          new WritableStream({
            write(chunk) {
              term.write(chunk);
            },
          })
        );

        const input = shell.input.getWriter();
        term.onData((data) => {
          void input.write(data);
        });

        stopSync = watchAndSync(wc, {
          applyWrite: (path, content) => sourceRef.current.applyWrite(path, content),
          applyDelete: (path) => sourceRef.current.applyDelete(path),
          onSync: () => onSyncRef.current?.(),
        });

        setStatus("ready");
      } catch (e) {
        if (disposed) return;
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Couldn't start the terminal.");
      }
    })();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      stopSync?.();
      procRef.current?.kill();
      procRef.current = null;
      term.dispose();
    };
    // Intentionally boots once per mount — see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {status === "error" && (
        <div className="px-3 py-2 text-[12px] text-(--accent-stop) font-(family-name:--font-ui) shrink-0">
          {errorMsg}
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 px-2 py-1 overflow-hidden" />
    </div>
  );
}
