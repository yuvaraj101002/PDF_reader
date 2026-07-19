import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repo } from '@/db/repo';
import type { VocabEntry } from '@/db/types';
import { lookupWord } from '@/dictionary';
import { DefinitionList } from '@/dictionary/definition-list';
import type { DictionaryResult } from '@/dictionary/types';
import { csvField, exportTextFile } from '@/lib/export';
import { FONT, useAppColors } from '@/ui/app-theme';
import { BottomSheetModal } from '@/ui/bottom-sheet';

function vocabAsCsv(entries: VocabEntry[]): string {
  const rows = [['word', 'form_seen', 'sentence', 'saved_on'].join(',')];
  for (const entry of entries) {
    rows.push(
      [
        csvField(entry.lemma),
        csvField(entry.word),
        csvField(entry.sentence),
        csvField(new Date(entry.createdAt).toISOString().slice(0, 10)),
      ].join(','),
    );
  }
  return rows.join('\n');
}

/** Vocabulary Book — every word looked up while reading, with its source sentence. */
export default function VocabularyScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<VocabEntry[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [selected, setSelected] = useState<VocabEntry | null>(null);
  const [definition, setDefinition] = useState<DictionaryResult | 'loading' | 'none'>('loading');

  const reload = useCallback(() => {
    repo.listVocab().then(setEntries).catch(() => setEntries([]));
    repo
      .listDueVocab(Date.now())
      .then((due) => setDueCount(due.length))
      .catch(() => setDueCount(0));
  }, []);
  useFocusEffect(reload);

  useEffect(() => {
    if (!selected) return;
    setDefinition('loading');
    lookupWord(selected.lemma)
      .then((result) => setDefinition(result ?? 'none'))
      .catch(() => setDefinition('none'));
  }, [selected]);

  const onDelete = (entry: VocabEntry) => {
    const doDelete = () => repo.removeVocabEntry(entry.id).then(reload);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${entry.lemma}" from your vocabulary?`)) void doDelete();
      return;
    }
    Alert.alert('Remove word', `Remove "${entry.lemma}" from your vocabulary?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={entries ?? []}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
        ListHeaderComponent={
          entries && entries.length > 0 ? (
            <View>
              <Pressable
                onPress={() => router.push('/review')}
                style={({ pressed }) => [
                  styles.reviewButton,
                  { backgroundColor: colors.accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reviewLabel}>
                  🃏 Review{dueCount > 0 ? ` · ${dueCount} due` : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void exportTextFile('vocabulary.csv', vocabAsCsv(entries), 'text/csv')
                }
                style={({ pressed }) => [
                  styles.exportButton,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={{ color: colors.accent, fontSize: 13, fontFamily: FONT.bold }}>
                  ⬇ Export CSV ({entries.length} words)
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          entries === null ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>⭐</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No words yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subtle }]}>
                Tap any word while reading — every word you look up is saved here automatically,
                with the sentence you found it in.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            onLongPress={() => onDelete(item)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowHeader}>
              <Text style={[styles.lemma, { color: colors.text }]}>{item.lemma}</Text>
              {item.word.toLowerCase() !== item.lemma && (
                <Text style={[styles.surfaceForm, { color: colors.text }]}>as “{item.word}”</Text>
              )}
              <Text style={[styles.date, { color: colors.text }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            {item.sentence && (
              <Text style={[styles.sentence, { color: colors.text }]} numberOfLines={2}>
                “{item.sentence}”
              </Text>
            )}
          </Pressable>
        )}
      />

      {/* word detail */}
      <BottomSheetModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        surfaceColor={colors.surface}
      >
        {selected && (
          <>
            <View style={styles.detailHeader}>
              <Text style={[styles.detailWord, { color: colors.text }]}>{selected.lemma}</Text>
              {typeof definition === 'object' && definition.ipa && (
                <Text style={[styles.detailIpa, { color: colors.subtle }]}>{definition.ipa}</Text>
              )}
              <Pressable
                onPress={() => {
                  Speech.stop();
                  Speech.speak(selected.lemma, { language: 'en-US' });
                }}
                style={({ pressed }) => [styles.speakButton, pressed && styles.pressed]}
              >
                <Text style={{ fontSize: 18 }}>🔊</Text>
              </Pressable>
            </View>
            {selected.sentence && (
              <Text style={[styles.detailSentence, { color: colors.subtle }]}>
                “{selected.sentence}”
              </Text>
            )}
            {definition === 'loading' && (
              <Text style={{ color: colors.subtle, marginTop: 8 }}>Loading…</Text>
            )}
            {definition === 'none' && (
              <Text style={{ color: colors.subtle, marginTop: 8 }}>
                No dictionary entry found.
              </Text>
            )}
            {typeof definition === 'object' && (
              <DefinitionList
                result={definition}
                colors={{ text: colors.text, subtle: colors.subtle, accent: colors.accent }}
                maxHeight={260}
              />
            )}
          </>
        )}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONT.heading,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONT.semibold,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  reviewButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    boxShadow: '0 6px 16px rgba(242, 104, 140, 0.3)',
  },
  reviewLabel: {
    color: '#fff',
    fontSize: 15,
    fontFamily: FONT.bold,
  },
  exportButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  row: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8884',
    padding: 14,
    marginBottom: 10,
    gap: 6,
    boxShadow: '0 3px 10px rgba(59, 48, 73, 0.05)',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  lemma: {
    fontSize: 17,
    fontFamily: FONT.bold,
  },
  surfaceForm: {
    fontSize: 13,
    opacity: 0.55,
  },
  date: {
    marginLeft: 'auto',
    fontSize: 12,
    opacity: 0.45,
  },
  sentence: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.75,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 10,
  },
  detailWord: {
    fontSize: 24,
    fontFamily: FONT.heading,
  },
  detailIpa: {
    fontSize: 15,
  },
  speakButton: {
    marginLeft: 'auto',
    padding: 6,
  },
  detailSentence: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 19,
  },
});
