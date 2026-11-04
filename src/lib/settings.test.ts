import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, LIMITS, normalizeSettings, stepSetting } from './settings';

describe('normalizeSettings', () => {
  it('returns defaults for missing or invalid input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ theme: 'neon', fontSize: 'big' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and fills in the rest', () => {
    const result = normalizeSettings({ theme: 'sepia', fontSize: 24 });
    expect(result.theme).toBe('sepia');
    expect(result.fontSize).toBe(24);
    expect(result.lineWidth).toBe(DEFAULT_SETTINGS.lineWidth);
  });

  it('clamps numbers to their limits', () => {
    expect(normalizeSettings({ fontSize: 99 }).fontSize).toBe(LIMITS.fontSize.max);
    expect(normalizeSettings({ lineHeight: 0.5 }).lineHeight).toBe(LIMITS.lineHeight.min);
  });
});

describe('stepSetting', () => {
  it('steps within limits and avoids float drift', () => {
    const up = stepSetting(DEFAULT_SETTINGS, 'lineHeight', 1);
    expect(up.lineHeight).toBe(1.8);
    const maxed = stepSetting(
      { ...DEFAULT_SETTINGS, fontSize: LIMITS.fontSize.max },
      'fontSize',
      1,
    );
    expect(maxed.fontSize).toBe(LIMITS.fontSize.max);
  });
});
