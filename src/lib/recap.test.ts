import { describe, expect, it } from 'vitest';
import { formatDuration, lastSentence, splitSentences } from './recap';

describe('splitSentences', () => {
  it('splits on sentence punctuation followed by a capital', () => {
    expect(splitSentences('One thing. Another! A third? Yes.')).toEqual([
      'One thing.',
      'Another!',
      'A third?',
      'Yes.',
    ]);
  });

  it('does not split decimals or lowercase continuations', () => {
    expect(splitSentences('It costs 3.5 dollars. e.g. this one stays together.')).toEqual([
      'It costs 3.5 dollars. e.g. this one stays together.',
    ]);
  });
});

describe('lastSentence', () => {
  it('returns the final sentence', () => {
    expect(lastSentence('First idea here. The last thing you read.')).toBe(
      'The last thing you read.',
    );
  });

  it('trims very long sentences from the start at a word boundary', () => {
    const long = `${'word '.repeat(100)}end.`;
    const result = lastSentence(long, 40);
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('end.')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(41);
  });

  it('handles empty text', () => {
    expect(lastSentence('   ')).toBe('');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(3 * 60_000)).toBe('3 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 5 min');
    expect(formatDuration(120 * 60_000)).toBe('2 h');
  });
});
