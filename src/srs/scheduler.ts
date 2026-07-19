/**
 * Spaced-repetition scheduler — simplified SM-2 (Anki-style).
 * Pure functions; persistence lives on the vocab entry (db/types.ts).
 *
 * intervalDays === 0 means "new/learning card".
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsState {
  intervalDays: number;
  /** difficulty multiplier, clamped to >= 1.3 (SM-2 convention) */
  easeFactor: number;
  reviewCount: number;
}

export interface SrsUpdate extends SrsState {
  dueAt: number;
}

export const newSrsState = (): SrsState => ({
  intervalDays: 0,
  easeFactor: 2.5,
  reviewCount: 0,
});

const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;
const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function reviewCard(state: SrsState, grade: Grade, now: number): SrsUpdate {
  let { intervalDays, easeFactor } = state;
  const reviewCount = state.reviewCount + 1;

  if (grade === 'again') {
    return {
      intervalDays: 0,
      easeFactor: Math.max(MIN_EASE, easeFactor - 0.2),
      reviewCount,
      dueAt: now + AGAIN_DELAY_MS,
    };
  }

  if (grade === 'hard') {
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
    intervalDays = intervalDays === 0 ? 0.5 : intervalDays * 1.2;
  } else if (grade === 'good') {
    intervalDays = intervalDays === 0 ? 1 : intervalDays * easeFactor;
  } else {
    // easy
    easeFactor += 0.15;
    intervalDays = intervalDays === 0 ? 3 : intervalDays * easeFactor * 1.3;
  }

  intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
  return {
    intervalDays,
    easeFactor,
    reviewCount,
    dueAt: now + Math.round(intervalDays * DAY_MS),
  };
}

/** Compact "what happens if I press this" hint for grade buttons: 10m, 12h, 3d… */
export function intervalHint(state: SrsState, grade: Grade, now: number): string {
  const ms = reviewCard(state, grade, now).dueAt - now;
  if (ms < 60 * 60 * 1000) return `${Math.max(1, Math.round(ms / 60000))}m`;
  if (ms < DAY_MS) return `${Math.round(ms / (60 * 60 * 1000))}h`;
  return `${Math.round(ms / DAY_MS)}d`;
}
