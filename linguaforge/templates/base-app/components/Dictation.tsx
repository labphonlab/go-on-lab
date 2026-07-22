"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useSegmentPlayer } from "@/lib/useAudio";
import { explainFlags } from "@/lib/flagExplanations";

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
    return <p className="text-sm text-slate-500">音声のある項目がありません。</p>;
  }
  if (!current) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
        <p className="font-medium">このセクションのディクテーションは終わりです。</p>
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
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <p className="text-xs text-slate-400">
        {index + 1} / {items.length}
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          disabled={playing}
          onClick={() => current.audio && play(current.audio, rate)}
          className="rounded-full border border-slate-300 dark:border-slate-600 px-5 py-2 disabled:opacity-50"
        >
          🔊 再生 ({rate}x)
        </button>
        <div className="flex text-xs border rounded overflow-hidden border-slate-300 dark:border-slate-600">
          {[0.75, 1.0].map((r) => (
            <button
              key={r}
              onClick={() => setRate(r as 0.75 | 1.0)}
              className={`px-2 py-1 ${rate === r ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : ""}`}
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
            className="w-full rounded border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          />
          <button type="submit" className="w-full rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 py-2">
            答え合わせ
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className={`text-center font-medium ${allCorrect ? "text-green-600" : "text-red-600"}`}>
            {allCorrect ? "正解です！" : "違いを確認しましょう"}
          </p>
          <p className="flex flex-wrap gap-1 justify-center">
            {diff!.map((d, i) => (
              <span
                key={i}
                className={d.correct ? "text-green-600" : "text-red-600 underline decoration-wavy"}
              >
                {d.word}
              </span>
            ))}
          </p>
          <p className="text-sm text-center text-slate-500">正解: {current.text}</p>

          {explanations.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              {explanations.map((e, i) => (
                <li key={i}>⚠️ {e}</li>
              ))}
            </ul>
          )}

          <button onClick={markDoneAndNext} className="w-full rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 py-2">
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
