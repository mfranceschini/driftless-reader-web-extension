import { describe, expect, it, vi } from 'vitest';
import { DriftDetector, SKIM_COOLDOWN_MS, THRESHOLDS } from './drift-detector';

const balanced = THRESHOLDS.balanced;

function make() {
  const onDrift = vi.fn();
  const detector = new DriftDetector({ sensitivity: 'balanced', onDrift }, 0);
  return { detector, onDrift };
}

describe('away detection', () => {
  it('welcomes you back after being away long enough', () => {
    const { detector, onDrift } = make();
    detector.setPresent(false, 1_000);
    detector.setPresent(true, 1_000 + balanced.awayMs + 500);
    expect(onDrift).toHaveBeenCalledWith({
      type: 'returned',
      reason: 'away',
      awayMs: balanced.awayMs + 500,
    });
  });

  it('ignores quick tab switches', () => {
    const { detector, onDrift } = make();
    detector.setPresent(false, 1_000);
    detector.setPresent(true, 4_000);
    expect(onDrift).not.toHaveBeenCalled();
  });

  it('keeps the first "away" time when blur and hide both fire', () => {
    const { detector, onDrift } = make();
    detector.setPresent(false, 0);
    detector.setPresent(false, 10_000);
    detector.setPresent(true, balanced.awayMs);
    expect(onDrift).toHaveBeenCalledTimes(1);
  });
});

describe('idle detection', () => {
  it('reports a return on the first input after going idle', () => {
    const { detector, onDrift } = make();
    detector.tick(balanced.idleMs - 1);
    expect(detector.isIdle).toBe(false);
    detector.tick(balanced.idleMs);
    expect(detector.isIdle).toBe(true);
    expect(onDrift).not.toHaveBeenCalled();
    detector.activity(balanced.idleMs + 5_000);
    expect(onDrift).toHaveBeenCalledWith({
      type: 'returned',
      reason: 'idle',
      awayMs: balanced.idleMs + 5_000,
    });
  });

  it('gives long paragraphs more time', () => {
    const { detector } = make();
    detector.setCurrentBlockExpectedMs(60_000); // 2.5 × 60s = 150s > 90s
    detector.tick(balanced.idleMs + 1);
    expect(detector.isIdle).toBe(false);
    detector.tick(150_000);
    expect(detector.isIdle).toBe(true);
  });

  it('never goes idle while passive (e.g. Read Aloud playing)', () => {
    const { detector } = make();
    detector.setPassive(true, 0);
    detector.tick(10 * balanced.idleMs);
    expect(detector.isIdle).toBe(false);
  });
});

describe('skim detection', () => {
  it('nudges when scrolling far past the anchor much faster than reading', () => {
    const { detector, onDrift } = make();
    detector.scrolledTo(3, 0, 3, 240, 0);
    detector.scrolledTo(4, 200, 4, 240, 1_000);
    detector.scrolledTo(5, 400, 5, 240, 2_000); // 400 words in 2s ≫ 3×240 wpm
    expect(onDrift).toHaveBeenCalledWith({ type: 'skimming', wordsSkimmed: 400 });
  });

  it('ignores jumps, even big ones', () => {
    const { detector, onDrift } = make();
    detector.scrolledTo(0, 0, 0, 240, 0);
    detector.scrolledTo(3, 0, 3, 240, 0);
    detector.scrolledTo(20, 2_000, 20, 240, 500);
    detector.scrolledTo(21, 2_100, 21, 240, 700);
    expect(onDrift).not.toHaveBeenCalled();
  });

  it('stays quiet when reading normally or near the anchor', () => {
    const { detector, onDrift } = make();
    detector.scrolledTo(0, 0, 0, 240, 0);
    detector.scrolledTo(1, 400, 1, 240, 2_000); // fast, but only 1 block past anchor
    detector.scrolledTo(3, 0, 3, 240, 10_000);
    detector.scrolledTo(4, 100, 4, 240, 30_000); // far past anchor but slow
    expect(onDrift).not.toHaveBeenCalled();
  });

  it('respects the cooldown and the mute', () => {
    const { detector, onDrift } = make();
    detector.scrolledTo(5, 0, 5, 240, 0);
    detector.scrolledTo(6, 500, 6, 240, 1_000);
    detector.scrolledTo(7, 1_000, 7, 240, 2_000);
    detector.scrolledTo(8, 1_500, 8, 240, 3_000);
    expect(onDrift).toHaveBeenCalledTimes(1);

    detector.muteSkimming();
    detector.scrolledTo(9, 2_000, 9, 240, SKIM_COOLDOWN_MS + 1_000);
    detector.scrolledTo(10, 3_000, 10, 240, SKIM_COOLDOWN_MS + 2_000);
    expect(onDrift).toHaveBeenCalledTimes(1);
  });
});
