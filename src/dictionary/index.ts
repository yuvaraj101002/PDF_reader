/**
 * Offline dictionary lookups, web implementation (metro picks
 * `index.native.ts` on iOS/Android). Reads the bundled dictionary.db via
 * sql.js (WASM) — loaded lazily on the first lookup so the ~16MB database
 * costs nothing until a word is tapped.
 */
import { Asset } from 'expo-asset';
import initSqlJs, { type Database } from 'sql.js';

import { lookupCandidates } from './lemma';
import type { DictionaryEntry, DictionaryResult } from './types';

let dbPromise: Promise<Database> | null = null;

function ensureDb(): Promise<Database> {
  dbPromise ??= (async () => {
    const wasmAsset = Asset.fromModule(require('sql.js/dist/sql-wasm.wasm'));
    const dbAsset = Asset.fromModule(require('@/assets/dictionary/dictionary.db'));
    await Promise.all([wasmAsset.downloadAsync().catch(() => {}), dbAsset.downloadAsync().catch(() => {})]);
    const SQL = await initSqlJs({ locateFile: () => wasmAsset.localUri ?? wasmAsset.uri });
    const bytes = await (await fetch(dbAsset.localUri ?? dbAsset.uri)).arrayBuffer();
    return new SQL.Database(new Uint8Array(bytes));
  })();
  return dbPromise;
}

function query(db: Database, sql: string, params: (string | number)[]): Record<string, unknown>[] {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

export async function lookupWord(raw: string): Promise<DictionaryResult | null> {
  const db = await ensureDb();
  for (const candidate of lookupCandidates(raw)) {
    const rows = query(
      db,
      'SELECT pos, definition, example, synonyms FROM entries WHERE word = ? ORDER BY pos, rank LIMIT 8',
      [candidate],
    );
    if (rows.length === 0) continue;
    const ipaRow = query(db, 'SELECT ipa FROM pronunciations WHERE word = ?', [candidate])[0];
    return {
      requested: raw,
      word: candidate,
      ipa: typeof ipaRow?.ipa === 'string' ? ipaRow.ipa : undefined,
      entries: rows.map(
        (row): DictionaryEntry => ({
          pos: String(row.pos),
          definition: String(row.definition),
          example: row.example ? String(row.example) : undefined,
          synonyms: row.synonyms ? String(row.synonyms).split(', ') : [],
        }),
      ),
    };
  }
  return null;
}
