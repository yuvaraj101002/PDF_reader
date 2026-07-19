import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { HighlightRecord } from '@/db/types';
import { lookupWord } from '@/dictionary';
import { DefinitionList } from '@/dictionary/definition-list';
import type { DictionaryResult } from '@/dictionary/types';
import { BottomSheetModal } from '@/ui/bottom-sheet';

import type { ReaderPalette } from './settings';
import { HIGHLIGHT_COLORS, type HighlightColor } from './tokens';

export interface Selection {
  kind: 'word' | 'sentence';
  text: string;
  start: number;
  end: number;
  /** existing highlight covering this selection, if any */
  existing?: HighlightRecord;
}

interface Props {
  selection: Selection | null;
  palette: ReaderPalette;
  onClose: () => void;
  onHighlight: (color: HighlightColor) => void;
  onRemoveHighlight: () => void;
  /** save (or clear, with '') the note for this selection's highlight */
  onSaveNote: (note: string) => void;
  /** called after a successful lookup; resolves true when newly saved to vocab */
  onWordLookedUp?: (result: DictionaryResult) => Promise<boolean>;
}

/**
 * Action sheet for a tapped word / long-pressed sentence:
 * Speak (expo-speech) · highlight colors · remove · note view/editor.
 * Define becomes live with the dictionary milestone.
 */
export function SelectionSheet({
  selection,
  palette,
  onClose,
  onHighlight,
  onRemoveHighlight,
  onSaveNote,
  onWordLookedUp,
}: Props) {
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [definition, setDefinition] = useState<DictionaryResult | 'loading' | 'none' | null>(null);
  const [vocabState, setVocabState] = useState<'new' | 'known' | null>(null);

  useEffect(() => {
    setNoteMode(false);
    setNoteText(selection?.existing?.note ?? '');
    setVocabState(null);
    // Eager offline dictionary lookup for single words — the core learner flow.
    if (selection?.kind === 'word') {
      let stale = false;
      setDefinition('loading');
      lookupWord(selection.text)
        .then(async (result) => {
          if (stale) return;
          setDefinition(result ?? 'none');
          if (result && onWordLookedUp) {
            const isNew = await onWordLookedUp(result);
            if (!stale) setVocabState(isNew ? 'new' : 'known');
          }
        })
        .catch(() => !stale && setDefinition('none'));
      return () => {
        stale = true;
      };
    }
    setDefinition(null);
    return undefined;
  }, [selection, onWordLookedUp]);

  if (!selection) return null;

  const speak = (rate: number) => {
    Speech.stop();
    Speech.speak(selection.text, { language: 'en-US', rate });
  };

  const existingNote = selection.existing?.note;

  return (
    <BottomSheetModal open onClose={onClose} surfaceColor={palette.surface}>
      {selection.kind === 'word' ? (
        <View style={styles.wordHeader}>
          <Text style={[styles.word, { color: palette.text }]}>{selection.text}</Text>
          {typeof definition === 'object' && definition?.ipa && (
            <Text style={[styles.ipa, { color: palette.subtle }]}>{definition.ipa}</Text>
          )}
        </View>
      ) : (
        <Text style={[styles.sentence, { color: palette.text }]} numberOfLines={3}>
          “{selection.text}”
        </Text>
      )}

      {noteMode ? (
        <View>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            multiline
            autoFocus
            placeholder="Write your note…"
            placeholderTextColor={palette.subtle}
            style={[
              styles.noteInput,
              {
                color: palette.text,
                borderColor: palette.border,
                backgroundColor: palette.background,
              },
            ]}
          />
          <View style={styles.noteButtons}>
            <ActionButton label="Cancel" palette={palette} onPress={() => setNoteMode(false)} />
            {existingNote !== undefined && (
              <ActionButton label="Delete note" palette={palette} onPress={() => onSaveNote('')} />
            )}
            <Pressable
              onPress={() => onSaveNote(noteText.trim())}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: palette.accent },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.saveLabel}>Save note</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {existingNote !== undefined && (
            <Pressable
              onPress={() => setNoteMode(true)}
              style={[styles.noteCard, { backgroundColor: palette.background, borderColor: palette.border }]}
            >
              <Text style={{ color: palette.subtle, fontSize: 11, fontWeight: '700' }}>NOTE</Text>
              <Text style={{ color: palette.text, fontSize: 14, lineHeight: 20 }}>
                {existingNote}
              </Text>
              <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '600' }}>
                Tap to edit
              </Text>
            </Pressable>
          )}

          <View style={styles.actionRow}>
            <ActionButton label="🔊 Speak" palette={palette} onPress={() => speak(1.0)} />
            <ActionButton label="🐢 Slow" palette={palette} onPress={() => speak(0.65)} />
            <ActionButton
              label={existingNote !== undefined ? '📝 Edit note' : '📝 Note'}
              palette={palette}
              onPress={() => setNoteMode(true)}
            />
          </View>

          {/* offline dictionary */}
          {definition === 'loading' && <ActivityIndicator style={styles.dictLoading} />}
          {definition === 'none' && (
            <Text style={[styles.hint, { color: palette.subtle }]}>
              Not in the dictionary — it may be a name or a rare form.
            </Text>
          )}
          {typeof definition === 'object' && definition !== null && (
            <View style={styles.definitions}>
              <DefinitionList
                result={definition}
                colors={{ text: palette.text, subtle: palette.subtle, accent: palette.accent }}
              />
              {vocabState && (
                <Text style={[styles.vocabState, { color: palette.subtle }]}>
                  {vocabState === 'new'
                    ? '⭐ Added to your Vocabulary Book'
                    : 'In your Vocabulary Book'}
                </Text>
              )}
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: palette.subtle }]}>Highlight</Text>
          <View style={styles.colorRow}>
            {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
              <Pressable
                key={color}
                onPress={() => onHighlight(color)}
                style={({ pressed }) => [
                  styles.colorDot,
                  { backgroundColor: HIGHLIGHT_COLORS[color], borderColor: palette.border },
                  pressed && styles.pressed,
                ]}
              />
            ))}
            {selection.existing && (
              <Pressable
                onPress={onRemoveHighlight}
                style={({ pressed }) => [
                  styles.removeButton,
                  { borderColor: palette.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={{ color: '#d33', fontSize: 13, fontWeight: '600' }}>
                  Remove highlight
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </BottomSheetModal>
  );
}

function ActionButton({
  label,
  palette,
  onPress,
}: {
  label: string;
  palette: ReaderPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 14,
  },
  word: {
    fontSize: 26,
    fontWeight: '700',
  },
  ipa: {
    fontSize: 16,
  },
  dictLoading: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  definitions: {
    marginTop: 14,
  },
  vocabState: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  sentence: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeButton: {
    marginLeft: 'auto',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  hint: {
    marginTop: 14,
    fontSize: 13,
  },
  noteCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  noteInput: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  noteButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButton: {
    marginLeft: 'auto',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  saveLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
