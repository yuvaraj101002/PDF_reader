import type { ReadingDay } from '@/db/types';

/**
 * Streak & stats math over ReadingDay rows. Day keys are LOCAL calendar days
 * ("2026-07-19") so a streak follows the reader's clock, not UTC.
 */

/** local day key for a date, e.g. "2026-07-19" */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function prevKey(key: string): string {
  const date = keyToDate(key);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

/** the last `n` day keys ending at `today`, ascending */
export function lastNDays(n: number, today: string = dayKey()): string[] {
  const keys: string[] = [today];
  for (let i = 1; i < n; i++) keys.unshift(prevKey(keys[0]));
  return keys;
}

export interface Streaks {
  current: number;
  best: number;
}

/**
 * current — consecutive days ending today, or ending yesterday when today has
 * no reading yet (the streak isn't lost until the day is over).
 * best — longest run ever recorded.
 */
export function computeStreaks(days: ReadingDay[], today: string = dayKey()): Streaks {
  const set = new Set(days.filter((day) => day.seconds > 0).map((day) => day.date));

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of [...set].sort()) {
    run = previous !== null && prevKey(key) === previous ? run + 1 : 1;
    if (run > best) best = run;
    previous = key;
  }

  let current = 0;
  let cursor = set.has(today) ? today : prevKey(today);
  while (set.has(cursor)) {
    current++;
    cursor = prevKey(cursor);
  }

  return { current, best: Math.max(best, current) };
}

/** "0 min" · "<1 min" · "23 min" · "2h 5m" */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 min';
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
