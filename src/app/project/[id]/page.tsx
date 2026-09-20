"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import FileTree, { type OpResult } from "@/components/FileTree";
import Tabs, { type OpenTab } from "@/components/Tabs";
import Editor, { type CursorPosition } from "@/components/Editor";
import OutputPanel, { type RunResult } from "@/components/OutputPanel";
import PreviewPanel from "@/components/PreviewPanel";
import AgentPanel from "@/components/AgentPanel";
import TerminalPanel from "@/components/TerminalPanel";
import ActivityBar from "@/components/ActivityBar";
import StatusBar from "@/components/StatusBar";
import { findNode, type Project, type TreeNode, type WorkspaceNode } from "@/lib/types";
import { isRunnable } from "@/lib/languageMap";
import { parseErrorBody } from "@/lib/http";
import { IconBack, IconPlay, IconMaximize, IconMinimize, IconClose } from "@/components/icons";
import { useToast } from "@/components/ToastProvider";
import { useDialog } from "@/components/DialogProvider";
import { useResizableWidth } from "@/lib/useResizableWidth";
import { useResizableHeight } from "@/lib/useResizableHeight";
import { flattenTreeWithPaths, hasHtmlEntry, isPreviewableFile, pickPreviewEntry } from "@/lib/previewFiles";
import type { AgentFileContext } from "@/lib/agent/useAgent";
import { ensureParentFolder } from "@/lib/agent/pathOps";
import { getWebContainer, subscribeDevServerUrl } from "@/lib/webcontainer/instance";
import { buildFileSystemTree } from "@/lib/webcontainer/fileTree";

const AUTOSAVE_DELAY_MS = 900;

const PANEL_LABELS: Record<"console" | "preview" | "agent", string> = {
  console: "Console",
  preview: "Preview",
  agent: "Agent",
};

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
      <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
      <span className="w-3 h-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

interface OpenFileState extends OpenTab {
  content: string;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const toast = useToast();
  const dialog = useDialog();

  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openFiles, setOpenFiles] = useState<OpenFileState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const openFilesRef = useRef(openFiles);
  useEffect(() => {
    openFilesRef.current = openFiles;
  });
  // The agent's tool closures are created once per run() call and don't pick
  // up later re-renders mid-run — reading through a ref (not the `tree`
  // state variable) ensures a write_file followed by run_code in the same
  // turn sees the just-written content instead of a stale pre-write snapshot.
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  });

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [rightPanel, setRightPanel] = useState<"console" | "preview" | "agent">("console");
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [devServerUrl, setDevServerUrl] = useState<string | null>(null);
  useEffect(() => subscribeDevServerUrl(setDevServerUrl), []);
  const [panelMaximized, setPanelMaximized] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);

  const selectRightPanel = (panel: "console" | "preview" | "agent") => {
    if (panel === rightPanel && rightPanelVisible) {
      setRightPanelVisible(false);
      setPanelMaximized(false);
    } else {
      setRightPanel(panel);
      setRightPanelVisible(true);
    }
  };
  const [cursor, setCursor] = useState<CursorPosition | null>(null);

  const sidebarResize = useResizableWidth("ide.sidebarWidth", 240, 160, 480, "right");
  const consoleResize = useResizableWidth("ide.consoleWidth", 384, 240, 640, "left");
  const terminalResize = useResizableHeight("ide.terminalHeight", 260, 140, 560);

  const filePaths = useMemo(() => flattenTreeWithPaths(tree), [tree]);

  const previewManifest = useMemo(() => {
    const manifest: Record<string, string> = {};
    for (const { path, node } of filePaths) {
      if (!isPreviewableFile(path)) continue;
      const open = openFiles.find((f) => f.id === node.id);
      manifest[path] = open ? open.content : (node.content ?? "");
    }
    return manifest;
  }, [filePaths, openFiles]);

  const activeFilePath = useMemo(
    () => filePaths.find((f) => f.node.id === activeId)?.path ?? null,
    [filePaths, activeId]
  );

  const previewEntryPath = useMemo(
    () => pickPreviewEntry(Object.keys(previewManifest), activeFilePath),
    [previewManifest, activeFilePath]
  );

  const canPreview = useMemo(() => hasHtmlEntry(tree), [tree]);

  // Requests can resolve out of order (e.g. two tree refreshes fired close
  // together). Track a sequence number so only the most recent response is
  // ever applied to state — otherwise a slower, older response can silently
  // overwrite newer data.
  const loadSeq = useRef(0);

  const loadTree = useCallback(async () => {
    const seq = ++loadSeq.current;
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (seq !== loadSeq.current) return;
    if (!res.ok) {
      setError(await parseErrorBody(res));
      return;
    }
    const data = await res.json();
    if (seq !== loadSeq.current) return;
    setProject(data.project);
    setTree(data.tree);
    // Assigned synchronously (not just via the mirroring effect) so a caller
    // that awaits loadTree() and immediately reads treeRef.current — like
    // the agent's applyWrite — sees the update without waiting on React's
    // next render/effect cycle.
    treeRef.current = data.tree;
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- simple fetch-on-mount, no external data lib in this learning project
    loadTree().finally(() => setLoading(false));
  }, [loadTree]);

  // Keep open tabs in sync with the tree: drop tabs whose file was deleted
  // elsewhere (e.g. from the tree), and pick up renames for non-dirty tabs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling local tab state against the server-fetched tree, not a plain prop mirror
    setOpenFiles((prev) => {
      let changed = false;
      const next = prev.flatMap((f) => {
        const node = findNode(tree, f.id);
        if (!node) {
          changed = true;
          return [];
        }
        if (node.name !== f.name) {
          changed = true;
          return [{ ...f, name: node.name }];
        }
        return [f];
      });
      return changed ? next : prev;
    });
  }, [tree]);

  useEffect(() => {
    if (activeId && !openFiles.some((f) => f.id === activeId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- picking a fallback active tab after the active one closed/was removed
      setActiveId(openFiles.length > 0 ? openFiles[openFiles.length - 1].id : null);
    }
  }, [openFiles, activeId]);

  // Native unload guard — the one place a browser-native prompt is the right call,
  // since only the browser itself can intercept a tab close or refresh.
  useEffect(() => {
    const hasUnsaved = openFiles.some((f) => f.dirty);
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [openFiles]);

  const openFile = (node: WorkspaceNode) => {
    if (node.type !== "file") return;
    const full = findNode(tree, node.id);
    setActiveId(node.id);
    setOpenFiles((prev) => {
      if (prev.some((f) => f.id === node.id)) return prev;
      return [...prev, { id: node.id, name: node.name, content: full?.content ?? "", dirty: false }];
    });
  };

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAutoSaveTimer = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  };

  // Saves a specific file by id (not "whatever is active now") so a debounced
  // auto-save scheduled while editing one tab can't accidentally save a
  // different file the user has since switched to.
  const saveFile = useCallback(
    async (id: string) => {
      const file = openFilesRef.current.find((f) => f.id === id);
      if (!file || !file.dirty) return;
      setSaving(true);
      try {
        const res = await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: file.id, content: file.content }),
        });
        if (!res.ok) {
          toast.show(await parseErrorBody(res), "error");
          return;
        }
        setOpenFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, dirty: false } : f)));
      } catch {
        toast.show("Couldn't save — check your connection.", "error");
      } finally {
        setSaving(false);
      }
    },
    [toast]
  );

  const saveActive = useCallback(async () => {
    if (!activeId) return;
    clearAutoSaveTimer();
    await saveFile(activeId);
  }, [activeId, saveFile]);

  const closeTab = useCallback(
    async (id: string) => {
      const file = openFilesRef.current.find((f) => f.id === id);
      if (file?.dirty) {
        const ok = await dialog.confirm({
          title: `Close "${file.name}" without saving?`,
          message: "Your changes will be lost. Press ⌘S / Ctrl+S first if you want to keep them.",
          confirmLabel: "Close Without Saving",
          destructive: true,
        });
        if (!ok) return;
      }
      clearAutoSaveTimer();
      setOpenFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [dialog]
  );

  const updateContent = (content: string) => {
    if (!activeId) return;
    const fileId = activeId;
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content, dirty: true } : f))
    );
    clearAutoSaveTimer();
    autoSaveTimer.current = setTimeout(() => saveFile(fileId), AUTOSAVE_DELAY_MS);
  };

  useEffect(() => clearAutoSaveTimer, []);

  const createNode = useCallback(
    async (
      parentId: string | null,
      name: string,
      type: "file" | "folder",
      content?: string
    ): Promise<OpResult> => {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, parent_id: parentId, name, type, content }),
      });
      if (!res.ok) return { ok: false, error: await parseErrorBody(res) };
      const created = await res.json();
      loadTree();
      if (type === "file") {
        setActiveId(created.id);
        setOpenFiles((prev) =>
          prev.some((f) => f.id === created.id)
            ? prev
            : [...prev, { id: created.id, name: created.name, content: created.content ?? "", dirty: false }]
        );
      }
      return { ok: true, id: created.id };
    },
    [projectId, loadTree]
  );

  const renameNode = useCallback(async (id: string, name: string): Promise<OpResult> => {
    const res = await fetch("/api/files", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (!res.ok) return { ok: false, error: await parseErrorBody(res) };
    loadTree();
    return { ok: true };
  }, [loadTree]);

  const deleteNode = useCallback(async (id: string): Promise<OpResult> => {
    const res = await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return { ok: false, error: await parseErrorBody(res) };
    loadTree();
    return { ok: true };
  }, [loadTree]);

  const createFileAtRoot = useCallback(async () => {
    const name = await dialog.prompt({
      title: "New File",
      label: "Name",
      placeholder: "main.py",
      confirmLabel: "Create",
    });
    if (!name) return;
    const result = await createNode(null, name, "file");
    if (!result.ok) toast.show(result.error ?? "Couldn't create it.", "error");
  }, [dialog, createNode, toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd+S is safe to override — browsers let pages claim it (and
      // users expect "save" there). Ctrl/Cmd+W, +N, and (in Firefox) +B are
      // reserved by the browser itself (close tab, new window, bookmarks
      // sidebar) and can't be intercepted from a page — binding them here
      // would silently close the user's real tab instead of our editor tab.
      // Alt+<letter> isn't reserved by any major browser, so that's what
      // carries the rest of these shortcuts.
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActive();
        return;
      }
      if (!e.altKey) return;
      if (e.key === "w") {
        if (activeId) {
          e.preventDefault();
          closeTab(activeId);
        }
      } else if (e.key === "n") {
        e.preventDefault();
        createFileAtRoot();
      } else if (e.key === "b") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, saveActive, closeTab, createFileAtRoot]);

  const agentCtx = useMemo<AgentFileContext>(
    () => ({
      listFiles: () => flattenTreeWithPaths(treeRef.current).map((f) => f.path),
      readFile: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) throw new Error(`No file at "${path}".`);
        const open = openFilesRef.current.find((f) => f.id === match.node.id);
        return open ? open.content : (match.node.content ?? "");
      },
      runFile: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) throw new Error(`No file at "${path}".`);
        if (!isRunnable(match.node.name)) throw new Error(`"${path}" isn't a runnable file type.`);
        const open = openFilesRef.current.find((f) => f.id === match.node.id);
        const content = open ? open.content : (match.node.content ?? "");
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: match.node.name, content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Run failed.");
        return data;
      },
      getContent: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) return null;
        const open = openFilesRef.current.find((f) => f.id === match.node.id);
        return open ? open.content : (match.node.content ?? "");
      },
      applyWrite: async (path, content) => {
        // The change is about to land somewhere the user can actually see it —
        // a maximized console/agent/terminal panel currently hides the editor
        // and sidebar entirely, which is the main way an agent-created or
        // agent-edited file looks like it "vanished".
        setPanelMaximized(false);
        setSidebarVisible(true);

        const existing = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (existing) {
          const res = await fetch("/api/files", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existing.node.id, content }),
          });
          if (!res.ok) throw new Error(await parseErrorBody(res));
          setActiveId(existing.node.id);
          setOpenFiles((prev) =>
            prev.some((f) => f.id === existing.node.id)
              ? prev.map((f) => (f.id === existing.node.id ? { ...f, content, dirty: false } : f))
              : [...prev, { id: existing.node.id, name: existing.node.name, content, dirty: false }]
          );
          await loadTree();
          return;
        }
        const { parentId, leafName, error } = await ensureParentFolder(treeRef.current, path, createNode);
        if (error) throw new Error(error);
        const result = await createNode(parentId, leafName, "file", content);
        if (!result.ok) throw new Error(result.error || "Couldn't create the file.");
        await loadTree();
      },
      applyDelete: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) throw new Error(`No file at "${path}".`);
        const result = await deleteNode(match.node.id);
        if (!result.ok) throw new Error(result.error || "Couldn't delete the file.");
        setOpenFiles((prev) => prev.filter((f) => f.id !== match.node.id));
        await loadTree();
      },
      runCommand: async (command) => {
        const wc = await getWebContainer();
        const files = await buildFileSystemTree({
          listFiles: () => flattenTreeWithPaths(treeRef.current).map((f) => f.path),
          getContent: async (path) => {
            const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
            if (!match) return null;
            const open = openFilesRef.current.find((f) => f.id === match.node.id);
            return open ? open.content : (match.node.content ?? "");
          },
        });
        await wc.mount(files);

        const parts = command.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) throw new Error("Empty command.");
        const [cmd, ...args] = parts;
        const proc = await wc.spawn(cmd, args);

        let output = "";
        const reader = proc.output.getReader();
        void (async () => {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            output += value;
          }
        })();

        const exitCode = await Promise.race([
          proc.exit,
          new Promise<number>((resolve) => setTimeout(() => resolve(-1), 20_000)),
        ]);

        return { stdout: output.slice(0, 4000), exitCode, timedOut: exitCode === -1 };
      },
    }),
    [createNode, deleteNode, loadTree]
  );

  const runActive = async () => {
    const file = openFiles.find((f) => f.id === activeId);
    if (!file) return;
    await saveActive();
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content: file.content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunResult({ stdout: "", stderr: "", exitCode: -1, error: data.error });
      } else {
        setRunResult(data);
      }
    } catch (e) {
      setRunResult({
        stdout: "",
        stderr: "",
        exitCode: -1,
        error: e instanceof Error ? e.message : "Run failed — check your connection.",
      });
    } finally {
      setRunning(false);
    }
  };

  const activeFile = openFiles.find((f) => f.id === activeId) ?? null;

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-(--surface-panel)">
        <div className="h-11 flex items-center px-3 border-b border-(--border-hairline) bg-(--surface-toolbar) shrink-0">
          <TrafficLights />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-60 border-r border-(--border-hairline) bg-(--surface-sidebar) p-3 space-y-2">
            {[85, 60, 70, 45, 65].map((w, i) => (
              <div key={i} className="h-3 rounded bg-black/[.06] dark:bg-white/[.08] animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="flex-1 bg-(--surface-editor)" />
          <div className="w-96 border-l border-(--border-hairline) bg-(--surface-editor)" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-(--surface-panel) text-(--text-primary) p-6 text-sm">
        <div className="max-w-md">
          <p className="text-(--accent-stop) mb-3">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-(--accent) hover:underline text-sm"
          >
            <IconBack className="w-3 h-3" /> Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-(--surface-panel) text-(--text-primary)">
      <div className="h-11 grid grid-cols-3 items-center px-3 border-b border-(--border-hairline) bg-(--titlebar-bg) shrink-0">
        <div className="flex items-center gap-3">
          <TrafficLights />
          <Link
            href="/"
            title="Back to Projects"
            aria-label="Back to Projects"
            className="text-(--text-tertiary) hover:text-(--text-primary) p-1 rounded hover:bg-white/5"
          >
            <IconBack className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="text-center text-[13px] font-medium text-(--text-secondary) truncate">
          {project?.name}
          {saving && <span className="text-(--text-tertiary) font-normal"> · Saving…</span>}
        </div>

        <div className="flex justify-end">
          <button
            onClick={runActive}
            disabled={!activeFile || !isRunnable(activeFile.name) || running}
            className="flex items-center gap-1.5 bg-(--accent-run) hover:bg-(--accent-run-hover) disabled:bg-white/[.06] disabled:text-(--text-tertiary) text-white text-[12.5px] font-medium h-7 px-3 rounded-md transition-colors"
          >
            <IconPlay className="w-3 h-3" />
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <ActivityBar
          explorerOpen={sidebarVisible}
          onToggleExplorer={() => setSidebarVisible((v) => !v)}
          rightPanelKey={rightPanel}
          rightPanelOpen={rightPanelVisible}
          onSelectRightPanel={selectRightPanel}
          terminalOpen={terminalVisible}
          onToggleTerminal={() => setTerminalVisible((v) => !v)}
          previewDisabled={!canPreview && !devServerUrl}
          agentBusy={agentBusy}
        />

        {!panelMaximized && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 flex min-h-0">
              {sidebarVisible && (
                <>
                  <div
                    style={{ width: sidebarResize.width }}
                    className="border-r border-(--border-hairline) overflow-y-auto shrink-0 bg-(--surface-sidebar)"
                  >
                    <FileTree
                      tree={tree}
                      activeFileId={activeId}
                      onOpenFile={openFile}
                      onCreateNode={createNode}
                      onRenameNode={renameNode}
                      onDeleteNode={deleteNode}
                    />
                  </div>
                  <div
                    onMouseDown={sidebarResize.startDrag}
                    title="Drag to resize"
                    className="w-2 -mx-0.5 shrink-0 cursor-col-resize group relative z-10"
                  >
                    <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-transparent group-hover:bg-(--accent)/50 group-active:bg-(--accent)" />
                  </div>
                </>
              )}

              <div className="flex-1 flex flex-col min-w-0">
                <Tabs
                  tabs={openFiles.map(({ id, name, dirty }) => ({ id, name, dirty }))}
                  activeId={activeId}
                  onSelect={setActiveId}
                  onClose={closeTab}
                />
                <div className="flex-1 min-h-0">
                  {activeFile ? (
                    <Editor
                      key={activeFile.id}
                      filename={activeFile.name}
                      value={activeFile.content}
                      onChange={updateContent}
                      onCursorChange={setCursor}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-(--surface-editor) text-neutral-600 text-sm">
                      {openFiles.length === 0 && tree.length === 0
                        ? "Add a file to get started"
                        : "Select a file to start editing"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {terminalVisible && (
              <>
                <div
                  onMouseDown={terminalResize.startDrag}
                  title="Drag to resize"
                  className="h-2 -my-0.5 shrink-0 cursor-row-resize group relative z-10"
                >
                  <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-transparent group-hover:bg-(--accent)/50 group-active:bg-(--accent)" />
                </div>
                <div
                  style={{ height: terminalResize.height }}
                  className="shrink-0 flex flex-col border-t border-(--border-hairline)"
                >
                  <div className="flex items-center justify-between h-8 border-b border-(--border-hairline) bg-(--surface-panel) shrink-0 text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
                    <span className="px-3">Terminal</span>
                    <button
                      title="Close terminal"
                      aria-label="Close terminal"
                      onClick={() => setTerminalVisible(false)}
                      className="mr-2 p-1 rounded normal-case text-(--text-tertiary) hover:bg-white/10 hover:text-(--text-primary)"
                    >
                      <IconClose className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <TerminalPanel source={agentCtx} onSync={loadTree} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!panelMaximized && rightPanelVisible && (
          <div
            onMouseDown={consoleResize.startDrag}
            title="Drag to resize"
            className="w-2 -mx-0.5 shrink-0 cursor-col-resize group relative z-10"
          >
            <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-transparent group-hover:bg-(--accent)/50 group-active:bg-(--accent)" />
          </div>
        )}
        {rightPanelVisible && (
          <div
            style={panelMaximized ? undefined : { width: consoleResize.width }}
            className={`flex flex-col ${panelMaximized ? "flex-1 min-w-0" : "shrink-0"}`}
          >
            <div className="flex items-center justify-between h-8 border-b border-(--border-hairline) bg-(--surface-panel) shrink-0 text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
              <span className="px-3">{PANEL_LABELS[rightPanel]}</span>
              <button
                title={panelMaximized ? "Restore layout" : "Maximize panel"}
                aria-label={panelMaximized ? "Restore layout" : "Maximize panel"}
                onClick={() => setPanelMaximized((v) => !v)}
                className="mr-2 p-1 rounded normal-case text-(--text-tertiary) hover:bg-white/10 hover:text-(--text-primary)"
              >
                {panelMaximized ? <IconMinimize className="w-3.5 h-3.5" /> : <IconMaximize className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {rightPanel === "console" ? (
                <OutputPanel running={running} result={runResult} />
              ) : rightPanel === "preview" ? (
                <PreviewPanel manifest={previewManifest} entryPath={previewEntryPath} devServerUrl={devServerUrl} />
              ) : (
                <AgentPanel ctx={agentCtx} storageKey={projectId} onRunningChange={setAgentBusy} />
              )}
            </div>
          </div>
        )}
      </div>
      <StatusBar filename={activeFile?.name ?? null} cursor={activeFile ? cursor : null} />
    </div>
  );
}
