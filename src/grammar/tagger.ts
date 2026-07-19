import nlp from 'compromise';

/**
 * Grammar-lite: offline part-of-speech tagging via compromise (rule +
 * lexicon based, no network). Penn-style tags are folded into a small set of
 * learner-friendly categories, each with a stable legend color that reads on
 * every reader palette (fills carry their own alpha).
 */

export type PosCategory =
  | 'noun'
  | 'pronoun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'article'
  | 'conjunction'
  | 'number'
  | 'other';

export interface TaggedWord {
  text: string;
  /** trailing punctuation/whitespace after the word, e.g. ", " */
  post: string;
  pos: PosCategory;
}

export const POS_INFO: Record<PosCategory, { label: string; color: string }> = {
  noun: { label: 'noun', color: '#7C6FD0' },
  pronoun: { label: 'pronoun', color: '#0A84FF' },
  verb: { label: 'verb', color: '#E95580' },
  adjective: { label: 'adjective', color: '#E8930C' },
  adverb: { label: 'adverb', color: '#00A2A2' },
  preposition: { label: 'preposition', color: '#30A46C' },
  article: { label: 'article', color: '#8E8E93' },
  conjunction: { label: 'conjunction', color: '#A0653A' },
  number: { label: 'number', color: '#B08800' },
  other: { label: 'other', color: '#8E8E93' },
};

/** display order for the legend */
export const POS_ORDER: PosCategory[] = [
  'noun',
  'pronoun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'article',
  'conjunction',
  'number',
];

/**
 * Closed-class words compromise sometimes mislabels (e.g. "jumps over" →
 * over:Adjective). When the tag-based category is weak (adjective/other),
 * these are relabeled as prepositions — right far more often than not.
 */
const PREPOSITION_OVERRIDES = new Set([
  'over', 'under', 'near', 'past', 'through', 'behind', 'above', 'below',
  'beyond', 'inside', 'outside', 'within', 'without', 'across', 'along',
  'beneath', 'beside', 'toward', 'towards', 'upon', 'onto', 'into',
]);

/** precedence matters: pronouns also carry Noun, determiners carry Adjective… */
function categorize(word: string, tags: string[]): PosCategory {
  const has = (tag: string) => tags.includes(tag);
  if (has('Pronoun')) return 'pronoun';
  if (has('Determiner')) return 'article';
  if (has('Preposition')) return 'preposition';
  if (has('Conjunction')) return 'conjunction';
  if (has('Value') || has('Cardinal') || has('NumericValue')) return 'number';
  if (has('Adverb') || has('Negative')) return 'adverb';
  if (has('Verb') || has('Copula') || has('Auxiliary') || has('Modal')) return 'verb';
  if (has('Adjective')) {
    return PREPOSITION_OVERRIDES.has(word.toLowerCase()) ? 'preposition' : 'adjective';
  }
  if (has('Noun')) return 'noun';
  return PREPOSITION_OVERRIDES.has(word.toLowerCase()) ? 'preposition' : 'other';
}

interface CompromiseTerm {
  text: string;
  pre: string;
  post: string;
  tags?: string[];
}

export function tagSentence(text: string): TaggedWord[] {
  const doc = nlp(text);
  const words: TaggedWord[] = [];
  const sentences = doc.json({ offset: false }) as { terms: CompromiseTerm[] }[];
  for (const sentence of sentences) {
    for (const term of sentence.terms) {
      if (!term.text) continue;
      words.push({
        text: term.text,
        post: term.post ?? '',
        pos: categorize(term.text, term.tags ?? []),
      });
    }
  }
  return words;
}
