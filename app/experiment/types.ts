export type Phase =
  | "loading"
  | "consent"
  | "demographics"
  | "audio-setup"
  | "headphone-check"
  | "instructions"
  | "practice"
  | "rest"
  | "main"
  | "debrief"
  | "complete"
  | "ineligible";

export type Handedness = "right" | "left" | "ambidextrous";
export type Gender = "female" | "male" | "non-binary" | "prefer-not-to-say";

export interface Demographics {
  age: number | null;
  gender: Gender | null;
  handedness: Handedness | null;
  nativeLanguage: string;
  otherLanguages: string;
  hearingImpairment: "none" | "mild" | "moderate" | "severe" | "unsure" | null;
  hearingAids: boolean | null;
  musicalTrainingYears: number | null;
  headphoneType: "over-ear" | "on-ear" | "in-ear" | "earbuds" | "unknown" | null;
  environmentQuiet: boolean | null;
}

export interface ConsentRecord {
  agreedAt: string;
  agreementVersion: string;
  participantInitials: string;
}

export interface AudioInfo {
  sampleRate: number;
  baseLatencySec: number | null;
  outputLatencySec: number | null;
  state: AudioContextState;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
}

export interface HeadphoneTrial {
  index: number;
  correctSide: "left" | "right" | "center";
  responseSide: "left" | "right" | "center" | null;
  correct: boolean;
  rtMs: number | null;
}

export interface IdentificationTrial {
  block: "practice" | "main";
  blockIndex: number;
  trialIndexInBlock: number;
  globalTrialIndex: number;

  stimulusId: string;
  stimulusSrc: string;
  stimulusValue: number | null;
  stimulusLabel: string;

  stimulusOnsetAudioTime: number;
  stimulusEndAudioTime: number;

  response: string | null;
  correct: boolean | null;
  rtMs: number | null;
  replayCount: number;
  undone: boolean;

  preStimulusSilenceSec: number;
  postStimulusSilenceSec: number;
  outputLevel: number;
  timestamp: string;
}

export interface DiscriminationTrial {
  block: "practice" | "main";
  blockIndex: number;
  staircaseId: number;
  trialIndexInStaircase: number;
  globalTrialIndex: number;

  referenceFrequencyHz: number;
  deltaHz: number;
  comparisonFrequencyHz: number;
  comparisonIntervalIs2: boolean;

  stimulusOnsetAudioTime: number;
  responseDeadlineAudioTime: number;
  scheduledIntervalOnsets: [number, number];

  response: 1 | 2 | null;
  correct: boolean | null;
  rtMs: number | null;
  replayCount: number;
  undone: boolean;

  staircaseDirectionBefore: "up" | "down" | "init";
  reversal: boolean;
  stepFactorBefore: number;
  deltaAfter: number;

  isiSec: number;
  toneDurationSec: number;
  rampDurationSec: number;
  outputLevel: number;
  timestamp: string;
}

export interface StaircaseSummary {
  staircaseId: number;
  startDelta: number;
  reversals: number[];
  reversalDeltas: number[];
  threshold: number | null;
  thresholdSemitones: number | null;
  thresholdCents: number | null;
  numTrials: number;
  converged: boolean;
}

export interface ExperimentResult {
  participantId: string;
  experimentId: string;
  locale: string;
  startedAt: string;
  completedAt: string | null;
  durationSec: number | null;
  consent: ConsentRecord | null;
  demographics: Demographics | null;
  audioInfo: AudioInfo | null;
  headphoneCheck: {
    trials: HeadphoneTrial[];
    correctCount: number;
    passed: boolean;
  } | null;
  practiceTrials: DiscriminationTrial[];
  mainTrials: DiscriminationTrial[];
  identificationPracticeTrials: IdentificationTrial[];
  identificationMainTrials: IdentificationTrial[];
  staircases: StaircaseSummary[];
  finalThresholdHz: number | null;
  finalThresholdCents: number | null;
  taskType: "fdl-2afc" | "identification";
  configVersion: string;
  appVersion: string;
}
