import { describe, expect, it } from 'vitest';
import { buildBlockStats, progressAt } from './progress';

describe('progressAt', () => {
  const stats = buildBlockStats([100, 100, 200]);

  it('computes prefix sums', () => {
    expect(stats.before).toEqual([0, 100, 200]);
    expect(stats.total).toBe(400);
  });

  it('reports progress at block starts and partway through', () => {
    expect(progressAt(stats, 0)).toEqual({ percent: 0, wordsRemaining: 400 });
    expect(progressAt(stats, 2)).toEqual({ percent: 50, wordsRemaining: 200 });
    expect(progressAt(stats, 2, 0.5)).toEqual({ percent: 75, wordsRemaining: 100 });
  });

  it('handles the end, out-of-range input and empty articles', () => {
    expect(progressAt(stats, 3)).toEqual({ percent: 100, wordsRemaining: 0 });
    expect(progressAt(stats, -1)).toEqual({ percent: 0, wordsRemaining: 400 });
    expect(progressAt(buildBlockStats([]), 0)).toEqual({ percent: 0, wordsRemaining: 0 });
  });
});
