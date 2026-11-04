/**
 * Drift Guard's brain. Watches three signals and reports drift events:
 *
 *  - away:     the tab was hidden or the window lost focus for a while
 *  - idle:     no scroll / mouse / key input for much longer than the
 *              current paragraph should take to read
 *  - skimming: scrolling forward much faster than you read, past your anchor
 *
 * Pure and clock-injected (no DOM), so it can be unit-tested.
 */

import type { DriftSensitivity } from './settings';

export type { DriftSensitivity };

export interface DriftThresholds {
  /** Minimum time away (hidden/unfocused) before we welcome you back. */
  awayMs: number;
  /** Minimum no-input time before we consider you drifted. */
  idleMs: number;
  /** Words skimmed within the window that count as skimming. */
  skimWords: number;
}

export const THRESHOLDS: Record<DriftSensitivity, DriftThresholds> = {
  gentle: { awayMs: 60_000, idleMs: 180_000, skimWords: 600 },
  balanced: { awayMs: 20_000, idleMs: 90_000, skimWords: 350 },
  eager: { awayMs: 8_000, idleMs: 45_000, skimWords: 200 },
};

/** Scrolling counts as skimming when faster than this multiple of your reading speed. */
export const SKIM_SPEED_FACTOR = 3;
/** Look-back window for skim detection. */
export const SKIM_WINDOW_MS = 6_000;
/** Consecutive forward steps (block changes) needed to count as skimming. */
export const MIN_SKIM_STEPS = 2;
/** A step forward of more than this many blocks is a jump, not skimming. */
export const MAX_SKIM_STEP = 5;
/** After a skim nudge, stay quiet for this long. */
export const SKIM_COOLDOWN_MS = 90_000;
/** Idle threshold is at least this multiple of the current block's expected reading time. */
export const IDLE_BLOCK_FACTOR = 2.5;

export type DriftEvent =
  | { type: 'returned'; reason: 'away' | 'idle'; awayMs: number }
  | { type: 'skimming'; wordsSkimmed: number };

export interface DriftDetectorOptions {
  sensitivity: DriftSensitivity;
  onDrift(event: DriftEvent): void;
}

interface ScrollSample {
  at: number;
  /** Block index. */
  index: number;
  /** Words before the current block (its position in the article). */
  position: number;
}

export class DriftDetector {
  private thresholds: DriftThresholds;
  private readonly onDrift: (event: DriftEvent) => void;

  private awaySince: number | null = null;
  private lastActivity: number;
  private idle = false;
  private samples: ScrollSample[] = [];
  private skimQuietUntil = 0;
  private skimMuted = false;
  /** While true (e.g. Read Aloud is playing), no input is expected. */
  private passive = false;
  private currentBlockExpectedMs = 0;

  constructor(options: DriftDetectorOptions, now: number) {
    this.thresholds = THRESHOLDS[options.sensitivity];
    this.onDrift = options.onDrift;
    this.lastActivity = now;
  }

  setSensitivity(sensitivity: DriftSensitivity): void {
    this.thresholds = THRESHOLDS[sensitivity];
  }

  /** "I'm skimming on purpose" — no more skim nudges for this article. */
  muteSkimming(): void {
    this.skimMuted = true;
  }

  setPassive(passive: boolean, now: number): void {
    this.passive = passive;
    this.lastActivity = now;
    this.idle = false;
  }

  /** Expected time to read the current block, so long paragraphs don't trigger idle. */
  setCurrentBlockExpectedMs(ms: number): void {
    this.currentBlockExpectedMs = ms;
  }

  /** Tab visibility or window focus changed. */
  setPresent(present: boolean, now: number): void {
    if (!present) {
      if (this.awaySince === null) this.awaySince = now;
      return;
    }
    if (this.awaySince === null) return;
    const awayMs = now - this.awaySince;
    this.awaySince = null;
    this.lastActivity = now;
    this.samples = [];
    if (awayMs >= this.thresholds.awayMs) {
      this.idle = false;
      this.onDrift({ type: 'returned', reason: 'away', awayMs });
    }
  }

  /** Any user input: mouse move, key, wheel, touch, scroll. */
  activity(now: number): void {
    if (this.idle) {
      this.idle = false;
      this.onDrift({ type: 'returned', reason: 'idle', awayMs: now - this.lastActivity });
    }
    this.lastActivity = now;
  }

  /**
   * The block under the reading line changed.
   * @param index the block's index
   * @param position words before the block
   * @param beyondAnchor how many blocks past the anchor the reader is
   */
  scrolledTo(
    index: number,
    position: number,
    beyondAnchor: number,
    wpm: number,
    now: number,
  ): void {
    // Keep only the current run of small forward steps inside the time window.
    const previous = this.samples[this.samples.length - 1];
    const step = previous ? index - previous.index : 0;
    if (previous && (step <= 0 || step > MAX_SKIM_STEP)) this.samples = [];
    this.samples.push({ at: now, index, position });
    this.samples = this.samples.filter((s) => now - s.at <= SKIM_WINDOW_MS);
    if (this.skimMuted || now < this.skimQuietUntil || beyondAnchor < 3) return;

    // Skimming means passing through several blocks, not one jump (e.g. a link).
    if (this.samples.length < MIN_SKIM_STEPS + 1) return;
    const first = this.samples[0]!;
    const words = position - first.position;
    const minutes = (now - first.at) / 60_000;
    if (words < this.thresholds.skimWords || minutes <= 0) return;
    if (words / minutes < wpm * SKIM_SPEED_FACTOR) return;

    this.skimQuietUntil = now + SKIM_COOLDOWN_MS;
    this.samples = [];
    this.onDrift({ type: 'skimming', wordsSkimmed: words });
  }

  /** Periodic check for idleness. */
  tick(now: number): void {
    if (this.idle || this.passive || this.awaySince !== null) return;
    const limit = Math.max(this.thresholds.idleMs, this.currentBlockExpectedMs * IDLE_BLOCK_FACTOR);
    if (now - this.lastActivity >= limit) this.idle = true;
  }

  get isIdle(): boolean {
    return this.idle;
  }
}
