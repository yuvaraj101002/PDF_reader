import type { ImportedBook } from '@/extraction';
import type { BookContent } from '@/extraction/types';

/** Library-facing view of a stored book (metadata only — content loads lazily). */
export interface BookSummary {
  id: string;
  title: string;
  author?: string;
  cefr?: string;
  fkGrade?: number;
  wordCount: number;
  pageCount?: number;
  chapterCount: number;
  /** 0..1 across the whole book */
  progress: number;
  currentChapter: number;
  /** char offset within the current chapter */
  currentOffset: number;
  /** page-1 thumbnail as a data URL (small JPEG) */
  coverUri?: string;
  lastReadAt?: number;
  createdAt: number;
}

export interface BookmarkRecord {
  id: string;
  bookId: string;
  chapterIndex: number;
  charOffset: number;
  /** snippet of the paragraph at the bookmarked position */
  label: string;
  createdAt: number;
}

export type NewBookmark = Omit<BookmarkRecord, 'id' | 'createdAt'>;

export interface PositionUpdate {
  chapter: number;
  offset: number;
  progress: number;
}

/** A stored highlight (optionally annotated once notes land). Offsets index the chapter's text. */
export interface HighlightRecord {
  id: string;
  bookId: string;
  chapterIndex: number;
  startOffset: number;
  endOffset: number;
  color: string;
  /** snapshot of the highlighted text */
  snippet: string;
  note?: string;
  createdAt: number;
}

export interface NewHighlight {
  bookId: string;
  chapterIndex: number;
  startOffset: number;
  endOffset: number;
  color: string;
  snippet: string;
  note?: string;
}

/** A saved vocabulary word with the context it was met in. */
export interface VocabEntry {
  id: string;
  /** surface form as tapped, e.g. "running" */
  word: string;
  /** dictionary form, e.g. "run" — dedupe key */
  lemma: string;
  bookId?: string;
  chapterIndex?: number;
  charOffset?: number;
  /** the sentence the word was found in */
  sentence?: string;
  createdAt: number;
}

export type NewVocabEntry = Omit<VocabEntry, 'id' | 'createdAt'>;

/**
 * Storage contract implemented per platform:
 * - `repo.native.ts` — Drizzle + expo-sqlite (iOS/Android)
 * - `repo.ts`        — IndexedDB (web)
 * Phase 2 cloud sync layers on top of this interface.
 */
export interface BookRepo {
  saveImportedBook(imported: ImportedBook, sourceUri: string): Promise<BookSummary>;
  listBooks(): Promise<BookSummary[]>;
  getBook(id: string): Promise<BookSummary | null>;
  getBookContent(id: string): Promise<BookContent | null>;
  updatePosition(id: string, position: PositionUpdate): Promise<void>;
  deleteBook(id: string): Promise<void>;
  listHighlights(bookId: string): Promise<HighlightRecord[]>;
  addHighlight(input: NewHighlight): Promise<HighlightRecord>;
  removeHighlight(id: string): Promise<void>;
  /** set or clear (null) the note attached to a highlight */
  updateHighlightNote(id: string, note: string | null): Promise<void>;
  /** save a looked-up word; dedupes by lemma — isNew=false when already known */
  addVocabEntry(input: NewVocabEntry): Promise<{ entry: VocabEntry; isNew: boolean }>;
  listVocab(): Promise<VocabEntry[]>;
  removeVocabEntry(id: string): Promise<void>;
  listBookmarks(bookId: string): Promise<BookmarkRecord[]>;
  addBookmark(input: NewBookmark): Promise<BookmarkRecord>;
  removeBookmark(id: string): Promise<void>;
}
