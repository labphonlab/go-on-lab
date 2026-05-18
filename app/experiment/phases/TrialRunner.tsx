"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, PrimaryButton } from "./Shell";
import { AudioEngine } from "../lib/audio";
import { EXPERIMENT_CONFIG, TEXTS } from "../config";
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
  | "iti"
  | "blockPause";

interface RunnerProps {
  engine: AudioEngine;
  mode: "practice" | "main";
  blockIndex: number;
  staircaseConfig: StaircaseConfig | null;
  practiceDelta?: number;
  practiceTrialCount?: number;
  feedback: boolean;
  maxReplays: number;
  onTrialComplete: (t: DiscriminationTrial) => void;
  onUndoLastTrial?: () => void;
  onBlockComplete: (info: {
    finishedStaircases: StaircaseState[];
    totalTrials: number;
  }) => void;
  seed: number;
}

interface TrialSnapshot {
  staircaseId: number;
  prevStaircase: StaircaseState | null;
  wasInFinished: boolean;
  trial: DiscriminationTrial;
}

export function TrialRunner({
  engine,
  mode,
  blockIndex,
  staircaseConfig,
  practiceDelta,
  practiceTrialCount,
  feedback,
  maxReplays,
  onTrialComplete,
  onUndoLastTrial,
  onBlockComplete,
  seed,
}: RunnerProps) {
  const rngRef = useRef(mulberry32(seed));
  const staircasesRef = useRef<StaircaseState[]>([]);
  const finishedRef = useRef<StaircaseState[]>([]);
  const practiceCountRef = useRef(0);
  const trialCountRef = useRef(0);
  const trialsSinceBreakRef = useRef(0);
  const responseTimeStartRef = useRef<number>(0);
  const lastTrialRef = useRef<DiscriminationTrial | null>(null);
  const replayCountRef = useRef(0);
  const lastSnapshotRef = useRef<TrialSnapshot | null>(null);
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
  const [replayCount, setReplayCount] = useState(0);
  const [undoAvailableUntil, setUndoAvailableUntil] = useState<number | null>(
    null,
  );
  const [hasUndoSnapshot, setHasUndoSnapshot] = useState(false);
  const [pauseCountdown, setPauseCountdown] = useState<number>(0);

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
    trialsSinceBreakRef.current = 0;
    completedRef.current = false;
    lastSnapshotRef.current = null;
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

  const scheduleStimulusPair = useCallback(
    (f1: number, f2: number) => {
      const start =
        engine.currentTime + 0.05 + EXPERIMENT_CONFIG.stimulusInitialSilenceSec;
      const dur = EXPERIMENT_CONFIG.toneDurationSec;
      const isi = EXPERIMENT_CONFIG.isiSec;
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
      return { onset1, onset2, dur };
    },
    [engine],
  );

  const playStimulusAndWait = useCallback(
    async (
      f1: number,
      f2: number,
      trial: DiscriminationTrial,
      isReplay: boolean,
    ) => {
      const { onset1, onset2, dur } = scheduleStimulusPair(f1, f2);
      if (!isReplay) {
        trial.stimulusOnsetAudioTime = onset1;
        trial.scheduledIntervalOnsets = [onset1, onset2];
        trial.responseDeadlineAudioTime =
          onset2 +
          dur +
          EXPERIMENT_CONFIG.stimulusFinalSilenceSec +
          EXPERIMENT_CONFIG.responseTimeoutSec;
      }
      setPhase("playingInterval1");
      await engine.waitUntil(onset1 + dur);
      if (completedRef.current || lastTrialRef.current !== trial) return false;
      setPhase("isiGap");
      await engine.waitUntil(onset2);
      if (completedRef.current || lastTrialRef.current !== trial) return false;
      setPhase("playingInterval2");
      await engine.waitUntil(
        onset2 + dur + EXPERIMENT_CONFIG.stimulusFinalSilenceSec,
      );
      if (completedRef.current || lastTrialRef.current !== trial) return false;
      setPhase("awaitingResponse");
      responseTimeStartRef.current = performance.now();
      return true;
    },
    [engine, scheduleStimulusPair, setPhase],
  );

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
    const f1 = comparisonIs2 ? ref : cmp;
    const f2 = comparisonIs2 ? cmp : ref;

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
      stimulusOnsetAudioTime: 0,
      responseDeadlineAudioTime: 0,
      scheduledIntervalOnsets: [0, 0],
      response: null,
      correct: null,
      rtMs: null,
      replayCount: 0,
      undone: false,
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
    replayCountRef.current = 0;
    setReplayCount(0);
    setUndoAvailableUntil(null);

    const ok = await playStimulusAndWait(f1, f2, trial, false);
    if (!ok) return;

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
  }, [
    engine,
    mode,
    blockIndex,
    practiceDelta,
    pickNextStaircase,
    playStimulusAndWait,
  ]);

  const replay = useCallback(async () => {
    if (phaseRef.current !== "awaitingResponse") return;
    if (replayCountRef.current >= maxReplays) return;
    const trial = lastTrialRef.current;
    if (!trial) return;
    replayCountRef.current += 1;
    trial.replayCount = replayCountRef.current;
    setReplayCount(replayCountRef.current);
    const f1 = trial.comparisonIntervalIs2
      ? trial.referenceFrequencyHz
      : trial.comparisonFrequencyHz;
    const f2 = trial.comparisonIntervalIs2
      ? trial.comparisonFrequencyHz
      : trial.referenceFrequencyHz;
    await playStimulusAndWait(f1, f2, trial, true);
  }, [maxReplays, playStimulusAndWait]);

  const proceedAfterResponse = useCallback(() => {
    if (completedRef.current) return;

    const finishedAll =
      mode === "practice"
        ? practiceCountRef.current >=
          (practiceTrialCount ?? EXPERIMENT_CONFIG.numPracticeTrials)
        : staircasesRef.current.every((s) => s.finished);

    if (finishedAll) {
      completedRef.current = true;
      onBlockComplete({
        finishedStaircases: finishedRef.current.slice(),
        totalTrials: trialCountRef.current,
      });
      return;
    }

    const shouldBreak =
      mode === "main" &&
      EXPERIMENT_CONFIG.breakAfterEvery > 0 &&
      trialsSinceBreakRef.current >= EXPERIMENT_CONFIG.breakAfterEvery;

    if (shouldBreak) {
      trialsSinceBreakRef.current = 0;
      setPhase("blockPause");
      setPauseCountdown(EXPERIMENT_CONFIG.breakMinDurationSec);
      return;
    }

    setPhase("iti");
    setTimeout(() => runTrialRef.current?.(), EXPERIMENT_CONFIG.itiSec * 1000);
  }, [mode, onBlockComplete, practiceTrialCount, setPhase]);

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

      const snapshot: TrialSnapshot = {
        staircaseId: trial.staircaseId,
        prevStaircase: sUsed ? { ...sUsed } : null,
        wasInFinished: false,
        trial,
      };

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
            snapshot.wasInFinished = true;
          }
        }
      } else if (mode === "practice") {
        practiceCountRef.current += 1;
      }

      trialCountRef.current += 1;
      trialsSinceBreakRef.current += 1;
      lastSnapshotRef.current = snapshot;
      setHasUndoSnapshot(true);
      onTrialComplete(trial);
      setTrialIndex(trialCountRef.current);

      if (mode === "main" && staircaseConfig) {
        const totalReversalsTarget =
          EXPERIMENT_CONFIG.numStaircases * staircaseConfig.reversalsToStop;
        const totalReversals = staircasesRef.current.reduce(
          (a, b) => a + b.reversalCount,
          0,
        );
        setProgress(
          Math.min(
            100,
            Math.round((totalReversals / totalReversalsTarget) * 100),
          ),
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

      if (EXPERIMENT_CONFIG.allowUndo) {
        const until =
          performance.now() + EXPERIMENT_CONFIG.undoWindowSec * 1000;
        setUndoAvailableUntil(until);
      }

      if (feedback) {
        setLastFeedback(correct ? "correct" : "incorrect");
        setPhase("feedback");
        setTimeout(() => {
          setLastFeedback(null);
          proceedAfterResponse();
        }, EXPERIMENT_CONFIG.feedbackDurationSec * 1000);
      } else {
        proceedAfterResponse();
      }
    },
    [
      mode,
      staircaseConfig,
      feedback,
      onTrialComplete,
      practiceTrialCount,
      setPhase,
      proceedAfterResponse,
    ],
  );

  const undo = useCallback(() => {
    const snap = lastSnapshotRef.current;
    if (!snap) return;
    if (
      undoAvailableUntil === null ||
      performance.now() > undoAvailableUntil
    ) {
      return;
    }
    if (
      phaseRef.current !== "feedback" &&
      phaseRef.current !== "iti" &&
      phaseRef.current !== "blockPause"
    ) {
      return;
    }
    snap.trial.undone = true;

    if (mode === "main" && snap.prevStaircase) {
      const idx = staircasesRef.current.findIndex(
        (x) => x.id === snap.staircaseId,
      );
      if (idx >= 0) staircasesRef.current[idx] = snap.prevStaircase;
      if (snap.wasInFinished) {
        finishedRef.current = finishedRef.current.filter(
          (x) => x.id !== snap.staircaseId,
        );
      }
    } else if (mode === "practice") {
      practiceCountRef.current = Math.max(0, practiceCountRef.current - 1);
    }
    trialCountRef.current = Math.max(0, trialCountRef.current - 1);
    trialsSinceBreakRef.current = Math.max(0, trialsSinceBreakRef.current - 1);
    setTrialIndex(trialCountRef.current);
    setUndoAvailableUntil(null);
    setHasUndoSnapshot(false);
    lastSnapshotRef.current = null;
    onUndoLastTrial?.();
    setPhase("iti");
    setTimeout(() => runTrialRef.current?.(), 300);
  }, [mode, onUndoLastTrial, setPhase, undoAvailableUntil]);

  const continueAfterBreak = useCallback(() => {
    if (phaseRef.current !== "blockPause") return;
    setPhase("iti");
    setTimeout(() => runTrialRef.current?.(), 300);
  }, [setPhase]);

  useEffect(() => {
    handleResponseRef.current = handleResponse;
    runTrialRef.current = runTrial;
  }, [handleResponse, runTrial]);

  useEffect(() => {
    const timer = setTimeout(() => runTrialRef.current?.(), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phaseRef.current !== "blockPause") return;
    if (pauseCountdown <= 0) return;
    const t = setTimeout(() => setPauseCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [pauseCountdown]);

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
      else if (e.key === "r" || e.key === "R") replay();
      else if (e.key === "u" || e.key === "U") undo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [respond, replay, undo]);

  const totalLabel =
    mode === "practice"
      ? `${trialIndex} / ${practiceTrialCount ?? EXPERIMENT_CONFIG.numPracticeTrials}`
      : `${trialIndex} 試行 完了`;

  const canReplay =
    trialPhase === "awaitingResponse" && replayCount < maxReplays;
  const canUndo =
    (trialPhase === "feedback" ||
      trialPhase === "iti" ||
      trialPhase === "blockPause") &&
    undoAvailableUntil !== null &&
    hasUndoSnapshot;

  if (trialPhase === "blockPause") {
    return (
      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-bold text-emerald-400 mb-3">
            小休憩
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {TEXTS.pauseText}
          </p>
          <div className="text-xs text-slate-500 mb-2">
            進捗: {trialIndex} 試行完了 / 約 {progress}%
          </div>
          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-end">
            {canUndo && (
              <button
                onClick={undo}
                className="text-amber-300 hover:text-amber-200 text-xs underline"
              >
                {TEXTS.undoLabel}
              </button>
            )}
            <PrimaryButton
              disabled={pauseCountdown > 0}
              onClick={continueAfterBreak}
            >
              {pauseCountdown > 0
                ? `あと ${pauseCountdown} 秒…`
                : TEXTS.continueLabel}
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

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
            {trialPhase === "awaitingResponse" && TEXTS.runText}
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

        <div className="flex flex-wrap gap-3 mt-5 justify-between items-center min-h-[2.25rem]">
          <div>
            {maxReplays > 0 && (
              <button
                type="button"
                onClick={replay}
                disabled={!canReplay}
                className="text-xs font-medium text-slate-300 hover:text-emerald-300 disabled:text-slate-700 disabled:cursor-not-allowed underline"
              >
                {TEXTS.replayLabel}
                {maxReplays > 1 && (
                  <span className="ml-1 text-slate-500 font-mono text-[10px]">
                    ({replayCount}/{maxReplays})
                  </span>
                )}{" "}
                <kbd className="ml-1 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
                  R
                </kbd>
              </button>
            )}
          </div>
          <div>
            {canUndo && (
              <button
                type="button"
                onClick={undo}
                className="text-xs font-medium text-amber-300 hover:text-amber-200 underline"
              >
                {TEXTS.undoLabel}{" "}
                <kbd className="ml-1 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
                  U
                </kbd>
              </button>
            )}
          </div>
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
