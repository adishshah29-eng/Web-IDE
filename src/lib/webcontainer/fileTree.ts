import type { FileSystemTree } from "@webcontainer/api";

export interface FileSource {
  listFiles: () => string[];
  getContent: (path: string) => Promise<string | null>;
}

// Converts the app's flat "list of paths + content getter" (the same shape
// the agent already uses) into WebContainer's nested FileSystemTree shape.
export async function buildFileSystemTree(source: FileSource): Promise<FileSystemTree> {
  const tree: FileSystemTree = {};

  for (const path of source.listFiles()) {
    const content = await source.getContent(path);
    if (content === null) continue;

    const segments = path.split("/").filter(Boolean);
    const leaf = segments.pop();
    if (!leaf) continue;

    let node = tree;
    for (const seg of segments) {
      const existing = node[seg];
      if (existing && "directory" in existing) {
        node = existing.directory;
      } else {
        const dir: FileSystemTree = {};
        node[seg] = { directory: dir };
        node = dir;
      }
    }
    node[leaf] = { file: { contents: content } };
  }

  return tree;
}
