/**
 * Reader appearance settings, shared by the popup and the on-page reader.
 * Stored in browser.storage.local — never synced or sent anywhere.
 */

export type Theme = 'auto' | 'light' | 'sepia' | 'dark';
export type FontFamily = 'lexend' | 'atkinson' | 'arial' | 'serif';
export type LineWidth = 'narrow' | 'medium' | 'wide';
export type DriftSensitivity = 'gentle' | 'balanced' | 'eager';
export type FocusBandLines = 1 | 3 | 5;
/** 'line': band stays on the reading line and text scrolls through it; 'pointer': follows the mouse. */
export type FocusBandMode = 'line' | 'pointer';

/** Bump when defaults change in a way existing users should receive. */
export const SETTINGS_VERSION = 2;

export interface ReaderSettings {
  version: number;
  theme: Theme;
  fontFamily: FontFamily;
  /** Body font size in px. */
  fontSize: number;
  /** Unitless line-height. */
  lineHeight: number;
  lineWidth: LineWidth;
  /** Extra space between paragraphs, in em. */
  paragraphSpacing: number;
  /** Extra space between letters, in em. */
  letterSpacing: number;
  /** Extra space between words, in em. */
  wordSpacing: number;
  /** Drift Guard: welcome-back cards and skim nudges. */
  driftGuard: boolean;
  driftSensitivity: DriftSensitivity;
  /** Read Aloud speed (1 = normal). */
  readAloudRate: number;
  /** Chosen voice's voiceURI, or null for "best match for the article". */
  readAloudVoice: string | null;
  /** Focus band: dims everything except a few lines. */
  focusBand: boolean;
  focusBandLines: FocusBandLines;
  focusBandMode: FocusBandMode;
  /** Chunk mode: one small piece of the article at a time. */
  chunkMode: boolean;
  /** Frosted-glass look on floating controls (never on the text). */
  glass: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  version: SETTINGS_VERSION,
  theme: 'auto',
  fontFamily: 'lexend',
  fontSize: 18,
  lineHeight: 1.6,
  lineWidth: 'medium',
  paragraphSpacing: 1.2,
  letterSpacing: 0,
  wordSpacing: 0,
  driftGuard: true,
  driftSensitivity: 'balanced',
  readAloudRate: 1,
  readAloudVoice: null,
  focusBand: false,
  focusBandLines: 3,
  focusBandMode: 'line',
  chunkMode: false,
  glass: true,
};

export const LIMITS = {
  fontSize: { min: 14, max: 32, step: 2 },
  lineHeight: { min: 1.3, max: 2.4, step: 0.1 },
  paragraphSpacing: { min: 0.6, max: 2.4, step: 0.3 },
  // Upper bounds go beyond WCAG 2.2 SC 1.4.12 (0.12em letters, 0.16em words).
  letterSpacing: { min: 0, max: 0.15, step: 0.03 },
  wordSpacing: { min: 0, max: 0.4, step: 0.08 },
  readAloudRate: { min: 0.6, max: 2, step: 0.1 },
} as const;

/** Max characters per line for each width option (≈ 50 / 66 / 80 is the readable range). */
export const LINE_WIDTH_CH: Record<LineWidth, number> = {
  narrow: 52,
  medium: 68,
  wide: 80,
};

const THEMES: readonly Theme[] = ['auto', 'light', 'sepia', 'dark'];
const FONTS: readonly FontFamily[] = ['lexend', 'atkinson', 'arial', 'serif'];
const WIDTHS: readonly LineWidth[] = ['narrow', 'medium', 'wide'];
const SENSITIVITIES: readonly DriftSensitivity[] = ['gentle', 'balanced', 'eager'];
const BAND_LINES: readonly FocusBandLines[] = [1, 3, 5];
const BAND_MODES: readonly FocusBandMode[] = ['line', 'pointer'];

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  const rounded = Math.round(value * 100) / 100;
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
  let input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<string, unknown>>;
  const d = DEFAULT_SETTINGS;

  // v1 → v2: the reading defaults changed to Lexend / 18px / 1.6 / 68ch.
  // Reset typography once, but keep theme and Drift Guard choices.
  if (input.version !== SETTINGS_VERSION && Object.keys(input).length > 0) {
    input = {
      theme: input.theme,
      driftGuard: input.driftGuard,
      driftSensitivity: input.driftSensitivity,
    };
  }

  return {
    version: SETTINGS_VERSION,
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
    letterSpacing: clamp(
      input.letterSpacing,
      LIMITS.letterSpacing.min,
      LIMITS.letterSpacing.max,
      d.letterSpacing,
    ),
    wordSpacing: clamp(
      input.wordSpacing,
      LIMITS.wordSpacing.min,
      LIMITS.wordSpacing.max,
      d.wordSpacing,
    ),
    driftGuard: typeof input.driftGuard === 'boolean' ? input.driftGuard : d.driftGuard,
    driftSensitivity: oneOf(input.driftSensitivity, SENSITIVITIES, d.driftSensitivity),
    readAloudRate: clamp(
      input.readAloudRate,
      LIMITS.readAloudRate.min,
      LIMITS.readAloudRate.max,
      d.readAloudRate,
    ),
    readAloudVoice:
      typeof input.readAloudVoice === 'string' && input.readAloudVoice.length < 500
        ? input.readAloudVoice
        : null,
    focusBand: typeof input.focusBand === 'boolean' ? input.focusBand : d.focusBand,
    focusBandLines: BAND_LINES.includes(input.focusBandLines as FocusBandLines)
      ? (input.focusBandLines as FocusBandLines)
      : d.focusBandLines,
    focusBandMode: oneOf(input.focusBandMode, BAND_MODES, d.focusBandMode),
    chunkMode: typeof input.chunkMode === 'boolean' ? input.chunkMode : d.chunkMode,
    glass: typeof input.glass === 'boolean' ? input.glass : d.glass,
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
