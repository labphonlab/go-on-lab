"use client";

import { useEffect, useRef, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useSegmentPlayer } from "@/lib/useAudio";
import { useSettings } from "@/lib/settings";
import ProgressBar from "./ProgressBar";

// DeKeyser's declarative -> constrained practice -> fluency (timed) chain,
// applied to a substitution drill: model exposure -> self-produced attempt
// with model confirmation -> a timed rapid-fire round across all items.
const STAGES = [
  { key: "model", label: "モデル確認" },
  { key: "produce", label: "産出練習" },
  { key: "fluency", label: "流暢性チェック" },
] as const;

const FLUENCY_SECONDS = 4;

interface Progress {
  stageIndex: number;
  itemIndex: number;
}

export default function SubstitutionDrill({ section }: { section: Section }) {
  const bucket = `pattern:${section.id}`;
  const { showIPA } = useSettings();
  const { play, stop, playing } = useSegmentPlayer();

  const items = section.items.filter((it) => it.audio);
  const [progress, setProgress] = useState<Progress>({ stageIndex: 0, itemIndex: 0 });
  const [revealed, setRevealed] = useState(false);

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

  function setStage(i: number) {
    stop();
    setRevealed(false);
    setProgress((p) => ({ ...p, stageIndex: i }));
  }

  function moveItem(delta: number) {
    stop();
    setRevealed(false);
    setProgress((p) => ({ ...p, itemIndex: Math.min(Math.max(p.itemIndex + delta, 0), items.length - 1) }));
  }

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">音声のある項目がありません。</p>;
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

      {stage.key === "fluency" ? (
        <FluencyRound items={items} play={play} stop={stop} />
      ) : (
        <>
          <ProgressBar current={progress.itemIndex} total={items.length} />

          <div className="card p-6 space-y-5 text-center">
            {stage.key === "model" || revealed ? (
              <div className="animate-fade-up">
                <p className="text-xl font-semibold">{current.text}</p>
                {showIPA && current.ipa && <p className="text-stone-500 text-sm mt-1">/{current.ipa}/</p>}
                {current.ja && <p className="text-stone-500 mt-1">{current.ja}</p>}
              </div>
            ) : (
              <p className="text-stone-400 italic text-sm py-2">
                音声を聞いて、声に出して言ってみましょう
              </p>
            )}

            <button
              disabled={playing}
              onClick={() => current.audio && play(current.audio, 1.0)}
              className="rounded-full bg-indigo-600 text-white px-5 py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              🔊 再生
            </button>

            {stage.key === "produce" && !revealed && (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-xl border border-stone-200 dark:border-stone-700 py-2.5 font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                言えた？モデルを確認する
              </button>
            )}
          </div>

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
        </>
      )}
    </div>
  );
}

function FluencyRound({
  items,
  play,
  stop,
}: {
  items: Section["items"];
  play: (audio: NonNullable<Section["items"][number]["audio"]>, rate: 0.75 | 1.0) => Promise<void>;
  stop: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(FLUENCY_SECONDS);
  const [done, setDone] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => () => {
    cancelledRef.current = true;
    stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    cancelledRef.current = false;
    setRunning(true);
    setDone(false);
    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) return;
      setIndex(i);
      const audio = items[i].audio;
      if (audio) await play(audio, 1.0);
      if (cancelledRef.current) return;
      for (let s = FLUENCY_SECONDS; s > 0; s--) {
        setSecondsLeft(s);
        await new Promise((r) => setTimeout(r, 1000));
        if (cancelledRef.current) return;
      }
    }
    setRunning(false);
    setDone(true);
  }

  function cancel() {
    cancelledRef.current = true;
    stop();
    setRunning(false);
  }

  return (
    <div className="card p-6 space-y-4 text-center">
      <p className="text-sm text-stone-500">
        音声が流れたあと、{FLUENCY_SECONDS}秒以内に声に出して言ってみましょう。次々と進みます。
      </p>

      {running ? (
        <>
          <p className="text-xs text-stone-400">
            {index + 1} / {items.length}
          </p>
          <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{secondsLeft}</div>
          <button
            onClick={cancel}
            className="rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            中断する
          </button>
        </>
      ) : done ? (
        <>
          <div className="text-4xl">🎉</div>
          <p className="font-medium">お疲れさまでした！</p>
          <button
            onClick={start}
            className="rounded-full bg-indigo-600 text-white px-5 py-2.5 font-medium hover:bg-indigo-500"
          >
            もう一度
          </button>
        </>
      ) : (
        <button
          onClick={start}
          className="rounded-full bg-indigo-600 text-white px-6 py-2.5 font-medium hover:bg-indigo-500"
        >
          ▶ 流暢性チェックを始める
        </button>
      )}
    </div>
  );
}
