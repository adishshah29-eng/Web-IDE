import type { WorkspaceNode } from "@/lib/types";

export function findNodeByPath(tree: WorkspaceNode[], path: string): WorkspaceNode | null {
  const segments = path.split("/").filter(Boolean);
  let nodes = tree;
  let node: WorkspaceNode | null = null;
  for (const seg of segments) {
    node = nodes.find((n) => n.name === seg) ?? null;
    if (!node) return null;
    nodes = node.children ?? [];
  }
  return node;
}

export interface CreateNodeResult {
  ok: boolean;
  error?: string;
  id?: string;
}

// Resolves the parent folder id for a file path, creating any missing
// intermediate folders along the way. Segments that already exist are
// walked from the given tree snapshot; once a segment is missing, every
// segment after it is freshly created (its parent was just created, so it
// has no children yet — no need to keep checking the stale snapshot).
export async function ensureParentFolder(
  tree: WorkspaceNode[],
  fullPath: string,
  createNode: (parentId: string | null, name: string, type: "folder") => Promise<CreateNodeResult>
): Promise<{ parentId: string | null; leafName: string; error?: string }> {
  const segments = fullPath.split("/").filter(Boolean);
  const leafName = segments.pop();
  if (!leafName) return { parentId: null, leafName: fullPath, error: "Empty file path." };

  let parentId: string | null = null;
  let nodes: WorkspaceNode[] = tree;
  let creatingFresh = false;

  for (const seg of segments) {
    if (!creatingFresh) {
      const existing = nodes.find((n) => n.name === seg && n.type === "folder");
      if (existing) {
        parentId = existing.id;
        nodes = existing.children ?? [];
        continue;
      }
      creatingFresh = true;
    }
    const result = await createNode(parentId, seg, "folder");
    if (!result.ok) return { parentId: null, leafName, error: result.error ?? `Couldn't create folder "${seg}".` };
    if (!result.id) return { parentId: null, leafName, error: `Folder "${seg}" was created but its id wasn't returned.` };
    parentId = result.id;
    nodes = [];
  }

  return { parentId, leafName };
}
