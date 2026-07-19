import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repo } from '@/db/repo';
import type { BookSummary } from '@/db/types';
import { importPdf } from '@/extraction';
import { FONT, useAppColors, type AppColors } from '@/ui/app-theme';

const COVER_EMOJI = ['📖', '🌸', '🚀', '🦋', '🐣', '🌈', '🧸', '🌻'];

function greeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning!', emoji: '☀️' };
  if (hour < 17) return { text: 'Good afternoon!', emoji: '🌤️' };
  return { text: 'Good evening!', emoji: '🌙' };
}

/** Library — saved books grid + PDF import. */
export default function LibraryScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [bookList, setBookList] = useState<BookSummary[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    repo
      .listBooks()
      .then(setBookList)
      .catch((loadError) => setError(String(loadError?.message ?? loadError)));
    repo
      .listDueVocab(Date.now())
      .then((due) => setDueCount(due.length))
      .catch(() => setDueCount(0));
  }, []);

  // Refresh on every visit — progress badges and due counts change while away.
  useFocusEffect(reload);

  const onImport = async () => {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0];
    setBusy(true);
    setProgressText('Reading the file…');
    try {
      const imported = await importPdf(asset.uri, asset.name ?? 'Untitled.pdf', (done, total) =>
        setProgressText(`Analyzing page ${done} of ${total}…`),
      );
      setProgressText('Detecting chapters…');
      const saved = await repo.saveImportedBook(imported, asset.uri);
      reload();
      router.push({ pathname: '/book/[id]', params: { id: saved.id } });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setBusy(false);
      setProgressText(null);
    }
  };

  const onDelete = (book: BookSummary) => {
    const doDelete = () => repo.deleteBook(book.id).then(reload);
    if (Platform.OS === 'web') {
      // RN Alert is a no-op on web
      if (window.confirm(`Remove "${book.title}" from your library?`)) void doDelete();
      return;
    }
    Alert.alert('Remove book', `Remove "${book.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  const hello = greeting();
  // most recently read, unfinished book (listBooks sorts by lastReadAt desc)
  const continueBook =
    bookList?.find((book) => book.lastReadAt !== undefined && book.progress < 0.99) ?? null;

  return (
    <View style={styles.screen}>
      <FlatList
        data={bookList ?? []}
        keyExtractor={(book) => book.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.greetingBlock}>
              <Text style={[styles.greeting, { color: colors.text }]}>
                {hello.text} {hello.emoji}
              </Text>
              <Text style={[styles.greetingSub, { color: colors.subtle }]}>
                What shall we read today?
              </Text>
            </View>
            {continueBook && !busy && (
              <ContinueCard
                book={continueBook}
                colors={colors}
                onOpen={() =>
                  router.push({ pathname: '/book/[id]', params: { id: continueBook.id } })
                }
              />
            )}
            <Pressable
              onPress={onImport}
              disabled={busy}
              style={({ pressed }) => [
                styles.importButton,
                { backgroundColor: colors.accent },
                (pressed || busy) && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.importLabel}>＋ Add a new book</Text>
              )}
            </Pressable>
            {busy && (
              <Text style={[styles.busyHint, { color: colors.subtle }]}>
                {progressText ?? 'Analyzing your book…'}
              </Text>
            )}
            {dueCount > 0 && !busy && (
              <Pressable
                onPress={() => router.push('/review')}
                style={({ pressed }) => [
                  styles.duePill,
                  { backgroundColor: colors.accentSoft },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={{ color: colors.accent, fontSize: 14, fontFamily: FONT.bold }}>
                  🃏 {dueCount} {dueCount === 1 ? 'word' : 'words'} ready to practice →
                </Text>
              </Pressable>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          bookList === null ? (
            <ActivityIndicator style={styles.empty} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📚</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Your library is waiting
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.subtle }]}>
                Add an English PDF — a story, a novel, a book — and start your reading adventure.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <BookCard
            book={item}
            index={index}
            colors={colors}
            onOpen={() => router.push({ pathname: '/book/[id]', params: { id: item.id } })}
            onLongPress={() => onDelete(item)}
          />
        )}
      />
    </View>
  );
}

function ContinueCard({
  book,
  colors,
  onOpen,
}: {
  book: BookSummary;
  colors: AppColors;
  onOpen: () => void;
}) {
  const progressPct = Math.round(book.progress * 100);
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.continueCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      {book.coverUri ? (
        <Image source={{ uri: book.coverUri }} style={styles.continueCover} contentFit="cover" />
      ) : (
        <View
          style={[styles.continueCover, styles.coverFallback, { backgroundColor: colors.secondarySoft }]}
        >
          <Text style={{ fontSize: 26 }}>📖</Text>
        </View>
      )}
      <View style={styles.continueBody}>
        <Text style={[styles.continueLabel, { color: colors.accent }]}>CONTINUE READING</Text>
        <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.subtle }]}>
          Ch. {book.currentChapter + 1}/{book.chapterCount} ·{' '}
          {progressPct > 0 ? `${progressPct}% read` : 'just started'}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.accentSoft }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.accent, width: `${Math.max(2, progressPct)}%` },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.continueChevron, { color: colors.accent }]}>›</Text>
    </Pressable>
  );
}

function BookCard({
  book,
  index,
  colors,
  onOpen,
  onLongPress,
}: {
  book: BookSummary;
  index: number;
  colors: AppColors;
  onOpen: () => void;
  onLongPress: () => void;
}) {
  const progressPct = Math.round(book.progress * 100);
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        {book.coverUri ? (
          <Image
            source={{ uri: book.coverUri }}
            style={styles.cover}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.cover, styles.coverFallback, { backgroundColor: colors.secondarySoft }]}>
            <Text style={styles.coverEmoji}>{COVER_EMOJI[index % COVER_EMOJI.length]}</Text>
          </View>
        )}
        {book.cefr && (
          <View style={[styles.cefrBadge, { backgroundColor: colors.secondarySoft }]}>
            <Text style={[styles.cefrText, { color: colors.secondary }]}>{book.cefr}</Text>
          </View>
        )}
        <Text
          style={[styles.cardTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {book.title}
        </Text>
        {book.author && (
          <Text style={[styles.cardAuthor, { color: colors.subtle }]} numberOfLines={1}>
            {book.author}
          </Text>
        )}
      </View>
      <View>
        <Text style={[styles.cardMeta, { color: colors.subtle }]}>
          {book.chapterCount} chapters · {(book.wordCount / 1000).toFixed(1)}k words
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.accentSoft }]}>
          <View
            style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progressPct}%` }]}
          />
        </View>
        <Text style={[styles.cardMeta, { color: colors.subtle }]}>
          {progressPct > 0 ? `${progressPct}% read 🎉` : 'Ready to start ✨'}
        </Text>
      </View>
    </Pressable>
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
  row: {
    gap: 12,
  },
  header: {
    gap: 10,
    marginBottom: 16,
  },
  greetingBlock: {
    gap: 2,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 24,
    fontFamily: FONT.heading,
  },
  greetingSub: {
    fontSize: 14,
    fontFamily: FONT.semibold,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    boxShadow: '0 4px 14px rgba(59, 48, 73, 0.08)',
  },
  continueCover: {
    width: 52,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#8882',
  },
  continueBody: {
    flex: 1,
    gap: 3,
  },
  continueLabel: {
    fontSize: 11,
    fontFamily: FONT.heading,
    letterSpacing: 0.6,
  },
  continueTitle: {
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  continueChevron: {
    fontSize: 30,
    fontFamily: FONT.heading,
    paddingHorizontal: 4,
  },
  importButton: {
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    boxShadow: '0 6px 16px rgba(242, 104, 140, 0.35)',
  },
  importLabel: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  busyHint: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FONT.semibold,
  },
  duePill: {
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  error: {
    color: '#d33',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 19,
    fontFamily: FONT.heading,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONT.semibold,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 21,
  },
  card: {
    flex: 1,
    minHeight: 170,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
    justifyContent: 'space-between',
    gap: 10,
    boxShadow: '0 4px 14px rgba(59, 48, 73, 0.07)',
  },
  cardTop: {
    gap: 4,
  },
  cover: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#8882',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 40,
  },
  cefrBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cefrText: {
    fontSize: 12,
    fontFamily: FONT.heading,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  cardAuthor: {
    fontSize: 13,
    fontFamily: FONT.semibold,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: FONT.semibold,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
