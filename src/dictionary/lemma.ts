import lemmatizer from 'wink-lemmatizer';

/**
 * Lookup candidates for a tapped word, most-specific first:
 * exact lowercase → verb lemma → noun lemma → adjective lemma.
 * ("running" → run, "knives" → knife, "happier" → happy)
 */
export function lookupCandidates(raw: string): string[] {
  const word = raw.toLowerCase();
  const candidates = [
    word,
    lemmatizer.verb(word),
    lemmatizer.noun(word),
    lemmatizer.adjective(word),
  ];
  return [...new Set(candidates.filter((c) => c.length > 0))];
}
