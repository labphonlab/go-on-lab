"use client";

import { useEffect, useMemo, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { pickContentWordIndex, normalizeWord } from "@/lib/wordPick";
import ProgressBar from "./ProgressBar";
import MeaningMatchQuestion from "./MeaningMatchQuestion";

// Three DeKeyser stages in one component, per AGENTS.md's grammar_note row:
// structured input (VanPatten: meaning-form mapping, no production yet) ->
// cloze (constrained production) -> reorder (production, closer to fluency).
const STAGES = [
  { key: "meaning", label: "意味の理解" },
  { key: "cloze", label: "穴埋め" },
  { key: "reorder", label: "並べ替え" },
] as const;

interface Progress {
  stageIndex: number;
  itemIndex: number;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ClozeDrill({ section }: { section: Section }) {
  const bucket = `grammar:${section.id}`;
  const [progress, setProgress] = useState<Progress>({ stageIndex: 0, itemIndex: 0 });

  useEffect(() => {
    setProgress(loadJSON(bucket, { stageIndex: 0, itemIndex: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  useEffect(() => {
    saveJSON(bucket, progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const items = section.items;
  const current = items[progress.itemIndex];
  const stage = STAGES[progress.stageIndex];

  function setStage(i: number) {
    setProgress((p) => ({ ...p, stageIndex: i }));
  }

  function nextItem() {
    setProgress((p) => ({ ...p, itemIndex: Math.min(p.itemIndex + 1, items.length - 1) }));
  }

  function moveItem(delta: number) {
    setProgress((p) => ({ ...p, itemIndex: Math.min(Math.max(p.itemIndex + delta, 0), items.length - 1) }));
  }

  if (!current) {
    return <p className="text-sm text-stone-500">項目がありません。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center">
            <button onClick={() => setStage(i)} className="flex flex-col items-center gap-1 flex-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  progress.stageIndex === i
                    ? "bg-indigo-600 text-white"
                    : progress.stageIndex > i
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-stone-100 text-stone-400 dark:bg-stone-800"
                }`}
              >
                {progress.stageIndex > i ? "✓" : i + 1}
              </span>
              <span className="text-[11px] text-stone-500 text-center leading-tight">{s.label}</span>
            </button>
            {i < STAGES.length - 1 && (
              <div
                className={`h-0.5 flex-1 -mx-1 mb-4 ${
                  progress.stageIndex > i ? "bg-emerald-300 dark:bg-emerald-800" : "bg-stone-100 dark:bg-stone-800"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <ProgressBar current={progress.itemIndex} total={items.length} />

      {stage.key === "meaning" && <MeaningStage item={current} allItems={items} onNext={nextItem} />}
      {stage.key === "cloze" && <ClozeStage item={current} onNext={nextItem} />}
      {stage.key === "reorder" && <ReorderStage item={current} onNext={nextItem} />}

      <div className="flex justify-between">
        <button
          disabled={progress.itemIndex === 0}
          onClick={() => moveItem(-1)}
          className="text-sm rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 disabled:opacity-30 hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          ← 前へ
        </button>
        <button
          disabled={progress.itemIndex === items.length - 1}
          onClick={() => moveItem(1)}
          className="text-sm rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 disabled:opacity-30 hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          次へ →
        </button>
      </div>
    </div>
  );
}

// Stage 1: meaning-form mapping, recognition only (Processing Instruction) —
// no production is asked for here.
function MeaningStage({
  item,
  allItems,
  onNext,
}: {
  item: Section["items"][number];
  allItems: Section["items"];
  onNext: () => void;
}) {
  return (
    <div className="card p-6 space-y-4">
      <MeaningMatchQuestion item={item} pool={allItems} />
      <button
        onClick={onNext}
        className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500"
      >
        次へ
      </button>
    </div>
  );
}

// Stage 2: constrained production — type the missing content word.
function ClozeStage({ item, onNext }: { item: Section["items"][number]; onNext: () => void }) {
  const words = useMemo(() => item.text.split(" "), [item.text]);
  const blankIdx = useMemo(() => pickContentWordIndex(words), [words]);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setInput("");
    setChecked(false);
  }, [item.id]);

  const correct = normalizeWord(words[blankIdx]) === normalizeWord(input);

  return (
    <div className="card p-6 space-y-4">
      <p className="text-center text-lg leading-relaxed">
        {words.map((w, i) => (i === blankIdx ? <span key={i} className="mx-1 border-b-2 border-indigo-400">＿＿＿</span> : <span key={i}> {w}</span>))}
      </p>

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
            placeholder="空欄に入る単語"
            className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent px-4 py-2.5 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="submit" className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500">
            答え合わせ
          </button>
        </form>
      ) : (
        <div className="space-y-3 animate-fade-up">
          <p
            className={`text-center font-medium rounded-lg py-1.5 ${
              correct
                ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40"
            }`}
          >
            {correct ? "正解です！" : `正解: ${words[blankIdx]}`}
          </p>
          <button onClick={onNext} className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500">
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

// Stage 3: full-sentence production via reconstruction — closer to the
// fluency end of DeKeyser's declarative -> procedural -> automatic chain.
function ReorderStage({ item, onNext }: { item: Section["items"][number]; onNext: () => void }) {
  const originalWords = useMemo(() => item.text.split(" "), [item.text]);
  const [bank, setBank] = useState<number[]>([]);
  const [answer, setAnswer] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setBank(shuffled(originalWords.map((_, i) => i)));
    setAnswer([]);
    setChecked(false);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const correct = answer.every((idx, i) => idx === i) && answer.length === originalWords.length;

  return (
    <div className="card p-6 space-y-4">
      <div className="min-h-[3rem] flex flex-wrap gap-1.5 justify-center items-start rounded-lg border border-dashed border-stone-200 dark:border-stone-700 p-2">
        {answer.map((idx) => (
          <button
            key={idx}
            onClick={() => {
              if (checked) return;
              setAnswer((a) => a.filter((x) => x !== idx));
              setBank((b) => [...b, idx]);
            }}
            className="rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-1 text-sm"
          >
            {originalWords[idx]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center">
        {bank.map((idx) => (
          <button
            key={idx}
            onClick={() => {
              setBank((b) => b.filter((x) => x !== idx));
              setAnswer((a) => [...a, idx]);
            }}
            className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-1 text-sm"
          >
            {originalWords[idx]}
          </button>
        ))}
      </div>

      {!checked ? (
        <button
          disabled={bank.length > 0}
          onClick={() => setChecked(true)}
          className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-40"
        >
          答え合わせ
        </button>
      ) : (
        <div className="space-y-3 animate-fade-up">
          <p
            className={`text-center font-medium rounded-lg py-1.5 ${
              correct
                ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40"
                : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40"
            }`}
          >
            {correct ? "正解です！" : `正解: ${item.text}`}
          </p>
          <button onClick={onNext} className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500">
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
