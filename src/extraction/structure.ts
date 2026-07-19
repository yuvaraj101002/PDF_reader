import { sentences as splitSentences } from 'sbd';
import { syllable } from 'syllable';

import type {
  BookAnalysis,
  BookContent,
  Chapter,
  Paragraph,
  RawExtraction,
  RawPage,
  TextRange,
} from './types';

/**
 * Structure detection: RawExtraction (positioned pdf.js text runs) →
 * BookContent (chapters → paragraphs → sentences) + BookAnalysis.
 *
 * Heuristic-based by design (see PLAN.md risks — a manual "edit chapters"
 * escape hatch ships with the library UI). Tunables are grouped below.
 */

const T = {
  /** y-clustering tolerance as a fraction of font size */
  lineYTolerance: 0.4,
  /** insert a space when the x-gap between runs exceeds this × font size */
  wordGapFactor: 0.25,
  /** a vertical gap this × the median line gap starts a new paragraph */
  paragraphGapFactor: 1.55,
  /** an x-indent beyond this × body font size starts a new paragraph */
  indentFactor: 0.8,
  /** headings are at least this × the body font size */
  headingSizeFactor: 1.2,
  /** drop lines repeating on at least this fraction of pages (headers/footers) */
  repeatedLineFraction: 0.3,
} as const;

interface Line {
  text: string;
  fontSize: number;
  x: number;
  y: number;
  page: number;
  /** vertical gap to the previous line on the same page (null at page top) */
  gapBefore: number | null;
}

// ── line building ────────────────────────────────────────────────────────────

function buildPageLines(page: RawPage, pageIndex: number): Line[] {
  // Cluster items into lines by y (PDF y grows upward → sort top-down).
  const items = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  const clusters: RawPage['items'][] = [];
  for (const item of items) {
    const current = clusters[clusters.length - 1];
    const tol = Math.max(2, item.fontSize * T.lineYTolerance);
    if (current && Math.abs(current[0].y - item.y) <= tol) {
      current.push(item);
    } else {
      clusters.push([item]);
    }
  }

  const lines: Line[] = [];
  let prevY: number | null = null;
  for (const cluster of clusters) {
    cluster.sort((a, b) => a.x - b.x);
    let text = '';
    let endX = 0;
    // dominant font size = size of the longest run in the line
    const dominant = cluster.reduce((a, b) => (b.str.length > a.str.length ? b : a));
    for (const item of cluster) {
      const needsGapSpace =
        text.length > 0 &&
        !text.endsWith(' ') &&
        !item.str.startsWith(' ') &&
        item.x - endX > item.fontSize * T.wordGapFactor;
      text += (needsGapSpace ? ' ' : '') + item.str;
      endX = item.x + item.width;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const y = cluster[0].y;
    lines.push({
      text,
      fontSize: dominant.fontSize,
      x: cluster[0].x,
      y,
      page: pageIndex,
      gapBefore: prevY === null ? null : prevY - y,
    });
    prevY = y;
  }
  return lines;
}

// ── header/footer & furniture removal ────────────────────────────────────────

function dropPageFurniture(lines: Line[], pageCount: number): Line[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    // Normalize digits so "Page 12" / "Page 13" count as the same furniture.
    const key = line.text.replace(/\d+/g, '#');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeatThreshold = Math.max(3, Math.ceil(pageCount * T.repeatedLineFraction));
  return lines.filter((line) => {
    if (/^[\divxlc]+$/i.test(line.text)) return false; // bare page numbers
    const key = line.text.replace(/\d+/g, '#');
    return (counts.get(key) ?? 0) < repeatThreshold || pageCount < 4;
  });
}

// ── body statistics ──────────────────────────────────────────────────────────

function weightedMode(pairs: Array<[value: number, weight: number]>): number {
  const tally = new Map<number, number>();
  for (const [value, weight] of pairs) {
    const key = Math.round(value * 2) / 2;
    tally.set(key, (tally.get(key) ?? 0) + weight);
  }
  let best = 10;
  let bestWeight = -1;
  for (const [value, weight] of tally) {
    if (weight > bestWeight) {
      best = value;
      bestWeight = weight;
    }
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ── heading detection ────────────────────────────────────────────────────────

const CHAPTER_PATTERN = /^(chapter|part|book|section|prologue|epilogue|introduction|preface|foreword)\b/i;

function isHeading(line: Line, bodySize: number): boolean {
  const wordCount = line.text.split(/\s+/).length;
  if (CHAPTER_PATTERN.test(line.text) && wordCount <= 8) return true;
  if (line.fontSize >= bodySize * T.headingSizeFactor && wordCount <= 12 && !/[.!?,;:]$/.test(line.text)) {
    return true;
  }
  const isAllCaps = line.text === line.text.toUpperCase() && /[A-Z]/.test(line.text);
  return isAllCaps && wordCount <= 8 && line.fontSize >= bodySize;
}

// ── paragraph & chapter assembly ─────────────────────────────────────────────

/** Join a continuation line onto a paragraph, de-hyphenating split words. */
function joinLine(paragraph: string, line: string): string {
  if (paragraph === '') return line;
  if (/[A-Za-z]-$/.test(paragraph) && /^[a-z]/.test(line)) {
    return paragraph.slice(0, -1) + line; // "beauti-" + "ful" → "beautiful"
  }
  return paragraph + ' ' + line;
}

function endsSentence(text: string): boolean {
  return /[.!?]["'”’)\]]*$/.test(text);
}

interface DraftChapter {
  title: string;
  paragraphs: string[];
}

function assembleChapters(lines: Line[], bodySize: number, fallbackTitle: string): DraftChapter[] {
  // Median line gap from body↔body pairs only — gaps adjacent to headings
  // would otherwise inflate the paragraph-break threshold.
  const bodyGaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const prev = lines[i - 1];
    if (line.gapBefore === null || line.gapBefore <= 0) continue;
    if (isHeading(line, bodySize) || isHeading(prev, bodySize)) continue;
    bodyGaps.push(line.gapBefore);
  }
  const medianGap = median(bodyGaps) || bodySize * 1.2;
  const bodyLeft = weightedMode(
    lines.filter((l) => !isHeading(l, bodySize)).map((l) => [l.x, l.text.length]),
  );

  const chapters: DraftChapter[] = [];
  let current: DraftChapter | null = null;
  let paragraph = '';
  let prevLine: Line | null = null;
  let prevWasHeading = false;

  const flushParagraph = () => {
    if (paragraph.trim()) {
      current ??= { title: fallbackTitle, paragraphs: [] };
      current.paragraphs.push(paragraph.trim());
    }
    paragraph = '';
  };

  for (const line of lines) {
    if (isHeading(line, bodySize)) {
      flushParagraph();
      if (prevWasHeading && current && current.paragraphs.length === 0) {
        current.title = `${current.title} ${line.text}`.trim(); // multi-line heading
      } else {
        if (current) chapters.push(current);
        current = { title: line.text, paragraphs: [] };
      }
      prevWasHeading = true;
      prevLine = line;
      continue;
    }

    let startsParagraph = false;
    if (paragraph === '' || prevWasHeading) {
      startsParagraph = true;
    } else if (line.page !== prevLine?.page) {
      // Page break: only a sentence-final previous line starts a new paragraph.
      startsParagraph = prevLine !== null && endsSentence(prevLine.text);
    } else if (line.gapBefore !== null && line.gapBefore > medianGap * T.paragraphGapFactor) {
      startsParagraph = true;
    } else if (line.x > bodyLeft + bodySize * T.indentFactor) {
      startsParagraph = true;
    }

    if (startsParagraph) flushParagraph();
    paragraph = joinLine(paragraph, line.text);
    prevWasHeading = false;
    prevLine = line;
  }
  flushParagraph();
  if (current) chapters.push(current);

  // Drop empty chapters (e.g. a heading with no body on a title page).
  const nonEmpty = chapters.filter((c) => c.paragraphs.length > 0);
  return nonEmpty.length > 0 ? nonEmpty : chapters;
}

// ── sentence segmentation & offsets ──────────────────────────────────────────

function sentenceRanges(paragraphText: string, offset: number): TextRange[] {
  let parts: string[];
  try {
    parts = splitSentences(paragraphText, { newline_boundaries: false, sanitize: false });
  } catch {
    parts = [paragraphText];
  }
  const ranges: TextRange[] = [];
  let cursor = 0;
  for (const part of parts) {
    const needle = part.trim();
    if (!needle) continue;
    const at = paragraphText.indexOf(needle, cursor);
    if (at === -1) continue;
    ranges.push({ start: offset + at, end: offset + at + needle.length });
    cursor = at + needle.length;
  }
  if (ranges.length === 0 && paragraphText.trim()) {
    ranges.push({ start: offset, end: offset + paragraphText.length });
  }
  return ranges;
}

function buildChapter(draft: DraftChapter): Chapter {
  const text = draft.paragraphs.join('\n\n');
  const paragraphs: Paragraph[] = [];
  let cursor = 0;
  for (const paragraphText of draft.paragraphs) {
    const start = cursor;
    const end = start + paragraphText.length;
    paragraphs.push({ start, end, sentences: sentenceRanges(paragraphText, start) });
    cursor = end + 2; // '\n\n' separator
  }
  return { title: draft.title, text, paragraphs };
}

// ── analysis ─────────────────────────────────────────────────────────────────

export function cefrFromFkGrade(fkGrade: number): string {
  if (fkGrade < 2) return 'A1';
  if (fkGrade < 4) return 'A2';
  if (fkGrade < 7) return 'B1';
  if (fkGrade < 10) return 'B2';
  if (fkGrade < 13) return 'C1';
  return 'C2';
}

function analyze(chapters: Chapter[], pageCount: number): BookAnalysis {
  let words = 0;
  let syllables = 0;
  let sentenceCount = 0;
  for (const chapter of chapters) {
    for (const word of chapter.text.match(/[A-Za-z’'-]+/g) ?? []) {
      words += 1;
      syllables += syllable(word);
    }
    for (const paragraph of chapter.paragraphs) sentenceCount += paragraph.sentences.length;
  }
  const fkGrade =
    words > 0 && sentenceCount > 0
      ? 0.39 * (words / sentenceCount) + 11.8 * (syllables / words) - 15.59
      : 0;
  const rounded = Math.round(fkGrade * 10) / 10;
  return { wordCount: words, pageCount, fkGrade: rounded, cefr: cefrFromFkGrade(rounded) };
}

// ── entry point ──────────────────────────────────────────────────────────────

export function structureBook(
  raw: RawExtraction,
  fallbackTitle: string,
): { content: BookContent; analysis: BookAnalysis } {
  const allLines = raw.pages.flatMap((page, index) => buildPageLines(page, index));
  const lines = dropPageFurniture(allLines, raw.pages.length);
  const bodySize = weightedMode(lines.map((l) => [l.fontSize, l.text.length]));
  const drafts = assembleChapters(lines, bodySize, raw.title?.trim() || fallbackTitle);
  const chapters = drafts.map(buildChapter);

  const content: BookContent = {
    version: 1,
    title: raw.title?.trim() || fallbackTitle,
    author: raw.author?.trim() || undefined,
    chapters,
  };
  return { content, analysis: analyze(chapters, raw.pages.length) };
}
