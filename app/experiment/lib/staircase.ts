export interface StaircaseConfig {
  initialDelta: number;
  minDelta: number;
  maxDelta: number;
  largeStepFactor: number;
  smallStepFactor: number;
  stepChangeAfterReversal: number;
  reversalsToStop: number;
  reversalsToAverage: number;
  maxTrials: number;
}

export interface StaircaseState {
  id: number;
  delta: number;
  consecutiveCorrect: number;
  direction: "up" | "down" | "init";
  reversalCount: number;
  reversalDeltas: number[];
  trialCount: number;
  stepFactor: number;
  finished: boolean;
  history: { delta: number; correct: boolean; reversal: boolean }[];
}

export function createStaircase(id: number, cfg: StaircaseConfig): StaircaseState {
  return {
    id,
    delta: cfg.initialDelta,
    consecutiveCorrect: 0,
    direction: "init",
    reversalCount: 0,
    reversalDeltas: [],
    trialCount: 0,
    stepFactor: cfg.largeStepFactor,
    finished: false,
    history: [],
  };
}

export function updateStaircase(
  s: StaircaseState,
  correct: boolean,
  cfg: StaircaseConfig,
): StaircaseState {
  if (s.finished) return s;
  const next: StaircaseState = {
    ...s,
    history: [...s.history, { delta: s.delta, correct, reversal: false }],
    trialCount: s.trialCount + 1,
  };

  let nextDirection: "up" | "down" = s.direction === "init" ? "down" : s.direction;
  let newConsecutiveCorrect = s.consecutiveCorrect;
  let stepUpdate = false;

  if (correct) {
    newConsecutiveCorrect = s.consecutiveCorrect + 1;
    if (newConsecutiveCorrect >= 2) {
      stepUpdate = true;
      nextDirection = "down";
      newConsecutiveCorrect = 0;
    }
  } else {
    stepUpdate = true;
    nextDirection = "up";
    newConsecutiveCorrect = 0;
  }

  let reversal = false;
  if (stepUpdate && s.direction !== "init" && nextDirection !== s.direction) {
    reversal = true;
  }

  next.consecutiveCorrect = newConsecutiveCorrect;

  if (stepUpdate) {
    let factor = s.stepFactor;
    if (reversal) {
      next.reversalCount = s.reversalCount + 1;
      next.reversalDeltas = [...s.reversalDeltas, s.delta];
      next.history[next.history.length - 1].reversal = true;
      if (next.reversalCount >= cfg.stepChangeAfterReversal) {
        factor = cfg.smallStepFactor;
      }
    }
    next.stepFactor = factor;

    let newDelta =
      nextDirection === "down" ? s.delta / factor : s.delta * factor;
    newDelta = Math.min(cfg.maxDelta, Math.max(cfg.minDelta, newDelta));
    next.delta = newDelta;
    next.direction = nextDirection;
  }

  if (
    next.reversalCount >= cfg.reversalsToStop ||
    next.trialCount >= cfg.maxTrials
  ) {
    next.finished = true;
  }
  return next;
}

export function geometricMean(values: number[]): number {
  if (values.length === 0) return NaN;
  const sumLn = values.reduce((acc, v) => acc + Math.log(v), 0);
  return Math.exp(sumLn / values.length);
}

export function computeThreshold(
  s: StaircaseState,
  cfg: StaircaseConfig,
): number | null {
  const n = cfg.reversalsToAverage;
  if (s.reversalDeltas.length < n) return null;
  const used = s.reversalDeltas.slice(-n);
  return geometricMean(used);
}

export function hzToCents(deltaHz: number, refHz: number): number {
  return 1200 * Math.log2((refHz + deltaHz) / refHz);
}
