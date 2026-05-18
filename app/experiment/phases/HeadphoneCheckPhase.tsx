"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./Shell";
import { AudioEngine } from "../lib/audio";
import { EXPERIMENT_CONFIG } from "../config";
import { mulberry32, shuffleInPlace } from "../lib/rng";
import type { HeadphoneTrial } from "../types";

type Side = "left" | "right" | "center";

function buildTrialList(seed: number): Side[] {
  const base: Side[] = [
    "left",
    "right",
    "center",
    "left",
    "right",
    "center",
  ];
  const rng = mulberry32(seed);
  return shuffleInPlace(base.slice(), rng);
}

export function HeadphoneCheckPhase({
  engine,
  onComplete,
  onFail,
}: {
  engine: AudioEngine;
  onComplete: (trials: HeadphoneTrial[]) => void;
  onFail: (trials: HeadphoneTrial[]) => void;
}) {
  const [trials] = useState<Side[]>(() => buildTrialList(Date.now() & 0xffffffff));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [responses, setResponses] = useState<HeadphoneTrial[]>([]);
  const [played, setPlayed] = useState(false);
  const playStartRef = useRef<number>(0);

  const playCurrent = useCallback(() => {
    if (playing) return;
    setPlayed(false);
    setPlaying(true);
    const side = trials[idx];
    const channel = side === "center" ? "both" : side;
    const start = engine.currentTime + 0.05;
    engine.scheduleTone(
      {
        frequencyHz: EXPERIMENT_CONFIG.headphoneCheckFreqHz,
        durationSec: EXPERIMENT_CONFIG.headphoneCheckToneDurationSec,
        rampSec: 0.02,
        level: EXPERIMENT_CONFIG.headphoneCheckLevel,
        channel,
      },
      start,
    );
    const dur = EXPERIMENT_CONFIG.headphoneCheckToneDurationSec * 1000 + 100;
    setTimeout(() => {
      setPlaying(false);
      setPlayed(true);
      playStartRef.current = performance.now();
    }, dur);
  }, [engine, idx, playing, trials]);

  useEffect(() => {
    if (idx >= trials.length) return;
    const t = setTimeout(playCurrent, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const respond = useCallback(
    (side: Side) => {
      if (!played) return;
      const rt = performance.now() - playStartRef.current;
      const correct = side === trials[idx];
      const trial: HeadphoneTrial = {
        index: idx,
        correctSide: trials[idx],
        responseSide: side,
        correct,
        rtMs: rt,
      };
      const next = [...responses, trial];
      setResponses(next);
      if (idx + 1 >= trials.length) {
        const correctCount = next.filter((t) => t.correct).length;
        if (correctCount >= EXPERIMENT_CONFIG.headphoneCheckPassThreshold) {
          onComplete(next);
        } else {
          onFail(next);
        }
      } else {
        setIdx(idx + 1);
      }
    },
    [idx, onComplete, onFail, played, responses, trials],
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-emerald-400">
            音響チェック
          </h2>
          <div className="text-xs text-slate-500 font-mono">
            {idx + 1} / {trials.length}
          </div>
        </div>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          音が再生されます。<strong>どちらの耳から聞こえたか</strong>を選んでください。
          両耳から同じように聞こえた場合は「両耳」を選びます。
        </p>

        <div className="flex flex-col items-center gap-6 py-8">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all ${
              playing
                ? "border-emerald-400 bg-emerald-500/20 scale-110"
                : played
                  ? "border-slate-600 bg-slate-800"
                  : "border-slate-700 bg-slate-900"
            }`}
          >
            <span className="text-3xl">{playing ? "🔊" : "🎧"}</span>
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">
            {playing
              ? "再生中..."
              : played
                ? "どちらから聞こえましたか?"
                : "準備中..."}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { side: "left" as const, label: "左耳", key: "L" },
            { side: "center" as const, label: "両耳", key: "C" },
            { side: "right" as const, label: "右耳", key: "R" },
          ].map(({ side, label, key }) => (
            <button
              key={side}
              disabled={!played}
              onClick={() => respond(side)}
              className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 text-white font-semibold disabled:cursor-not-allowed transition active:scale-[0.98]"
            >
              <div className="text-base">{label}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">{key}</div>
            </button>
          ))}
        </div>
      </Card>

      <KeyboardListener onKey={(k) => {
        if (!played) return;
        if (k === "ArrowLeft" || k === "l" || k === "L") respond("left");
        else if (k === "ArrowDown" || k === "c" || k === "C") respond("center");
        else if (k === "ArrowRight" || k === "r" || k === "R") respond("right");
      }} />

      <button
        type="button"
        onClick={() => onFail(responses)}
        className="block mx-auto text-xs text-slate-500 hover:text-slate-300 underline"
      >
        音が聞こえない / 中止する
      </button>
    </div>
  );
}

function KeyboardListener({ onKey }: { onKey: (k: string) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      onKey(e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);
  return null;
}
