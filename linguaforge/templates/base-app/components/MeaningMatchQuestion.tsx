"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Recognition-only meaning-form mapping (Processing Instruction / comprehension
// check): pick the correct ja translation among distractors from the same
// pool. No production asked for — used by ClozeDrill's first stage and by
// KaraokeReader's comprehension check.
export default function MeaningMatchQuestion({ item, pool }: { item: Item; pool: Item[] }) {
  const [picked, setPicked] = useState<string | null>(null);

  const choices = useMemo(() => {
    if (!item.ja) return [];
    const distractors = pool.filter((it) => it.id !== item.id && it.ja).map((it) => it.ja);
    return shuffled([item.ja, ...shuffled(distractors).slice(0, 2)]);
  }, [item, pool]);

  useEffect(() => setPicked(null), [item.id]);

  return (
    <div className="space-y-3">
      <p className="text-center text-lg">{item.text}</p>

      {choices.length === 0 ? (
        <p className="text-sm text-center text-stone-400">（この項目には日本語訳が未登録です）</p>
      ) : (
        <div className="space-y-2">
          {choices.map((choice) => {
            const isCorrect = choice === item.ja;
            const show = picked !== null;
            return (
              <button
                key={choice}
                disabled={picked !== null}
                onClick={() => setPicked(choice)}
                className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm ${
                  show && isCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : show && choice === picked
                    ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-stone-200 dark:border-stone-700"
                }`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
