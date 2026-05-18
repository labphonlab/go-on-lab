"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./Shell";
import { AudioEngine } from "../lib/audio";
import { EXPERIMENT_CONFIG } from "../config";
import {
  createStaircase,
  StaircaseConfig,
  StaircaseState,
  updateStaircase,
} from "../lib/staircase";
import { mulberry32 } from "../lib/rng";
import type { DiscriminationTrial } from "../types";

type TrialPhase =
  | "idle"
  | "playingInterval1"
  | "isiGap"
  | "playingInterval2"
  | "awaitingResponse"
  | "feedback"
  | "iti";

interface RunnerProps {
  engine: AudioEngine;
  mode: "practice" | "main";
  blockIndex: number;
  staircaseConfig: StaircaseConfig | null;
  practiceDelta?: number;
  practiceTrialCount?: number;
  feedback: boolean;
  onTrialComplete: (t: DiscriminationTrial) => void;
  onBlockComplete: (info: {
    finishedStaircases: StaircaseState[];
    totalTrials: number;
  }) => void;
  seed: number;
}

export function TrialRunner({
  engine,
  mode,
  blockIndex,
  staircaseConfig,
  practiceDelta,
  practiceTrialCount,
  feedback,
  onTrialComplete,
  onBlockComplete,
  seed,
}: RunnerProps) {
  const rngRef = useRef(mulberry32(seed));
  const staircasesRef = useRef<StaircaseState[]>([]);
  const finishedRef = useRef<StaircaseState[]>([]);
  const practiceCountRef = useRef(0);
  const trialCountRef = useRef(0);
  const responseTimeStartRef = useRef<number>(0);
  const lastTrialRef = useRef<DiscriminationTrial | null>(null);
  const phaseRef = useRef<TrialPhase>("idle");
  const completedRef = useRef(false);
  const handleResponseRef = useRef<
    ((response: 1 | 2 | null, sUsed: StaircaseState | null) => void) | null
  >(null);
  const runTrialRef = useRef<(() => void) | null>(null);

  const [trialPhase, setTrialPhase] = useState<TrialPhase>("idle");
  const [trialIndex, setTrialIndex] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (mode === "main" && staircaseConfig) {
      staircasesRef.current = Array.from(
        { length: EXPERIMENT_CONFIG.numStaircases },
        (_, i) => createStaircase(i, staircaseConfig),
      );
    } else {
      staircasesRef.current = [];
    }
    finishedRef.current = [];
    practiceCountRef.current = 0;
    trialCountRef.current = 0;
    completedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, blockIndex]);

  const setPhase = useCallback((p: TrialPhase) => {
    phaseRef.current = p;
    setTrialPhase(p);
  }, []);

  const pickNextStaircase = useCallback((): StaircaseState | null => {
    const active = staircasesRef.current.filter((s) => !s.finished);
    if (active.length === 0) return null;
    const idx = Math.floor(rngRef.current() * active.length);
    return active[idx];
  }, []);

  const runTrial = useCallback(async () => {
    if (completedRef.current) return;

    let delta: number;
    let staircaseId = -1;
    let trialIndexInStaircase = -1;
    let staircase: StaircaseState | null = null;
    let stepFactorBefore = 0;
    let directionBefore: "up" | "down" | "init" = "init";

    if (mode === "practice") {
      delta = practiceDelta ?? EXPERIMENT_CONFIG.practiceDeltaHz;
      trialIndexInStaircase = practiceCountRef.current;
    } else {
      staircase = pickNextStaircase();
      if (!staircase) {
        completedRef.current = true;
        onBlockComplete({
          finishedStaircases: finishedRef.current.slice(),
          totalTrials: trialCountRef.current,
        });
        return;
      }
      delta = staircase.delta;
      staircaseId = staircase.id;
      trialIndexInStaircase = staircase.trialCount;
      stepFactorBefore = staircase.stepFactor;
      directionBefore = staircase.direction;
    }

    const ref = EXPERIMENT_CONFIG.referenceFrequencyHz;
    const cmp = ref + delta;
    const comparisonIs2 = rngRef.current() < 0.5;

    const start = engine.currentTime + 0.1;
    const dur = EXPERIMENT_CONFIG.toneDurationSec;
    const isi = EXPERIMENT_CONFIG.isiSec;

    const f1 = comparisonIs2 ? ref : cmp;
    const f2 = comparisonIs2 ? cmp : ref;
    const onset1 = start;
    const onset2 = start + dur + isi;

    engine.scheduleTone(
      {
        frequencyHz: f1,
        durationSec: dur,
        rampSec: EXPERIMENT_CONFIG.rampDurationSec,
        level: EXPERIMENT_CONFIG.outputLevel,
      },
      onset1,
    );
    engine.scheduleTone(
      {
        frequencyHz: f2,
        durationSec: dur,
        rampSec: EXPERIMENT_CONFIG.rampDurationSec,
        level: EXPERIMENT_CONFIG.outputLevel,
      },
      onset2,
    );

    const stimulusOnsetAudioTime = start;
    const responseDeadlineAudioTime =
      onset2 + dur + EXPERIMENT_CONFIG.responseTimeoutSec;

    const trial: DiscriminationTrial = {
      block: mode,
      blockIndex,
      staircaseId,
      trialIndexInStaircase,
      globalTrialIndex: trialCountRef.current,
      referenceFrequencyHz: ref,
      deltaHz: delta,
      comparisonFrequencyHz: cmp,
      comparisonIntervalIs2: comparisonIs2,
      stimulusOnsetAudioTime,
      responseDeadlineAudioTime,
      scheduledIntervalOnsets: [onset1, onset2],
      response: null,
      correct: null,
      rtMs: null,
      staircaseDirectionBefore: directionBefore,
      reversal: false,
      stepFactorBefore,
      deltaAfter: delta,
      isiSec: EXPERIMENT_CONFIG.isiSec,
      toneDurationSec: EXPERIMENT_CONFIG.toneDurationSec,
      rampDurationSec: EXPERIMENT_CONFIG.rampDurationSec,
      outputLevel: EXPERIMENT_CONFIG.outputLevel,
      timestamp: new Date().toISOString(),
    };
    lastTrialRef.current = trial;

    setPhase("playingInterval1");
    await engine.waitUntil(onset1 + dur);
    if (completedRef.current) return;
    setPhase("isiGap");
    await engine.waitUntil(onset2);
    if (completedRef.current) return;
    setPhase("playingInterval2");
    await engine.waitUntil(onset2 + dur);
    if (completedRef.current) return;
    setPhase("awaitingResponse");
    responseTimeStartRef.current = performance.now();

    if (EXPERIMENT_CONFIG.responseTimeoutSec > 0) {
      setTimeout(
        () => {
          if (
            phaseRef.current === "awaitingResponse" &&
            lastTrialRef.current === trial
          ) {
            handleResponseRef.current?.(null, staircase);
          }
        },
        EXPERIMENT_CONFIG.responseTimeoutSec * 1000,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, mode, blockIndex, practiceDelta, pickNextStaircase, setPhase]);

  const handleResponse = useCallback(
    (response: 1 | 2 | null, sUsed: StaircaseState | null) => {
      if (phaseRef.current !== "awaitingResponse") return;
      const trial = lastTrialRef.current;
      if (!trial) return;
      const rt =
        response === null
          ? null
          : performance.now() - responseTimeStartRef.current;
      const correct =
        response === null
          ? false
          : (response === 2) === trial.comparisonIntervalIs2;
      trial.response = response;
      trial.correct = correct;
      trial.rtMs = rt;

      if (mode === "main" && sUsed && staircaseConfig) {
        const updated = updateStaircase(sUsed, correct, staircaseConfig);
        trial.reversal =
          updated.history[updated.history.length - 1]?.reversal ?? false;
        trial.deltaAfter = updated.delta;
        const idx = staircasesRef.current.findIndex((x) => x.id === sUsed.id);
        if (idx >= 0) staircasesRef.current[idx] = updated;
        if (updated.finished) {
          if (!finishedRef.current.find((x) => x.id === updated.id)) {
            finishedRef.current.push(updated);
          }
        }
      } else if (mode === "practice") {
        practiceCountRef.current += 1;
      }

      trialCountRef.current += 1;
      onTrialComplete(trial);
      setTrialIndex(trialCountRef.current);

      const finishedAll =
        mode === "practice"
          ? practiceCountRef.current >=
            (practiceTrialCount ?? EXPERIMENT_CONFIG.numPracticeTrials)
          : staircasesRef.current.every((s) => s.finished);

      if (mode === "main" && staircaseConfig) {
        const totalReversalsTarget =
          EXPERIMENT_CONFIG.numStaircases * staircaseConfig.reversalsToStop;
        const totalReversals = staircasesRef.current.reduce(
          (a, b) => a + b.reversalCount,
          0,
        );
        setProgress(
          Math.min(100, Math.round((totalReversals / totalReversalsTarget) * 100)),
        );
      } else {
        setProgress(
          Math.min(
            100,
            Math.round(
              (practiceCountRef.current /
                (practiceTrialCount ?? EXPERIMENT_CONFIG.numPracticeTrials)) *
                100,
            ),
          ),
        );
      }

      if (feedback) {
        setLastFeedback(correct ? "correct" : "incorrect");
        setPhase("feedback");
        setTimeout(() => {
          if (finishedAll) {
            completedRef.current = true;
            onBlockComplete({
              finishedStaircases: finishedRef.current.slice(),
              totalTrials: trialCountRef.current,
            });
            return;
          }
          setLastFeedback(null);
          setPhase("iti");
          setTimeout(
            () => runTrialRef.current?.(),
            EXPERIMENT_CONFIG.itiSec * 1000,
          );
        }, EXPERIMENT_CONFIG.feedbackDurationSec * 1000);
      } else {
        setPhase("iti");
        if (finishedAll) {
          completedRef.current = true;
          setTimeout(
            () =>
              onBlockComplete({
                finishedStaircases: finishedRef.current.slice(),
                totalTrials: trialCountRef.current,
              }),
            300,
          );
          return;
        }
        setTimeout(
          () => runTrialRef.current?.(),
          EXPERIMENT_CONFIG.itiSec * 1000,
        );
      }
    },
    [
      mode,
      staircaseConfig,
      feedback,
      onTrialComplete,
      onBlockComplete,
      practiceTrialCount,
      setPhase,
    ],
  );

  useEffect(() => {
    handleResponseRef.current = handleResponse;
    runTrialRef.current = runTrial;
  }, [handleResponse, runTrial]);

  useEffect(() => {
    const timer = setTimeout(() => runTrialRef.current?.(), 500);
    return () => clearTimeout(timer);
  }, []);

  const respond = useCallback(
    (n: 1 | 2) => {
      if (phaseRef.current !== "awaitingResponse") return;
      let sUsed: StaircaseState | null = null;
      if (mode === "main" && lastTrialRef.current) {
        const id = lastTrialRef.current.staircaseId;
        sUsed = staircasesRef.current.find((s) => s.id === id) ?? null;
      }
      handleResponseRef.current?.(n, sUsed);
    },
    [mode],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "1") respond(1);
      else if (e.key === "2") respond(2);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [respond]);

  const totalLabel =
    mode === "practice"
      ? `${trialIndex} / ${practiceTrialCount ?? EXPERIMENT_CONFIG.numPracticeTrials}`
      : `${trialIndex} 試行 完了`;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">
            {mode === "practice" ? "練習試行" : "本試行"}
          </div>
          <div className="text-xs font-mono text-slate-500">{totalLabel}</div>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-col items-center justify-center min-h-[260px] py-4">
          <IntervalIndicator phase={trialPhase} feedback={lastFeedback} />
          <div className="mt-8 text-sm text-slate-400 h-6 text-center">
            {trialPhase === "awaitingResponse" &&
              "どちらの音が より高かった ですか?"}
            {trialPhase === "feedback" && lastFeedback === "correct" && (
              <span className="text-emerald-400 font-bold">○ 正解</span>
            )}
            {trialPhase === "feedback" && lastFeedback === "incorrect" && (
              <span className="text-rose-400 font-bold">× 不正解</span>
            )}
            {(trialPhase === "playingInterval1" ||
              trialPhase === "playingInterval2") && (
              <span>音を再生中</span>
            )}
            {trialPhase === "isiGap" && <span>—</span>}
            {trialPhase === "iti" && <span>次の試行を準備中…</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <ResponseButton
            label="音① が高かった"
            keyHint="1"
            disabled={trialPhase !== "awaitingResponse"}
            onClick={() => respond(1)}
          />
          <ResponseButton
            label="音② が高かった"
            keyHint="2"
            disabled={trialPhase !== "awaitingResponse"}
            onClick={() => respond(2)}
          />
        </div>
      </Card>
    </div>
  );
}

function IntervalIndicator({
  phase,
  feedback,
}: {
  phase: TrialPhase;
  feedback: "correct" | "incorrect" | null;
}) {
  const i1Active = phase === "playingInterval1";
  const i2Active = phase === "playingInterval2";
  return (
    <div className="flex items-center gap-6">
      <CircleDot label="①" active={i1Active} done={!i1Active && phase !== "idle"} />
      <div className="text-slate-700 text-2xl">→</div>
      <CircleDot label="②" active={i2Active} done={phase === "awaitingResponse" || phase === "feedback" || phase === "iti"} />
      <div className="text-slate-700 text-2xl">→</div>
      <div
        className={`w-20 h-20 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
          phase === "awaitingResponse"
            ? "border-amber-400 text-amber-300 bg-amber-500/10 animate-pulse"
            : phase === "feedback"
              ? feedback === "correct"
                ? "border-emerald-400 text-emerald-300 bg-emerald-500/20"
                : "border-rose-400 text-rose-300 bg-rose-500/20"
              : "border-slate-700 text-slate-700 bg-slate-900"
        }`}
      >
        {phase === "feedback"
          ? feedback === "correct"
            ? "○"
            : "×"
          : "?"}
      </div>
    </div>
  );
}

function CircleDot({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`w-20 h-20 rounded-full border-2 flex items-center justify-center text-2xl font-bold transition-all ${
        active
          ? "border-emerald-400 text-emerald-300 bg-emerald-500/20 scale-110"
          : done
            ? "border-slate-600 text-slate-500 bg-slate-800"
            : "border-slate-700 text-slate-700 bg-slate-900"
      }`}
    >
      {label}
    </div>
  );
}

function ResponseButton({
  label,
  keyHint,
  disabled,
  onClick,
}: {
  label: string;
  keyHint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="py-5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 border border-slate-700 disabled:border-slate-800 text-white font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed"
    >
      <div className="text-base">{label}</div>
      <kbd className="inline-block mt-2 px-2 py-0.5 bg-slate-950/80 border border-slate-700 rounded text-[11px] font-mono text-slate-400">
        {keyHint}
      </kbd>
    </button>
  );
}
