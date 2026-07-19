/**
 * PDF → RawExtraction, web implementation (metro picks `extractor.native.ts`
 * on iOS/Android; this default file is the web + typecheck target).
 *
 * Fully offline: the main library is bundled by metro from node_modules, and
 * the worker is served from our own bundled asset (assets/pdfjs/, refreshed by
 * scripts/copy-pdfjs.mjs) — turned into a blob: URL so the module worker gets
 * a JavaScript MIME type regardless of how the asset is served.
 */
import { Asset } from 'expo-asset';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { ExtractionProgress, RawExtraction, RawPage, RawTextItem } from './types';

let workerReady: Promise<void> | null = null;
function ensureWorker(): Promise<void> {
  workerReady ??= (async () => {
    const asset = Asset.fromModule(require('@/assets/pdfjs/pdf.worker.min.jsasset'));
    await asset.downloadAsync().catch(() => {});
    const response = await fetch(asset.localUri ?? asset.uri);
    const code = await response.text();
    GlobalWorkerOptions.workerSrc = URL.createObjectURL(
      new Blob([code], { type: 'text/javascript' }),
    );
  })();
  return workerReady;
}

/** Map one pdf.js text-content item to our RawTextItem (shared shape with the WebView extractor). */
export function mapTextItem(item: Record<string, unknown>): RawTextItem | null {
  if (typeof item.str !== 'string' || item.str.trim() === '') return null;
  const transform = item.transform as number[] | undefined;
  if (!transform) return null;
  const fontSize = Math.hypot(transform[2], transform[3]) || Math.abs(transform[3]) || 10;
  return {
    str: item.str,
    x: transform[4],
    y: transform[5],
    width: typeof item.width === 'number' ? item.width : 0,
    fontSize,
    fontName: typeof item.fontName === 'string' ? item.fontName : '',
  };
}

/** Render page 1 to a small JPEG data URL for the library cover. */
async function renderCover(pdf: Awaited<ReturnType<typeof getDocument>['promise']>): Promise<string | undefined> {
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 360 / baseViewport.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined; // cover is nice-to-have — never fail the import for it
  }
}

export async function extractRaw(
  uri: string,
  onProgress?: ExtractionProgress,
): Promise<RawExtraction> {
  await ensureWorker();
  const data = new Uint8Array(await (await fetch(uri)).arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  try {
    const metadata = await pdf.getMetadata().catch(() => null);
    const coverDataUrl = await renderCover(pdf);
    const pages: RawPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const { items } = await page.getTextContent();
      pages.push({
        width: viewport.width,
        height: viewport.height,
        items: items.map(mapTextItem).filter((item): item is RawTextItem => item !== null),
      });
      onProgress?.(pageNumber, pdf.numPages);
    }
    return {
      title: metadata?.info?.Title || undefined,
      author: metadata?.info?.Author || undefined,
      coverDataUrl,
      pages,
    };
  } finally {
    await pdf.destroy().catch(() => {});
  }
}
