import * as Speech from 'expo-speech';
import { create } from 'zustand';

import type { TextRange } from '@/extraction/types';

/**
 * Read-aloud controller. Speaks a chapter sentence-by-sentence (exact ranges
 * from extraction) so that:
 * - sentence-level karaoke highlighting works on EVERY platform,
 * - pause/resume and speed changes restart cleanly at a sentence boundary,
 * - utterances stay short (Android TTS input limits).
 * Where the engine emits word-boundary events (web Chrome/Edge, iOS), the
 * currently spoken word is tracked too (`word`), for word-level karaoke.
 */

export type TtsStatus = 'idle' | 'playing' | 'paused';

export const TTS_RATES = [0.65, 0.85, 1, 1.25] as const;

interface PlayArgs {
  chapterText: string;
  sentences: TextRange[];
  startIndex: number;
}

interface TtsState {
  status: TtsStatus;
  sentenceIndex: number;
  /** currently spoken sentence, in chapter offsets */
  sentence: TextRange | null;
  /** currently spoken word, when boundary events are available */
  word: TextRange | null;
  rate: number;
  /** true once a real word-boundary event has been observed (spike telemetry) */
  boundarySupported: boolean;
  play: (args: PlayArgs) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  cycleRate: () => void;
}

/** invalidates in-flight speech callbacks after stop/pause/rate change */
let generation = 0;
let current: PlayArgs | null = null;

const wordLengthAt = (text: string, start: number): number => {
  const match = /^\S+/.exec(text.slice(start, start + 60));
  return match ? match[0].length : 1;
};

export const useTts = create<TtsState>()((set, get) => {
  const speakFrom = (index: number): void => {
    const args = current;
    if (!args) return;
    if (index >= args.sentences.length) {
      generation += 1;
      current = null;
      set({ status: 'idle', sentence: null, word: null });
      return;
    }
    generation += 1;
    const gen = generation;
    const sentence = args.sentences[index];
    set({ status: 'playing', sentenceIndex: index, sentence, word: null });
    Speech.stop();
    Speech.speak(args.chapterText.slice(sentence.start, sentence.end), {
      language: 'en-US',
      rate: get().rate,
      onDone: () => {
        if (generation === gen && get().status === 'playing') speakFrom(index + 1);
      },
      onBoundary: (event: { charIndex?: number; charLength?: number } | null) => {
        if (generation !== gen || typeof event?.charIndex !== 'number') return;
        const start = sentence.start + event.charIndex;
        const length =
          typeof event.charLength === 'number' && event.charLength > 0
            ? event.charLength
            : wordLengthAt(args.chapterText, start);
        set({ word: { start, end: start + length }, boundarySupported: true });
      },
    } as Speech.SpeechOptions);
  };

  return {
    status: 'idle',
    sentenceIndex: 0,
    sentence: null,
    word: null,
    rate: 1,
    boundarySupported: false,

    play: (args) => {
      current = args;
      speakFrom(Math.max(0, args.startIndex));
    },
    pause: () => {
      generation += 1; // keep `current` so resume can continue
      Speech.stop();
      set({ status: 'paused', word: null });
    },
    resume: () => {
      if (current) speakFrom(get().sentenceIndex);
    },
    stop: () => {
      generation += 1;
      current = null;
      Speech.stop();
      set({ status: 'idle', sentence: null, word: null });
    },
    cycleRate: () => {
      const rates = TTS_RATES as readonly number[];
      const next = rates[(rates.indexOf(get().rate) + 1) % rates.length];
      set({ rate: next });
      if (get().status === 'playing') speakFrom(get().sentenceIndex);
    },
  };
});
