import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Sync-ready conventions (for Phase 2 cloud sync — see PLAN.md):
 * - `id` is a UUID generated on-device (expo-crypto randomUUID)
 * - `createdAt` / `updatedAt` are unix epoch milliseconds
 * - user data is soft-deleted via `deletedAt` (null = live row)
 */
const base = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const books = sqliteTable('books', {
  ...base,
  title: text('title').notNull(),
  author: text('author'),
  /** original imported PDF, copied into the app's document directory */
  sourceUri: text('source_uri').notNull(),
  /** extracted structured content JSON (chapters → paragraphs → sentences) */
  contentUri: text('content_uri').notNull(),
  coverUri: text('cover_uri'),
  wordCount: integer('word_count').notNull().default(0),
  pageCount: integer('page_count'),
  chapterCount: integer('chapter_count').notNull().default(0),
  /** Flesch-Kincaid grade and its mapped CEFR band (A1–C2) */
  fkGrade: real('fk_grade'),
  cefr: text('cefr'),
  // ── reading state ──
  lastReadAt: integer('last_read_at'),
  /** 0..1 across the whole book */
  progress: real('progress').notNull().default(0),
  currentChapter: integer('current_chapter').notNull().default(0),
  /** char offset within the current chapter's text */
  currentOffset: integer('current_offset').notNull().default(0),
});

/**
 * A highlight over a text range. Offsets index into the chapter's plain text —
 * stable across font-size changes and ready for sync. A non-null `note` makes
 * this an annotated highlight.
 */
export const highlights = sqliteTable('highlights', {
  ...base,
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  chapterIndex: integer('chapter_index').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  color: text('color').notNull().default('yellow'),
  note: text('note'),
  /** snapshot of the highlighted text (survives re-extraction drift) */
  snippet: text('snippet').notNull(),
});

export const bookmarks = sqliteTable('bookmarks', {
  ...base,
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  chapterIndex: integer('chapter_index').notNull(),
  charOffset: integer('char_offset').notNull(),
  label: text('label'),
});

/** Vocabulary Book: every looked-up/saved word with its source context. */
export const vocabEntries = sqliteTable('vocab_entries', {
  ...base,
  /** surface form as tapped, e.g. "running" */
  word: text('word').notNull(),
  /** dictionary form, e.g. "run" */
  lemma: text('lemma').notNull(),
  /** null = added outside a book (e.g. manual entry) */
  bookId: text('book_id').references(() => books.id),
  chapterIndex: integer('chapter_index'),
  charOffset: integer('char_offset'),
  /** the sentence the word was found in, for context on flashcards */
  sentence: text('sentence'),
  // ── SRS (SM-2, see src/srs/scheduler.ts) ──
  /** null = new card, due immediately */
  dueAt: integer('due_at'),
  intervalDays: real('interval_days').notNull().default(0),
  easeFactor: real('ease_factor').notNull().default(2.5),
  reviewCount: integer('review_count').notNull().default(0),
});
