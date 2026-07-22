"use client";

import { useState } from "react";
import Link from "next/link";
import type { Section } from "@/lib/types";
import Flashcard from "./Flashcard";
import Dictation from "./Dictation";
import Shadowing from "./Shadowing";
import ClozeDrill from "./ClozeDrill";
import KaraokeReader from "./KaraokeReader";
import SubstitutionDrill from "./SubstitutionDrill";

// Each entry maps one learning_methods value (schema.py's CONTENT_TYPE_METHODS)
// to the component that renders it. A content_type's other listed methods
// (e.g. grammar_note's structured_input/reorder_drill) are internal stages
// folded into the mapped component here, not separate tabs — see each
// component's stage stepper.
const METHOD_META: Record<string, { label: string; icon: string }> = {
  flashcard: { label: "フラッシュカード", icon: "🗂️" },
  dictation: { label: "ディクテーション", icon: "✍️" },
  shadowing: { label: "シャドーイング", icon: "🎧" },
  cloze_drill: { label: "文法ドリル", icon: "📘" },
  karaoke_reading: { label: "音読", icon: "📖" },
  substitution_drill: { label: "パターンドリル", icon: "🔁" },
};

const IMPLEMENTED_METHODS = new Set(Object.keys(METHOD_META));

export default function SectionView({ section }: { section: Section }) {
  const available = section.learning_methods.filter((m) => IMPLEMENTED_METHODS.has(m));
  const [active, setActive] = useState<string | null>(available[0] ?? null);
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className="space-y-4 animate-fade-up">
      <div>
        <Link href="/" className="text-sm text-stone-400 hover:text-indigo-500">
          ← コース一覧
        </Link>
        <h1 className="text-lg font-bold mt-1">
          {section.id}. {section.title}
        </h1>
        <button
          onClick={() => setShowWhy((v) => !v)}
          className="mt-1 text-xs text-stone-400 hover:text-indigo-500 underline decoration-dotted underline-offset-2"
        >
          {showWhy ? "閉じる" : "この学習法を選んだ理由"}
        </button>
        {showWhy && (
          <p className="mt-2 text-xs leading-relaxed text-stone-500 bg-stone-50 dark:bg-stone-900/60 rounded-lg p-3 animate-fade-up">
            {section.rationale}
          </p>
        )}
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-stone-500">
          このセクション（{section.content_type}）向けの学習方法はフェーズ1では未実装です。
          report.md を参照してください。
        </p>
      ) : (
        <>
          {available.length > 1 && (
            <div className="flex gap-1 rounded-xl bg-stone-100 dark:bg-stone-900 p-1">
              {available.map((m) => (
                <button
                  key={m}
                  onClick={() => setActive(m)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                    active === m
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-stone-800 dark:text-indigo-300"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  <span aria-hidden>{METHOD_META[m].icon}</span>
                  <span className="hidden sm:inline">{METHOD_META[m].label}</span>
                </button>
              ))}
            </div>
          )}

          <div key={active} className="animate-fade-up">
            {active === "flashcard" && <Flashcard section={section} />}
            {active === "dictation" && <Dictation section={section} />}
            {active === "shadowing" && <Shadowing section={section} />}
            {active === "cloze_drill" && <ClozeDrill section={section} />}
            {active === "karaoke_reading" && <KaraokeReader section={section} />}
            {active === "substitution_drill" && <SubstitutionDrill section={section} />}
          </div>
        </>
      )}
    </div>
  );
}
