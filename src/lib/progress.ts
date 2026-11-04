/**
 * Pure reading-progress math, shared by Focus View (and later the on-page mode).
 * A "block" is one readable unit: a paragraph, heading, list item, quote…
 */

export interface BlockStats {
  /** Words in each block, in document order. */
  words: readonly number[];
  /** Words before each block (prefix sums). */
  before: readonly number[];
  total: number;
}

export function buildBlockStats(words: readonly number[]): BlockStats {
  const before: number[] = [];
  let sum = 0;
  for (const count of words) {
    before.push(sum);
    sum += count;
  }
  return { words, before, total: sum };
}

export interface ProgressSnapshot {
  /** 0–100, whole numbers. */
  percent: number;
  wordsRemaining: number;
}

/**
 * Progress when the reader is `fraction` (0–1) of the way through block `index`.
 * An index past the end means "finished".
 */
export function progressAt(stats: BlockStats, index: number, fraction = 0): ProgressSnapshot {
  if (stats.total === 0) return { percent: 0, wordsRemaining: 0 };
  if (index >= stats.words.length) return { percent: 100, wordsRemaining: 0 };
  const safeIndex = Math.max(0, index);
  const within = (stats.words[safeIndex] ?? 0) * Math.min(1, Math.max(0, fraction));
  const read = (stats.before[safeIndex] ?? 0) + within;
  const wordsRemaining = Math.max(0, Math.round(stats.total - read));
  const percent = Math.min(100, Math.max(0, Math.round((read / stats.total) * 100)));
  return { percent, wordsRemaining };
}
