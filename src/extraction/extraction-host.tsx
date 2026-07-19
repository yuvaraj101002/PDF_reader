import type { ExtractionProgress, RawExtraction } from './types';

/**
 * Web/default stub — extraction runs pdf.js directly (see `extractor.ts`),
 * so no host WebView is needed. Metro picks `extraction-host.native.tsx`
 * on iOS/Android.
 */
export function PdfExtractionHost() {
  return null;
}

export function extractRawInWebView(
  _base64: string,
  _onProgress?: ExtractionProgress,
): Promise<RawExtraction> {
  return Promise.reject(new Error('WebView extraction is native-only'));
}
