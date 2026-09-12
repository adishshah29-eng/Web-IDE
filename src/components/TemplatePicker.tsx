"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { BOILERPLATES, type Boilerplate } from "@/lib/boilerplates";

interface TemplatePickerProps {
  onPick: (template: Boilerplate) => void;
  onClose: () => void;
}

export default function TemplatePicker({ onPick, onClose }: TemplatePickerProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = BOILERPLATES.filter(
      (t) =>
        !q ||
        t.label.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.filename.toLowerCase().includes(q)
    );
    const byCategory = new Map<string, Boilerplate[]>();
    for (const t of filtered) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }
    return byCategory;
  }, [query]);

  return (
    <Modal title="New From Template" onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search templates…"
        className="w-full bg-white dark:bg-white/[.06] border border-(--border-hairline-strong) rounded-md px-3 h-9 text-[13px] outline-none focus-visible:border-(--accent) placeholder:text-(--text-tertiary) text-(--text-primary) mb-3"
      />
      <div className="max-h-80 overflow-y-auto -mx-1 px-1">
        {grouped.size === 0 && (
          <div className="text-(--text-tertiary) text-[13px] text-center py-6">No templates match.</div>
        )}
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="mb-3 last:mb-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-(--text-tertiary) px-1.5 mb-1">
              {category}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t)}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-md text-left text-[13px] text-(--text-primary) hover:bg-black/[.05] dark:hover:bg-white/[.07] transition-colors"
                >
                  <span className="truncate">{t.label}</span>
                  <span className="text-(--text-tertiary) text-[11px] shrink-0 font-(family-name:--font-mono)">
                    {t.filename}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
