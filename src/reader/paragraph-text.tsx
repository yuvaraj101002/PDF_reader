import { memo, useMemo } from 'react';
import { Text } from 'react-native';

import type { TextRange } from '@/extraction/types';

import { highlightFill, tokenize, type WordToken } from './tokens';

export interface HighlightSpan {
  id: string;
  startOffset: number;
  endOffset: number;
  color: string;
  /** noted highlights get an underline cue */
  hasNote?: boolean;
}

interface Props {
  text: string;
  /** chapter-text offset of this paragraph's first character */
  baseOffset: number;
  fontSize: number;
  color: string;
  fontFamily?: string;
  highlights?: HighlightSpan[];
  /** karaoke: sentence currently being read aloud (chapter offsets) */
  activeSentence?: TextRange;
  /** karaoke: word currently being spoken */
  activeWord?: TextRange;
  /** karaoke fills, derived from the reader palette accent */
  sentenceFill?: string;
  wordFill?: string;
  onPressWord: (token: WordToken) => void;
  onLongPressWord: (token: WordToken) => void;
}

const intersects = (token: WordToken, range?: TextRange) =>
  range !== undefined && token.start < range.end && token.end > range.start;

/**
 * One paragraph as nested word spans — every word tappable (tap = word,
 * long-press = sentence). Backgrounds by precedence: spoken word > highlight >
 * spoken sentence. Adjacent words with identical backgrounds absorb the space
 * between them so fills paint continuously. Memoized — only paragraphs whose
 * props change re-render.
 */
export const ParagraphText = memo(function ParagraphText({
  text,
  baseOffset,
  fontSize,
  color,
  fontFamily,
  highlights,
  activeSentence,
  activeWord,
  sentenceFill,
  wordFill,
  onPressWord,
  onLongPressWord,
}: Props) {
  const tokens = useMemo(() => tokenize(text, baseOffset), [text, baseOffset]);

  const highlightFor = (token: WordToken) =>
    highlights?.find((h) => token.start < h.endOffset && token.end > h.startOffset);

  const backgroundFor = (token: WordToken): string | undefined => {
    if (intersects(token, activeWord)) return wordFill;
    const highlight = highlightFor(token);
    if (highlight) return highlightFill(highlight.color);
    if (intersects(token, activeSentence)) return sentenceFill;
    return undefined;
  };

  const parts: React.ReactNode[] = [];
  tokens.forEach((token, index) => {
    const background = backgroundFor(token);
    const noted = highlightFor(token)?.hasNote === true;
    const next = tokens[index + 1];
    const joinsNext =
      background !== undefined && next !== undefined && backgroundFor(next) === background;
    parts.push(
      <Text
        key={token.start}
        suppressHighlighting
        onPress={() => onPressWord(token)}
        onLongPress={() => onLongPressWord(token)}
        style={
          background || noted
            ? {
                backgroundColor: background,
                textDecorationLine: noted ? 'underline' : 'none',
              }
            : undefined
        }
      >
        {token.text}
        {joinsNext ? ' ' : ''}
      </Text>,
    );
    if (!joinsNext && index < tokens.length - 1) parts.push(' ');
  });

  return (
    <Text
      style={{
        fontFamily,
        fontSize,
        lineHeight: fontSize * 1.65,
        color,
        marginBottom: 16,
        // our tap/long-press selection replaces the browser's native one
        userSelect: 'none',
      }}
    >
      {parts}
    </Text>
  );
});
