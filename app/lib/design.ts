import type { Locale, LocalizedText } from "./i18n";
import { emptyLocalized, LOCALES } from "./i18n";

export type ExperimentStatus = "draft" | "active" | "closed";
export type TaskType = "fdl-2afc" | "identification";

export interface DemographicsFields {
  age: boolean;
  gender: boolean;
  handedness: boolean;
  nativeLanguage: boolean;
  otherLanguages: boolean;
  musicalTrainingYears: boolean;
  hearingImpairment: boolean;
  hearingAids: boolean;
  headphoneType: boolean;
  environmentQuiet: boolean;
}

export interface IdentificationStimulus {
  id: string;
  src: string;
  /** Optional numeric covariate exposed to results (e.g., VOT in ms). */
  value: number | null;
  /** Optional label shown to researcher in admin only. */
  label: string;
}

export interface IdentificationCategory {
  id: string;
  label: LocalizedText;
  /** Optional keyboard shortcut, single character. */
  keyHint: string;
}

export interface IdentificationConfig {
  stimuli: IdentificationStimulus[];
  categories: IdentificationCategory[];
  numPresentationsPerStimulus: number;
  numPracticePresentationsPerStimulus: number;
  practiceFeedback: boolean;
  shuffle: boolean;
  preStimulusSilenceSec: number;
  postStimulusSilenceSec: number;
  itiSec: number;
  maxReplaysPractice: number;
  maxReplaysMain: number;
  breakAfterEvery: number;
  breakMinDurationSec: number;
  responseTimeoutSec: number;
  feedbackDurationSec: number;
  /** Optional mapping from stimulus id -> correct category id, enables feedback / scoring. */
  correctMap: Record<string, string>;
}

export interface ExperimentDesign {
  id: string;
  schemaVersion: 1;

  taskType: TaskType;
  identification: IdentificationConfig;

  title: LocalizedText;
  description: LocalizedText;

  defaultLocale: Locale;
  enabledLocales: Locale[];
  forceLocale: Locale | null;

  referenceFrequencyHz: number;
  toneDurationSec: number;
  rampDurationSec: number;
  isiSec: number;
  itiSec: number;
  outputLevel: number;
  stimulusInitialSilenceSec: number;
  stimulusFinalSilenceSec: number;

  initialDeltaHz: number;
  minDeltaHz: number;
  maxDeltaHz: number;
  largeStepFactor: number;
  smallStepFactor: number;
  stepChangeAfterReversal: number;
  reversalsToStop: number;
  reversalsToAverage: number;
  maxTrialsPerStaircase: number;
  numStaircases: number;

  practiceEnabled: boolean;
  numPracticeTrials: number;
  practiceDeltaHz: number;
  practicePassThreshold: number;

  headphoneCheckEnabled: boolean;
  numHeadphoneCheckTrials: number;
  headphoneCheckPassThreshold: number;
  headphoneCheckLevel: number;
  headphoneCheckToneDurationSec: number;
  headphoneCheckFreqHz: number;

  breakAfterEvery: number;
  breakMinDurationSec: number;
  maxReplaysPractice: number;
  maxReplaysMain: number;
  allowUndo: boolean;
  undoWindowSec: number;

  responseTimeoutSec: number;
  feedbackDurationSec: number;

  collectDemographics: boolean;
  demographicsFields: DemographicsFields;
  minAge: number;
  maxAge: number;

  consentVersion: string;
  consentTextOverride: LocalizedText | null;
  institution: string;
  irbReference: string;
  contactEmail: string;

  status: ExperimentStatus;
  createdAt: string;
  updatedAt: string;
}

function defaultIdentificationConfig(): IdentificationConfig {
  return {
    stimuli: [],
    categories: [],
    numPresentationsPerStimulus: 10,
    numPracticePresentationsPerStimulus: 2,
    practiceFeedback: true,
    shuffle: true,
    preStimulusSilenceSec: 0.2,
    postStimulusSilenceSec: 0.1,
    itiSec: 0.6,
    maxReplaysPractice: 1,
    maxReplaysMain: 0,
    breakAfterEvery: 30,
    breakMinDurationSec: 10,
    responseTimeoutSec: 5,
    feedbackDurationSec: 0.5,
    correctMap: {},
  };
}

export function makeDefaultDesign(id: string, now = new Date()): ExperimentDesign {
  const iso = now.toISOString();
  return {
    id,
    schemaVersion: 1,

    taskType: "fdl-2afc",
    identification: defaultIdentificationConfig(),

    title: {
      ja: "周波数弁別実験",
      en: "Frequency Discrimination Experiment",
      ko: "주파수 변별 실험",
      zh: "频率辨别实验",
    },
    description: {
      ja: "1000 Hz 付近の純音で、より高い音を識別する2区間2選択強制選択課題です。約15分。",
      en: "A 2-interval forced-choice task identifying the higher pure tone near 1000 Hz. About 15 minutes.",
      ko: "1000 Hz 부근 순음에서 더 높은 음을 식별하는 2구간 2지선다 과제입니다. 약 15분.",
      zh: "在 1000 Hz 附近的纯音中辨别更高音的 2 间隔强制选择任务。约 15 分钟。",
    },

    defaultLocale: "ja",
    enabledLocales: [...LOCALES],
    forceLocale: null,

    referenceFrequencyHz: 1000,
    toneDurationSec: 0.2,
    rampDurationSec: 0.01,
    isiSec: 0.5,
    itiSec: 0.6,
    outputLevel: 0.25,
    stimulusInitialSilenceSec: 0.1,
    stimulusFinalSilenceSec: 0.0,

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

    practiceEnabled: true,
    numPracticeTrials: 8,
    practiceDeltaHz: 200,
    practicePassThreshold: 5,

    headphoneCheckEnabled: true,
    numHeadphoneCheckTrials: 6,
    headphoneCheckPassThreshold: 5,
    headphoneCheckLevel: 0.3,
    headphoneCheckToneDurationSec: 0.5,
    headphoneCheckFreqHz: 600,

    breakAfterEvery: 30,
    breakMinDurationSec: 10,
    maxReplaysPractice: 2,
    maxReplaysMain: 0,
    allowUndo: true,
    undoWindowSec: 4,

    responseTimeoutSec: 5,
    feedbackDurationSec: 0.5,

    collectDemographics: true,
    demographicsFields: {
      age: true,
      gender: true,
      handedness: true,
      nativeLanguage: true,
      otherLanguages: true,
      musicalTrainingYears: true,
      hearingImpairment: true,
      hearingAids: true,
      headphoneType: true,
      environmentQuiet: true,
    },
    minAge: 18,
    maxAge: 90,

    consentVersion: "v1-2026-05",
    consentTextOverride: null,
    institution: "",
    irbReference: "",
    contactEmail: "",

    status: "draft",
    createdAt: iso,
    updatedAt: iso,
  };
}

/** Construct a VOT identification design preloaded with the bundled stimuli. */
export function makeVotDefaultDesign(id = "vot-default", now = new Date()): ExperimentDesign {
  const base = makeDefaultDesign(id, now);
  const vots = [0, 10, 20, 30, 40];
  const stimuli: IdentificationStimulus[] = vots.map((ms) => ({
    id: `vot_${String(ms).padStart(2, "0")}ms`,
    src: `/stimuli/vot-default/vot_${String(ms).padStart(2, "0")}ms.wav`,
    value: ms,
    label: `VOT ${ms} ms`,
  }));
  const categories: IdentificationCategory[] = [
    {
      id: "ba",
      label: { ja: "「ば」", en: "/ba/", ko: "「바」", zh: "「ba」" },
      keyHint: "1",
    },
    {
      id: "pa",
      label: { ja: "「ぱ」", en: "/pa/", ko: "「파」", zh: "「pa」" },
      keyHint: "2",
    },
  ];
  return {
    ...base,
    taskType: "identification",
    title: {
      ja: "VOT カテゴリ知覚実験 (/ba/–/pa/)",
      en: "VOT Category Perception (/ba/–/pa/)",
      ko: "VOT 범주 지각 실험 (/ba/–/pa/)",
      zh: "VOT 范畴感知实验 (/ba/–/pa/)",
    },
    description: {
      ja: "0〜40 ms の VOT 連続体に沿った合成音を聴き、「ば」と「ぱ」のどちらに聞こえたかを判断する識別課題。約10分。",
      en: "An identification task: hear a synthesised syllable along the 0–40 ms VOT continuum and decide whether it sounded like /ba/ or /pa/. About 10 minutes.",
      ko: "0~40 ms VOT 연속체 합성음을 듣고 /ba/와 /pa/ 중 어느 쪽으로 들리는지 판단하는 범주 지각 과제. 약 10분.",
      zh: "0–40 ms VOT 连续体的合成音节，判断听到的是 /ba/ 还是 /pa/。约 10 分钟。",
    },
    identification: {
      ...defaultIdentificationConfig(),
      stimuli,
      categories,
      numPresentationsPerStimulus: 10,
      numPracticePresentationsPerStimulus: 1,
      shuffle: true,
      preStimulusSilenceSec: 0.3,
      postStimulusSilenceSec: 0.1,
      itiSec: 0.6,
      maxReplaysPractice: 1,
      maxReplaysMain: 0,
      breakAfterEvery: 25,
      breakMinDurationSec: 5,
      responseTimeoutSec: 5,
      feedbackDurationSec: 0.4,
      practiceFeedback: false,
      correctMap: {},
    },
    headphoneCheckEnabled: true,
    practiceEnabled: true,
  };
}

export const DESIGN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,32}$/;

export function isValidDesignId(id: string): boolean {
  return DESIGN_ID_PATTERN.test(id);
}

function isLocalizedTextPartial(v: unknown): v is Partial<LocalizedText> {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Object.entries(o).every(([k, val]) => {
    if (!(["ja", "en", "ko", "zh"] as const).includes(k as Locale)) return false;
    return typeof val === "string";
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sanitizeDesign(
  base: ExperimentDesign,
  patch: unknown,
): ExperimentDesign {
  if (!patch || typeof patch !== "object")
    return { ...base, updatedAt: new Date().toISOString() };
  const p = patch as Record<string, unknown>;
  const d: ExperimentDesign = { ...base };

  const setLocalized = (key: keyof ExperimentDesign) => {
    const v = p[key as string];
    if (isLocalizedTextPartial(v)) {
      const merged = { ...emptyLocalized(), ...(base[key] as LocalizedText), ...v };
      (d as unknown as Record<string, unknown>)[key as string] = merged;
    }
  };

  setLocalized("title");
  setLocalized("description");

  if (typeof p.defaultLocale === "string" && LOCALES.includes(p.defaultLocale as Locale)) {
    d.defaultLocale = p.defaultLocale as Locale;
  }
  if (Array.isArray(p.enabledLocales)) {
    const arr = p.enabledLocales.filter(
      (x): x is Locale => typeof x === "string" && LOCALES.includes(x as Locale),
    );
    if (arr.length > 0) d.enabledLocales = Array.from(new Set(arr)) as Locale[];
  }
  if (p.forceLocale === null) d.forceLocale = null;
  else if (
    typeof p.forceLocale === "string" &&
    LOCALES.includes(p.forceLocale as Locale)
  ) {
    d.forceLocale = p.forceLocale as Locale;
  }

  const numFields: [keyof ExperimentDesign, number, number][] = [
    ["referenceFrequencyHz", 50, 20000],
    ["toneDurationSec", 0.02, 5],
    ["rampDurationSec", 0.001, 0.5],
    ["isiSec", 0, 5],
    ["itiSec", 0, 10],
    ["outputLevel", 0.01, 1],
    ["stimulusInitialSilenceSec", 0, 5],
    ["stimulusFinalSilenceSec", 0, 5],
    ["initialDeltaHz", 0.1, 5000],
    ["minDeltaHz", 0.01, 1000],
    ["maxDeltaHz", 1, 10000],
    ["largeStepFactor", 1.01, 10],
    ["smallStepFactor", 1.001, 10],
    ["stepChangeAfterReversal", 1, 20],
    ["reversalsToStop", 2, 30],
    ["reversalsToAverage", 2, 30],
    ["maxTrialsPerStaircase", 5, 500],
    ["numStaircases", 1, 5],
    ["numPracticeTrials", 0, 100],
    ["practiceDeltaHz", 0.1, 5000],
    ["practicePassThreshold", 0, 100],
    ["numHeadphoneCheckTrials", 0, 30],
    ["headphoneCheckPassThreshold", 0, 30],
    ["headphoneCheckLevel", 0.01, 1],
    ["headphoneCheckToneDurationSec", 0.05, 5],
    ["headphoneCheckFreqHz", 50, 20000],
    ["breakAfterEvery", 0, 500],
    ["breakMinDurationSec", 0, 300],
    ["maxReplaysPractice", 0, 20],
    ["maxReplaysMain", 0, 20],
    ["undoWindowSec", 0, 60],
    ["responseTimeoutSec", 0, 60],
    ["feedbackDurationSec", 0, 5],
    ["minAge", 0, 120],
    ["maxAge", 1, 130],
  ];

  for (const [key, lo, hi] of numFields) {
    const v = p[key as string];
    if (typeof v === "number" && Number.isFinite(v)) {
      (d as unknown as Record<string, number>)[key as string] = clamp(v, lo, hi);
    }
  }

  if (typeof p.practiceEnabled === "boolean") d.practiceEnabled = p.practiceEnabled;
  if (typeof p.headphoneCheckEnabled === "boolean")
    d.headphoneCheckEnabled = p.headphoneCheckEnabled;
  if (typeof p.allowUndo === "boolean") d.allowUndo = p.allowUndo;
  if (typeof p.collectDemographics === "boolean")
    d.collectDemographics = p.collectDemographics;

  if (p.demographicsFields && typeof p.demographicsFields === "object") {
    const df = p.demographicsFields as Record<string, unknown>;
    const next: DemographicsFields = { ...base.demographicsFields };
    for (const k of Object.keys(next) as (keyof DemographicsFields)[]) {
      if (typeof df[k] === "boolean") next[k] = df[k] as boolean;
    }
    d.demographicsFields = next;
  }

  if (typeof p.consentVersion === "string" && p.consentVersion.length <= 80)
    d.consentVersion = p.consentVersion;
  if (p.consentTextOverride === null) {
    d.consentTextOverride = null;
  } else if (isLocalizedTextPartial(p.consentTextOverride)) {
    d.consentTextOverride = {
      ...emptyLocalized(),
      ...(base.consentTextOverride ?? {}),
      ...p.consentTextOverride,
    } as LocalizedText;
  }
  if (typeof p.institution === "string" && p.institution.length <= 200)
    d.institution = p.institution;
  if (typeof p.irbReference === "string" && p.irbReference.length <= 100)
    d.irbReference = p.irbReference;
  if (typeof p.contactEmail === "string" && p.contactEmail.length <= 200)
    d.contactEmail = p.contactEmail;

  if (
    typeof p.status === "string" &&
    (p.status === "draft" || p.status === "active" || p.status === "closed")
  ) {
    d.status = p.status as ExperimentStatus;
  }

  if (
    typeof p.taskType === "string" &&
    (p.taskType === "fdl-2afc" || p.taskType === "identification")
  ) {
    d.taskType = p.taskType as TaskType;
  }

  if (p.identification && typeof p.identification === "object") {
    d.identification = sanitizeIdentification(
      base.identification ?? defaultIdentificationConfig(),
      p.identification,
    );
  }

  d.updatedAt = new Date().toISOString();
  return d;
}

function sanitizeIdentification(
  base: IdentificationConfig,
  patch: unknown,
): IdentificationConfig {
  if (!patch || typeof patch !== "object") return base;
  const p = patch as Record<string, unknown>;
  const out: IdentificationConfig = { ...base };

  if (Array.isArray(p.stimuli)) {
    const stims: IdentificationStimulus[] = [];
    for (const raw of p.stimuli.slice(0, 200)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.slice(0, 64) : "";
      const src = typeof r.src === "string" ? r.src.slice(0, 512) : "";
      if (!id || !src) continue;
      if (!/^[a-zA-Z0-9_./-]+$/.test(src)) continue;
      const value =
        typeof r.value === "number" && Number.isFinite(r.value) ? r.value : null;
      const label = typeof r.label === "string" ? r.label.slice(0, 120) : id;
      stims.push({ id, src, value, label });
    }
    out.stimuli = stims;
  }

  if (Array.isArray(p.categories)) {
    const cats: IdentificationCategory[] = [];
    for (const raw of p.categories.slice(0, 20)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.slice(0, 32) : "";
      if (!id) continue;
      const labelInput =
        r.label && typeof r.label === "object"
          ? (r.label as Record<string, unknown>)
          : {};
      const labelMerged: LocalizedText = {
        ...emptyLocalized(),
        ...(["ja", "en", "ko", "zh"] as Locale[]).reduce<Record<string, string>>(
          (acc, loc) => {
            const v = labelInput[loc];
            if (typeof v === "string") acc[loc] = v.slice(0, 80);
            return acc;
          },
          {},
        ),
      } as LocalizedText;
      const keyHint =
        typeof r.keyHint === "string" ? r.keyHint.slice(0, 2) : "";
      cats.push({ id, label: labelMerged, keyHint });
    }
    out.categories = cats;
  }

  if (typeof p.correctMap === "object" && p.correctMap !== null) {
    const cm = p.correctMap as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(cm)) {
      if (typeof v === "string" && v.length <= 32 && k.length <= 64) next[k] = v;
    }
    out.correctMap = next;
  }

  const numFields: [keyof IdentificationConfig, number, number][] = [
    ["numPresentationsPerStimulus", 1, 100],
    ["numPracticePresentationsPerStimulus", 0, 20],
    ["preStimulusSilenceSec", 0, 5],
    ["postStimulusSilenceSec", 0, 5],
    ["itiSec", 0, 10],
    ["maxReplaysPractice", 0, 20],
    ["maxReplaysMain", 0, 20],
    ["breakAfterEvery", 0, 500],
    ["breakMinDurationSec", 0, 300],
    ["responseTimeoutSec", 0, 60],
    ["feedbackDurationSec", 0, 5],
  ];
  for (const [k, lo, hi] of numFields) {
    const v = p[k as string];
    if (typeof v === "number" && Number.isFinite(v)) {
      (out as unknown as Record<string, number>)[k as string] = clamp(v, lo, hi);
    }
  }
  if (typeof p.shuffle === "boolean") out.shuffle = p.shuffle;
  if (typeof p.practiceFeedback === "boolean")
    out.practiceFeedback = p.practiceFeedback;

  return out;
}
