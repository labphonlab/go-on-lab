// SM-2 spaced-repetition scheduler (AGENTS.md: "集中反復モードは作らない" — every
// review always reschedules forward; there is no cram/repeat-until-correct mode).
export type Quality = 0 | 1 | 2 | 3 | 4 | 5; // 0-2 = fail (again), 3-5 = pass (hard/good/easy)

export interface CardState {
  repetition: number;
  interval: number; // days
  efactor: number;
  due: string; // ISO date
}

export function initCardState(now: Date): CardState {
  return { repetition: 0, interval: 0, efactor: 2.5, due: now.toISOString() };
}

export function isDue(state: CardState, now: Date): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}

export function reviewCard(state: CardState, quality: Quality, now: Date): CardState {
  let { repetition, interval } = state;
  let { efactor } = state;

  if (quality < 3) {
    // Lapse: resurfaces immediately, interleaved with other due cards — not
    // repeated back-to-back, since that would be the massed-practice mode
    // AGENTS.md rules out.
    repetition = 0;
    interval = 0;
  } else {
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else interval = Math.round(interval * efactor);
    repetition += 1;
  }

  efactor = Math.max(1.3, efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const due = new Date(now);
  due.setDate(due.getDate() + interval);

  return { repetition, interval, efactor, due: due.toISOString() };
}
