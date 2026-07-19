/**
 * Offline dictionary lookups, iOS/Android implementation: the bundled
 * dictionary.db asset is copied into the app's documents once, then opened
 * read-only with expo-sqlite. Lazy — nothing loads until the first lookup.
 */
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { lookupCandidates } from './lemma';
import type { DictionaryEntry, DictionaryResult } from './types';

const DB_NAME = 'dictionary.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

function ensureDb(): Promise<SQLiteDatabase> {
  dbPromise ??= (async () => {
    const dir = new Directory(Paths.document, 'dictionary');
    try {
      if (!dir.exists) dir.create({ intermediates: true });
    } catch {
      // already exists — fine
    }
    const target = new File(dir, DB_NAME);
    if (!target.exists) {
      const asset = Asset.fromModule(require('@/assets/dictionary/dictionary.db'));
      await asset.downloadAsync();
      new File(asset.localUri ?? asset.uri).copy(target);
    }
    return openDatabaseSync(DB_NAME, undefined, dir.uri);
  })();
  return dbPromise;
}

interface EntryRow {
  pos: string;
  definition: string;
  example: string | null;
  synonyms: string | null;
}

export async function lookupWord(raw: string): Promise<DictionaryResult | null> {
  const db = await ensureDb();
  for (const candidate of lookupCandidates(raw)) {
    const rows = await db.getAllAsync<EntryRow>(
      'SELECT pos, definition, example, synonyms FROM entries WHERE word = ? ORDER BY pos, rank LIMIT 8',
      [candidate],
    );
    if (rows.length === 0) continue;
    const ipaRow = await db.getFirstAsync<{ ipa: string }>(
      'SELECT ipa FROM pronunciations WHERE word = ?',
      [candidate],
    );
    return {
      requested: raw,
      word: candidate,
      ipa: ipaRow?.ipa,
      entries: rows.map(
        (row): DictionaryEntry => ({
          pos: row.pos,
          definition: row.definition,
          example: row.example ?? undefined,
          synonyms: row.synonyms ? row.synonyms.split(', ') : [],
        }),
      ),
    };
  }
  return null;
}
