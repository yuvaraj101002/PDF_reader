import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DictionaryResult } from './types';

interface Colors {
  text: string;
  subtle: string;
  accent: string;
}

/** Dictionary senses list — shared by the reader's selection sheet and the Vocabulary Book. */
export function DefinitionList({
  result,
  colors,
  maxHeight = 230,
}: {
  result: DictionaryResult;
  colors: Colors;
  maxHeight?: number;
}) {
  return (
    <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
      {result.word !== result.requested.toLowerCase() && (
        <Text style={[styles.lemmaNote, { color: colors.subtle }]}>
          form of <Text style={styles.lemmaWord}>{result.word}</Text>
        </Text>
      )}
      {result.entries.slice(0, 4).map((entry, index) => (
        <View key={index} style={styles.senseRow}>
          <Text style={[styles.posBadge, { color: colors.accent }]}>{entry.pos}</Text>
          <View style={styles.senseBody}>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
              {entry.definition}
            </Text>
            {entry.example && (
              <Text style={[styles.example, { color: colors.subtle }]}>“{entry.example}”</Text>
            )}
            {entry.synonyms.length > 0 && (
              <Text style={[styles.synonyms, { color: colors.subtle }]}>
                ≈ {entry.synonyms.slice(0, 4).join(', ')}
              </Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lemmaNote: {
    fontSize: 13,
    marginBottom: 8,
  },
  lemmaWord: {
    fontWeight: '700',
  },
  senseRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  posBadge: {
    fontSize: 12,
    fontWeight: '700',
    width: 38,
    textTransform: 'uppercase',
  },
  senseBody: {
    flex: 1,
    gap: 3,
  },
  example: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  synonyms: {
    fontSize: 13,
  },
});
