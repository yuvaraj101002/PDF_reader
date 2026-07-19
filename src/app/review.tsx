import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repo } from '@/db/repo';
import type { VocabEntry } from '@/db/types';
import { lookupWord } from '@/dictionary';
import { DefinitionList } from '@/dictionary/definition-list';
import type { DictionaryResult } from '@/dictionary/types';
import { intervalHint, reviewCard, type Grade, type SrsState } from '@/srs/scheduler';
import { useAppColors } from '@/ui/app-theme';

const shuffle = <T,>(items: T[]): T[] => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const srsStateOf = (entry: VocabEntry): SrsState => ({
  intervalDays: entry.intervalDays ?? 0,
  easeFactor: entry.easeFactor ?? 2.5,
  reviewCount: entry.reviewCount ?? 0,
});

const GRADES: { grade: Grade; label: string; color: string }[] = [
  { grade: 'again', label: 'Again', color: '#E5484D' },
  { grade: 'hard', label: 'Hard', color: '#E8930C' },
  { grade: 'good', label: 'Good', color: '#30A46C' },
  { grade: 'easy', label: 'Easy', color: '#0A84FF' },
];

/** Flashcard review session over due vocabulary (SM-2 scheduling). */
export default function ReviewScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();

  const [queue, setQueue] = useState<VocabEntry[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [definition, setDefinition] = useState<DictionaryResult | 'loading' | 'none'>('loading');

  useEffect(() => {
    repo
      .listDueVocab(Date.now())
      .then((due) => setQueue(shuffle(due)))
      .catch(() => setQueue([]));
  }, []);

  const current = queue?.[index];

  // Prefetch the definition while the front of the card is showing.
  useEffect(() => {
    if (!current) return;
    setDefinition('loading');
    lookupWord(current.lemma)
      .then((result) => setDefinition(result ?? 'none'))
      .catch(() => setDefinition('none'));
  }, [current]);

  const speak = useCallback((word: string) => {
    Speech.stop();
    Speech.speak(word, { language: 'en-US' });
  }, []);

  const grade = useCallback(
    async (choice: Grade) => {
      if (!current) return;
      const update = reviewCard(srsStateOf(current), choice, Date.now());
      await repo.updateVocabSrs(current.id, update);
      if (choice === 'again') {
        // See it again before the session ends.
        setQueue((q) => (q ? [...q, { ...current, ...update }] : q));
      } else {
        setReviewedCount((count) => count + 1);
      }
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [current],
  );

  // ── session states ─────────────────────────────────────────────────────────
  if (queue === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.subtle }}>Loading…</Text>
      </View>
    );
  }

  if (!current) {
    const nothingDue = queue.length === 0;
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>{nothingDue ? '🌤' : '🎉'}</Text>
        <Text style={[styles.doneTitle, { color: colors.text }]}>
          {nothingDue ? 'Nothing due right now' : 'Session complete!'}
        </Text>
        <Text style={[styles.doneSubtitle, { color: colors.subtle }]}>
          {nothingDue
            ? 'Read a little and tap words you don’t know — they’ll show up here for review.'
            : `You reviewed ${reviewedCount} ${reviewedCount === 1 ? 'word' : 'words'}. Come back tomorrow to keep the streak alive.`}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.doneButtonLabel}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const state = srsStateOf(current);
  const now = Date.now();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingBottom: 16 + insets.bottom },
      ]}
    >
      <Text style={[styles.progress, { color: colors.subtle }]}>
        {queue.length - index} left · {reviewedCount} done
      </Text>

      {/* card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.wordRow}>
          <Text style={[styles.word, { color: colors.text }]}>{current.lemma}</Text>
          <Pressable
            onPress={() => speak(current.lemma)}
            style={({ pressed }) => [styles.speak, pressed && styles.pressed]}
          >
            <Text style={{ fontSize: 20 }}>🔊</Text>
          </Pressable>
        </View>

        {revealed ? (
          <>
            {typeof definition === 'object' && definition.ipa && (
              <Text style={[styles.ipa, { color: colors.subtle }]}>{definition.ipa}</Text>
            )}
            {current.sentence && (
              <Text style={[styles.sentence, { color: colors.subtle }]}>“{current.sentence}”</Text>
            )}
            {definition === 'loading' && (
              <Text style={{ color: colors.subtle, marginTop: 10 }}>Loading…</Text>
            )}
            {definition === 'none' && (
              <Text style={{ color: colors.subtle, marginTop: 10 }}>No dictionary entry.</Text>
            )}
            {typeof definition === 'object' && (
              <DefinitionList
                result={definition}
                colors={{ text: colors.text, subtle: colors.subtle, accent: colors.accent }}
                maxHeight={240}
              />
            )}
          </>
        ) : (
          <Text style={[styles.prompt, { color: colors.subtle }]}>
            Do you remember what this means?
          </Text>
        )}
      </View>

      {/* actions */}
      {revealed ? (
        <View style={styles.gradeRow}>
          {GRADES.map(({ grade: g, label, color }) => (
            <Pressable
              key={g}
              onPress={() => void grade(g)}
              style={({ pressed }) => [
                styles.gradeButton,
                { backgroundColor: color },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.gradeLabel}>{label}</Text>
              <Text style={styles.gradeHint}>{intervalHint(state, g, now)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => setRevealed(true)}
          style={({ pressed }) => [
            styles.showButton,
            { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.showLabel}>Show answer</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  word: {
    fontSize: 32,
    fontWeight: '700',
    flexShrink: 1,
  },
  speak: {
    padding: 6,
  },
  ipa: {
    fontSize: 16,
    marginTop: 2,
  },
  prompt: {
    marginTop: 24,
    fontSize: 15,
  },
  sentence: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 6,
  },
  showButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  showLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  gradeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  gradeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  gradeHint: {
    color: '#ffffffcc',
    fontSize: 11,
  },
  doneEmoji: {
    fontSize: 44,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  doneSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  doneButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  doneButtonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
