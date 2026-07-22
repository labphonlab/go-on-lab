"use client";

import { useEffect, useMemo, useState } from "react";
import type { Section } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { useSegmentPlayer } from "@/lib/useAudio";
import { useRecorder } from "@/lib/useRecorder";
import ProgressBar from "./ProgressBar";

interface Progress {
  myRole: string | null;
  index: number;
}

// One-sided mute roleplay (AGENTS.md's dialogue row): mute the learner's
// chosen speaker, they perform that line aloud -> record for playback
// self-check only (no scoring) -> confirm against the model audio -> next
// turn. Speaker A/B is switchable at any time.
export default function Roleplay({ section }: { section: Section }) {
  const bucket = `roleplay:${section.id}`;
  const { play, playing } = useSegmentPlayer();
  const recorder = useRecorder();

  const speakers = useMemo(() => {
    const seen = new Set<string>();
    for (const it of section.items) {
      if (it.speaker) seen.add(it.speaker);
    }
    return Array.from(seen);
  }, [section.items]);

  const [progress, setProgress] = useState<Progress>({ myRole: null, index: 0 });

  useEffect(() => {
    setProgress(loadJSON(bucket, { myRole: null, index: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  useEffect(() => {
    saveJSON(bucket, progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  if (speakers.length < 2) {
    return (
      <p className="text-sm text-stone-500">
        話者情報が2人分そろっていないため、ロールプレイは利用できません。
      </p>
    );
  }

  const current = section.items[progress.index];

  function chooseRole(role: string) {
    recorder.reset();
    setProgress({ myRole: role, index: 0 });
  }

  function changeRole() {
    recorder.reset();
    setProgress((p) => ({ ...p, myRole: null }));
  }

  function next() {
    recorder.reset();
    setProgress((p) => ({ ...p, index: Math.min(p.index + 1, section.items.length - 1) }));
  }

  function restart() {
    recorder.reset();
    setProgress((p) => ({ ...p, index: 0 }));
  }

  if (!progress.myRole) {
    return (
      <div className="card p-6 space-y-4 text-center">
        <p className="text-sm text-stone-500">演じる役を選んでください。もう一方は音声で流れます。</p>
        <div className="flex gap-3 justify-center">
          {speakers.map((s) => (
            <button
              key={s}
              onClick={() => chooseRole(s)}
              className="rounded-xl bg-indigo-600 text-white px-6 py-3 font-medium hover:bg-indigo-500"
            >
              {s} 役
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="card p-8 text-center space-y-2 animate-pop-in">
        <div className="text-4xl">🎉</div>
        <p className="font-medium">ロールプレイ終了です。</p>
        <button
          onClick={restart}
          className="mt-2 rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          もう一度
        </button>
      </div>
    );
  }

  const isMyTurn = current.speaker === progress.myRole;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-stone-400">
        <span>あなたの役: {progress.myRole}</span>
        <button onClick={changeRole} className="underline decoration-dotted hover:text-indigo-500">
          役を変更
        </button>
      </div>

      <ProgressBar current={progress.index} total={section.items.length} />

      <div className="card p-6 space-y-4 text-center">
        <p className="text-xs uppercase tracking-wide text-stone-400">{current.speaker || "?"}</p>

        {isMyTurn ? (
          <>
            <p className="text-stone-400 italic text-sm">あなたの番です。声に出して演じてみましょう。</p>

            {!recorder.audioUrl ? (
              <button
                onClick={recorder.recording ? recorder.stop : recorder.start}
                className={`rounded-full px-6 py-3 font-medium text-white ${
                  recorder.recording ? "bg-rose-600 hover:bg-rose-500" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {recorder.recording ? "■ 録音停止" : "🎙️ 録音開始"}
              </button>
            ) : (
              <div className="space-y-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={recorder.audioUrl} className="w-full" />
                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={recorder.reset}
                    className="rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    録り直す
                  </button>
                  {current.audio && (
                    <button
                      disabled={playing}
                      onClick={() => play(current.audio!, 1.0)}
                      className="rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm disabled:opacity-50 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      🔊 モデル音声で確認
                    </button>
                  )}
                </div>
              </div>
            )}
            {recorder.error && <p className="text-xs text-rose-600 dark:text-rose-400">{recorder.error}</p>}
          </>
        ) : (
          <>
            <p className="text-lg">{current.text}</p>
            {current.audio && (
              <button
                disabled={playing}
                onClick={() => play(current.audio!, 1.0)}
                className="rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm disabled:opacity-50 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                🔊 音声再生
              </button>
            )}
          </>
        )}

        <button
          onClick={next}
          className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
