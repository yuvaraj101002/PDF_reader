import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repo } from '@/db/repo';
import type { BookmarkRecord, BookSummary, HighlightRecord } from '@/db/types';
import type { BookContent, TextRange } from '@/extraction/types';
import { NotebookSheet } from '@/reader/notebook-sheet';
import { ParagraphText, type HighlightSpan } from '@/reader/paragraph-text';
import { SelectionSheet, type Selection } from '@/reader/selection-sheet';
import { TocSheet } from '@/reader/toc-sheet';
import {
  READER_PALETTES,
  useReaderSettings,
  type ReaderTheme,
} from '@/reader/settings';
import { cleanWord, type HighlightColor, type WordToken } from '@/reader/tokens';
import { useTts } from '@/reader/tts';
import { TtsPlayerBar } from '@/reader/tts-player';
import { BottomSheetModal } from '@/ui/bottom-sheet';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
const POSITION_SAVE_DEBOUNCE_MS = 800;

interface ParagraphItem {
  key: string;
  index: number;
  start: number;
  text: string;
}

/** Reader — reflowable Reading Mode for one book. */
export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, fontSize, setTheme, adjustFontSize } = useReaderSettings();
  const palette = READER_PALETTES[theme];

  const [book, setBook] = useState<BookSummary | null>(null);
  const [content, setContent] = useState<BookContent | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightList, setHighlightList] = useState<HighlightRecord[]>([]);
  const [bookmarkList, setBookmarkList] = useState<BookmarkRecord[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  const listRef = useRef<FlatList<ParagraphItem>>(null);
  const pendingRestoreOffset = useRef<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVisibleOffset = useRef(0);

  // ── read-aloud (karaoke) ──────────────────────────────────────────────────
  const ttsStatus = useTts((s) => s.status);
  const ttsSentence = useTts((s) => s.sentence);
  const ttsWord = useTts((s) => s.word);
  useEffect(() => () => useTts.getState().stop(), []); // stop on leave

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    Promise.all([
      repo.getBook(id),
      repo.getBookContent(id),
      repo.listHighlights(id),
      repo.listBookmarks(id),
    ])
      .then(([summary, bookContent, storedHighlights, storedBookmarks]) => {
        if (!summary || !bookContent) {
          setLoadError('This book could not be loaded.');
          return;
        }
        setBook(summary);
        setContent(bookContent);
        setHighlightList(storedHighlights);
        setBookmarkList(storedBookmarks);
        setChapterIndex(Math.min(summary.currentChapter, bookContent.chapters.length - 1));
        pendingRestoreOffset.current = summary.currentOffset;
      })
      .catch((error) => setLoadError(String(error?.message ?? error)));
  }, [id]);

  const chapter = content?.chapters[chapterIndex];

  const paragraphs = useMemo<ParagraphItem[]>(() => {
    if (!chapter) return [];
    return chapter.paragraphs.map((paragraph, index) => ({
      key: `${chapterIndex}:${index}`,
      index,
      start: paragraph.start,
      text: chapter.text.slice(paragraph.start, paragraph.end),
    }));
  }, [chapter, chapterIndex]);

  /** cumulative char count before each chapter, for whole-book progress */
  const chapterStarts = useMemo(() => {
    if (!content) return [0];
    const starts: number[] = [];
    let total = 0;
    for (const c of content.chapters) {
      starts.push(total);
      total += c.text.length;
    }
    starts.push(total); // sentinel: total length
    return starts;
  }, [content]);

  // ── position save ─────────────────────────────────────────────────────────
  const positionContext = useRef({
    id: '',
    chapterIndex: 0,
    chapterStarts: [0],
    paragraphs: [] as ParagraphItem[],
  });
  positionContext.current = { id: id ?? '', chapterIndex, chapterStarts, paragraphs };

  const savePosition = useCallback((offset: number) => {
    const ctx = positionContext.current;
    if (!ctx.id) return;
    const total = ctx.chapterStarts[ctx.chapterStarts.length - 1] || 1;
    const progress = Math.min(1, (ctx.chapterStarts[ctx.chapterIndex] + offset) / total);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void repo.updatePosition(ctx.id, { chapter: ctx.chapterIndex, offset, progress });
    }, POSITION_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  // Stable viewability callback (FlatList requires it not to change identity).
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item as ParagraphItem | undefined;
    if (first) {
      lastVisibleOffset.current = first.start;
      savePosition(first.start);
      // "~N min left in chapter" at ~200 wpm (≈6 chars per word)
      const ctx = positionContext.current;
      const chapterLength =
        ctx.chapterStarts[ctx.chapterIndex + 1] - ctx.chapterStarts[ctx.chapterIndex];
      if (chapterLength > 0) {
        setMinutesLeft(Math.max(1, Math.ceil((chapterLength - first.start) / 6 / 200)));
      }
    }
  });

  // ── position restore ──────────────────────────────────────────────────────
  const restoreScroll = useCallback(() => {
    const offset = pendingRestoreOffset.current;
    if (offset === null || offset === 0 || paragraphs.length === 0) {
      pendingRestoreOffset.current = null;
      return;
    }
    const index = paragraphs.findIndex(
      (p, i) => offset >= p.start && (i + 1 >= paragraphs.length || offset < paragraphs[i + 1].start),
    );
    pendingRestoreOffset.current = null;
    if (index > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
      }, 80);
    }
  }, [paragraphs]);

  // Run restores whenever the paragraph set changes (initial load + jumps).
  useEffect(restoreScroll, [restoreScroll]);

  // Fresh chapter → full-chapter reading-time estimate until scrolling refines it.
  useEffect(() => {
    if (chapter) setMinutesLeft(Math.max(1, Math.ceil(chapter.text.length / 6 / 200)));
  }, [chapter]);

  const goToChapter = useCallback(
    (nextChapter: number, offset = 0) => {
      useTts.getState().stop();
      setTocOpen(false);
      setNotebookOpen(false);
      const ctxNow = positionContext.current;
      if (nextChapter === ctxNow.chapterIndex && offset > 0) {
        // Same-chapter jump (search hit / notebook entry): paragraphs won't
        // change, so scroll directly instead of via the restore effect.
        const index = ctxNow.paragraphs.findIndex(
          (p, i) =>
            offset >= p.start &&
            (i + 1 >= ctxNow.paragraphs.length || offset < ctxNow.paragraphs[i + 1].start),
        );
        if (index >= 0) {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 });
          }, 120);
        }
      } else {
        setChapterIndex(nextChapter);
        // offset > 0 = jump target (e.g. from the Notebook) — restored once the
        // chapter's paragraphs render.
        pendingRestoreOffset.current = offset > 0 ? offset : null;
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
      const ctx = positionContext.current;
      const total = ctx.chapterStarts[ctx.chapterStarts.length - 1] || 1;
      void repo.updatePosition(ctx.id, {
        chapter: nextChapter,
        offset,
        progress: Math.min(1, (ctx.chapterStarts[nextChapter] + offset) / total),
      });
    },
    [],
  );

  // ── selection & highlights ────────────────────────────────────────────────
  const findExistingHighlight = useCallback(
    (start: number, end: number) =>
      highlightList.find(
        (h) => h.chapterIndex === chapterIndex && start < h.endOffset && end > h.startOffset,
      ),
    [highlightList, chapterIndex],
  );

  const onPressWord = useCallback(
    (token: WordToken) => {
      const word = cleanWord(token.text);
      if (!word) return;
      setSelection({
        kind: 'word',
        text: word,
        start: token.start,
        end: token.end,
        existing: findExistingHighlight(token.start, token.end),
      });
    },
    [findExistingHighlight],
  );

  /** exact sentence range containing a chapter offset (from extraction data) */
  const findSentenceAt = useCallback(
    (offset: number) => {
      const paragraph = chapter?.paragraphs.find((p) => offset >= p.start && offset < p.end);
      const sentence = paragraph?.sentences.find((s) => offset >= s.start && offset < s.end);
      return sentence ?? paragraph ?? null;
    },
    [chapter],
  );

  const onLongPressWord = useCallback(
    (token: WordToken) => {
      if (!chapter) return;
      // Expand to the containing sentence (exact ranges from extraction).
      const range = findSentenceAt(token.start);
      const start = range?.start ?? token.start;
      const end = range?.end ?? token.end;
      setSelection({
        kind: 'sentence',
        text: chapter.text.slice(start, end).trim(),
        start,
        end,
        existing: findExistingHighlight(start, end),
      });
    },
    [chapter, findSentenceAt, findExistingHighlight],
  );

  /** toggle a bookmark at the top visible paragraph */
  const onToggleBookmark = useCallback(async () => {
    if (!id || !chapter) return;
    const offset = lastVisibleOffset.current;
    const paragraph = chapter.paragraphs.find((p) => offset >= p.start && offset < p.end);
    // Existing bookmark within the current paragraph → remove (toggle off).
    const existing = bookmarkList.find(
      (b) =>
        b.chapterIndex === chapterIndex &&
        paragraph !== undefined &&
        b.charOffset >= paragraph.start &&
        b.charOffset < paragraph.end,
    );
    if (existing) {
      await repo.removeBookmark(existing.id);
      setBookmarkList((prev) => prev.filter((b) => b.id !== existing.id));
      return;
    }
    const label = chapter.text
      .slice(paragraph?.start ?? offset, (paragraph?.start ?? offset) + 60)
      .replace(/\s+/g, ' ')
      .trim();
    const record = await repo.addBookmark({
      bookId: id,
      chapterIndex,
      charOffset: paragraph?.start ?? offset,
      label,
    });
    setBookmarkList((prev) =>
      [...prev, record].sort(
        (a, b) => a.chapterIndex - b.chapterIndex || a.charOffset - b.charOffset,
      ),
    );
  }, [id, chapter, chapterIndex, bookmarkList]);

  const onRemoveBookmark = useCallback(async (bookmarkId: string) => {
    await repo.removeBookmark(bookmarkId);
    setBookmarkList((prev) => prev.filter((b) => b.id !== bookmarkId));
  }, []);

  /** auto-save every successfully looked-up word into the Vocabulary Book */
  const onWordLookedUp = useCallback(
    async (result: import('@/dictionary/types').DictionaryResult) => {
      if (!selection || !id || !chapter) return false;
      const sentenceRange = findSentenceAt(selection.start);
      const { isNew } = await repo.addVocabEntry({
        word: selection.text,
        lemma: result.word,
        bookId: id,
        chapterIndex,
        charOffset: selection.start,
        sentence: sentenceRange
          ? chapter.text.slice(sentenceRange.start, sentenceRange.end).trim()
          : undefined,
      });
      return isNew;
    },
    [selection, id, chapter, chapterIndex, findSentenceAt],
  );

  const onHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!selection || !id) return;
      // Re-coloring: replace the existing highlight covering this selection.
      if (selection.existing) {
        await repo.removeHighlight(selection.existing.id);
        setHighlightList((prev) => prev.filter((h) => h.id !== selection.existing!.id));
      }
      const record = await repo.addHighlight({
        bookId: id,
        chapterIndex,
        startOffset: selection.existing?.startOffset ?? selection.start,
        endOffset: selection.existing?.endOffset ?? selection.end,
        color,
        snippet: selection.text.slice(0, 300),
      });
      setHighlightList((prev) => [...prev, record]);
      setSelection(null);
    },
    [selection, id, chapterIndex],
  );

  const onRemoveHighlight = useCallback(async () => {
    const existing = selection?.existing;
    if (!existing) return;
    await repo.removeHighlight(existing.id);
    setHighlightList((prev) => prev.filter((h) => h.id !== existing.id));
    setSelection(null);
  }, [selection]);

  const onSaveNote = useCallback(
    async (note: string) => {
      if (!selection || !id) return;
      const trimmed = note.trim();
      if (selection.existing) {
        await repo.updateHighlightNote(selection.existing.id, trimmed || null);
        setHighlightList((prev) =>
          prev.map((h) =>
            h.id === selection.existing!.id ? { ...h, note: trimmed || undefined } : h,
          ),
        );
      } else if (trimmed) {
        // A note on plain text implies a highlight to anchor it.
        const record = await repo.addHighlight({
          bookId: id,
          chapterIndex,
          startOffset: selection.start,
          endOffset: selection.end,
          color: 'yellow',
          snippet: selection.text.slice(0, 300),
          note: trimmed,
        });
        setHighlightList((prev) => [...prev, record]);
      }
      setSelection(null);
    },
    [selection, id, chapterIndex],
  );

  /** flat sentence list for the chapter — the read-aloud playlist */
  const sentences = useMemo<TextRange[]>(
    () => chapter?.paragraphs.flatMap((p) => p.sentences) ?? [],
    [chapter],
  );

  const startListening = useCallback(() => {
    if (!chapter) return;
    const fromOffset = lastVisibleOffset.current;
    const startIndex = Math.max(
      0,
      sentences.findIndex((s) => s.end > fromOffset),
    );
    useTts.getState().play({ chapterText: chapter.text, sentences, startIndex });
  }, [chapter, sentences]);

  // Auto-scroll to keep the spoken sentence in view (only across paragraphs).
  const lastAutoScrolledParagraph = useRef(-1);
  useEffect(() => {
    if (!ttsSentence || ttsStatus !== 'playing') {
      lastAutoScrolledParagraph.current = -1;
      return;
    }
    const index = paragraphs.findIndex(
      (p) => ttsSentence.start >= p.start && ttsSentence.start < p.start + p.text.length,
    );
    if (index >= 0 && index !== lastAutoScrolledParagraph.current) {
      lastAutoScrolledParagraph.current = index;
      try {
        listRef.current?.scrollToIndex({ index, viewPosition: 0.25, animated: true });
      } catch {
        // unmeasured target — FlatList will land close enough via failure handler
      }
    }
  }, [ttsSentence, ttsStatus, paragraphs]);

  /** highlights per visible paragraph, in HighlightSpan shape */
  const paragraphHighlights = useMemo(() => {
    const byParagraph = new Map<number, HighlightSpan[]>();
    const inChapter = highlightList.filter((h) => h.chapterIndex === chapterIndex);
    if (inChapter.length === 0) return byParagraph;
    for (const item of paragraphs) {
      const spans = inChapter
        .filter((h) => h.endOffset > item.start && h.startOffset < item.start + item.text.length)
        .map((h) => ({
          id: h.id,
          startOffset: h.startOffset,
          endOffset: h.endOffset,
          color: h.color,
          hasNote: h.note !== undefined,
        }));
      if (spans.length > 0) byParagraph.set(item.index, spans);
    }
    return byParagraph;
  }, [highlightList, chapterIndex, paragraphs]);

  // ── render ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: palette.text }}>{loadError}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: palette.accent, marginTop: 12 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  if (!book || !content || !chapter) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator />
      </View>
    );
  }

  const isFirstChapter = chapterIndex === 0;
  const isLastChapter = chapterIndex >= content.chapters.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* top bar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <BarButton label="‹" palette={palette} onPress={() => router.back()} />
        <View style={styles.topBarTitleWrap}>
          <Text style={[styles.topBarTitle, { color: palette.text }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.topBarSubtitle, { color: palette.subtle }]} numberOfLines={1}>
            Ch. {chapterIndex + 1}/{content.chapters.length}
            {minutesLeft !== null ? ` · ~${minutesLeft} min` : ''}
          </Text>
        </View>
        <BarButton
          label="🎧"
          palette={palette}
          onPress={() => (ttsStatus === 'idle' ? startListening() : useTts.getState().stop())}
        />
        <BarButton label="🔖" palette={palette} onPress={() => void onToggleBookmark()} />
        <BarButton label="📔" palette={palette} onPress={() => setNotebookOpen(true)} />
        <BarButton label="☰" palette={palette} onPress={() => setTocOpen(true)} />
        <BarButton label="Aa" palette={palette} onPress={() => setSettingsOpen(true)} />
      </View>

      {/* chapter body */}
      <FlatList
        ref={listRef}
        data={paragraphs}
        keyExtractor={(item) => item.key}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 10, minimumViewTime: 150 }}
        onLayout={restoreScroll}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
        }}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: 32 + insets.bottom }]}
        ListHeaderComponent={
          <Text style={[styles.chapterTitle, { color: palette.text }]}>{chapter.title}</Text>
        }
        renderItem={({ item }) => {
          const paragraphEnd = item.start + item.text.length;
          const within = (range: TextRange | null): TextRange | undefined =>
            range && range.start < paragraphEnd && range.end > item.start ? range : undefined;
          return (
            <ParagraphText
              text={item.text}
              baseOffset={item.start}
              fontSize={fontSize}
              color={palette.text}
              fontFamily={SERIF}
              highlights={paragraphHighlights.get(item.index)}
              activeSentence={within(ttsSentence)}
              activeWord={within(ttsWord)}
              sentenceFill={`${palette.accent}26`}
              wordFill={`${palette.accent}59`}
              onPressWord={onPressWord}
              onLongPressWord={onLongPressWord}
            />
          );
        }}
        ListFooterComponent={
          <View style={styles.chapterNav}>
            {!isFirstChapter && (
              <NavButton
                label="‹ Previous chapter"
                palette={palette}
                onPress={() => goToChapter(chapterIndex - 1)}
              />
            )}
            {!isLastChapter && (
              <NavButton
                label="Next chapter ›"
                palette={palette}
                onPress={() => goToChapter(chapterIndex + 1)}
              />
            )}
          </View>
        }
      />

      {/* table of contents + in-book search + bookmarks */}
      <TocSheet
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        palette={palette}
        content={content}
        currentChapter={chapterIndex}
        bookmarks={bookmarkList}
        onJump={goToChapter}
        onRemoveBookmark={(bookmarkId) => void onRemoveBookmark(bookmarkId)}
      />

      {/* appearance settings */}
      <BottomSheetModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        surfaceColor={palette.surface}
      >
        <Text style={[styles.sheetTitle, { color: palette.text }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {(Object.keys(READER_PALETTES) as ReaderTheme[]).map((themeKey) => (
            <Pressable
              key={themeKey}
              onPress={() => setTheme(themeKey)}
              style={[
                styles.themeSwatch,
                {
                  backgroundColor: READER_PALETTES[themeKey].background,
                  borderColor: theme === themeKey ? palette.accent : palette.border,
                  borderWidth: theme === themeKey ? 2 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text style={{ color: READER_PALETTES[themeKey].text, fontSize: 16 }}>Aa</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.fontRow}>
          <NavButton label="A −" palette={palette} onPress={() => adjustFontSize(-1)} />
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '600' }}>{fontSize}</Text>
          <NavButton label="A +" palette={palette} onPress={() => adjustFontSize(1)} />
        </View>
      </BottomSheetModal>

      {/* word / sentence actions */}
      <SelectionSheet
        selection={selection}
        palette={palette}
        onClose={() => setSelection(null)}
        onHighlight={(color) => void onHighlight(color)}
        onRemoveHighlight={() => void onRemoveHighlight()}
        onSaveNote={(note) => void onSaveNote(note)}
        onWordLookedUp={onWordLookedUp}
      />

      {/* notebook: all highlights & notes in this book */}
      <NotebookSheet
        open={notebookOpen}
        onClose={() => setNotebookOpen(false)}
        palette={palette}
        bookTitle={book.title}
        highlights={highlightList}
        chapterTitles={content.chapters.map((c) => c.title)}
        onJump={goToChapter}
      />

      {/* read-aloud mini player */}
      <TtsPlayerBar palette={palette} />
    </View>
  );
}

function BarButton({
  label,
  palette,
  onPress,
}: {
  label: string;
  palette: { text: string };
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.barButton, pressed && styles.pressed]}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function NavButton({
  label,
  palette,
  onPress,
}: {
  label: string;
  palette: { surface: string; text: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        { backgroundColor: palette.surface },
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  topBarTitleWrap: {
    flex: 1,
    marginHorizontal: 4,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  topBarSubtitle: {
    fontSize: 12,
  },
  barButton: {
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  chapterTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: SERIF,
    marginBottom: 20,
  },
  chapterNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
    marginBottom: 48,
  },
  navButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  themeSwatch: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
