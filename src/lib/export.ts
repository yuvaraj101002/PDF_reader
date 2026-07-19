import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Save-or-share a generated text file: browser download on web, native share
 * sheet on iOS/Android.
 */
export async function exportTextFile(
  filename: string,
  content: string,
  mimeType: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, filename);
  try {
    file.delete();
  } catch {
    // didn't exist — fine
  }
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

export const sanitizeFilename = (name: string): string =>
  name.replace(/[^\w\d-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'export';

/** CSV field escaping per RFC 4180. */
export const csvField = (value: string | undefined): string =>
  `"${(value ?? '').replace(/"/g, '""')}"`;
