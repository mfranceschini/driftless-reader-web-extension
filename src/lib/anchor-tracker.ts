/**
 * Decides which block you have *actually read* (not just scrolled past),
 * and learns your reading speed while doing it. Pure and clock-injected,
 * so it can be unit-tested without a browser.
 *
 * A block counts as read once it has been the current block (the one under
 * the reading line) for long enough while the page is visible:
 *   max(MIN_DWELL_MS, DWELL_SHARE × expected reading time), capped at MAX_DWELL_MS.
 * Fast skim-scrolling therefore never moves the anchor forward.
 */

export const MIN_DWELL_MS = 1200;
export const MAX_DWELL_MS = 8000;
/** Fraction of the expected reading time a block must be "current" to count. */
export const DWELL_SHARE = 0.35;
/** Plausible human reading speeds; outside this we assume skimming or distraction. */
export const WPM_RANGE = { min: 80, max: 700 } as const;
const SPEED_SMOOTHING = 0.25;

export function dwellNeededMs(words: number, wpm: number): number {
  const expectedMs = (words / Math.max(1, wpm)) * 60_000;
  return Math.min(MAX_DWELL_MS, Math.max(MIN_DWELL_MS, expectedMs * DWELL_SHARE));
}

export interface TrackerState {
  /** Block currently under the reading line (-1 = none yet). */
  current: number;
  /** Furthest block confirmed as read (-1 = none). */
  anchor: number;
  /** Learned words-per-minute. */
  wpm: number;
}

export interface AnchorTrackerOptions {
  words: readonly number[];
  wpm: number;
  initialAnchor?: number;
  /** Called when the anchor moves forward. */
  onAnchor?(index: number): void;
  /** Called with an updated reading-speed estimate. */
  onSpeed?(wpm: number): void;
}

export class AnchorTracker {
  private readonly words: readonly number[];
  private readonly onAnchor?: (index: number) => void;
  private readonly onSpeed?: (wpm: number) => void;
  private state: TrackerState;
  private dwellMs = 0;
  private lastTick: number | null = null;
  /** Active (visible) time and words since the last anchor move, for speed learning. */
  private activeMsSinceAnchor = 0;
  /**
   * Speed is learned between two confirmations. The first confirmation of a
   * session only sets the baseline (its timing starts mid-block).
   */
  private hasBaseline = false;

  constructor(options: AnchorTrackerOptions) {
    this.words = options.words;
    this.onAnchor = options.onAnchor;
    this.onSpeed = options.onSpeed;
    this.state = {
      current: -1,
      anchor: Math.min(options.initialAnchor ?? -1, options.words.length - 1),
      wpm: options.wpm,
    };
  }

  get snapshot(): TrackerState {
    return { ...this.state };
  }

  /** Sets which block is under the reading line. Resets dwell when it changes. */
  setCurrent(index: number, now: number): void {
    if (index === this.state.current) return;
    this.state.current = index;
    this.dwellMs = 0;
    this.lastTick = now;
  }

  /**
   * Advances time. `active` is false while the tab is hidden or the window
   * is unfocused, so that time never counts as reading.
   */
  tick(now: number, active: boolean): void {
    this.advanceClock(now, active);
    this.maybeConfirm();
  }

  /** Lets the user (or a resume) place the anchor explicitly. */
  setAnchor(index: number): void {
    this.state.anchor = Math.max(-1, Math.min(index, this.words.length - 1));
    this.activeMsSinceAnchor = 0;
    this.hasBaseline = false;
  }

  private advanceClock(now: number, active: boolean): void {
    if (this.lastTick !== null && active) {
      const delta = Math.max(0, Math.min(now - this.lastTick, 2000)); // ignore long gaps (sleep)
      this.dwellMs += delta;
      this.activeMsSinceAnchor += delta;
    }
    this.lastTick = now;
  }

  private maybeConfirm(): void {
    const { current, anchor, wpm } = this.state;
    if (current < 0 || current <= anchor) return;
    const words = this.words[current] ?? 0;
    if (this.dwellMs < dwellNeededMs(words, wpm)) return;

    // Learn speed from the stretch between the old and new anchor, but only
    // when it was a normal step forward (not a jump after skimming).
    const wordsRead = this.words.slice(anchor + 1, current + 1).reduce((a, b) => a + b, 0);
    const minutes = this.activeMsSinceAnchor / 60_000;
    if (this.hasBaseline && current - anchor <= 3 && minutes > 0 && wordsRead >= 20) {
      const observed = wordsRead / minutes;
      if (observed >= WPM_RANGE.min && observed <= WPM_RANGE.max) {
        this.state.wpm = Math.round(wpm + (observed - wpm) * SPEED_SMOOTHING);
        this.onSpeed?.(this.state.wpm);
      }
    }

    this.state.anchor = current;
    this.activeMsSinceAnchor = 0;
    this.hasBaseline = true;
    this.onAnchor?.(current);
  }
}
