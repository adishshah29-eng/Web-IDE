"use client";

import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { getEditorLanguage } from "@/lib/languageMap";

export interface CursorPosition {
  line: number;
  col: number;
}

interface EditorProps {
  filename: string;
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (pos: CursorPosition) => void;
}

export default function Editor({ filename, value, onChange, onCursorChange }: EditorProps) {
  const handleMount: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.({ line: e.position.lineNumber, col: e.position.column });
    });
  };

  return (
    <div className="h-full bg-(--surface-editor)">
      <MonacoEditor
        language={getEditorLanguage(filename)}
        value={value}
        theme="vs-dark"
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        loading={<div className="w-full h-full bg-(--surface-editor)" />}
        options={{
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          minimap: { enabled: false },
          automaticLayout: true,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          tabSize: 2,
        }}
      />
    </div>
  );
}
