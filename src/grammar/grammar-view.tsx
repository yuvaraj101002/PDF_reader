import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReaderPalette } from '@/reader/settings';
import { FONT } from '@/ui/app-theme';

import { POS_INFO, POS_ORDER, tagSentence, type PosCategory } from './tagger';

/** word-chip fill: legend color at low alpha, readable on every palette */
const fill = (category: PosCategory) => `${POS_INFO[category].color}2E`;

/**
 * Grammar-lite view of one sentence: every word as a chip tinted by its part
 * of speech, with a legend of just the categories present.
 */
export function GrammarView({ text, palette }: { text: string; palette: ReaderPalette }) {
  const words = useMemo(() => tagSentence(text), [text]);

  const present = useMemo(() => {
    const seen = new Set(words.map((word) => word.pos));
    return POS_ORDER.filter((category) => seen.has(category));
  }, [words]);

  return (
    <ScrollView style={styles.scroll}>
      <View style={styles.sentence}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordGroup}>
            <Text
              style={[
                styles.word,
                { color: palette.text },
                word.pos !== 'other' && { backgroundColor: fill(word.pos) },
              ]}
            >
              {word.text}
            </Text>
            {word.post.trim().length > 0 && (
              <Text style={[styles.punctuation, { color: palette.subtle }]}>
                {word.post.trim()}
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        {present.map((category) => (
          <View key={category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: POS_INFO[category].color }]} />
            <Text style={[styles.legendLabel, { color: palette.subtle }]}>
              {POS_INFO[category].label}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    marginBottom: 14,
  },
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 6,
  },
  wordGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5,
  },
  word: {
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  punctuation: {
    fontSize: 16,
    lineHeight: 24,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 6,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: FONT.semibold,
  },
});
