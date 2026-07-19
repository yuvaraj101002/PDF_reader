import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { BookmarkRecord } from '@/db/types';
import type { BookContent } from '@/extraction/types';
import { BottomSheetModal } from '@/ui/bottom-sheet';

import type { ReaderPalette } from './settings';

interface SearchHit {
  chapterIndex: number;
  offset: number;
  snippet: string;
}

const MAX_HITS = 50;

function searchBook(lowerChapters: string[], content: BookContent, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  const hits: SearchHit[] = [];
  if (query.length < 2) return hits;
  for (let chapterIndex = 0; chapterIndex < lowerChapters.length; chapterIndex++) {
    const lower = lowerChapters[chapterIndex];
    const original = content.chapters[chapterIndex].text;
    let from = 0;
    while (hits.length < MAX_HITS) {
      const at = lower.indexOf(query, from);
      if (at === -1) break;
      const start = Math.max(0, at - 40);
      const end = Math.min(original.length, at + query.length + 40);
      hits.push({
        chapterIndex,
        offset: at,
        snippet: `${start > 0 ? '…' : ''}${original.slice(start, end).replace(/\s+/g, ' ')}${end < original.length ? '…' : ''}`,
      });
      from = at + query.length;
    }
    if (hits.length >= MAX_HITS) break;
  }
  return hits;
}

/** Contents sheet: chapter list + full-book text search, jump on tap. */
export function TocSheet({
  open,
  onClose,
  palette,
  content,
  currentChapter,
  bookmarks,
  onJump,
  onRemoveBookmark,
}: {
  open: boolean;
  onClose: () => void;
  palette: ReaderPalette;
  content: BookContent;
  currentChapter: number;
  bookmarks: BookmarkRecord[];
  onJump: (chapterIndex: number, offset?: number) => void;
  onRemoveBookmark: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const lowerChapters = useMemo(
    () => content.chapters.map((chapter) => chapter.text.toLowerCase()),
    [content],
  );
  const hits = useMemo(
    () => (query.trim().length >= 2 ? searchBook(lowerChapters, content, query) : null),
    [query, lowerChapters, content],
  );

  return (
    <BottomSheetModal open={open} onClose={onClose} surfaceColor={palette.surface}>
      <Text style={[styles.title, { color: palette.text }]}>Contents</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search in book…"
        placeholderTextColor={palette.subtle}
        autoCorrect={false}
        style={[
          styles.search,
          { color: palette.text, borderColor: palette.border, backgroundColor: palette.background },
        ]}
      />

      {hits === null && bookmarks.length > 0 && (
        <View style={styles.bookmarkBlock}>
          <Text style={[styles.sectionLabel, { color: palette.subtle }]}>Bookmarks</Text>
          {bookmarks.map((bookmark) => (
            <View key={bookmark.id} style={styles.bookmarkRow}>
              <Pressable
                onPress={() => onJump(bookmark.chapterIndex, bookmark.charOffset)}
                style={({ pressed }) => [styles.bookmarkBody, pressed && styles.pressed]}
              >
                <Text numberOfLines={1} style={{ color: palette.text, fontSize: 14 }}>
                  🔖 {bookmark.label || `Chapter ${bookmark.chapterIndex + 1}`}
                </Text>
                <Text style={[styles.hitChapter, { color: palette.subtle }]}>
                  Chapter {bookmark.chapterIndex + 1}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRemoveBookmark(bookmark.id)}
                style={({ pressed }) => [styles.bookmarkRemove, pressed && styles.pressed]}
              >
                <Text style={{ color: palette.subtle, fontSize: 15 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ScrollView (not FlatList): virtualized lists collapse inside this modal on web */}
      <ScrollView style={styles.list}>
        {hits === null ? (
          content.chapters.map((item, index) => (
            <Pressable
              key={index}
              onPress={() => onJump(index)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: index === currentChapter ? palette.accent : palette.text,
                  fontWeight: index === currentChapter ? '700' : '400',
                  fontSize: 15,
                }}
              >
                {index + 1}. {item.title}
              </Text>
            </Pressable>
          ))
        ) : hits.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.subtle }]}>No matches.</Text>
        ) : (
          hits.map((item, index) => (
            <Pressable
              key={`${item.chapterIndex}:${item.offset}:${index}`}
              onPress={() => onJump(item.chapterIndex, item.offset)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.hitChapter, { color: palette.subtle }]}>
                Chapter {item.chapterIndex + 1}
              </Text>
              <Text numberOfLines={2} style={{ color: palette.text, fontSize: 14, lineHeight: 20 }}>
                {item.snippet}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  search: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  row: {
    paddingVertical: 10,
    gap: 2,
  },
  hitChapter: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bookmarkBlock: {
    marginBottom: 10,
  },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarkBody: {
    flex: 1,
    paddingVertical: 8,
    gap: 1,
  },
  bookmarkRemove: {
    padding: 8,
  },
  emptyText: {
    paddingVertical: 16,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.6,
  },
});
