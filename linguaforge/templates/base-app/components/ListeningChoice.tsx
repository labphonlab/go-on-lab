"use client";

import { useEffect, useMemo, useState } from "react";
import type { Section } from "@/lib/types";
import { useSegmentPlayer } from "@/lib/useAudio";
import { explainFlags } from "@/lib/flagExplanations";
import ProgressBar from "./ProgressBar";

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4-choice listening comprehension (AGENTS.md's vocabulary_list row).
// Distractors are drawn from the same section, preferring the highest
// L1-weighted ND (analysis/neighborhood.py) — words a Japanese learner is
// most likely to actually confuse, not random unrelated words.
export default function ListeningChoice({ section }: { section: Section }) {
  const { play, playing } = useSegmentPlayer();
  const items = section.items;

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const current = items[index];

  const choices = useMemo(() => {
    if (!current || !current.ja) return [];
    const distractors = items
      .filter((it) => it.id !== current.id && it.ja)
      .sort((a, b) => (b.nd_l1_weighted ?? -1) - (a.nd_l1_weighted ?? -1))
      .slice(0, 3)
      .map((it) => it.ja);
    return shuffled([current.ja, ...distractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => setPicked(null), [index]);

  if (!current) {
    return <p className="text-sm text-stone-500">項目がありません。</p>;
  }

  const answered = picked !== null;
  const explanations = answered && picked !== current.ja ? explainFlags(current.difficulty_flags) : [];

  function next() {
    setIndex((i) => Math.min(i + 1, items.length - 1));
  }

  return (
    <div className="space-y-3">
      <ProgressBar current={index} total={items.length} />

      <div className="card p-6 space-y-4 text-center">
        <button
          disabled={playing || !current.audio}
          onClick={() => current.audio && play(current.audio, 1.0)}
          className="rounded-full bg-indigo-600 text-white px-6 py-3 font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          🔊 音声再生
        </button>

        {choices.length === 0 ? (
          <p className="text-sm text-stone-400">（この項目には日本語訳が未登録です）</p>
        ) : (
          <div className="space-y-2">
            {choices.map((choice) => {
              const isCorrect = choice === current.ja;
              return (
                <button
                  key={choice}
                  disabled={answered}
                  onClick={() => setPicked(choice)}
                  className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm ${
                    answered && isCorrect
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : answered && choice === picked
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

        {explanations.length > 0 && (
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5 text-left">
            {explanations.map((e, i) => (
              <li key={i}>⚠️ {e}</li>
            ))}
          </ul>
        )}

        {(answered || choices.length === 0) && (
          <button
            onClick={next}
            disabled={index === items.length - 1}
            className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-40"
          >
            次へ
          </button>
        )}
      </div>
    </div>
  );
}
