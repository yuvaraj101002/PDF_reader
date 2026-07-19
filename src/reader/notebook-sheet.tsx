import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HighlightRecord } from '@/db/types';
import { exportTextFile, sanitizeFilename } from '@/lib/export';
import { BottomSheetModal } from '@/ui/bottom-sheet';

import type { ReaderPalette } from './settings';
import { highlightFill } from './tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  palette: ReaderPalette;
  bookTitle: string;
  highlights: HighlightRecord[];
  chapterTitles: string[];
  /** jump the reader to a stored highlight */
  onJump: (chapterIndex: number, offset: number) => void;
}

function notesAsText(bookTitle: string, highlights: HighlightRecord[], chapterTitles: string[]) {
  const lines = [`# ${bookTitle} — Highlights & Notes`, ''];
  let lastChapter = -1;
  for (const h of highlights) {
    if (h.chapterIndex !== lastChapter) {
      lastChapter = h.chapterIndex;
      lines.push(`## ${chapterTitles[h.chapterIndex] ?? `Chapter ${h.chapterIndex + 1}`}`, '');
    }
    lines.push(`> "${h.snippet}"`);
    if (h.note) lines.push(`Note: ${h.note}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Notebook — every highlight and note in this book, tap to jump back to it. */
export function NotebookSheet({
  open,
  onClose,
  palette,
  bookTitle,
  highlights,
  chapterTitles,
  onJump,
}: Props) {
  return (
    <BottomSheetModal open={open} onClose={onClose} surfaceColor={palette.surface}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: palette.text }]}>
          Notebook{highlights.length > 0 ? ` · ${highlights.length}` : ''}
        </Text>
        {highlights.length > 0 && (
          <Pressable
            onPress={() =>
              void exportTextFile(
                `${sanitizeFilename(bookTitle)}-notes.txt`,
                notesAsText(bookTitle, highlights, chapterTitles),
                'text/plain',
              )
            }
            style={({ pressed }) => [
              styles.exportButton,
              { borderColor: palette.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={{ color: palette.accent, fontSize: 13, fontWeight: '600' }}>
              ⬇ Export
            </Text>
          </Pressable>
        )}
      </View>

      {highlights.length === 0 ? (
        <Text style={[styles.empty, { color: palette.subtle }]}>
          Nothing saved yet. Tap a word or long-press a sentence while reading, then highlight it
          or add a note — everything collects here.
        </Text>
      ) : (
        // ScrollView (not FlatList): virtualized lists collapse to zero height
        // inside this modal on web, and notebook lists are small anyway.
        <ScrollView style={styles.list}>
          {highlights.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onJump(item.chapterIndex, item.startOffset)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: palette.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.colorBar, { backgroundColor: highlightFill(item.color) }]} />
              <View style={styles.rowBody}>
                <Text style={[styles.snippet, { color: palette.text }]} numberOfLines={2}>
                  “{item.snippet}”
                </Text>
                {item.note && (
                  <Text style={[styles.note, { color: palette.text }]} numberOfLines={3}>
                    📝 {item.note}
                  </Text>
                )}
                <Text style={[styles.meta, { color: palette.subtle }]}>
                  {chapterTitles[item.chapterIndex] ?? `Chapter ${item.chapterIndex + 1}`} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  exportButton: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    paddingBottom: 12,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  snippet: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.6,
  },
});
