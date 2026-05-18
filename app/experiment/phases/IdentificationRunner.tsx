"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, PrimaryButton } from "./Shell";
import { AudioEngine } from "../lib/audio";
import { mulberry32, shuffleInPlace } from "../lib/rng";
import type { IdentificationTrial } from "../types";
import { useLocale } from "../contexts/LocaleProvider";
import { pickLocalized } from "@/app/lib/i18n";
import type {
  ExperimentDesign,
  IdentificationStimulus,
} from "@/app/lib/design";

type Phase =
  | "loading"
  | "preroll"
  | "playing"
  | "awaitingResponse"
  | "feedback"
  | "iti"
  | "blockPause";

interface Props {
  engine: AudioEngine;
  design: ExperimentDesign;
  mode: "practice" | "main";
  blockIndex: number;
  feedback: boolean;
  maxReplays: number;
  presentationsPerStimulus: number;
  onTrialComplete: (t: IdentificationTrial) => void;
  onUndoLastTrial?: () => void;
  onBlockComplete: (totalTrials: number) => void;
  seed: number;
}

interface Snapshot {
  trial: IdentificationTrial;
}

function buildTrialList(
  stimuli: IdentificationStimulus[],
  presentations: number,
  shuffle: boolean,
  seed: number,
): IdentificationStimulus[] {
  const list: IdentificationStimulus[] = [];
  for (let i = 0; i < presentations; i++) for (const s of stimuli) list.push(s);
  if (shuffle) {
    const rng = mulberry32(seed);
    shuffleInPlace(list, rng);
  }
  return list;
}

export function IdentificationRunner({
  engine,
  design,
  mode,
  blockIndex,
  feedback,
  maxReplays,
  presentationsPerStimulus,
  onTrialComplete,
  onUndoLastTrial,
  onBlockComplete,
  seed,
}: Props) {
  const { t, locale } = useLocale();
  const cfg = design.identification;
  const categories = cfg.categories;
  const [trialList] = useState<IdentificationStimulus[]>(() =>
    buildTrialList(cfg.stimuli, presentationsPerStimulus, cfg.shuffle, seed),
  );
  const totalTrials = trialList.length;
  const indexRef = useRef(0);
  const trialCountRef = useRef(0);
  const trialsSinceBreakRef = useRef(0);
  const lastTrialRef = useRef<IdentificationTrial | null>(null);
  const replayCountRef = useRef(0);
  const lastSnapshotRef = useRef<Snapshot | null>(null);
  const phaseRef = useRef<Phase>("loading");
  const completedRef = useRef(false);
  const responseTimeStartRef = useRef<number>(0);
  const runTrialRef = useRef<(() => void) | null>(null);
  const handleResponseRef = useRef<((cat: string | null) => void) | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [trialIndex, setTrialIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [undoUntil, setUndoUntil] = useState<number | null>(null);
  const [hasSnap, setHasSnap] = useState(false);
  const [feedbackState, setFeedbackState] = useState<
    "correct" | "incorrect" | "neutral" | null
  >(null);
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(() =>
    trialList.length === 0 ? "No stimuli configured." : null,
  );

  const setPh = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // preload buffers + kick off first trial
  useEffect(() => {
    let cancelled = false;
    if (trialList.length === 0) return;
    (async () => {
      try {
        await engine.preloadBuffers(cfg.stimuli.map((s) => s.src));
        if (cancelled) return;
        setPh("iti");
        setTimeout(() => runTrialRef.current?.(), 500);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runTrial = useCallback(async () => {
    if (completedRef.current) return;
    const list = trialList;
    const i = indexRef.current;
    if (i >= list.length) {
      completedRef.current = true;
      onBlockComplete(trialCountRef.current);
      return;
    }
    const stim = list[i];
    let buffer: AudioBuffer;
    try {
      buffer = await engine.loadBuffer(stim.src);
    } catch (e) {
      setLoadError((e as Error).message);
      return;
    }
    if (completedRef.current) return;

    setPh("preroll");
    setReplayCount(0);
    replayCountRef.current = 0;
    setUndoUntil(null);

    const start = engine.currentTime + 0.05 + cfg.preStimulusSilenceSec;
    const scheduled = engine.scheduleBuffer(buffer, start, design.outputLevel);

    const trial: IdentificationTrial = {
      block: mode,
      blockIndex,
      trialIndexInBlock: i,
      globalTrialIndex: trialCountRef.current,
      stimulusId: stim.id,
      stimulusSrc: stim.src,
      stimulusValue: stim.value,
      stimulusLabel: stim.label,
      stimulusOnsetAudioTime: scheduled.startTime,
      stimulusEndAudioTime: scheduled.endTime,
      response: null,
      correct: null,
      rtMs: null,
      replayCount: 0,
      undone: false,
      preStimulusSilenceSec: cfg.preStimulusSilenceSec,
      postStimulusSilenceSec: cfg.postStimulusSilenceSec,
      outputLevel: design.outputLevel,
      timestamp: new Date().toISOString(),
    };
    lastTrialRef.current = trial;

    await engine.waitUntil(scheduled.startTime);
    if (completedRef.current || lastTrialRef.current !== trial) return;
    setPh("playing");
    await engine.waitUntil(scheduled.endTime + cfg.postStimulusSilenceSec);
    if (completedRef.current || lastTrialRef.current !== trial) return;
    setPh("awaitingResponse");
    responseTimeStartRef.current = performance.now();

    if (cfg.responseTimeoutSec > 0) {
      setTimeout(() => {
        if (
          phaseRef.current === "awaitingResponse" &&
          lastTrialRef.current === trial
        ) {
          handleResponseRef.current?.(null);
        }
      }, cfg.responseTimeoutSec * 1000);
    }
  }, [
    blockIndex,
    cfg.postStimulusSilenceSec,
    cfg.preStimulusSilenceSec,
    cfg.responseTimeoutSec,
    design.outputLevel,
    engine,
    mode,
    onBlockComplete,
    setPh,
    trialList,
  ]);

  const replay = useCallback(async () => {
    if (phaseRef.current !== "awaitingResponse") return;
    if (replayCountRef.current >= maxReplays) return;
    const trial = lastTrialRef.current;
    if (!trial) return;
    let buffer: AudioBuffer;
    try {
      buffer = await engine.loadBuffer(trial.stimulusSrc);
    } catch {
      return;
    }
    replayCountRef.current += 1;
    trial.replayCount = replayCountRef.current;
    setReplayCount(replayCountRef.current);
    const start = engine.currentTime + 0.05;
    engine.scheduleBuffer(buffer, start, design.outputLevel);
    await engine.waitUntil(start + buffer.duration + cfg.postStimulusSilenceSec);
    if (phaseRef.current === "awaitingResponse") {
      responseTimeStartRef.current = performance.now();
    }
  }, [
    cfg.postStimulusSilenceSec,
    design.outputLevel,
    engine,
    maxReplays,
  ]);

  const proceedAfter = useCallback(() => {
    if (completedRef.current) return;
    const list = trialList;
    if (indexRef.current >= list.length) {
      completedRef.current = true;
      onBlockComplete(trialCountRef.current);
      return;
    }
    const shouldBreak =
      mode === "main" &&
      cfg.breakAfterEvery > 0 &&
      trialsSinceBreakRef.current >= cfg.breakAfterEvery;
    if (shouldBreak) {
      trialsSinceBreakRef.current = 0;
      setPh("blockPause");
      setPauseCountdown(cfg.breakMinDurationSec);
      return;
    }
    setPh("iti");
    setTimeout(() => runTrialRef.current?.(), cfg.itiSec * 1000);
  }, [
    cfg.breakAfterEvery,
    cfg.breakMinDurationSec,
    cfg.itiSec,
    mode,
    onBlockComplete,
    setPh,
    trialList,
  ]);

  const handleResponse = useCallback(
    (cat: string | null) => {
      if (phaseRef.current !== "awaitingResponse") return;
      const trial = lastTrialRef.current;
      if (!trial) return;
      const rt =
        cat === null ? null : performance.now() - responseTimeStartRef.current;
      const correctId = cfg.correctMap[trial.stimulusId];
      const correct =
        correctId && cat !== null ? correctId === cat : null;
      trial.response = cat;
      trial.correct = correct;
      trial.rtMs = rt;

      indexRef.current += 1;
      trialCountRef.current += 1;
      trialsSinceBreakRef.current += 1;
      lastSnapshotRef.current = { trial };
      setHasSnap(true);
      onTrialComplete(trial);
      setTrialIndex(trialCountRef.current);
      setProgress(
        Math.min(
          100,
          Math.round((indexRef.current / trialList.length) * 100),
        ),
      );

      if (design.allowUndo) {
        setUndoUntil(performance.now() + design.undoWindowSec * 1000);
      }

      if (feedback) {
        const state =
          correct === null ? "neutral" : correct ? "correct" : "incorrect";
        setFeedbackState(state);
        setPh("feedback");
        setTimeout(() => {
          setFeedbackState(null);
          proceedAfter();
        }, cfg.feedbackDurationSec * 1000);
      } else {
        proceedAfter();
      }
    },
    [
      cfg.correctMap,
      cfg.feedbackDurationSec,
      design.allowUndo,
      design.undoWindowSec,
      feedback,
      onTrialComplete,
      proceedAfter,
      setPh,
      trialList.length,
    ],
  );

  const undo = useCallback(() => {
    const snap = lastSnapshotRef.current;
    if (!snap) return;
    if (undoUntil === null || performance.now() > undoUntil) return;
    if (
      phaseRef.current !== "feedback" &&
      phaseRef.current !== "iti" &&
      phaseRef.current !== "blockPause"
    )
      return;
    snap.trial.undone = true;
    indexRef.current = Math.max(0, indexRef.current - 1);
    trialCountRef.current = Math.max(0, trialCountRef.current - 1);
    trialsSinceBreakRef.current = Math.max(0, trialsSinceBreakRef.current - 1);
    setTrialIndex(trialCountRef.current);
    setProgress(
      Math.min(
        100,
        Math.round((indexRef.current / trialList.length) * 100),
      ),
    );
    setUndoUntil(null);
    setHasSnap(false);
    lastSnapshotRef.current = null;
    onUndoLastTrial?.();
    setPh("iti");
    setTimeout(() => runTrialRef.current?.(), 300);
  }, [onUndoLastTrial, setPh, trialList.length, undoUntil]);

  const continueAfterBreak = useCallback(() => {
    if (phaseRef.current !== "blockPause") return;
    setPh("iti");
    setTimeout(() => runTrialRef.current?.(), 300);
  }, [setPh]);

  useEffect(() => {
    handleResponseRef.current = handleResponse;
    runTrialRef.current = runTrial;
  }, [handleResponse, runTrial]);

  useEffect(() => {
    if (phaseRef.current !== "blockPause") return;
    if (pauseCountdown <= 0) return;
    const tmr = setTimeout(
      () => setPauseCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearTimeout(tmr);
  }, [pauseCountdown]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      if (phaseRef.current === "awaitingResponse") {
        for (const c of categories) {
          if (c.keyHint && key === c.keyHint) {
            handleResponseRef.current?.(c.id);
            return;
          }
        }
        if (key === "r" || key === "R") replay();
      } else if (key === "u" || key === "U") {
        undo();
      } else if (
        phaseRef.current === "blockPause" &&
        (key === "Enter" || key === " ")
      ) {
        continueAfterBreak();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [categories, continueAfterBreak, replay, undo]);

  const canReplay = phase === "awaitingResponse" && replayCount < maxReplays;
  const canUndo =
    (phase === "feedback" || phase === "iti" || phase === "blockPause") &&
    undoUntil !== null &&
    hasSnap;

  if (loadError) {
    return (
      <Card>
        <h2 className="text-rose-400 font-bold mb-2">音声の読み込みに失敗</h2>
        <p className="text-sm text-slate-300">{loadError}</p>
      </Card>
    );
  }

  if (phase === "blockPause") {
    return (
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">
          {t.break.heading}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {t.break.text}
        </p>
        <div className="text-xs text-slate-500 mb-2">
          {t.break.progressLabel(trialIndex, progress)}
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-end">
          <PrimaryButton
            disabled={pauseCountdown > 0}
            onClick={continueAfterBreak}
          >
            {pauseCountdown > 0
              ? t.break.waitSec(pauseCountdown)
              : t.break.continueButton}
          </PrimaryButton>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">
          {mode === "practice" ? t.trial.practiceLabel : t.trial.mainLabel}
        </div>
        <div className="text-xs font-mono text-slate-500">
          {trialIndex} / {totalTrials}
        </div>
      </div>
      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-6 sm:mb-8">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-col items-center justify-center min-h-[160px] sm:min-h-[200px] py-2 sm:py-4">
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-2 transition-all text-3xl ${
            phase === "playing"
              ? "border-emerald-400 bg-emerald-500/20 scale-110"
              : phase === "awaitingResponse"
                ? "border-amber-400 bg-amber-500/10 animate-pulse"
                : phase === "feedback" && feedbackState === "correct"
                  ? "border-emerald-400 bg-emerald-500/20"
                  : phase === "feedback" && feedbackState === "incorrect"
                    ? "border-rose-400 bg-rose-500/20"
                    : "border-slate-700 bg-slate-900"
          }`}
        >
          {phase === "playing"
            ? "🔊"
            : phase === "awaitingResponse"
              ? "?"
              : phase === "feedback" && feedbackState === "correct"
                ? "○"
                : phase === "feedback" && feedbackState === "incorrect"
                  ? "×"
                  : phase === "feedback"
                    ? "✓"
                    : "🎧"}
        </div>
        <div className="mt-6 text-sm text-slate-400 h-6 text-center px-2">
          {phase === "awaitingResponse" &&
            (t.identification?.askLabel ?? "どちらに聞こえましたか?")}
          {phase === "playing" && t.trial.playing}
          {phase === "preroll" && "—"}
          {phase === "iti" && t.trial.nextTrial}
        </div>
      </div>

      <div
        className={`grid gap-3 sm:gap-4 mt-4 ${
          categories.length <= 2
            ? "grid-cols-2"
            : categories.length === 3
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => handleResponseRef.current?.(c.id)}
            disabled={phase !== "awaitingResponse"}
            className="py-5 sm:py-6 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 border border-slate-700 disabled:border-slate-800 text-white font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed select-none"
          >
            <div className="text-lg sm:text-xl">
              {pickLocalized(c.label, locale)}
            </div>
            {c.keyHint && (
              <kbd className="hidden sm:inline-block mt-2 px-2 py-0.5 bg-slate-950/80 border border-slate-700 rounded text-[11px] font-mono text-slate-400">
                {c.keyHint}
              </kbd>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mt-5 justify-between items-center min-h-[2.25rem]">
        <div>
          {maxReplays > 0 && (
            <button
              type="button"
              onClick={replay}
              disabled={!canReplay}
              className="text-xs font-medium text-slate-300 hover:text-emerald-300 disabled:text-slate-700 disabled:cursor-not-allowed underline py-2"
            >
              🔁 {t.trial.replay}
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
              className="text-xs font-medium text-amber-300 hover:text-amber-200 underline py-2"
            >
              {t.trial.undo}{" "}
              <kbd className="ml-1 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
                U
              </kbd>
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
