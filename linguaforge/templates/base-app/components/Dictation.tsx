"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useSegmentPlayer } from "@/lib/useAudio";
import { explainFlags } from "@/lib/flagExplanations";
import ProgressBar from "./ProgressBar";

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"']/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

interface WordDiff {
  word: string;
  correct: boolean;
}

function diffWords(target: string, attempt: string): WordDiff[] {
  const targetWords = normalize(target);
  const attemptWords = normalize(attempt);
  return targetWords.map((w, i) => ({ word: w, correct: attemptWords[i] === w }));
}

// Partial-playback dictation. Wrong-word highlighting implements the
// noticing hypothesis (Schmidt) + explicit corrective feedback (Lyster &
// Ranta) — errors are shown, plus *why* they're easy to mishear.
export default function Dictation({ section }: { section: Section }) {
  const bucket = `dictation:${section.id}`;
  const { play, playing } = useSegmentPlayer();

  const items = section.items.filter((it) => it.audio);
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState<0.75 | 1.0>(0.75);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDone(loadJSON(bucket, {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  const current = items[index];

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">音声のある項目がありません。</p>;
  }
  if (!current) {
    return (
      <div className="card p-8 text-center space-y-2 animate-pop-in">
        <div className="text-4xl">🎉</div>
        <p className="font-medium">このセクションのディクテーションは終わりです。</p>
        <button
          onClick={() => setIndex(0)}
          className="mt-2 rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          最初からやり直す
        </button>
      </div>
    );
  }

  const diff = checked ? diffWords(current.text, input) : null;
  const allCorrect = diff?.every((d) => d.correct) ?? false;
  const explanations = explainFlags(current.difficulty_flags);

  function markDoneAndNext() {
    const nextDone = { ...done, [current.id]: true };
    setDone(nextDone);
    saveJSON(bucket, nextDone);
    setChecked(false);
    setInput("");
    setIndex((i) => i + 1);
  }

  return (
    <div className="space-y-3">
      <ProgressBar current={index} total={items.length} />

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={playing}
            onClick={() => current.audio && play(current.audio, rate)}
            className="rounded-full bg-indigo-600 text-white px-5 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            🔊 再生
          </button>
          <div className="flex text-xs border rounded-full overflow-hidden border-stone-200 dark:border-stone-700">
            {[0.75, 1.0].map((r) => (
              <button
                key={r}
                onClick={() => setRate(r as 0.75 | 1.0)}
                className={`px-3 py-2 ${
                  rate === r
                    ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-500"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>

        {!checked ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setChecked(true);
            }}
            className="space-y-3"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="聞き取った内容を入力してください"
              className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500"
            >
              答え合わせ
            </button>
          </form>
        ) : (
          <div className="space-y-3 animate-fade-up">
            <p
              className={`text-center font-medium rounded-lg py-1.5 ${
                allCorrect
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                  : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40"
              }`}
            >
              {allCorrect ? "正解です！" : "違いを確認しましょう"}
            </p>
            <p className="flex flex-wrap gap-1.5 justify-center">
              {diff!.map((d, i) => (
                <span
                  key={i}
                  className={`rounded-md px-1.5 py-0.5 text-sm ${
                    d.correct
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  {d.word}
                </span>
              ))}
            </p>
            <p className="text-sm text-center text-stone-500">正解: {current.text}</p>

            {explanations.length > 0 && (
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5">
                {explanations.map((e, i) => (
                  <li key={i}>⚠️ {e}</li>
                ))}
              </ul>
            )}

            <button
              onClick={markDoneAndNext}
              className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
