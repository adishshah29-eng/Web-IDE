import { Type, type FunctionDeclaration } from "@google/genai";

// Tool surface for the coding agent. Kept deliberately small — each tool is a
// thin wrapper around functionality the app already has (file tree, run
// endpoint), executed client-side since the server can't reach a local
// folder opened via the File System Access API.
export const AGENT_TOOLS: FunctionDeclaration[] = [
  {
    name: "list_files",
    description: "List every file path in the current project, so you know what exists before reading or editing anything.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: "read_file",
    description: "Read the full contents of one file by its path (e.g. \"main.py\" or \"src/utils/foo.js\").",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Path exactly as returned by list_files." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create a new file or overwrite an existing one with new content. The user reviews a diff and must approve it before anything is actually saved.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Path to create or overwrite, e.g. \"src/utils/foo.js\". Missing folders are created automatically." },
        content: { type: Type.STRING, description: "The full new file content — not a diff or patch." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Delete an existing file. The user reviews and must approve it before anything is actually deleted.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Path of the file to delete." },
      },
      required: ["path"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in a real Node.js/npm environment (npm install, npx create-vite, node scripts, npm run build, etc.). Not for Python or other non-Node languages — use run_code for those. Long-running commands (dev servers) will time out this call; start them, then check separately whether a preview URL became available instead of waiting on this call to finish.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "The full shell command, e.g. \"npm install\" or \"npx create-vite my-app --template react\"." },
      },
      required: ["command"],
    },
  },
  {
    name: "run_code",
    description: "Run an existing file's code and get back stdout, stderr, and the exit code. Only works on already-saved files in a runnable language.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "Path of the file to run." },
      },
      required: ["path"],
    },
  },
  {
    name: "finish",
    description: "Call this once the task is actually complete, with a short summary of what you found or did. Do not call it just to ask a clarifying question.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "One or two sentences summarizing the outcome." },
      },
      required: ["summary"],
    },
  },
];
