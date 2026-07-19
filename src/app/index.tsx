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
import { useAppColors, type AppColors } from '@/ui/app-theme';

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
            <Pressable
              onPress={onImport}
              disabled={busy}
              style={({ pressed }) => [styles.importButton, (pressed || busy) && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.importLabel}>＋ Import PDF</Text>
              )}
            </Pressable>
            {busy && (
              <Text style={[styles.busyHint, { color: colors.text }]}>
                {progressText ?? 'Analyzing your book…'}
              </Text>
            )}
            {dueCount > 0 && !busy && (
              <Pressable
                onPress={() => router.push('/review')}
                style={({ pressed }) => [
                  styles.duePill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  🃏 {dueCount} {dueCount === 1 ? 'word' : 'words'} ready to review →
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
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Your library is empty
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.text }]}>
                Import an English PDF — a story, a novel, a book — and start reading.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <BookCard
            book={item}
            colors={colors}
            onOpen={() => router.push({ pathname: '/book/[id]', params: { id: item.id } })}
            onLongPress={() => onDelete(item)}
          />
        )}
      />
    </View>
  );
}

function BookCard({
  book,
  colors,
  onOpen,
  onLongPress,
}: {
  book: BookSummary;
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
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        {book.coverUri && (
          <Image
            source={{ uri: book.coverUri }}
            style={styles.cover}
            contentFit="cover"
            transition={150}
          />
        )}
        {book.cefr && (
          <View style={styles.cefrBadge}>
            <Text style={styles.cefrText}>{book.cefr}</Text>
          </View>
        )}
        <Text
          style={[styles.cardTitle, { color: colors.text }]}
          numberOfLines={book.coverUri ? 2 : 3}
        >
          {book.title}
        </Text>
        {book.author && (
          <Text style={[styles.cardAuthor, { color: colors.text }]} numberOfLines={1}>
            {book.author}
          </Text>
        )}
      </View>
      <View>
        <Text style={[styles.cardMeta, { color: colors.text }]}>
          {book.chapterCount} chapters · {(book.wordCount / 1000).toFixed(1)}k words
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={[styles.cardMeta, { color: colors.text }]}>
          {progressPct > 0 ? `${progressPct}% read` : 'Not started'}
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
    gap: 8,
    marginBottom: 16,
  },
  importButton: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  busyHint: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.6,
  },
  duePill: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    flex: 1,
    minHeight: 170,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8884',
    padding: 14,
    marginBottom: 12,
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTop: {
    gap: 4,
  },
  cover: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#8882',
  },
  cefrBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#208AEF22',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cefrText: {
    color: '#208AEF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardAuthor: {
    fontSize: 13,
    opacity: 0.6,
  },
  cardMeta: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8883',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#208AEF',
  },
});
