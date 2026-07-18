/**
 * Structured book document — the output contract of the extraction pipeline
 * (pdf.js → structure detection, see PLAN.md "Core Architecture Concept").
 *
 * All reader features (highlights, notes, TTS tracking, tap-word) address text
 * via `chapterIndex` + character offsets into `Chapter.text`. Word tokens are
 * NOT stored — they are derived at render time from sentence ranges.
 */

export interface BookContent {
  version: 1;
  title: string;
  author?: string;
  chapters: Chapter[];
}

export interface Chapter {
  title: string;
  /** full plain text of the chapter; every offset below indexes this string */
  text: string;
  paragraphs: Paragraph[];
}

/** Character range within the owning chapter's `text`. `end` is exclusive. */
export interface TextRange {
  start: number;
  end: number;
}

export interface Paragraph extends TextRange {
  sentences: TextRange[];
}

/** Metadata computed during extraction, stored on the `books` DB row. */
export interface BookAnalysis {
  wordCount: number;
  pageCount: number;
  /** Flesch-Kincaid grade level */
  fkGrade: number;
  /** CEFR band mapped from fkGrade: A1 | A2 | B1 | B2 | C1 | C2 */
  cefr: string;
}
