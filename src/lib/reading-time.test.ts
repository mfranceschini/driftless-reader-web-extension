import { describe, expect, it } from 'vitest';
import { countWords, formatTimeLeft, minutesLeft, DEFAULT_WPM } from './reading-time';

describe('countWords', () => {
  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
  });

  it('counts words separated by any whitespace', () => {
    expect(countWords('one two\nthree\tfour')).toBe(4);
    expect(countWords('  leading and trailing  ')).toBe(3);
  });
});

describe('minutesLeft', () => {
  it('is 0 when nothing is left', () => {
    expect(minutesLeft(0)).toBe(0);
    expect(minutesLeft(-5)).toBe(0);
  });

  it('rounds up partial minutes', () => {
    expect(minutesLeft(1, 200)).toBe(1);
    expect(minutesLeft(401, 200)).toBe(3);
  });

  it('falls back to the default speed for invalid wpm', () => {
    expect(minutesLeft(DEFAULT_WPM * 2, 0)).toBe(2);
  });
});

describe('formatTimeLeft', () => {
  it('formats labels', () => {
    expect(formatTimeLeft(0)).toBe('Done');
    expect(formatTimeLeft(10, 200)).toBe('<1 min left');
    expect(formatTimeLeft(800, 200)).toBe('~4 min left');
  });
});
