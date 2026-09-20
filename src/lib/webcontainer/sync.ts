import type { WebContainer } from "@webcontainer/api";

export interface SyncTarget {
  applyWrite: (path: string, content: string) => Promise<void>;
  applyDelete: (path: string) => Promise<void>;
  /** Called (debounced) after a change is synced, so the file tree UI catches up. */
  onSync?: () => void;
}

// Never mirror these back into the project — node_modules alone can be tens
// of thousands of file-write events from a single `npm install`.
const IGNORED_SEGMENTS = new Set(["node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv"]);

function isIgnored(path: string): boolean {
  return path.split("/").some((seg) => IGNORED_SEGMENTS.has(seg));
}

// Mirrors changes made inside the WebContainer (via the terminal, or the
// agent's run_command) back into the project's real persistence — Supabase
// in cloud mode, actual disk in local mode — so `mkdir`/`npm create`/etc.
// show up in the file tree instead of only existing in the sandbox.
export function watchAndSync(wc: WebContainer, target: SyncTarget): () => void {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRefresh = () => {
    if (!target.onSync) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => target.onSync?.(), 500);
  };

  const watcher = wc.fs.watch(".", { recursive: true }, (_event, filename) => {
    if (typeof filename !== "string" || isIgnored(filename)) return;
    void (async () => {
      try {
        const content = await wc.fs.readFile(filename, "utf-8");
        await target.applyWrite(filename, content);
        scheduleRefresh();
      } catch (e) {
        // ENOENT = the path no longer exists — treat as a delete.
        // Anything else (EISDIR for a directory event, transient errors
        // mid-write) isn't actionable here, so it's dropped.
        const code = (e as { code?: string } | undefined)?.code;
        if (code === "ENOENT") {
          try {
            await target.applyDelete(filename);
            scheduleRefresh();
          } catch {
            // already gone from the target too — fine
          }
        }
      }
    })();
  });

  return () => {
    watcher.close();
    if (refreshTimer) clearTimeout(refreshTimer);
  };
}
