import { describe, expect, it, vi } from 'vitest';
import { AnchorTracker, dwellNeededMs, MAX_DWELL_MS, MIN_DWELL_MS } from './anchor-tracker';

/** Simulates ticking every 250ms for `ms` milliseconds. */
function run(tracker: AnchorTracker, start: number, ms: number, active = true): number {
  let now = start;
  for (; now <= start + ms; now += 250) tracker.tick(now, active);
  return now;
}

describe('dwellNeededMs', () => {
  it('scales with length and stays within bounds', () => {
    expect(dwellNeededMs(1, 240)).toBe(MIN_DWELL_MS);
    expect(dwellNeededMs(10_000, 240)).toBe(MAX_DWELL_MS);
    expect(dwellNeededMs(48, 240)).toBeCloseTo(4200); // 12s expected × 0.35
  });
});

describe('AnchorTracker', () => {
  const words = [20, 20, 20, 20];

  it('moves the anchor only after enough dwell time', () => {
    const onAnchor = vi.fn();
    // 10 words is short, so the minimum dwell (1.2s) applies.
    const tracker = new AnchorTracker({ words: [10, 10], wpm: 240, onAnchor });
    tracker.setCurrent(0, 0);
    run(tracker, 0, 1000);
    expect(tracker.snapshot.anchor).toBe(-1);
    run(tracker, 1000, 500);
    expect(tracker.snapshot.anchor).toBe(0);
    expect(onAnchor).toHaveBeenCalledWith(0);
  });

  it('does not move the anchor while skim-scrolling', () => {
    const tracker = new AnchorTracker({ words, wpm: 240 });
    let now = 0;
    for (let i = 0; i < words.length; i += 1) {
      tracker.setCurrent(i, now);
      now = run(tracker, now, 300);
    }
    expect(tracker.snapshot.anchor).toBe(-1);
  });

  it('does not count hidden-tab time as reading', () => {
    const tracker = new AnchorTracker({ words, wpm: 240 });
    tracker.setCurrent(0, 0);
    run(tracker, 0, 10_000, false);
    expect(tracker.snapshot.anchor).toBe(-1);
  });

  it('never moves the anchor backwards when re-reading', () => {
    const tracker = new AnchorTracker({ words, wpm: 240, initialAnchor: 2 });
    tracker.setCurrent(1, 0);
    run(tracker, 0, 5000);
    expect(tracker.snapshot.anchor).toBe(2);
  });

  it('learns reading speed from normal forward reading', () => {
    const onSpeed = vi.fn();
    const tracker = new AnchorTracker({ words: [60, 60, 60, 60], wpm: 240, onSpeed });
    let now = 0;
    // Read 60 words every 30s = 120 wpm, much slower than the 240 default.
    for (let i = 0; i < 4; i += 1) {
      tracker.setCurrent(i, now);
      now = run(tracker, now, 30_000);
    }
    expect(onSpeed).toHaveBeenCalled();
    expect(tracker.snapshot.wpm).toBeLessThan(240);
  });
});
