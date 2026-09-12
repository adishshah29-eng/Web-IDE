# Online IDE — Architecture & File Reference

A browser-based, multi-language IDE built with Next.js. It has two independent
"workspace" modes that share the same UI components:

- **Cloud mode** (`/project/[id]`) — files live in Supabase (Postgres), so a
  project can be reopened from any browser.
- **Local mode** (`/local`) — files live on the user's own disk, opened via
  the browser's File System Access API. Nothing is uploaded anywhere.

Code execution (the "Run" button) is proxied server-side to the public
Judge0 CE API, which compiles/runs the submitted source in an isolated
sandbox and returns stdout/stderr/exit code.

---

## 1. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router, Turbopack)** | Single project for both frontend pages and backend API routes — no separate server needed. |
| Language | **TypeScript** | Type safety across API routes, DB rows, and the tree/file data model. |
| UI styling | **Tailwind CSS v4** | Utility classes + CSS custom properties (`--surface-panel`, `--accent`, etc. — see `globals.css`) for a themeable dark IDE look. |
| Code editor | **Monaco Editor** (`@monaco-editor/react`) | The actual VS Code editor component — real syntax highlighting, bracket matching, multi-cursor, minimap-capable. Loaded from CDN. |
| Cloud persistence | **Supabase** (hosted Postgres + auto-generated REST API via PostgREST) | No custom DB server to run; `@supabase/supabase-js` talks to it directly from Next.js API routes using the public anon key. |
| Local persistence | **File System Access API** (`showDirectoryPicker`) + **IndexedDB** | Lets the browser read/write real files on disk (Chrome/Edge only); IndexedDB remembers which folder was last opened across refreshes. |
| Code execution | **Judge0 CE** (`https://ce.judge0.com`) | Free hosted sandboxed execution engine, supports 20+ languages, no infrastructure to run ourselves. |
| Preview | `srcDoc` on a sandboxed `<iframe>` | Renders a project's `index.html` (with its CSS/JS inlined) without needing a real HTTP server or Service Worker. |

---

## 2. High-level architecture

```
                         ┌─────────────────────────────┐
                         │         Browser (client)     │
                         │                              │
                         │  /            project list    │
                         │  /project/[id]  cloud workspace│
                         │  /local        local workspace │
                         └───────────┬──────────────────┘
                                     │
                 ┌───────────────────┼─────────────────────┐
                 │                   │                      │
                 ▼                   ▼                      ▼
        Next.js API routes    File System Access API   Judge0 CE (public API)
        /api/projects              (local disk,             /submissions
        /api/projects/[id]      no network round-trip)   (code execution)
        /api/files
        /api/run
                 │
                 ▼
        Supabase (Postgres + PostgREST)
        tables: projects, files
```

Both workspace pages (`project/[id]/page.tsx` and `local/page.tsx`) render
the **same** set of shared UI components (`FileTree`, `Tabs`, `Editor`,
`OutputPanel`, `PreviewPanel`, `StatusBar`). Those components only know about
a backend-agnostic `WorkspaceNode` shape (`id`, `name`, `type`,
`children?`) — they never call Supabase or the filesystem directly. Each
page supplies its own `onCreateNode` / `onRenameNode` / `onDeleteNode`
callbacks that do the actual persistence, which is what lets one codebase
run in "cloud" and "local" mode without duplicating the editor UI.

---

## 3. Data model (Supabase / cloud mode only)

Defined in [`supabase/schema.sql`](supabase/schema.sql):

```sql
projects
  id          uuid primary key
  name        text
  created_at  timestamptz

files
  id          uuid primary key
  project_id  uuid  -> projects.id (cascade delete)
  parent_id   uuid  -> files.id, nullable (cascade delete)   -- null = root level
  name        text
  type        text  ('file' | 'folder')
  content     text  (null for folders)
  created_at  timestamptz
  updated_at  timestamptz
```

This is a classic **adjacency-list tree**: every row points at its parent
folder via `parent_id`. `src/lib/types.ts`'s `buildTree()` turns the flat
row list returned by Supabase into a nested tree the UI can render.

Row-level security is enabled but wide open (`using (true)`) since there's
no auth yet — anyone with the anon key can read/write any row. This is
called out in the schema file as temporary.

---

## 4. Directory-by-directory file reference

### `supabase/`
- **`schema.sql`** — the two tables above, indexes on `project_id`/`parent_id`,
  and the (temporarily) open RLS policies. Run once in the Supabase SQL
  Editor to provision a new project's database.

### `src/app/` — pages and API routes (Next.js App Router)

- **`layout.tsx`** — root HTML shell. Wraps every page in `ToastProvider`
  (bottom-right notifications) and `DialogProvider` (custom prompt/confirm
  modals — replaces the ugly native `window.prompt`/`confirm`).
- **`page.tsx`** (`/`) — the landing/project-list page. Lists Supabase
  projects, lets you create a new one, delete one, or click **"Open a Local
  Folder"** (feature-detected — only enabled in Chromium browsers) which
  triggers `showDirectoryPicker()`, saves the handle to IndexedDB, and routes
  to `/local`.
- **`globals.css`** — Tailwind v4 entry point + the CSS custom properties
  that theme the whole app (`--surface-panel`, `--surface-editor`, `--accent`,
  `--accent-run`, `--accent-stop`, `--border-hairline`, `--font-mono`, etc.).
- **`project/[id]/page.tsx`** — **cloud workspace**. On mount, fetches
  `/api/projects/[id]` for the project + file tree. Manages: open tabs, the
  active file, unsaved/dirty state, debounced auto-save (900ms after the last
  keystroke, via `PATCH /api/files`), the Console/Preview tab switcher, the
  Run button (calls `/api/run`), and resizable sidebar/console panels. Guards
  against race conditions when the tree reloads (a `loadSeq` ref discards
  any stale in-flight response older than the newest request).
- **`local/page.tsx`** — **local-folder workspace**. Mirrors the cloud page's
  structure and behavior, but every persistence call goes through
  `src/lib/localFs.ts` (real filesystem reads/writes) instead of `fetch()`.
  Has an explicit status machine (`loading` → `no-folder` /
  `needs-permission` / `ready` / `unsupported` / `error`) because, unlike
  Supabase, local mode has real permission and browser-support edge cases to
  surface to the user. Folder rename is intentionally unsupported (the File
  System Access API has no rename primitive for directories).
- **`api/projects/route.ts`** — `GET` (list all projects), `POST` (create
  one). `dynamic = "force-dynamic"` so Next.js never serves a cached list
  after a create/delete.
- **`api/projects/[id]/route.ts`** — `GET` (one project + its full file tree,
  built via `buildTree()`), `DELETE` (cascades to all its files via the FK).
- **`api/files/route.ts`** — `POST` (create a file/folder), `PATCH` (rename /
  edit content / move — whichever fields are present in the body), `DELETE`
  (remove one row; folder deletes cascade to children via the FK).
- **`api/run/route.ts`** — takes `{ filename, content }`, resolves the
  language via `languageMap.ts`, and calls `judge0.ts` to execute it,
  returning `{ stdout, stderr, exitCode, compileStderr }`.

### `src/components/` — shared, backend-agnostic UI

- **`FileTree.tsx`** — recursive file/folder tree. Create/rename/delete are
  delegated to the parent page via `onCreateNode`/`onRenameNode`/
  `onDeleteNode` props, each returning `{ ok, error? }` so the tree can show
  a toast on failure without knowing *why* it failed (network vs. filesystem
  permission vs. validation).
- **`Editor.tsx`** — thin wrapper around Monaco. Maps the open file's
  extension to a Monaco language id (via `languageMap.ts`), reports cursor
  position up to the parent for the status bar, dark ("vs-dark") theme,
  `automaticLayout: true` so it resizes correctly inside the resizable
  panels.
- **`Tabs.tsx`** — open-file tabs. Each tab shows a dot for unsaved changes
  that swaps to a close (×) button on hover — the classic macOS
  document-proxy pattern — instead of showing both at once.
- **`OutputPanel.tsx`** — renders the Run result: a colored status dot
  (idle/running/succeeded/failed), stdout, stderr, and compiler output.
- **`PreviewPanel.tsx`** — renders a live preview of the project's HTML entry
  point inside a sandboxed `<iframe>` using `srcDoc`, with three device-size
  toggle buttons (phone 375×667, tablet 768×1024, laptop 1280×800) and a
  manual reload button.
- **`StatusBar.tsx`** — bottom bar: current file's language label and
  `Ln X, Col Y · UTF-8` cursor position.
- **`Modal.tsx`** — generic centered dialog shell (backdrop blur, Escape to
  close, reduced-motion aware) used by both providers below.
- **`DialogProvider.tsx`** — app-wide `useDialog()` hook exposing
  `prompt()`/`confirm()` as promises, so any component can
  `await dialog.confirm(...)` instead of the browser's native (and
  unstyleable) `window.confirm`.
- **`ToastProvider.tsx`** — app-wide `useToast()` hook for transient
  bottom-right notifications (success/error/info), auto-dismiss after 4s.
- **`icons.tsx`** — every icon used in the app as a small inline SVG
  component (no icon-font/library dependency).

### `src/lib/` — framework-agnostic logic

- **`types.ts`** — the shared `WorkspaceNode`/`TreeNode`/`FileNode`/`Project`
  interfaces, plus `buildTree()` (flat Supabase rows → nested tree, folders
  sorted before files, alphabetically) and `findNode()` (recursive lookup by
  id).
- **`supabase.ts`** — creates the single `supabase` client using
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon/publishable
  key only — never the service-role/secret key, since this runs in
  server-side API routes that are still reachable per-request, not a trusted
  backend process).
- **`judge0.ts`** — one function, `executeCode(languageId, sourceCode)`,
  which POSTs to Judge0 CE's `/submissions?wait=true` endpoint and normalizes
  the response into `{ stdout, stderr, exitCode, compileStderr }`.
- **`languageMap.ts`** — the single source of truth mapping a file extension
  to (a) its Monaco syntax-highlighting language id and (b) its Judge0
  numeric language id + human label. Also lists syntax-only languages
  (HTML/CSS/JSON/Markdown/YAML/SQL) that Monaco can highlight but Judge0
  can't execute, so the Run button correctly disables itself for those.
- **`fileIcons.ts`** — per-extension icon color (for the file tree) and a
  broader display-label map (for the status bar) than `languageMap.ts`
  covers, since the status bar needs to label non-runnable files too.
- **`http.ts`** — `parseErrorBody()`, a small helper that turns a failed
  `fetch` response into a user-readable error string (falls back to a
  generic "check your `.env.local`" hint if the response isn't JSON, which
  is what a misconfigured Supabase connection actually returns).
- **`localFs.ts`** — all File System Access API operations: recursively
  walking a directory into a `WorkspaceNode` tree (skipping `node_modules`,
  `.git`, `.next`, etc.), reading/writing file contents, creating/deleting
  entries, and a best-effort file rename (read old → write new name →
  delete old, since the API has no native rename).
- **`localHandleStore.ts`** — persists the picked `FileSystemDirectoryHandle`
  in IndexedDB (handles are structured-cloneable) so a page refresh doesn't
  force the user back through the native folder picker — just a quick
  re-grant of permission. Also wraps `queryPermission`/`requestPermission`.
- **`pendingLocalHandle.ts`** — an in-memory (not persisted) handoff slot: a
  handle picked via `showDirectoryPicker()` can't survive a serialization
  boundary (URL/query string), so it's stashed here for the one
  client-side navigation from `/` to `/local`, then read once and cleared.
- **`previewFiles.ts`** — builds the self-contained HTML document used by
  `PreviewPanel`: walks the tree to a flat path→content manifest, picks the
  right HTML entry point (active file if HTML, else `index.html`, else the
  first HTML file found), and inlines every local `<link rel="stylesheet">`
  and `<script src>` it references (external `http(s)://` references are
  left untouched) so the whole page can be handed to an iframe as one
  `srcDoc` string with no server needed.
- **`useResizableWidth.ts`** — a small hook backing the draggable
  sidebar/console panels: tracks width in state, persists it to
  `localStorage` per-panel, and clamps it to a min/max range while dragging.

### `src/types/`
- **`file-system-access.d.ts`** — hand-written TypeScript ambient
  declarations filling in the parts of the File System Access API
  (`entries()`/`values()`/`keys()` on directory handles,
  `requestPermission`/`queryPermission`, `window.showDirectoryPicker`) that
  TypeScript's bundled DOM types don't yet include.

### Project root
- **`package.json`** — dependencies: `next`, `react`/`react-dom`,
  `@monaco-editor/react`, `@supabase/supabase-js`; dev: `typescript`,
  `tailwindcss`/`@tailwindcss/postcss`, `eslint`/`eslint-config-next`.
- **`.gitignore`** — excludes `node_modules`, `.next`, all `.env*` files
  (with `!.env*.example` so the template *is* tracked), `.vercel`, build
  artifacts.
- **`AGENTS.md`** / **`CLAUDE.md`** — instructions for AI coding agents
  working in this repo (points at the locally-installed Next.js docs since
  this Next.js version has behavior that can differ from training data).

---

## 5. Key flows

### Opening and editing a cloud project
1. `page.tsx` → `POST /api/projects` → redirect to `/project/[id]`.
2. `project/[id]/page.tsx` fetches `GET /api/projects/[id]` → `{ project, tree }`.
3. Clicking a file in `FileTree` opens a tab (`Tabs.tsx`) and loads its
   `content` into `Editor.tsx`.
4. Typing debounces for 900ms, then fires `PATCH /api/files` with the new
   `content` — auto-save, no explicit Ctrl+S needed (though it's bound too).
5. Create/rename/delete in the tree call `POST`/`PATCH`/`DELETE
   /api/files` respectively, then reload the tree.

### Opening and editing a local folder
1. `/` → `showDirectoryPicker()` → handle saved to IndexedDB and stashed in
   `pendingLocalHandle` → navigate to `/local`.
2. `/local` takes the pending handle (or loads the last one from IndexedDB
   on a fresh reload) → `ensureReadWritePermission()` → `buildLocalTree()`.
3. All edits are debounced writes straight to disk via `writeLocalFile()` —
   no network involved at all.

### Running code
1. User clicks Run on an open file → `POST /api/run` with `{ filename, content }`.
2. The route looks up the Judge0 language id for that extension, calls
   Judge0 CE's `/submissions` endpoint with `wait=true` (synchronous — waits
   for the run to finish before responding).
3. Result renders in `OutputPanel` (stdout/stderr/exit code/compile errors).

### Previewing an HTML/CSS/JS project
1. `previewFiles.ts` builds a manifest of every text file, keyed by its
   relative path.
2. It picks an entry point HTML file and inlines that file's local
   stylesheet and script references directly into the document.
3. `PreviewPanel` drops the resulting HTML string into a sandboxed
   `<iframe srcDoc=...>` sized to whichever device preset (phone/tablet/
   laptop) is selected.

---

## 6. Environment variables

Required in `.env.local` (never committed — see `.env.local.example` for the
template):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/public key>
```

Only the **anon/public** key is ever used — the Supabase `service_role`/
secret key must never be placed in this project (client-exposed `NEXT_PUBLIC_*`
vars are bundled into the browser, and even server-side, RLS is meant to be
the security boundary here since there's no separate trusted backend).

---

## 7. Explicitly out of scope (not built yet)

- Authentication / multi-user accounts
- Real-time collaborative editing (the original "Google Docs for code" idea)
- Git integration for local-folder mode
- Running actual backend/server processes (only static HTML/CSS/JS preview)
- Binary asset support (images, fonts) in the preview
- Folder rename in local mode (File System Access API limitation)
