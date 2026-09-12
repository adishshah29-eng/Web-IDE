interface LangConfig {
  monacoLanguage: string;
  judge0Id: number;
  label: string;
}

// Judge0 language ids from https://ce.judge0.com/languages — picked recent, stable versions.
// monacoLanguage ids come from Monaco's built-in language list; most match the
// obvious name. Haskell isn't one of Monaco's bundled languages, so it falls
// back to plaintext (no highlighting, but still editable and still runnable).
const extensionMap: Record<string, LangConfig> = {
  js: { monacoLanguage: "javascript", judge0Id: 102, label: "JavaScript (Node.js 22)" },
  jsx: { monacoLanguage: "javascript", judge0Id: 102, label: "JavaScript (Node.js 22)" },
  ts: { monacoLanguage: "typescript", judge0Id: 101, label: "TypeScript 5.6" },
  tsx: { monacoLanguage: "typescript", judge0Id: 101, label: "TypeScript 5.6" },
  py: { monacoLanguage: "python", judge0Id: 109, label: "Python 3.13" },
  cpp: { monacoLanguage: "cpp", judge0Id: 105, label: "C++ (GCC 14)" },
  cc: { monacoLanguage: "cpp", judge0Id: 105, label: "C++ (GCC 14)" },
  c: { monacoLanguage: "c", judge0Id: 103, label: "C (GCC 14)" },
  java: { monacoLanguage: "java", judge0Id: 91, label: "Java (JDK 17)" },
  go: { monacoLanguage: "go", judge0Id: 107, label: "Go 1.23" },
  rs: { monacoLanguage: "rust", judge0Id: 108, label: "Rust 1.85" },
  php: { monacoLanguage: "php", judge0Id: 98, label: "PHP 8.3" },
  cs: { monacoLanguage: "csharp", judge0Id: 51, label: "C# (Mono)" },
  kt: { monacoLanguage: "kotlin", judge0Id: 111, label: "Kotlin 2.1" },
  scala: { monacoLanguage: "scala", judge0Id: 112, label: "Scala 3.4" },
  dart: { monacoLanguage: "dart", judge0Id: 90, label: "Dart 2.19" },
  rb: { monacoLanguage: "ruby", judge0Id: 72, label: "Ruby 2.7" },
  sh: { monacoLanguage: "shell", judge0Id: 46, label: "Bash 5.0" },
  bash: { monacoLanguage: "shell", judge0Id: 46, label: "Bash 5.0" },
  pl: { monacoLanguage: "perl", judge0Id: 85, label: "Perl 5.28" },
  r: { monacoLanguage: "r", judge0Id: 99, label: "R 4.4" },
  hs: { monacoLanguage: "plaintext", judge0Id: 61, label: "Haskell (GHC 8.8)" },
  lua: { monacoLanguage: "lua", judge0Id: 64, label: "Lua 5.3" },
  swift: { monacoLanguage: "swift", judge0Id: 83, label: "Swift 5.2" },
};

// File types Monaco can highlight but Judge0 can't run — used only for
// editor syntax highlighting, never for the Run button.
const MARKUP_MONACO_BY_EXT: Record<string, string> = {
  html: "html",
  htm: "html",
  css: "css",
  json: "json",
  md: "markdown",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
};

export function getLangConfig(filename: string): LangConfig | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return extensionMap[ext] ?? null;
}

export function isRunnable(filename: string): boolean {
  return getLangConfig(filename) !== null;
}

// Monaco language id for any file, runnable or not — falls back to plaintext.
export function getEditorLanguage(filename: string): string {
  const runnable = getLangConfig(filename);
  if (runnable) return runnable.monacoLanguage;
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && MARKUP_MONACO_BY_EXT[ext]) ?? "plaintext";
}
