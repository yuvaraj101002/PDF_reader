import { and, asc, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { Directory, File, Paths } from 'expo-file-system';

import type { ImportedBook } from '@/extraction';
import type { BookContent } from '@/extraction/types';
import { newId } from '@/lib/uuid';

import { db } from './index';
import migrations from './migrations/migrations';
import { bookmarks, books, highlights, readingDays, vocabEntries } from './schema';
import type {
  BookmarkRecord,
  BookRepo,
  BookSummary,
  HighlightRecord,
  NewBookmark,
  NewHighlight,
  NewVocabEntry,
  PositionUpdate,
  ReadingDay,
  VocabEntry,
  VocabSrsUpdate,
} from './types';

/**
 * iOS/Android storage backend: Drizzle + expo-sqlite for metadata, structured
 * content JSON as files under <documents>/books/. Web uses `repo.ts`.
 */

let ready: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  ready ??= migrate(db, migrations);
  return ready;
}

function booksDir(): Directory {
  const dir = new Directory(Paths.document, 'books');
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    // already exists (or racing creation) — fine
  }
  return dir;
}

const contentFile = (id: string) => new File(booksDir(), `${id}.json`);

type BookRow = typeof books.$inferSelect;

function toSummary(row: BookRow): BookSummary {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    cefr: row.cefr ?? undefined,
    fkGrade: row.fkGrade ?? undefined,
    wordCount: row.wordCount,
    pageCount: row.pageCount ?? undefined,
    chapterCount: row.chapterCount,
    progress: row.progress,
    currentChapter: row.currentChapter,
    currentOffset: row.currentOffset,
    coverUri: row.coverUri ?? undefined,
    lastReadAt: row.lastReadAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export const repo: BookRepo = {
  async saveImportedBook(imported: ImportedBook, sourceUri: string): Promise<BookSummary> {
    await ensureReady();
    const { content, analysis } = imported;
    const id = newId();
    const now = Date.now();

    const file = contentFile(id);
    await file.write(JSON.stringify(content));

    await db.insert(books).values({
      id,
      createdAt: now,
      updatedAt: now,
      title: content.title,
      author: content.author ?? null,
      sourceUri,
      contentUri: file.uri,
      coverUri: imported.cover ?? null,
      wordCount: analysis.wordCount,
      pageCount: analysis.pageCount,
      chapterCount: content.chapters.length,
      fkGrade: analysis.fkGrade,
      cefr: analysis.cefr,
    });

    return {
      id,
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
      createdAt: now,
    };
  },

  async listBooks(): Promise<BookSummary[]> {
    await ensureReady();
    const rows = await db
      .select()
      .from(books)
      .where(isNull(books.deletedAt))
      .orderBy(desc(books.lastReadAt), desc(books.createdAt));
    return rows.map(toSummary);
  },

  async getBook(id: string): Promise<BookSummary | null> {
    await ensureReady();
    const rows = await db
      .select()
      .from(books)
      .where(and(eq(books.id, id), isNull(books.deletedAt)))
      .limit(1);
    return rows[0] ? toSummary(rows[0]) : null;
  },

  async getBookContent(id: string): Promise<BookContent | null> {
    await ensureReady();
    try {
      const text = await contentFile(id).text();
      return JSON.parse(text) as BookContent;
    } catch {
      return null;
    }
  },

  async updatePosition(id: string, position: PositionUpdate): Promise<void> {
    await ensureReady();
    const now = Date.now();
    await db
      .update(books)
      .set({
        currentChapter: position.chapter,
        currentOffset: position.offset,
        progress: position.progress,
        lastReadAt: now,
        updatedAt: now,
      })
      .where(eq(books.id, id));
  },

  async deleteBook(id: string): Promise<void> {
    await ensureReady();
    const now = Date.now();
    await db.update(books).set({ deletedAt: now, updatedAt: now }).where(eq(books.id, id));
    // Highlights are meaningless without the book; vocab survives on purpose.
    await db
      .update(highlights)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(highlights.bookId, id));
    try {
      contentFile(id).delete();
    } catch {
      // content file already gone — fine
    }
  },

  async listHighlights(bookId: string): Promise<HighlightRecord[]> {
    await ensureReady();
    const rows = await db
      .select()
      .from(highlights)
      .where(and(eq(highlights.bookId, bookId), isNull(highlights.deletedAt)));
    return rows
      .map(
        (row): HighlightRecord => ({
          id: row.id,
          bookId: row.bookId,
          chapterIndex: row.chapterIndex,
          startOffset: row.startOffset,
          endOffset: row.endOffset,
          color: row.color,
          snippet: row.snippet,
          note: row.note ?? undefined,
          createdAt: row.createdAt,
        }),
      )
      .sort((a, b) => a.chapterIndex - b.chapterIndex || a.startOffset - b.startOffset);
  },

  async addHighlight(input: NewHighlight): Promise<HighlightRecord> {
    await ensureReady();
    const id = newId();
    const now = Date.now();
    await db.insert(highlights).values({
      id,
      createdAt: now,
      updatedAt: now,
      bookId: input.bookId,
      chapterIndex: input.chapterIndex,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      color: input.color,
      snippet: input.snippet,
      note: input.note ?? null,
    });
    return { ...input, id, createdAt: now };
  },

  async removeHighlight(id: string): Promise<void> {
    await ensureReady();
    const now = Date.now();
    await db.update(highlights).set({ deletedAt: now, updatedAt: now }).where(eq(highlights.id, id));
  },

  async updateHighlightNote(id: string, note: string | null): Promise<void> {
    await ensureReady();
    await db
      .update(highlights)
      .set({ note, updatedAt: Date.now() })
      .where(eq(highlights.id, id));
  },

  async addVocabEntry(input: NewVocabEntry): Promise<{ entry: VocabEntry; isNew: boolean }> {
    await ensureReady();
    const existing = await db
      .select()
      .from(vocabEntries)
      .where(and(eq(vocabEntries.lemma, input.lemma), isNull(vocabEntries.deletedAt)))
      .limit(1);
    if (existing[0]) return { entry: toVocab(existing[0]), isNew: false };
    const id = newId();
    const now = Date.now();
    await db.insert(vocabEntries).values({
      id,
      createdAt: now,
      updatedAt: now,
      word: input.word,
      lemma: input.lemma,
      bookId: input.bookId ?? null,
      chapterIndex: input.chapterIndex ?? null,
      charOffset: input.charOffset ?? null,
      sentence: input.sentence ?? null,
    });
    return { entry: { ...input, id, createdAt: now }, isNew: true };
  },

  async listVocab(): Promise<VocabEntry[]> {
    await ensureReady();
    const rows = await db
      .select()
      .from(vocabEntries)
      .where(isNull(vocabEntries.deletedAt))
      .orderBy(desc(vocabEntries.createdAt));
    return rows.map(toVocab);
  },

  async removeVocabEntry(id: string): Promise<void> {
    await ensureReady();
    const now = Date.now();
    await db
      .update(vocabEntries)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(vocabEntries.id, id));
  },

  async listBookmarks(bookId: string): Promise<BookmarkRecord[]> {
    await ensureReady();
    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.bookId, bookId), isNull(bookmarks.deletedAt)));
    return rows
      .map(
        (row): BookmarkRecord => ({
          id: row.id,
          bookId: row.bookId,
          chapterIndex: row.chapterIndex,
          charOffset: row.charOffset,
          label: row.label ?? '',
          createdAt: row.createdAt,
        }),
      )
      .sort((a, b) => a.chapterIndex - b.chapterIndex || a.charOffset - b.charOffset);
  },

  async addBookmark(input: NewBookmark): Promise<BookmarkRecord> {
    await ensureReady();
    const id = newId();
    const now = Date.now();
    await db.insert(bookmarks).values({
      id,
      createdAt: now,
      updatedAt: now,
      bookId: input.bookId,
      chapterIndex: input.chapterIndex,
      charOffset: input.charOffset,
      label: input.label,
    });
    return { ...input, id, createdAt: now };
  },

  async removeBookmark(id: string): Promise<void> {
    await ensureReady();
    const now = Date.now();
    await db.update(bookmarks).set({ deletedAt: now, updatedAt: now }).where(eq(bookmarks.id, id));
  },

  async listDueVocab(now: number): Promise<VocabEntry[]> {
    await ensureReady();
    const rows = await db
      .select()
      .from(vocabEntries)
      .where(
        and(
          isNull(vocabEntries.deletedAt),
          or(isNull(vocabEntries.dueAt), lte(vocabEntries.dueAt, now)),
        ),
      );
    return rows.map(toVocab);
  },

  async updateVocabSrs(id: string, srs: VocabSrsUpdate): Promise<void> {
    await ensureReady();
    await db
      .update(vocabEntries)
      .set({ ...srs, updatedAt: Date.now() })
      .where(eq(vocabEntries.id, id));
  },

  async addReadingSeconds(date: string, seconds: number): Promise<void> {
    await ensureReady();
    const now = Date.now();
    await db
      .insert(readingDays)
      .values({ date, seconds, updatedAt: now })
      .onConflictDoUpdate({
        target: readingDays.date,
        set: { seconds: sql`${readingDays.seconds} + ${seconds}`, updatedAt: now },
      });
  },

  async listReadingDays(): Promise<ReadingDay[]> {
    await ensureReady();
    const rows = await db.select().from(readingDays).orderBy(asc(readingDays.date));
    return rows.map((row) => ({ date: row.date, seconds: row.seconds }));
  },
};

function toVocab(row: typeof vocabEntries.$inferSelect): VocabEntry {
  return {
    id: row.id,
    word: row.word,
    lemma: row.lemma,
    bookId: row.bookId ?? undefined,
    chapterIndex: row.chapterIndex ?? undefined,
    charOffset: row.charOffset ?? undefined,
    sentence: row.sentence ?? undefined,
    createdAt: row.createdAt,
    dueAt: row.dueAt ?? undefined,
    intervalDays: row.intervalDays,
    easeFactor: row.easeFactor,
    reviewCount: row.reviewCount,
  };
}
