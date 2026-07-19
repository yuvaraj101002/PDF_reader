/** Word tokenization for tap-to-select. Offsets index the chapter's text. */

export interface WordToken {
  /** raw token as printed (may carry punctuation) */
  text: string;
  start: number;
  end: number;
}

export function tokenize(text: string, baseOffset: number): WordToken[] {
  const tokens: WordToken[] = [];
  const matcher = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    tokens.push({
      text: match[0],
      start: baseOffset + match.index,
      end: baseOffset + match.index + match[0].length,
    });
  }
  return tokens;
}

/** "beautiful," → "beautiful"; keeps inner apostrophes/hyphens (don't, well-known) */
export const cleanWord = (raw: string): string =>
  raw.replace(/^[^A-Za-z’'-]+|[^A-Za-z’'-]+$/g, '');

/** Translucent highlight fills that read on light, sepia, and dark themes. */
export const HIGHLIGHT_COLORS = {
  yellow: '#FFD60A55',
  green: '#34C75955',
  blue: '#0A84FF45',
  pink: '#FF375F45',
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

export const highlightFill = (color: string): string =>
  HIGHLIGHT_COLORS[color as HighlightColor] ?? HIGHLIGHT_COLORS.yellow;
