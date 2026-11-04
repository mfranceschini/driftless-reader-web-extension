/** Average adult silent-reading speed for non-fiction (words per minute). */
export const DEFAULT_WPM = 238;

/** Counts words in a block of text (whitespace-separated tokens). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/u).length;
}

/**
 * Estimated minutes left to read `wordsRemaining` words at `wpm`.
 * Always rounds up so "0 min" only appears when there is nothing left.
 */
export function minutesLeft(wordsRemaining: number, wpm: number = DEFAULT_WPM): number {
  if (wordsRemaining <= 0) return 0;
  const speed = wpm > 0 ? wpm : DEFAULT_WPM;
  return Math.ceil(wordsRemaining / speed);
}

/** Human-friendly label, e.g. "~4 min left" or "Done". */
export function formatTimeLeft(wordsRemaining: number, wpm?: number): string {
  const minutes = minutesLeft(wordsRemaining, wpm);
  if (minutes === 0) return 'Done';
  return minutes === 1 ? '<1 min left' : `~${minutes} min left`;
}
