export const EXPERIMENT_CONFIG = {
  appVersion: "1.0.0",
  configVersion: "fdl-2afc-2d1u-v1",
  consentVersion: "v1-2026-05",

  referenceFrequencyHz: 1000,
  toneDurationSec: 0.2,
  rampDurationSec: 0.01,
  isiSec: 0.5,
  itiSec: 0.6,
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

  minAge: 18,
  maxAge: 90,
} as const;

export const SCALE_OPTIONS = {
  gender: ["female", "male", "non-binary", "prefer-not-to-say"] as const,
  handedness: ["right", "left", "ambidextrous"] as const,
  hearingImpairment: ["none", "mild", "moderate", "severe", "unsure"] as const,
  headphoneType: ["over-ear", "on-ear", "in-ear", "earbuds", "unknown"] as const,
};
