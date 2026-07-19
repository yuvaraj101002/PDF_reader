import { extractRaw } from './extractor';
import { structureBook } from './structure';
import type { BookAnalysis, BookContent, ExtractionProgress } from './types';

export interface ImportedBook {
  content: BookContent;
  analysis: BookAnalysis;
  /** page-1 thumbnail (JPEG data URL), when renderable */
  cover?: string;
  /** wall-clock extraction + structuring time */
  durationMs: number;
}

/**
 * Import pipeline entry point: picked PDF uri → RawExtraction (pdf.js) →
 * BookContent + BookAnalysis (structure.ts).
 */
export async function importPdf(
  uri: string,
  fileName: string,
  onProgress?: ExtractionProgress,
): Promise<ImportedBook> {
  const startedAt = Date.now();
  const raw = await extractRaw(uri, onProgress);
  if (raw.pages.every((page) => page.items.length === 0)) {
    throw new Error(
      'This PDF has no selectable text (likely a scanned book). OCR support is planned — see PLAN.md Phase 3.',
    );
  }
  const fallbackTitle = fileName.replace(/\.pdf$/i, '').trim() || 'Untitled book';
  const { content, analysis } = structureBook(raw, fallbackTitle);
  return { content, analysis, cover: raw.coverDataUrl, durationMs: Date.now() - startedAt };
}

export type { BookAnalysis, BookContent, Chapter, Paragraph, TextRange } from './types';
