/**
 * Compiles the bundled offline dictionary (assets/dictionary/dictionary.db):
 *   - WordNet 3.0 (via wordnet-db): definitions, examples, synonyms per sense
 *   - CMUdict (via cmu-pronouncing-dictionary): ARPABET → IPA pronunciations
 * Pure-JS SQLite via sql.js — no native toolchain needed.
 *
 * Run: npm run build:dictionary   (dev machine only; output is gitignored)
 */
import { dictionary as cmu } from 'cmu-pronouncing-dictionary';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const wordnetDict = join(dirname(require.resolve('wordnet-db/package.json')), 'dict');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'dictionary');

const MAX_SENSES_PER_POS = 3;
const MAX_SYNONYMS = 6;

// ── WordNet parsing ──────────────────────────────────────────────────────────

const POS_FILES = [
  { index: 'index.noun', data: 'data.noun', pos: 'noun' },
  { index: 'index.verb', data: 'data.verb', pos: 'verb' },
  { index: 'index.adj', data: 'data.adj', pos: 'adj' },
  { index: 'index.adv', data: 'data.adv', pos: 'adv' },
];

/** data.pos → Map(synsetOffset → parsed synset) */
function parseDataFile(path) {
  const synsets = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith(' ') || line.length < 10) continue;
    const pipeAt = line.indexOf(' | ');
    if (pipeAt === -1) continue;
    const fields = line.slice(0, pipeAt).split(/\s+/);
    const offset = fields[0];
    const wordCount = parseInt(fields[3], 16);
    const words = [];
    for (let i = 0; i < wordCount; i++) {
      words.push(fields[4 + i * 2].replace(/_/g, ' '));
    }
    const gloss = line.slice(pipeAt + 3).trim();
    // gloss = definition; "example"; "example"...
    const definition = (gloss.split(';')[0] ?? '').trim().slice(0, 300);
    const exampleMatch = gloss.match(/"([^"]{3,200})"/);
    synsets.set(offset, {
      words,
      definition,
      example: exampleMatch ? exampleMatch[1] : null,
    });
  }
  return synsets;
}

/** index.pos → array of { lemma, offsets[] } (single words only) */
function parseIndexFile(path) {
  const lemmas = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith(' ') || line.trim() === '') continue;
    const fields = line.trim().split(/\s+/);
    const lemma = fields[0];
    if (lemma.includes('_')) continue; // multiword — out of MVP scope
    const synsetCount = parseInt(fields[2], 10);
    if (!Number.isFinite(synsetCount) || synsetCount < 1) continue;
    const offsets = fields.slice(fields.length - synsetCount);
    lemmas.push({ lemma, offsets: offsets.slice(0, MAX_SENSES_PER_POS) });
  }
  return lemmas;
}

// ── ARPABET → IPA ────────────────────────────────────────────────────────────

const ARPABET_IPA = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', B: 'b', CH: 'tʃ',
  D: 'd', DH: 'ð', EH: 'ɛ', ER: 'ɜr', EY: 'eɪ', F: 'f', G: 'ɡ', HH: 'h',
  IH: 'ɪ', IY: 'i', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ',
  OW: 'oʊ', OY: 'ɔɪ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ',
  UH: 'ʊ', UW: 'u', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};

function arpabetToIpa(arpabet) {
  const out = [];
  for (const raw of arpabet.trim().split(/\s+/)) {
    const stress = raw.endsWith('1') ? 'ˈ' : raw.endsWith('2') ? 'ˌ' : '';
    const phone = raw.replace(/\d$/, '');
    // unstressed AH is schwa; unstressed ER is syllabic ər
    let ipa =
      phone === 'AH' && raw.endsWith('0')
        ? 'ə'
        : phone === 'ER' && raw.endsWith('0')
          ? 'ər'
          : ARPABET_IPA[phone];
    if (!ipa) return null; // unknown phone — skip word
    out.push(stress + ipa);
  }
  return `/${out.join('')}/`;
}

// ── build ────────────────────────────────────────────────────────────────────

const SQL = await initSqlJs();
const db = new SQL.Database();
db.run(`
  CREATE TABLE entries (
    word TEXT NOT NULL,
    pos TEXT NOT NULL,
    rank INTEGER NOT NULL,
    definition TEXT NOT NULL,
    example TEXT,
    synonyms TEXT
  );
  CREATE TABLE pronunciations (
    word TEXT PRIMARY KEY,
    ipa TEXT NOT NULL
  );
`);

const knownWords = new Set();
let entryCount = 0;

db.run('BEGIN');
const insertEntry = db.prepare(
  'INSERT INTO entries (word, pos, rank, definition, example, synonyms) VALUES (?, ?, ?, ?, ?, ?)',
);
for (const { index, data, pos } of POS_FILES) {
  const synsets = parseDataFile(join(wordnetDict, data));
  const lemmas = parseIndexFile(join(wordnetDict, index));
  for (const { lemma, offsets } of lemmas) {
    let rank = 0;
    for (const offset of offsets) {
      const synset = synsets.get(offset);
      if (!synset || !synset.definition) continue;
      const synonyms = synset.words
        .filter((w) => w.toLowerCase() !== lemma.toLowerCase())
        .slice(0, MAX_SYNONYMS)
        .join(', ');
      insertEntry.run([lemma, pos, rank, synset.definition, synset.example, synonyms || null]);
      rank += 1;
      entryCount += 1;
    }
    if (rank > 0) knownWords.add(lemma);
  }
  console.log(`${pos}: done (${lemmas.length} lemmas scanned)`);
}
insertEntry.free();

let ipaCount = 0;
const insertIpa = db.prepare('INSERT OR IGNORE INTO pronunciations (word, ipa) VALUES (?, ?)');
for (const [word, arpabet] of Object.entries(cmu)) {
  const lower = word.toLowerCase();
  if (lower.includes('(') || !knownWords.has(lower)) continue;
  const ipa = arpabetToIpa(arpabet);
  if (!ipa) continue;
  insertIpa.run([lower, ipa]);
  ipaCount += 1;
}
insertIpa.free();
db.run('COMMIT');
db.run('CREATE INDEX idx_entries_word ON entries(word)');

mkdirSync(outDir, { recursive: true });
const bytes = db.export();
writeFileSync(join(outDir, 'dictionary.db'), Buffer.from(bytes));
console.log(
  `dictionary.db written: ${entryCount} sense entries, ${knownWords.size} words, ${ipaCount} pronunciations, ${(bytes.length / 1024 / 1024).toFixed(1)} MB`,
);
