import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  normalizeSettings,
  SETTINGS_VERSION,
  stepSetting,
} from './settings';

const v = SETTINGS_VERSION;

describe('normalizeSettings', () => {
  it('returns defaults for missing or invalid input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ version: v, theme: 'neon', fontSize: 'big' })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('keeps valid values and fills in the rest', () => {
    const result = normalizeSettings({ version: v, theme: 'sepia', fontSize: 24 });
    expect(result.theme).toBe('sepia');
    expect(result.fontSize).toBe(24);
    expect(result.lineWidth).toBe(DEFAULT_SETTINGS.lineWidth);
  });

  it('clamps numbers to their limits', () => {
    expect(normalizeSettings({ version: v, fontSize: 99 }).fontSize).toBe(LIMITS.fontSize.max);
    expect(normalizeSettings({ version: v, lineHeight: 0.5 }).lineHeight).toBe(
      LIMITS.lineHeight.min,
    );
  });
});

describe('settings migration', () => {
  it('moves v1 users to the new reading defaults but keeps theme and Drift Guard', () => {
    const v1 = {
      theme: 'dark',
      fontFamily: 'sans',
      fontSize: 24,
      lineHeight: 2,
      driftGuard: false,
      driftSensitivity: 'eager',
    };
    const result = normalizeSettings(v1);
    expect(result).toMatchObject({
      version: v,
      theme: 'dark',
      driftGuard: false,
      driftSensitivity: 'eager',
      fontFamily: 'lexend',
      fontSize: 18,
      lineHeight: 1.6,
    });
  });

  it('moves v2 users to Chunk mode on, keeping every other setting', () => {
    const v2 = {
      version: 2,
      theme: 'sepia',
      fontFamily: 'atkinson',
      fontSize: 22,
      chunkMode: false,
    };
    expect(normalizeSettings(v2)).toMatchObject({
      version: v,
      theme: 'sepia',
      fontFamily: 'atkinson',
      fontSize: 22,
      chunkMode: true,
    });
  });

  it('respects turning Chunk mode off after the migration', () => {
    expect(normalizeSettings({ version: v, chunkMode: false }).chunkMode).toBe(false);
  });

  it('defaults to Lexend, 18px, 1.6 line height and a 68ch column', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      fontFamily: 'lexend',
      fontSize: 18,
      lineHeight: 1.6,
      lineWidth: 'medium',
    });
  });
});

describe('stepSetting', () => {
  it('steps small em values without float drift', () => {
    let s = DEFAULT_SETTINGS;
    for (let i = 0; i < 4; i += 1) s = stepSetting(s, 'letterSpacing', 1);
    expect(s.letterSpacing).toBe(0.12);
    s = stepSetting(s, 'letterSpacing', 1);
    s = stepSetting(s, 'letterSpacing', 1);
    expect(s.letterSpacing).toBe(LIMITS.letterSpacing.max);
  });

  it('steps within limits and avoids float drift', () => {
    const up = stepSetting(DEFAULT_SETTINGS, 'lineHeight', 1);
    expect(up.lineHeight).toBe(1.7);
    const maxed = stepSetting(
      { ...DEFAULT_SETTINGS, fontSize: LIMITS.fontSize.max },
      'fontSize',
      1,
    );
    expect(maxed.fontSize).toBe(LIMITS.fontSize.max);
  });
});
