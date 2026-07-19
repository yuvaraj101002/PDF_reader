/** One WordNet sense of a word. */
export interface DictionaryEntry {
  pos: 'noun' | 'verb' | 'adj' | 'adv' | string;
  definition: string;
  example?: string;
  synonyms: string[];
}

export interface DictionaryResult {
  /** the word as tapped, e.g. "running" */
  requested: string;
  /** the dictionary form that matched, e.g. "run" */
  word: string;
  ipa?: string;
  entries: DictionaryEntry[];
}
