"use client";

import { useState } from "react";
import type { Section } from "@/lib/types";
import Flashcard from "./Flashcard";
import Dictation from "./Dictation";
import Shadowing from "./Shadowing";

// Phase 1 (MVP) only ships components for these methods; other content types
// are classified and reported (see report.md) but have no UI yet.
const METHOD_LABEL: Record<string, string> = {
  flashcard: "フラッシュカード",
  dictation: "ディクテーション",
  shadowing: "シャドーイング",
};

const IMPLEMENTED_METHODS = new Set(Object.keys(METHOD_LABEL));

export default function SectionView({ section }: { section: Section }) {
  const available = section.learning_methods.filter((m) => IMPLEMENTED_METHODS.has(m));
  const [active, setActive] = useState<string | null>(available[0] ?? null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">
          {section.id}. {section.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">{section.rationale}</p>
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-slate-500">
          このセクション（{section.content_type}）向けの学習方法はフェーズ1では未実装です。
          report.md を参照してください。
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            {available.map((m) => (
              <button
                key={m}
                onClick={() => setActive(m)}
                className={`rounded px-3 py-1.5 text-sm border ${
                  active === m
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>

          {active === "flashcard" && <Flashcard section={section} />}
          {active === "dictation" && <Dictation section={section} />}
          {active === "shadowing" && <Shadowing section={section} />}
        </>
      )}
    </div>
  );
}
