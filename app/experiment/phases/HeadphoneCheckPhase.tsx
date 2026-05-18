"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./Shell";
import { AudioEngine } from "../lib/audio";
import { mulberry32, shuffleInPlace } from "../lib/rng";
import type { HeadphoneTrial } from "../types";
import { useLocale } from "../contexts/LocaleProvider";
import type { ExperimentDesign } from "@/app/lib/design";

type Side = "left" | "right" | "center";

function buildTrialList(n: number, seed: number): Side[] {
  const base: Side[] = [];
  const cycle: Side[] = ["left", "right", "center"];
  for (let i = 0; i < n; i++) base.push(cycle[i % 3]);
  const rng = mulberry32(seed);
  return shuffleInPlace(base, rng);
}

export function HeadphoneCheckPhase({
  design,
  engine,
  onComplete,
  onFail,
}: {
  design: ExperimentDesign;
  engine: AudioEngine;
  onComplete: (trials: HeadphoneTrial[]) => void;
  onFail: (trials: HeadphoneTrial[]) => void;
}) {
  const { t } = useLocale();
  const [trials] = useState<Side[]>(() =>
    buildTrialList(
      design.numHeadphoneCheckTrials,
      Date.now() & 0xffffffff,
    ),
  );
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
        frequencyHz: design.headphoneCheckFreqHz,
        durationSec: design.headphoneCheckToneDurationSec,
        rampSec: 0.02,
        level: design.headphoneCheckLevel,
        channel,
      },
      start,
    );
    const dur = design.headphoneCheckToneDurationSec * 1000 + 100;
    setTimeout(() => {
      setPlaying(false);
      setPlayed(true);
      playStartRef.current = performance.now();
    }, dur);
  }, [
    design.headphoneCheckFreqHz,
    design.headphoneCheckLevel,
    design.headphoneCheckToneDurationSec,
    engine,
    idx,
    playing,
    trials,
  ]);

  useEffect(() => {
    if (idx >= trials.length) return;
    const tmr = setTimeout(playCurrent, 400);
    return () => clearTimeout(tmr);
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
        const correctCount = next.filter((tr) => tr.correct).length;
        if (correctCount >= design.headphoneCheckPassThreshold) onComplete(next);
        else onFail(next);
      } else {
        setIdx(idx + 1);
      }
    },
    [
      design.headphoneCheckPassThreshold,
      idx,
      onComplete,
      onFail,
      played,
      responses,
      trials,
    ],
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-emerald-400">
            {t.headphone.heading}
          </h2>
          <div className="text-xs text-slate-500 font-mono">
            {idx + 1} / {trials.length}
          </div>
        </div>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          {t.headphone.instructions}
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
          <div className="text-xs text-slate-500 uppercase tracking-widest font-bold text-center">
            {playing
              ? t.headphone.playing
              : played
                ? t.headphone.askDirection
                : t.headphone.preparing}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
          {[
            { side: "left" as const, label: t.headphone.left, key: "L" },
            { side: "center" as const, label: t.headphone.both, key: "C" },
            { side: "right" as const, label: t.headphone.right, key: "R" },
          ].map(({ side, label, key }) => (
            <button
              key={side}
              disabled={!played}
              onClick={() => respond(side)}
              className="py-4 sm:py-5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 text-white font-semibold disabled:cursor-not-allowed transition active:scale-[0.98]"
            >
              <div className="text-sm sm:text-base">{label}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">{key}</div>
            </button>
          ))}
        </div>
      </Card>

      <KeyboardListener
        onKey={(k) => {
          if (!played) return;
          if (k === "ArrowLeft" || k === "l" || k === "L") respond("left");
          else if (k === "ArrowDown" || k === "c" || k === "C") respond("center");
          else if (k === "ArrowRight" || k === "r" || k === "R") respond("right");
        }}
      />

      <button
        type="button"
        onClick={() => onFail(responses)}
        className="block mx-auto text-xs text-slate-500 hover:text-slate-300 underline py-2"
      >
        {t.headphone.cannotHear}
      </button>
    </div>
  );
}

function KeyboardListener({ onKey }: { onKey: (k: string) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);
  return null;
}
