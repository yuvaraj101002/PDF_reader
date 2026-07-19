import { useEffect } from 'react';
import { AppState } from 'react-native';

import { repo } from '@/db/repo';

import { dayKey } from './streaks';

const TICK_MS = 15_000;
/** a tick gap larger than this means the JS was suspended — don't credit it */
const MAX_CREDIT_MS = 60_000;

/**
 * Accumulates active reading time into today's ReadingDay row while `enabled`.
 * Mount it once on the reader screen. Ticks every 15s; time only counts while
 * the app is foregrounded, and suspended gaps (backgrounded native app,
 * throttled web tab) are dropped rather than credited.
 */
export function useReadingTimer(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let last = Date.now();
    let pendingMs = 0;

    const credit = () => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      if (AppState.currentState === 'active' && delta > 0 && delta < MAX_CREDIT_MS) {
        pendingMs += delta;
      }
    };

    const flush = () => {
      const seconds = Math.floor(pendingMs / 1000);
      if (seconds < 1) return;
      pendingMs -= seconds * 1000;
      repo.addReadingSeconds(dayKey(), seconds).catch(() => {
        // stats are best-effort — never break reading over them
      });
    };

    const timer = setInterval(() => {
      credit();
      flush();
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      credit();
      flush();
    };
  }, [enabled]);
}
