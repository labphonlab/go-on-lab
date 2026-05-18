export const EXPERIMENT_CONFIG = {
  appVersion: "1.1.0",
  configVersion: "fdl-2afc-2d1u-v2",
  consentVersion: "v1-2026-05",

  referenceFrequencyHz: 1000,
  toneDurationSec: 0.2,
  rampDurationSec: 0.01,
  isiSec: 0.5,
  itiSec: 0.6,
  stimulusInitialSilenceSec: 0.1,
  stimulusFinalSilenceSec: 0.0,
  outputLevel: 0.25,

  initialDeltaHz: 100,
  minDeltaHz: 0.5,
  maxDeltaHz: 500,
  largeStepFactor: Math.SQRT2,
  smallStepFactor: Math.pow(2, 1 / 6),
  stepChangeAfterReversal: 2,
  reversalsToStop: 8,
  reversalsToAverage: 6,
  maxTrialsPerStaircase: 60,
  numStaircases: 2,

  numPracticeTrials: 8,
  practiceDeltaHz: 200,
  practicePassThreshold: 5,

  numHeadphoneCheckTrials: 6,
  headphoneCheckLevel: 0.3,
  headphoneCheckPassThreshold: 5,
  headphoneCheckToneDurationSec: 0.5,
  headphoneCheckFreqHz: 600,

  responseTimeoutSec: 5,
  feedbackDurationSec: 0.5,

  breakAfterEvery: 30,
  breakMinDurationSec: 10,

  maxReplaysPractice: 2,
  maxReplaysMain: 0,

  allowUndo: true,
  undoWindowSec: 4,

  minAge: 18,
  maxAge: 90,
} as const;

export const TEXTS = {
  startText:
    "これから音声知覚の実験を開始します。順を追って画面の指示に従ってください。",
  runText: "どちらの音が より高かった ですか?",
  pauseText:
    "少し休んでください。準備ができたら下のボタンで続行してください。",
  endText:
    "実験が完了しました。ご協力ありがとうございました。データを保存しています…",
  replayLabel: "もう一度聴く",
  undoLabel: "↶ 前の回答を取り消す",
  continueLabel: "続ける →",
} as const;

export const SCALE_OPTIONS = {
  gender: ["female", "male", "non-binary", "prefer-not-to-say"] as const,
  handedness: ["right", "left", "ambidextrous"] as const,
  hearingImpairment: ["none", "mild", "moderate", "severe", "unsure"] as const,
  headphoneType: ["over-ear", "on-ear", "in-ear", "earbuds", "unknown"] as const,
};
