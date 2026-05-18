"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Shell, Card, PrimaryButton } from "./phases/Shell";
import { ConsentPhase } from "./phases/ConsentPhase";
import { DemographicsPhase } from "./phases/DemographicsPhase";
import { AudioSetupPhase } from "./phases/AudioSetupPhase";
import { HeadphoneCheckPhase } from "./phases/HeadphoneCheckPhase";
import { InstructionsPhase } from "./phases/InstructionsPhase";
import { TrialRunner } from "./phases/TrialRunner";
import { DebriefPhase } from "./phases/DebriefPhase";

import { AudioEngine } from "./lib/audio";
import { EXPERIMENT_CONFIG } from "./config";
import {
  computeThreshold,
  geometricMean,
  hzToCents,
  StaircaseConfig,
  StaircaseState,
} from "./lib/staircase";
import { generateParticipantId } from "./lib/rng";
import type {
  AudioInfo,
  ConsentRecord,
  Demographics,
  DiscriminationTrial,
  ExperimentResult,
  HeadphoneTrial,
  Phase,
  StaircaseSummary,
} from "./types";

const PROGRESS_MAP: Record<Phase, number> = {
  loading: 0,
  consent: 5,
  demographics: 15,
  "audio-setup": 25,
  "headphone-check": 35,
  instructions: 45,
  practice: 55,
  rest: 65,
  main: 80,
  debrief: 100,
  complete: 100,
  ineligible: 0,
};

const STAIRCASE_CONFIG: StaircaseConfig = {
  initialDelta: EXPERIMENT_CONFIG.initialDeltaHz,
  minDelta: EXPERIMENT_CONFIG.minDeltaHz,
  maxDelta: EXPERIMENT_CONFIG.maxDeltaHz,
  largeStepFactor: EXPERIMENT_CONFIG.largeStepFactor,
  smallStepFactor: EXPERIMENT_CONFIG.smallStepFactor,
  stepChangeAfterReversal: EXPERIMENT_CONFIG.stepChangeAfterReversal,
  reversalsToStop: EXPERIMENT_CONFIG.reversalsToStop,
  reversalsToAverage: EXPERIMENT_CONFIG.reversalsToAverage,
  maxTrials: EXPERIMENT_CONFIG.maxTrialsPerStaircase,
};

interface SessionInit {
  participantId: string;
  startedAt: string;
  seed: number;
}

export default function ExperimentPage() {
  const [session] = useState<SessionInit>(() => ({
    participantId: generateParticipantId(),
    startedAt: new Date().toISOString(),
    seed: (Math.floor(Math.random() * 0x100000000) ^ Date.now()) >>> 0,
  }));
  const participantId = session.participantId;
  const startedAt = session.startedAt;

  const [phase, setPhase] = useState<Phase>("consent");
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null);
  const [headphoneCheck, setHeadphoneCheck] = useState<
    ExperimentResult["headphoneCheck"]
  >(null);
  const [practiceTrials, setPracticeTrials] = useState<DiscriminationTrial[]>(
    [],
  );
  const [mainTrials, setMainTrials] = useState<DiscriminationTrial[]>([]);
  const [finalResult, setFinalResult] = useState<ExperimentResult | null>(null);

  useEffect(() => {
    return () => {
      audioEngine?.close();
    };
  }, [audioEngine]);

  const onConsent = useCallback((c: ConsentRecord) => {
    setConsent(c);
    setPhase("demographics");
  }, []);

  const onDemographics = useCallback((d: Demographics) => {
    setDemographics(d);
    setPhase("audio-setup");
  }, []);

  const onAudioReady = useCallback(
    (engine: AudioEngine, info: AudioInfo) => {
      setAudioEngine(engine);
      setAudioInfo(info);
      setPhase("headphone-check");
    },
    [],
  );

  const onHeadphonePass = useCallback((trials: HeadphoneTrial[]) => {
    const correctCount = trials.filter((t) => t.correct).length;
    setHeadphoneCheck({ trials, correctCount, passed: true });
    setPhase("instructions");
  }, []);

  const onHeadphoneFail = useCallback((trials: HeadphoneTrial[]) => {
    const correctCount = trials.filter((t) => t.correct).length;
    setHeadphoneCheck({ trials, correctCount, passed: false });
    setPhase("ineligible");
  }, []);

  const onInstructionsDone = useCallback(() => {
    setPhase("practice");
  }, []);

  const onPracticeTrial = useCallback(
    (t: DiscriminationTrial) => setPracticeTrials((prev) => [...prev, t]),
    [],
  );

  const onPracticeBlockComplete = useCallback(() => {
    setPhase("rest");
  }, []);

  const onMainTrial = useCallback(
    (t: DiscriminationTrial) => setMainTrials((prev) => [...prev, t]),
    [],
  );

  const onMainBlockComplete = useCallback(
    ({ finishedStaircases }: { finishedStaircases: StaircaseState[] }) => {
      const summaries: StaircaseSummary[] = finishedStaircases.map((s) => {
        const threshold = computeThreshold(s, STAIRCASE_CONFIG);
        const thresholdCents =
          threshold != null
            ? hzToCents(threshold, EXPERIMENT_CONFIG.referenceFrequencyHz)
            : null;
        return {
          staircaseId: s.id,
          startDelta: EXPERIMENT_CONFIG.initialDeltaHz,
          reversals: s.reversalDeltas,
          reversalDeltas: s.reversalDeltas,
          threshold,
          thresholdSemitones:
            threshold != null
              ? Math.log2(
                  (EXPERIMENT_CONFIG.referenceFrequencyHz + threshold) /
                    EXPERIMENT_CONFIG.referenceFrequencyHz,
                ) * 12
              : null,
          thresholdCents,
          numTrials: s.trialCount,
          converged: s.reversalCount >= STAIRCASE_CONFIG.reversalsToStop,
        };
      });

      const validThresholds = summaries
        .map((s) => s.threshold)
        .filter((t): t is number => t != null);
      const finalThresholdHz =
        validThresholds.length > 0 ? geometricMean(validThresholds) : null;
      const finalThresholdCents =
        finalThresholdHz != null
          ? hzToCents(finalThresholdHz, EXPERIMENT_CONFIG.referenceFrequencyHz)
          : null;

      const completedAt = new Date().toISOString();
      const durationSec =
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
        1000;

      const result: ExperimentResult = {
        participantId,
        startedAt,
        completedAt,
        durationSec,
        consent,
        demographics,
        audioInfo,
        headphoneCheck,
        practiceTrials,
        mainTrials,
        staircases: summaries,
        finalThresholdHz,
        finalThresholdCents,
        configVersion: EXPERIMENT_CONFIG.configVersion,
        appVersion: EXPERIMENT_CONFIG.appVersion,
      };
      setFinalResult(result);
      setPhase("debrief");
    },
    [
      audioInfo,
      consent,
      demographics,
      headphoneCheck,
      mainTrials,
      participantId,
      practiceTrials,
      startedAt,
    ],
  );

  return (
    <Shell progress={PROGRESS_MAP[phase]}>
      {phase === "consent" && (
        <ConsentPhase
          onConsent={onConsent}
          onDecline={() => setPhase("ineligible")}
        />
      )}

      {phase === "demographics" && <DemographicsPhase onSubmit={onDemographics} />}

      {phase === "audio-setup" && <AudioSetupPhase onReady={onAudioReady} />}

      {phase === "headphone-check" && audioEngine && (
        <HeadphoneCheckPhase
          engine={audioEngine}
          onComplete={onHeadphonePass}
          onFail={onHeadphoneFail}
        />
      )}

      {phase === "instructions" && (
        <InstructionsPhase
          forBlock="practice"
          onProceed={onInstructionsDone}
        />
      )}

      {phase === "practice" && audioEngine && (
        <TrialRunner
          engine={audioEngine}
          mode="practice"
          blockIndex={0}
          staircaseConfig={null}
          practiceDelta={EXPERIMENT_CONFIG.practiceDeltaHz}
          practiceTrialCount={EXPERIMENT_CONFIG.numPracticeTrials}
          feedback={true}
          onTrialComplete={onPracticeTrial}
          onBlockComplete={onPracticeBlockComplete}
          seed={session.seed}
        />
      )}

      {phase === "rest" && (
        <RestPhase
          practiceTrials={practiceTrials}
          onContinue={() => setPhase("main")}
          onRetryPractice={() => {
            setPracticeTrials([]);
            setPhase("practice");
          }}
        />
      )}

      {phase === "main" && audioEngine && (
        <TrialRunner
          engine={audioEngine}
          mode="main"
          blockIndex={1}
          staircaseConfig={STAIRCASE_CONFIG}
          feedback={false}
          onTrialComplete={onMainTrial}
          onBlockComplete={onMainBlockComplete}
          seed={(session.seed + 7919) >>> 0}
        />
      )}

      {phase === "debrief" && finalResult && (
        <DebriefPhase result={finalResult} />
      )}

      {phase === "ineligible" && (
        <Card>
          <h2 className="text-lg font-bold text-rose-400 mb-3">
            参加を完了できませんでした
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            ご協力ありがとうございました。
            前提条件を満たさなかったため、データは記録されませんでした。
            タブを閉じて終了してください。
          </p>
        </Card>
      )}
    </Shell>
  );
}

function RestPhase({
  practiceTrials,
  onContinue,
  onRetryPractice,
}: {
  practiceTrials: DiscriminationTrial[];
  onContinue: () => void;
  onRetryPractice: () => void;
}) {
  const correctCount = practiceTrials.filter((t) => t.correct === true).length;
  const total = practiceTrials.length;
  const acc = total > 0 ? correctCount / total : 0;
  const passed = correctCount >= EXPERIMENT_CONFIG.practicePassThreshold;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">練習完了</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          練習試行の正答率: <strong>{(acc * 100).toFixed(0)}%</strong>（
          {correctCount} / {total}）
        </p>
        {passed ? (
          <p className="text-sm text-slate-300 leading-relaxed">
            タスクを理解できているようです。本試行に進みます。
            本試行では<strong>正誤フィードバックは表示されません</strong>。
            10〜15分程度の集中を要します。準備ができたら開始してください。
          </p>
        ) : (
          <p className="text-sm text-amber-300 leading-relaxed">
            正答率が低めです。タスクをもう一度確認するために、練習をやり直すこともできます。
          </p>
        )}
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        {!passed && (
          <button
            onClick={onRetryPractice}
            className="text-slate-400 hover:text-slate-200 text-sm underline"
          >
            練習をやり直す
          </button>
        )}
        <PrimaryButton onClick={onContinue}>本試行を開始 →</PrimaryButton>
      </div>
    </div>
  );
}
