/**
 * PDF → RawExtraction, iOS/Android implementation: read the picked file as
 * base64 and run pdf.js inside the hidden WebView host.
 */
import { File } from 'expo-file-system';

import { extractRawInWebView } from './extraction-host';
import type { ExtractionProgress, RawExtraction } from './types';

export async function extractRaw(
  uri: string,
  onProgress?: ExtractionProgress,
): Promise<RawExtraction> {
  const base64 = await new File(uri).base64();
  return extractRawInWebView(base64, onProgress);
}
