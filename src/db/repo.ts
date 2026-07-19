import type { ImportedBook } from '@/extraction';
import type { BookContent } from '@/extraction/types';
import { newId } from '@/lib/uuid';

import type {
  BookmarkRecord,
  BookRepo,
  BookSummary,
  HighlightRecord,
  NewBookmark,
  NewHighlight,
  NewVocabEntry,
  PositionUpdate,
  VocabEntry,
  VocabSrsUpdate,
} from './types';

/**
 * Web/default storage backend: IndexedDB. Metro picks `repo.native.ts`
 * (Drizzle + expo-sqlite) on iOS/Android — see BookRepo in types.ts.
 */

const DB_NAME = 'pdf-reader';
const DB_VERSION = 4;
/** book metadata records (BookSummary shape + deletedAt) keyed by id */
const BOOKS = 'books';
/** structured BookContent JSON keyed by book id */
const CONTENTS = 'contents';
/** HighlightRecord rows keyed by id, indexed by bookId */
const HIGHLIGHTS = 'highlights';
/** VocabEntry rows keyed by id, indexed by lemma */
const VOCAB = 'vocab';
/** BookmarkRecord rows keyed by id, indexed by bookId */
const BOOKMARKS = 'bookmarks';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS)) db.createObjectStore(BOOKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CONTENTS)) db.createObjectStore(CONTENTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(HIGHLIGHTS)) {
        const highlights = db.createObjectStore(HIGHLIGHTS, { keyPath: 'id' });
        highlights.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains(VOCAB)) {
        const vocab = db.createObjectStore(VOCAB, { keyPath: 'id' });
        vocab.createIndex('lemma', 'lemma');
      }
      if (!db.objectStoreNames.contains(BOOKMARKS)) {
        const bookmarks = db.createObjectStore(BOOKMARKS, { keyPath: 'id' });
        bookmarks.createIndex('bookId', 'bookId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function store(name: string, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

type StoredBook = BookSummary & { deletedAt?: number };

export const repo: BookRepo = {
  async saveImportedBook(imported: ImportedBook, _sourceUri: string): Promise<BookSummary> {
    const { content, analysis } = imported;
    const summary: BookSummary = {
      id: newId(),
      title: content.title,
      author: content.author,
      cefr: analysis.cefr,
      fkGrade: analysis.fkGrade,
      wordCount: analysis.wordCount,
      pageCount: analysis.pageCount,
      chapterCount: content.chapters.length,
      progress: 0,
      currentChapter: 0,
      currentOffset: 0,
      coverUri: imported.cover,
      createdAt: Date.now(),
    };
    await requestToPromise((await store(CONTENTS, 'readwrite')).put({ id: summary.id, content }));
    await requestToPromise((await store(BOOKS, 'readwrite')).put(summary));
    return summary;
  },

  async listBooks(): Promise<BookSummary[]> {
    const all = await requestToPromise<StoredBook[]>((await store(BOOKS, 'readonly')).getAll());
    return all
      .filter((book) => !book.deletedAt)
      .sort((a, b) => (b.lastReadAt ?? b.createdAt) - (a.lastReadAt ?? a.createdAt));
  },

  async getBook(id: string): Promise<BookSummary | null> {
    const book = await requestToPromise<StoredBook | undefined>(
      (await store(BOOKS, 'readonly')).get(id),
    );
    return book && !book.deletedAt ? book : null;
  },

  async getBookContent(id: string): Promise<BookContent | null> {
    const record = await requestToPromise<{ id: string; content: BookContent } | undefined>(
      (await store(CONTENTS, 'readonly')).get(id),
    );
    return record?.content ?? null;
  },

  async updatePosition(id: string, position: PositionUpdate): Promise<void> {
    const books = await store(BOOKS, 'readwrite');
    const book = await requestToPromise<StoredBook | undefined>(books.get(id));
    if (!book) return;
    book.currentChapter = position.chapter;
    book.currentOffset = position.offset;
    book.progress = position.progress;
    book.lastReadAt = Date.now();
    await requestToPromise(books.put(book));
  },

  async deleteBook(id: string): Promise<void> {
    await requestToPromise((await store(CONTENTS, 'readwrite')).delete(id));
    // Highlights are meaningless without the book; vocab survives on purpose
    // (its sentence context is copied into the entry).
    const highlights = await store(HIGHLIGHTS, 'readwrite');
    const orphaned = await requestToPromise<HighlightRecord[]>(
      highlights.index('bookId').getAll(id),
    );
    for (const highlight of orphaned) {
      await requestToPromise(highlights.delete(highlight.id));
    }
    const books = await store(BOOKS, 'readwrite');
    const book = await requestToPromise<StoredBook | undefined>(books.get(id));
    if (!book) return;
    book.deletedAt = Date.now();
    await requestToPromise(books.put(book));
  },

  async listHighlights(bookId: string): Promise<HighlightRecord[]> {
    const index = (await store(HIGHLIGHTS, 'readonly')).index('bookId');
    const rows = await requestToPromise<HighlightRecord[]>(index.getAll(bookId));
    return rows.sort((a, b) => a.chapterIndex - b.chapterIndex || a.startOffset - b.startOffset);
  },

  async addHighlight(input: NewHighlight): Promise<HighlightRecord> {
    const record: HighlightRecord = { ...input, id: newId(), createdAt: Date.now() };
    await requestToPromise((await store(HIGHLIGHTS, 'readwrite')).put(record));
    return record;
  },

  async removeHighlight(id: string): Promise<void> {
    await requestToPromise((await store(HIGHLIGHTS, 'readwrite')).delete(id));
  },

  async updateHighlightNote(id: string, note: string | null): Promise<void> {
    const highlights = await store(HIGHLIGHTS, 'readwrite');
    const record = await requestToPromise<HighlightRecord | undefined>(highlights.get(id));
    if (!record) return;
    record.note = note ?? undefined;
    await requestToPromise(highlights.put(record));
  },

  async addVocabEntry(input: NewVocabEntry): Promise<{ entry: VocabEntry; isNew: boolean }> {
    const vocab = await store(VOCAB, 'readwrite');
    const existing = await requestToPromise<VocabEntry | undefined>(
      vocab.index('lemma').get(input.lemma),
    );
    if (existing) return { entry: existing, isNew: false };
    const entry: VocabEntry = { ...input, id: newId(), createdAt: Date.now() };
    await requestToPromise(vocab.put(entry));
    return { entry, isNew: true };
  },

  async listVocab(): Promise<VocabEntry[]> {
    const rows = await requestToPromise<VocabEntry[]>((await store(VOCAB, 'readonly')).getAll());
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },

  async removeVocabEntry(id: string): Promise<void> {
    await requestToPromise((await store(VOCAB, 'readwrite')).delete(id));
  },

  async listBookmarks(bookId: string): Promise<BookmarkRecord[]> {
    const index = (await store(BOOKMARKS, 'readonly')).index('bookId');
    const rows = await requestToPromise<BookmarkRecord[]>(index.getAll(bookId));
    return rows.sort((a, b) => a.chapterIndex - b.chapterIndex || a.charOffset - b.charOffset);
  },

  async addBookmark(input: NewBookmark): Promise<BookmarkRecord> {
    const record: BookmarkRecord = { ...input, id: newId(), createdAt: Date.now() };
    await requestToPromise((await store(BOOKMARKS, 'readwrite')).put(record));
    return record;
  },

  async removeBookmark(id: string): Promise<void> {
    await requestToPromise((await store(BOOKMARKS, 'readwrite')).delete(id));
  },

  async listDueVocab(now: number): Promise<VocabEntry[]> {
    const rows = await requestToPromise<VocabEntry[]>((await store(VOCAB, 'readonly')).getAll());
    return rows.filter((entry) => (entry.dueAt ?? 0) <= now);
  },

  async updateVocabSrs(id: string, srs: VocabSrsUpdate): Promise<void> {
    const vocab = await store(VOCAB, 'readwrite');
    const entry = await requestToPromise<VocabEntry | undefined>(vocab.get(id));
    if (!entry) return;
    await requestToPromise(vocab.put({ ...entry, ...srs }));
  },
};
