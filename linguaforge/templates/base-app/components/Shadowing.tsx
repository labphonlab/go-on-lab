"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useSegmentPlayer } from "@/lib/useAudio";
import { useSettings } from "@/lib/settings";
import ProgressBar from "./ProgressBar";

// Staged shadowing (門田ほか): mumbling (no support) -> text shown -> text
// hidden again, speed starting at 0.75x per AGENTS.md.
const STAGES = [
  { key: "mumbling", label: "マンブリング", hint: "テキストなし" },
  { key: "text", label: "テキスト付き", hint: "見ながら復唱" },
  { key: "no_text", label: "仕上げ", hint: "テキストなし" },
] as const;

interface Progress {
  stageIndex: number;
  itemIndex: number;
}

export default function Shadowing({ section }: { section: Section }) {
  const bucket = `shadowing:${section.id}`;
  const { showIPA } = useSettings();
  const { play, stop, playing } = useSegmentPlayer();

  const items = section.items.filter((it) => it.audio);
  const [progress, setProgress] = useState<Progress>({ stageIndex: 0, itemIndex: 0 });
  const [rate, setRate] = useState<0.75 | 1.0>(0.75);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    setProgress(loadJSON(bucket, { stageIndex: 0, itemIndex: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  useEffect(() => {
    saveJSON(bucket, progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const current = items[progress.itemIndex];
  const stage = STAGES[progress.stageIndex];

  async function playCurrent() {
    if (!current?.audio) return;
    await play(current.audio, rate);
    if (loop) void playCurrent();
  }

  function setStage(i: number) {
    stop();
    setProgress((p) => ({ ...p, stageIndex: i }));
  }

  function moveItem(delta: number) {
    stop();
    setProgress((p) => ({ ...p, itemIndex: Math.min(Math.max(p.itemIndex + delta, 0), items.length - 1) }));
  }

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">音声のある項目がありません。</p>;
  }

  return (
    <div className="space-y-4">
      {/* stage stepper */}
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

      <div className="card p-6 space-y-5">
        <div className="min-h-[4.5rem] flex items-center justify-center text-center px-2">
          {stage.key === "text" ? (
            <div className="animate-fade-up">
              <p className="text-lg">{current.text}</p>
              {showIPA && current.ipa && <p className="text-stone-500 text-sm mt-1">/{current.ipa}/</p>}
            </div>
          ) : (
            <p className="text-stone-400 italic text-sm">
              {stage.hint} — 音声だけを頼りに繰り返してください
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            disabled={playing}
            onClick={playCurrent}
            className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white text-2xl hover:bg-indigo-500 disabled:opacity-70 ${
              playing ? "animate-pulse" : ""
            }`}
            aria-label="再生"
          >
            🔊
          </button>

          <div className="flex items-center gap-3">
            <div className="flex text-xs border rounded-full overflow-hidden border-stone-200 dark:border-stone-700">
              {[0.75, 1.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r as 0.75 | 1.0)}
                  className={`px-3 py-1.5 ${
                    rate === r
                      ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
                      : "text-stone-500"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="accent-indigo-600"
              />
              ループ再生
            </label>
          </div>
        </div>

        <div className="flex justify-between pt-1">
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
    </div>
  );
}
