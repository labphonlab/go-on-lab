"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Section } from "@/lib/types";
import { computeProgress } from "@/lib/progress";

const CONTENT_TYPE_META: Record<string, { label: string; icon: string; badge: string }> = {
  vocabulary_list: {
    label: "語彙",
    icon: "🗂️",
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  dialogue: {
    label: "会話",
    icon: "💬",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  grammar_note: {
    label: "文法",
    icon: "📘",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  reading_passage: {
    label: "読解",
    icon: "📖",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  pattern_drill: {
    label: "パターン",
    icon: "🔁",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

export default function SectionCard({ section }: { section: Section }) {
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    setProgress(computeProgress(section));
  }, [section]);

  const meta = CONTENT_TYPE_META[section.content_type] ?? {
    label: section.content_type,
    icon: "📄",
    badge: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  };

  return (
    <Link
      href={`/section/${section.id}`}
      className="card flex items-center gap-3 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${meta.badge}`}
        aria-hidden
      >
        {meta.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium">
            {section.id}. {section.title}
          </p>
          <span className="shrink-0 text-xs text-stone-400">{section.items.length}項目</span>
        </div>

        {progress !== null ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-stone-800">
              <div
                className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-stone-400 tabular-nums">{progress}%</span>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-stone-400">{meta.label}</p>
        )}
      </div>

      <span className="shrink-0 text-stone-300 dark:text-stone-600">›</span>
    </Link>
  );
}
