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
import { LocaleProvider, useLocale } from "./contexts/LocaleProvider";

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
import type { Locale } from "@/app/lib/i18n";
import { type ExperimentDesign, makeDefaultDesign } from "@/app/lib/design";

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

function staircaseConfigFrom(design: ExperimentDesign): StaircaseConfig {
  return {
    initialDelta: design.initialDeltaHz,
    minDelta: design.minDeltaHz,
    maxDelta: design.maxDeltaHz,
    largeStepFactor: design.largeStepFactor,
    smallStepFactor: design.smallStepFactor,
    stepChangeAfterReversal: design.stepChangeAfterReversal,
    reversalsToStop: design.reversalsToStop,
    reversalsToAverage: design.reversalsToAverage,
    maxTrials: design.maxTrialsPerStaircase,
  };
}

interface SessionInit {
  participantId: string;
  startedAt: string;
  seed: number;
}

interface RunnerProps {
  design?: ExperimentDesign;
  initialLocale?: Locale;
}

export default function ExperimentRunner({
  design,
  initialLocale,
}: RunnerProps) {
  const [resolvedDesign] = useState<ExperimentDesign>(() => design ?? makeDefaultDesign("default"));
  const fallbackLocale: Locale =
    initialLocale ??
    resolvedDesign.forceLocale ??
    resolvedDesign.defaultLocale;

  return (
    <LocaleProvider
      initialLocale={fallbackLocale}
      enabledLocales={resolvedDesign.enabledLocales}
      forceLocale={resolvedDesign.forceLocale}
    >
      <RunnerInner design={resolvedDesign} />
    </LocaleProvider>
  );
}

function RunnerInner({ design }: { design: ExperimentDesign }) {
  const { t, locale } = useLocale();
  const [session] = useState<SessionInit>(() => ({
    participantId: generateParticipantId(),
    startedAt: new Date().toISOString(),
    seed: (Math.floor(Math.random() * 0x100000000) ^ Date.now()) >>> 0,
  }));
  const participantId = session.participantId;
  const startedAt = session.startedAt;

  const [phase, setPhase] = useState<Phase>(
    design.collectDemographics ? "consent" : "consent",
  );
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

  const onConsent = useCallback(
    (c: ConsentRecord) => {
      setConsent(c);
      setPhase(design.collectDemographics ? "demographics" : "audio-setup");
    },
    [design.collectDemographics],
  );

  const onDemographics = useCallback((d: Demographics) => {
    setDemographics(d);
    setPhase("audio-setup");
  }, []);

  const onAudioReady = useCallback(
    (engine: AudioEngine, info: AudioInfo) => {
      setAudioEngine(engine);
      setAudioInfo(info);
      setPhase(design.headphoneCheckEnabled ? "headphone-check" : "instructions");
    },
    [design.headphoneCheckEnabled],
  );

  const onHeadphonePass = useCallback((trials: HeadphoneTrial[]) => {
    const correctCount = trials.filter((tr) => tr.correct).length;
    setHeadphoneCheck({ trials, correctCount, passed: true });
    setPhase("instructions");
  }, []);

  const onHeadphoneFail = useCallback((trials: HeadphoneTrial[]) => {
    const correctCount = trials.filter((tr) => tr.correct).length;
    setHeadphoneCheck({ trials, correctCount, passed: false });
    setPhase("ineligible");
  }, []);

  const onInstructionsDone = useCallback(() => {
    setPhase(design.practiceEnabled ? "practice" : "main");
  }, [design.practiceEnabled]);

  const onPracticeTrial = useCallback(
    (tr: DiscriminationTrial) => setPracticeTrials((prev) => [...prev, tr]),
    [],
  );

  const onUndoPracticeTrial = useCallback(() => {
    setPracticeTrials((prev) => prev.slice(0, -1));
  }, []);

  const onPracticeBlockComplete = useCallback(() => {
    setPhase("rest");
  }, []);

  const onMainTrial = useCallback(
    (tr: DiscriminationTrial) => setMainTrials((prev) => [...prev, tr]),
    [],
  );

  const onUndoMainTrial = useCallback(() => {
    setMainTrials((prev) => prev.slice(0, -1));
  }, []);

  const onMainBlockComplete = useCallback(
    ({ finishedStaircases }: { finishedStaircases: StaircaseState[] }) => {
      const sc = staircaseConfigFrom(design);
      const summaries: StaircaseSummary[] = finishedStaircases.map((s) => {
        const threshold = computeThreshold(s, sc);
        const thresholdCents =
          threshold != null
            ? hzToCents(threshold, design.referenceFrequencyHz)
            : null;
        return {
          staircaseId: s.id,
          startDelta: design.initialDeltaHz,
          reversals: s.reversalDeltas,
          reversalDeltas: s.reversalDeltas,
          threshold,
          thresholdSemitones:
            threshold != null
              ? Math.log2(
                  (design.referenceFrequencyHz + threshold) /
                    design.referenceFrequencyHz,
                ) * 12
              : null,
          thresholdCents,
          numTrials: s.trialCount,
          converged: s.reversalCount >= sc.reversalsToStop,
        };
      });

      const validThresholds = summaries
        .map((s) => s.threshold)
        .filter((tt): tt is number => tt != null);
      const finalThresholdHz =
        validThresholds.length > 0 ? geometricMean(validThresholds) : null;
      const finalThresholdCents =
        finalThresholdHz != null
          ? hzToCents(finalThresholdHz, design.referenceFrequencyHz)
          : null;

      const completedAt = new Date().toISOString();
      const durationSec =
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;

      const result: ExperimentResult = {
        participantId,
        experimentId: design.id,
        locale,
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
      design,
      headphoneCheck,
      locale,
      mainTrials,
      participantId,
      practiceTrials,
      startedAt,
    ],
  );

  const staircaseCfg = staircaseConfigFrom(design);

  return (
    <Shell progress={PROGRESS_MAP[phase]} design={design}>
      {phase === "consent" && (
        <ConsentPhase
          design={design}
          onConsent={onConsent}
          onDecline={() => setPhase("ineligible")}
        />
      )}

      {phase === "demographics" && (
        <DemographicsPhase design={design} onSubmit={onDemographics} />
      )}

      {phase === "audio-setup" && (
        <AudioSetupPhase design={design} onReady={onAudioReady} />
      )}

      {phase === "headphone-check" && audioEngine && (
        <HeadphoneCheckPhase
          design={design}
          engine={audioEngine}
          onComplete={onHeadphonePass}
          onFail={onHeadphoneFail}
        />
      )}

      {phase === "instructions" && (
        <InstructionsPhase
          forBlock={design.practiceEnabled ? "practice" : "main"}
          design={design}
          onProceed={onInstructionsDone}
        />
      )}

      {phase === "practice" && audioEngine && (
        <TrialRunner
          engine={audioEngine}
          design={design}
          mode="practice"
          blockIndex={0}
          staircaseConfig={null}
          practiceDelta={design.practiceDeltaHz}
          practiceTrialCount={design.numPracticeTrials}
          feedback={true}
          maxReplays={design.maxReplaysPractice}
          onTrialComplete={onPracticeTrial}
          onUndoLastTrial={onUndoPracticeTrial}
          onBlockComplete={onPracticeBlockComplete}
          seed={session.seed}
        />
      )}

      {phase === "rest" && (
        <RestPhase
          design={design}
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
          design={design}
          mode="main"
          blockIndex={1}
          staircaseConfig={staircaseCfg}
          feedback={false}
          maxReplays={design.maxReplaysMain}
          onTrialComplete={onMainTrial}
          onUndoLastTrial={onUndoMainTrial}
          onBlockComplete={onMainBlockComplete}
          seed={(session.seed + 7919) >>> 0}
        />
      )}

      {phase === "debrief" && finalResult && (
        <DebriefPhase result={finalResult} experimentId={design.id} />
      )}

      {phase === "ineligible" && (
        <Card>
          <h2 className="text-lg font-bold text-rose-400 mb-3">
            {t.ineligible.heading}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t.ineligible.text}
          </p>
        </Card>
      )}
    </Shell>
  );
}

function RestPhase({
  design,
  practiceTrials,
  onContinue,
  onRetryPractice,
}: {
  design: ExperimentDesign;
  practiceTrials: DiscriminationTrial[];
  onContinue: () => void;
  onRetryPractice: () => void;
}) {
  const { t } = useLocale();
  const correctCount = practiceTrials.filter((tr) => tr.correct === true).length;
  const total = practiceTrials.length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = correctCount >= design.practicePassThreshold;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">
          {t.rest.heading}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {t.rest.accuracy(correctCount, total, pct)}
        </p>
        <p
          className={`text-sm leading-relaxed ${
            passed ? "text-slate-300" : "text-amber-300"
          }`}
        >
          {passed ? t.rest.passed : t.rest.failed}
        </p>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        {!passed && (
          <button
            onClick={onRetryPractice}
            className="text-slate-400 hover:text-slate-200 text-sm underline"
          >
            {t.rest.retry}
          </button>
        )}
        <PrimaryButton onClick={onContinue}>{t.rest.proceed}</PrimaryButton>
      </div>
    </div>
  );
}
