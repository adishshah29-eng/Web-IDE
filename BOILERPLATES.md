# Boilerplates & What's Next

Copy-paste templates for the patterns already used in this codebase, so
adding something new stays consistent with everything else. Followed by a
concrete list of what could be built next, roughly in priority order.

---

## 1. New Next.js API route

Path convention: `src/app/api/<name>/route.ts` (or `src/app/api/<name>/[id]/route.ts`
for a dynamic segment). Always add `dynamic = "force-dynamic"` on any route
whose data changes from a mutation elsewhere — Next.js will otherwise cache
GETs.

```ts
// src/app/api/<name>/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase.from("<table>").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("<table>").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

Dynamic `[id]` variant:

```ts
// src/app/api/<name>/[id]/route.ts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

**Client-side call convention** (always `cache: "no-store"`, always route
errors through `parseErrorBody`):

```ts
import { parseErrorBody } from "@/lib/http";

const res = await fetch("/api/<name>", { cache: "no-store" });
if (!res.ok) throw new Error(await parseErrorBody(res));
const data = await res.json();
```

---

## 2. New shared component (backend-agnostic)

Any component that appears in both cloud and local workspaces must not call
`fetch`/Supabase or `localFs.ts` directly — take data and callbacks as props
instead (see `FileTree.tsx` for the reference pattern).

```tsx
// src/components/<Name>.tsx
"use client";

interface <Name>Props {
  // ...
}

export default function <Name>({ /* ... */ }: <Name>Props) {
  return (
    <div className="h-full flex flex-col bg-(--surface-panel) text-(--text-primary)">
      {/* ... */}
    </div>
  );
}
```

Theme tokens already defined in `globals.css` — reuse these instead of raw
hex/Tailwind colors: `--surface-panel`, `--surface-editor`, `--surface-sidebar`,
`--surface-toolbar`, `--text-primary`, `--text-secondary`, `--text-tertiary`,
`--border-hairline`, `--border-hairline-strong`, `--accent`, `--accent-run`,
`--accent-stop`, `--font-mono`.

---

## 3. New context provider (global hook, e.g. `useToast`/`useDialog` pattern)

```tsx
// src/components/<Name>Provider.tsx
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface <Name>ContextValue {
  doThing: (arg: string) => void;
}

const <Name>Context = createContext<<Name>ContextValue | null>(null);

export function <Name>Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(/* ... */);

  const doThing = useCallback((arg: string) => {
    // ...
  }, []);

  return (
    <<Name>Context.Provider value={{ doThing }}>
      {children}
    </<Name>Context.Provider>
  );
}

export function use<Name>() {
  const ctx = useContext(<Name>Context);
  if (!ctx) throw new Error("use<Name> must be used within <Name>Provider");
  return ctx;
}
```

Register it in `src/app/layout.tsx` alongside `ToastProvider`/`DialogProvider`.

---

## 4. Adding a new runnable language

Everything for a new language lives in **one file**: `src/lib/languageMap.ts`.

1. Find its Judge0 language id from `https://ce.judge0.com/languages` (or
   `curl https://ce.judge0.com/languages`).
2. Add an entry:

```ts
// in extensionMap, src/lib/languageMap.ts
zig: { monacoLanguage: "zig" /* or "plaintext" if Monaco has no grammar for it */, judge0Id: 999, label: "Zig 0.13" },
```

3. (Optional) give it a file-tree icon color in `src/lib/fileIcons.ts`:

```ts
// in COLOR_BY_EXT, src/lib/fileIcons.ts
zig: "text-orange-300",
```

That's it — `Editor.tsx`, `StatusBar.tsx`, the Run button, and Judge0
execution all pick it up automatically through `getLangConfig`/
`getEditorLanguage`/`isRunnable`.

---

## 5. Adding a new previewable file type (for `PreviewPanel`)

Only matters for text-based assets referenced by an HTML entry point.

```ts
// in MIME_BY_EXT, src/lib/previewFiles.ts
webmanifest: "application/manifest+json",
```

Binary assets (images/fonts) aren't supported by the preview yet — see the
roadmap below.

---

## 6. New Supabase table (cloud-mode data)

```sql
-- append to supabase/schema.sql, then re-run in the Supabase SQL Editor
create table if not exists <table> (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  created_at  timestamptz not null default now()
  -- ...
);

alter table <table> enable row level security;
create policy "allow all on <table>" on <table> for all using (true) with check (true);
```

Then add the matching TypeScript interface next to `FileNode`/`Project` in
`src/lib/types.ts`, and a `src/lib/<table>.ts` if it needs its own
query/mutation helpers (mirroring `supabase.ts` usage in the API routes).

---

## 7. New workspace page (a third "mode", following cloud/local pattern)

```tsx
// src/app/<mode>/page.tsx
"use client";

import { useState } from "react";
import FileTree from "@/components/FileTree";
import Tabs from "@/components/Tabs";
import Editor from "@/components/Editor";
import StatusBar from "@/components/StatusBar";
import type { WorkspaceNode } from "@/lib/types";

export default function <Mode>Workspace() {
  const [tree, setTree] = useState<WorkspaceNode[]>([]);
  // wire up onCreateNode/onRenameNode/onDeleteNode against your new backend,
  // returning Promise<{ ok: boolean; error?: string }> like localFs.ts / the
  // Supabase API routes do — FileTree/Tabs/Editor don't need to change at all.

  return (
    <div className="flex h-screen bg-(--surface-panel)">
      {/* sidebar / editor / console, same 3-pane layout as project/[id]/page.tsx */}
    </div>
  );
}
```

---

## 8. `.env.local.example` template (already present, reproduced for reference)

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

Never add `SUPABASE_SERVICE_ROLE_KEY` or any `secret` key to this project —
only the anon key is meant to be used, from either client or server code,
since RLS is the security boundary (see `ARCHITECTURE.md` §6).

---

## 9. Minimal test boilerplate (none exist yet — see roadmap)

If/when tests are added, the natural split for this codebase:

```ts
// src/lib/__tests__/languageMap.test.ts  (pure function → plain unit test)
import { getLangConfig, isRunnable } from "@/lib/languageMap";

test("main.py resolves to Python", () => {
  expect(getLangConfig("main.py")?.label).toBe("Python 3.13");
  expect(isRunnable("main.py")).toBe(true);
});
```

```ts
// src/app/api/projects/__tests__/route.test.ts (API route → integration test against a Supabase test project, or a mocked client)
```

Recommended: **Vitest** for unit tests (fast, works natively with the App
Router's TS config) + **Playwright** for the end-to-end flows (create
project → add file → run → see output).

---

## What more can be done — prioritized

### High value, straightforward
1. **Keyboard shortcut for Save-all / Run** — `Ctrl/Cmd+S` to force-save the
   active tab immediately instead of waiting for the 900ms debounce;
   `Ctrl/Cmd+Enter` or `F5` to run. (Alt+ bindings already exist for
   tab/sidebar — this would follow the same pattern.)
2. **Binary asset support in Preview** — images/fonts referenced by
   `<img src>`/`@font-face` currently break the preview since
   `previewFiles.ts` only inlines text. Fix: read binary files as
   base64 and inline as `data:` URIs in the manifest.
3. **"Download project as .zip"** — cheap way to get work out of cloud mode
   without needing git yet. A few KB with `jszip` client-side.
4. **Undo/redo file-tree operations** — right now delete is destructive with
   only a confirm dialog. A simple "toast with Undo button, 5s window"
   pattern (delete only becomes permanent after the toast expires) is a
   nice safety net that doesn't require real versioning.
5. **Testing** — no tests exist anywhere yet (see §9 above). Even light
   coverage on `languageMap.ts`, `previewFiles.ts`, and `types.ts`'s
   `buildTree()` would catch regressions cheaply since they're pure
   functions.

### Medium effort, real feature additions
6. **Auth (Supabase Auth)** — the natural next phase per the original plan.
   Unlocks per-user projects and lets you finally tighten the wide-open RLS
   policies in `schema.sql` to `auth.uid() = owner_id`.
7. **Git integration for local mode** — `isomorphic-git` (pure-JS git,
   works against the File System Access API's handles) would let local
   mode show diff status, commit, and push without shelling out.
8. **Multiple file selection / drag-to-move in FileTree** — currently
   one-at-a-time create/rename/delete; drag-and-drop to reparent a file
   would make the tree feel more like a real IDE.
9. **Language Server-ish intellisense** — Monaco already ships TS/JS
   IntelliSense for free; wiring in `pyright`-in-browser (via Pyodide) or
   similar for Python would be the highest-impact single addition for the
   most commonly used language here.

### Larger, later-phase (matches your original roadmap)
10. **Real-time collaboration (CRDT)** — the original "Google Docs for
    code" goal. Would need a sync layer (Yjs is the standard choice) and a
    presence/awareness channel — natural to build on Supabase Realtime
    since you're already on Supabase.
11. **Running actual backend servers, not just static HTML/CSS/JS** — would
    require WebContainers (StackBlitz's in-browser Node runtime) or a real
    remote sandbox; a meaningfully bigger scope jump from the current
    Judge0-based one-shot execution model.
12. **Multi-user projects / sharing** — depends on auth (#6) landing first.

If you want, I can start on any single item above — the keyboard-shortcut
and binary-asset-preview items are both small enough to do in one pass right
now if you'd like to pick one.
