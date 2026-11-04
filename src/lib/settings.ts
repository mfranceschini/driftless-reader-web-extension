/**
 * Reader appearance settings, shared by the popup and the on-page reader.
 * Stored in browser.storage.local — never synced or sent anywhere.
 */

export type Theme = 'auto' | 'light' | 'sepia' | 'dark';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type LineWidth = 'narrow' | 'medium' | 'wide';

export interface ReaderSettings {
  theme: Theme;
  fontFamily: FontFamily;
  /** Body font size in px. */
  fontSize: number;
  /** Unitless line-height. */
  lineHeight: number;
  lineWidth: LineWidth;
  /** Extra space between paragraphs, in em. */
  paragraphSpacing: number;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'auto',
  fontFamily: 'sans',
  fontSize: 20,
  lineHeight: 1.7,
  lineWidth: 'medium',
  paragraphSpacing: 1.2,
};

export const LIMITS = {
  fontSize: { min: 14, max: 32, step: 2 },
  lineHeight: { min: 1.3, max: 2.4, step: 0.1 },
  paragraphSpacing: { min: 0.6, max: 2.4, step: 0.3 },
} as const;

/** Max characters per line for each width option (≈ 50 / 66 / 80 is the readable range). */
export const LINE_WIDTH_CH: Record<LineWidth, number> = {
  narrow: 52,
  medium: 66,
  wide: 80,
};

const THEMES: readonly Theme[] = ['auto', 'light', 'sepia', 'dark'];
const FONTS: readonly FontFamily[] = ['sans', 'serif', 'mono'];
const WIDTHS: readonly LineWidth[] = ['narrow', 'medium', 'wide'];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  const rounded = Math.round(value * 10) / 10;
  return Math.min(max, Math.max(min, rounded));
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/**
 * Turns whatever is in storage (possibly old, partial or corrupted) into a
 * valid settings object.
 */
export function normalizeSettings(raw: unknown): ReaderSettings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<string, unknown>>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: oneOf(input.theme, THEMES, d.theme),
    fontFamily: oneOf(input.fontFamily, FONTS, d.fontFamily),
    fontSize: clamp(input.fontSize, LIMITS.fontSize.min, LIMITS.fontSize.max, d.fontSize),
    lineHeight: clamp(input.lineHeight, LIMITS.lineHeight.min, LIMITS.lineHeight.max, d.lineHeight),
    lineWidth: oneOf(input.lineWidth, WIDTHS, d.lineWidth),
    paragraphSpacing: clamp(
      input.paragraphSpacing,
      LIMITS.paragraphSpacing.min,
      LIMITS.paragraphSpacing.max,
      d.paragraphSpacing,
    ),
  };
}

/** Steps a numeric setting up or down within its limits. */
export function stepSetting(
  settings: ReaderSettings,
  key: keyof typeof LIMITS,
  direction: 1 | -1,
): ReaderSettings {
  const { step } = LIMITS[key];
  return normalizeSettings({ ...settings, [key]: settings[key] + step * direction });
}
