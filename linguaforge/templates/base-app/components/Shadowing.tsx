"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useSegmentPlayer } from "@/lib/useAudio";
import { useSettings } from "@/lib/settings";

// Staged shadowing (門田ほか): mumbling (no support) -> text shown -> text
// hidden again, speed starting at 0.75x per AGENTS.md.
const STAGES = [
  { key: "mumbling", label: "マンブリング（テキストなし）" },
  { key: "text", label: "テキスト付き" },
  { key: "no_text", label: "テキストなし（仕上げ）" },
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
    return <p className="text-sm text-slate-500">音声のある項目がありません。</p>;
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <div className="flex gap-2 justify-center flex-wrap">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStage(i)}
            className={`text-xs rounded px-2 py-1 border ${
              progress.stageIndex === i
                ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 dark:border-slate-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-center text-slate-400">
        {progress.itemIndex + 1} / {items.length}
      </p>

      <div className="min-h-[4rem] flex items-center justify-center text-center px-2">
        {stage.key === "text" ? (
          <div>
            <p className="text-lg">{current.text}</p>
            {showIPA && current.ipa && <p className="text-slate-500 text-sm mt-1">/{current.ipa}/</p>}
          </div>
        ) : (
          <p className="text-slate-400 italic">（テキスト非表示）音声だけを頼りに繰り返してください</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          disabled={playing}
          onClick={playCurrent}
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
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          ループ
        </label>
      </div>

      <div className="flex justify-between">
        <button
          disabled={progress.itemIndex === 0}
          onClick={() => moveItem(-1)}
          className="text-sm rounded border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-30"
        >
          ← 前へ
        </button>
        <button
          disabled={progress.itemIndex === items.length - 1}
          onClick={() => moveItem(1)}
          className="text-sm rounded border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-30"
        >
          次へ →
        </button>
      </div>
    </div>
  );
}
