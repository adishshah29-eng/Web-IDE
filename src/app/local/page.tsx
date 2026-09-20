"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { findNode, type WorkspaceNode } from "@/lib/types";
import { isRunnable } from "@/lib/languageMap";
import { IconBack, IconPlay, IconFolder, IconMaximize, IconMinimize, IconClose } from "@/components/icons";
import { useToast } from "@/components/ToastProvider";
import { useDialog } from "@/components/DialogProvider";
import { useResizableWidth } from "@/lib/useResizableWidth";
import { useResizableHeight } from "@/lib/useResizableHeight";
import { flattenTreeWithPaths, hasHtmlEntry, isPreviewableFile, pickPreviewEntry } from "@/lib/previewFiles";
import type { AgentFileContext } from "@/lib/agent/useAgent";
import { ensureParentFolder } from "@/lib/agent/pathOps";
import { getWebContainer, subscribeDevServerUrl } from "@/lib/webcontainer/instance";
import { buildFileSystemTree } from "@/lib/webcontainer/fileTree";
import {
  buildLocalTree,
  createLocalEntry,
  deleteLocalEntry,
  isFileSystemAccessSupported,
  readLocalFile,
  renameLocalFile,
  writeLocalFile,
  type LocalEntry,
} from "@/lib/localFs";
import {
  loadDirectoryHandle,
  saveDirectoryHandle,
  ensureReadWritePermission,
} from "@/lib/localHandleStore";
import { takePendingDirectoryHandle } from "@/lib/pendingLocalHandle";

const AUTOSAVE_DELAY_MS = 900;

const PANEL_LABELS: Record<"console" | "preview" | "agent", string> = {
  console: "Console",
  preview: "Preview",
  agent: "Agent",
};

type Status = "loading" | "no-folder" | "needs-permission" | "ready" | "unsupported" | "error";

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

export default function LocalFolderPage() {
  const toast = useToast();
  const dialog = useDialog();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState("");
  const [tree, setTree] = useState<WorkspaceNode[]>([]);
  const entriesRef = useRef<Map<string, LocalEntry>>(new Map());
  // See the matching comment in the cloud workspace page: the agent's tool
  // closures are fixed for the life of one run() call, so they need to read
  // through a ref to see a write_file's effect on a later run_code in the
  // same turn instead of a stale pre-write tree snapshot.
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  });

  const [openFiles, setOpenFiles] = useState<OpenFileState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const openFilesRef = useRef(openFiles);
  useEffect(() => {
    openFilesRef.current = openFiles;
  });

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [rightPanel, setRightPanel] = useState<"console" | "preview" | "agent">("console");
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [panelMaximized, setPanelMaximized] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [devServerUrl, setDevServerUrl] = useState<string | null>(null);
  useEffect(() => subscribeDevServerUrl(setDevServerUrl), []);

  const selectRightPanel = (panel: "console" | "preview" | "agent") => {
    if (panel === rightPanel && rightPanelVisible) {
      setRightPanelVisible(false);
      setPanelMaximized(false);
    } else {
      setRightPanel(panel);
      setRightPanelVisible(true);
    }
  };
  const [previewManifest, setPreviewManifest] = useState<Record<string, string> | null>(null);
  const [cursor, setCursor] = useState<CursorPosition | null>(null);

  const sidebarResize = useResizableWidth("ide.sidebarWidth", 240, 160, 480, "right");
  const consoleResize = useResizableWidth("ide.consoleWidth", 384, 240, 640, "left");
  const terminalResize = useResizableHeight("ide.terminalHeight", 260, 140, 560);

  // Local content isn't all in memory like the cloud tree, so building the
  // manifest means reading every previewable file from disk (skipping ones
  // already open, which use their live — possibly unsaved — content).
  const buildPreviewManifest = useCallback(async () => {
    const manifest: Record<string, string> = {};
    for (const { path, node } of flattenTreeWithPaths(tree)) {
      if (!isPreviewableFile(path)) continue;
      const open = openFilesRef.current.find((f) => f.id === node.id);
      if (open) {
        manifest[path] = open.content;
        continue;
      }
      const entry = entriesRef.current.get(path);
      if (entry && entry.handle.kind === "file") {
        try {
          manifest[path] = await readLocalFile(entry.handle);
        } catch {
          // skip a file that can't be read rather than failing the whole preview
        }
      }
    }
    setPreviewManifest(manifest);
  }, [tree]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebuilding the preview manifest from disk when the tab is switched to, not a plain data fetch
    if (rightPanel === "preview") buildPreviewManifest();
  }, [rightPanel, buildPreviewManifest]);

  const previewEntryPath = useMemo(
    () => (previewManifest ? pickPreviewEntry(Object.keys(previewManifest), activeId) : null),
    [previewManifest, activeId]
  );

  const canPreview = useMemo(() => hasHtmlEntry(tree), [tree]);

  const refreshTree = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      try {
        const { tree: nextTree, entries } = await buildLocalTree(handle);
        entriesRef.current = entries;
        setTree(nextTree);
        // Synchronous, same reasoning as the cloud workspace page — a caller
        // awaiting refreshTree() and reading treeRef.current right after
        // shouldn't have to wait on React's own render/effect cycle.
        treeRef.current = nextTree;
      } catch {
        toast.show("Couldn't read the folder contents.", "error");
      }
    },
    [toast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isFileSystemAccessSupported()) {
          if (!cancelled) setStatus("unsupported");
          return;
        }
        let handle = takePendingDirectoryHandle();
        if (!handle) {
          handle = await loadDirectoryHandle();
        }
        if (!handle) {
          if (!cancelled) setStatus("no-folder");
          return;
        }
        if (cancelled) return;
        setDirHandle(handle);
        setFolderName(handle.name);
        const perm = await handle.queryPermission({ mode: "readwrite" });
        if (cancelled) return;
        if (perm === "granted") {
          await refreshTree(handle);
          if (!cancelled) setStatus("ready");
        } else {
          setStatus("needs-permission");
        }
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : "Couldn't open the stored folder.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTree]);

  const grantAccess = async () => {
    if (!dirHandle) return;
    try {
      const result = await ensureReadWritePermission(dirHandle);
      if (result === "granted") {
        await refreshTree(dirHandle);
        setStatus("ready");
      } else {
        toast.show("Access wasn't granted, so this folder can't be opened.", "error");
      }
    } catch {
      toast.show("Couldn't request folder access.", "error");
    }
  };

  const pickFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveDirectoryHandle(handle);
      setDirHandle(handle);
      setFolderName(handle.name);
      await refreshTree(handle);
      setStatus("ready");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.show("Couldn't open that folder.", "error");
    }
  };

  // Keep open tabs in sync with the tree: drop tabs whose file was deleted
  // elsewhere, and pick up renames for non-dirty tabs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling local tab state against the freshly-walked directory tree
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

  const openFile = async (node: WorkspaceNode) => {
    if (node.type !== "file") return;
    if (openFilesRef.current.some((f) => f.id === node.id)) {
      setActiveId(node.id);
      return;
    }
    const entry = entriesRef.current.get(node.id);
    if (!entry || entry.handle.kind !== "file") {
      toast.show("Couldn't find that file.", "error");
      return;
    }
    try {
      const content = await readLocalFile(entry.handle);
      setActiveId(node.id);
      setOpenFiles((prev) => [...prev, { id: node.id, name: node.name, content, dirty: false }]);
    } catch {
      toast.show("Couldn't read that file.", "error");
    }
  };

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAutoSaveTimer = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  };

  const saveFile = useCallback(
    async (id: string) => {
      const file = openFilesRef.current.find((f) => f.id === id);
      if (!file || !file.dirty) return;
      const entry = entriesRef.current.get(id);
      if (!entry || entry.handle.kind !== "file") {
        toast.show("Couldn't find that file on disk.", "error");
        return;
      }
      setSaving(true);
      try {
        await writeLocalFile(entry.handle, file.content);
        setOpenFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, dirty: false } : f)));
        if (rightPanel === "preview") buildPreviewManifest();
      } catch {
        toast.show("Couldn't save — check the folder's permissions.", "error");
      } finally {
        setSaving(false);
      }
    },
    [toast, rightPanel, buildPreviewManifest]
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
    setOpenFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, content, dirty: true } : f)));
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
      const parentHandle = parentId ? entriesRef.current.get(parentId)?.handle : dirHandle;
      if (!parentHandle || parentHandle.kind !== "directory") {
        return { ok: false, error: "Couldn't find that folder." };
      }
      try {
        const handle = await createLocalEntry(parentHandle, name, type);
        if (type === "file" && content) {
          await writeLocalFile(handle as FileSystemFileHandle, content);
        }
        await refreshTree(dirHandle!);
        const id = parentId ? `${parentId}/${name}` : name;
        if (type === "file") {
          setActiveId(id);
          setOpenFiles((prev) =>
            prev.some((f) => f.id === id) ? prev : [...prev, { id, name, content: content ?? "", dirty: false }]
          );
        }
        return { ok: true, id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Couldn't create it." };
      }
    },
    [dirHandle, refreshTree]
  );

  const renameNode = useCallback(
    async (id: string, name: string): Promise<OpResult> => {
      const entry = entriesRef.current.get(id);
      if (!entry) return { ok: false, error: "Couldn't find that item." };
      if (entry.handle.kind === "directory") {
        return { ok: false, error: "Renaming folders isn't supported in local mode yet — only files." };
      }
      const node = findNode(tree, id);
      if (!node) return { ok: false, error: "Couldn't find that item." };
      try {
        await renameLocalFile(entry.parentHandle, node.name, name);
        await refreshTree(dirHandle!);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Couldn't rename it." };
      }
    },
    [dirHandle, tree, refreshTree]
  );

  const deleteNode = useCallback(
    async (id: string): Promise<OpResult> => {
      const entry = entriesRef.current.get(id);
      const node = findNode(tree, id);
      if (!entry || !node) return { ok: false, error: "Couldn't find that item." };
      try {
        await deleteLocalEntry(entry.parentHandle, node.name, node.type === "folder");
        await refreshTree(dirHandle!);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete it." };
      }
    },
    [dirHandle, tree, refreshTree]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
      } else if (e.key === "b") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, saveActive, closeTab]);

  const agentCtx = useMemo<AgentFileContext>(
    () => ({
      listFiles: () => flattenTreeWithPaths(treeRef.current).map((f) => f.path),
      readFile: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) throw new Error(`No file at "${path}".`);
        const open = openFilesRef.current.find((f) => f.id === match.node.id);
        if (open) return open.content;
        const entry = entriesRef.current.get(match.node.id);
        if (!entry || entry.handle.kind !== "file") throw new Error(`Couldn't read "${path}".`);
        return readLocalFile(entry.handle);
      },
      runFile: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) throw new Error(`No file at "${path}".`);
        if (!isRunnable(match.node.name)) throw new Error(`"${path}" isn't a runnable file type.`);
        const open = openFilesRef.current.find((f) => f.id === match.node.id);
        let content: string;
        if (open) {
          content = open.content;
        } else {
          const entry = entriesRef.current.get(match.node.id);
          if (!entry || entry.handle.kind !== "file") throw new Error(`Couldn't read "${path}".`);
          content = await readLocalFile(entry.handle);
        }
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
        if (open) return open.content;
        const entry = entriesRef.current.get(match.node.id);
        if (!entry || entry.handle.kind !== "file") return null;
        try {
          return await readLocalFile(entry.handle);
        } catch {
          return null;
        }
      },
      applyWrite: async (path, content) => {
        // See the matching comment in the cloud workspace page — a maximized
        // panel hides the editor and sidebar entirely, which is the main way
        // an agent-created or agent-edited file looks like it "vanished".
        setPanelMaximized(false);
        setSidebarVisible(true);

        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (match) {
          const entry = entriesRef.current.get(match.node.id);
          if (!entry || entry.handle.kind !== "file") throw new Error(`Couldn't write "${path}".`);
          await writeLocalFile(entry.handle, content);
          setActiveId(match.node.id);
          setOpenFiles((prev) =>
            prev.some((f) => f.id === match.node.id)
              ? prev.map((f) => (f.id === match.node.id ? { ...f, content, dirty: false } : f))
              : [...prev, { id: match.node.id, name: match.node.name, content, dirty: false }]
          );
          return;
        }
        const { parentId, leafName, error } = await ensureParentFolder(treeRef.current, path, createNode);
        if (error) throw new Error(error);
        const result = await createNode(parentId, leafName, "file", content);
        if (!result.ok) throw new Error(result.error || "Couldn't create the file.");
      },
      applyDelete: async (path) => {
        const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
        if (!match) throw new Error(`No file at "${path}".`);
        const result = await deleteNode(match.node.id);
        if (!result.ok) throw new Error(result.error || "Couldn't delete the file.");
        setOpenFiles((prev) => prev.filter((f) => f.id !== match.node.id));
      },
      runCommand: async (command) => {
        const wc = await getWebContainer();
        const files = await buildFileSystemTree({
          listFiles: () => flattenTreeWithPaths(treeRef.current).map((f) => f.path),
          getContent: async (path) => {
            const match = flattenTreeWithPaths(treeRef.current).find((f) => f.path === path);
            if (!match) return null;
            const open = openFilesRef.current.find((f) => f.id === match.node.id);
            if (open) return open.content;
            const entry = entriesRef.current.get(match.node.id);
            if (!entry || entry.handle.kind !== "file") return null;
            try {
              return await readLocalFile(entry.handle);
            } catch {
              return null;
            }
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
    [createNode, deleteNode]
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-(--surface-panel) text-(--text-secondary) p-6 text-sm">
        Loading…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <CenteredMessage
        title="Not supported in this browser"
        message="Local folder editing uses the File System Access API, which only Chrome and Edge support right now — not Firefox or Safari."
      />
    );
  }

  if (status === "error") {
    return <CenteredMessage title="Something went wrong" message={errorMsg ?? "Unknown error."} />;
  }

  if (status === "no-folder") {
    return (
      <CenteredMessage title="No folder open" message="Pick a folder from your computer to start editing.">
        <button
          onClick={pickFolder}
          className="mt-4 bg-(--accent) hover:brightness-110 text-white px-4 h-9 rounded-md text-[13px] font-medium transition"
        >
          Choose Folder
        </button>
      </CenteredMessage>
    );
  }

  if (status === "needs-permission") {
    return (
      <CenteredMessage
        title={`Reopen "${folderName}"?`}
        message="Your browser needs you to re-grant access to this folder after a reload."
      >
        <button
          onClick={grantAccess}
          className="mt-4 bg-(--accent) hover:brightness-110 text-white px-4 h-9 rounded-md text-[13px] font-medium transition"
        >
          Grant Access
        </button>
      </CenteredMessage>
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

        <div className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-(--text-secondary) truncate">
          <IconFolder className="w-3.5 h-3.5 text-(--accent) shrink-0" />
          {folderName}
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
                        ? "This folder is empty"
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
                    <TerminalPanel source={agentCtx} onSync={() => dirHandle && refreshTree(dirHandle)} />
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
                <AgentPanel ctx={agentCtx} storageKey={`local:${folderName}`} onRunningChange={setAgentBusy} />
              )}
            </div>
          </div>
        )}
      </div>
      <StatusBar filename={activeFile?.name ?? null} cursor={activeFile ? cursor : null} />
    </div>
  );
}

function CenteredMessage({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-(--surface-panel) text-(--text-primary) p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-[17px] font-semibold mb-2">{title}</h1>
        <p className="text-(--text-secondary) text-[13px] leading-relaxed">{message}</p>
        {children}
        <div className="mt-4">
          <Link href="/" className="inline-flex items-center gap-1 text-(--accent) hover:underline text-[13px]">
            <IconBack className="w-3 h-3" /> Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
