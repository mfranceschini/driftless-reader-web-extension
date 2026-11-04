import type { FontFamily } from '@/src/lib/settings';
import { FONT_FILES } from './font-files';

/**
 * Bundled reading fonts are loaded from the extension package (never from a
 * CDN), as bytes, and registered with the FontFace API. Loading bytes avoids
 * the host page's Content-Security-Policy, and registering on `document.fonts`
 * is required because @font-face rules inside a shadow root are ignored.
 *
 * Family names are prefixed so they can't clash with fonts the page uses.
 */
const BUNDLED: Partial<Record<FontFamily, { family: string; files: keyof typeof FONT_FILES }>> = {
  lexend: { family: 'Driftless Lexend', files: 'lexend' },
  atkinson: { family: 'Driftless Atkinson Next', files: 'atkinson' },
};

export const FONT_STACKS: Record<FontFamily, string> = {
  lexend: '"Driftless Lexend", Arial, sans-serif',
  atkinson: '"Driftless Atkinson Next", Arial, sans-serif',
  arial: 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif',
  serif: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif',
};

const loading = new Map<FontFamily, Promise<void>>();

/** Loads a bundled font once per page. System fonts resolve immediately. */
export function ensureFont(font: FontFamily): Promise<void> {
  const bundled = BUNDLED[font];
  if (!bundled) return Promise.resolve();
  let promise = loading.get(font);
  if (!promise) {
    promise = Promise.all(
      FONT_FILES[bundled.files].map(async ({ file, unicodeRange, style }) => {
        const response = await fetch(browser.runtime.getURL(`/${file}` as '/'));
        const face = new FontFace(bundled.family, await response.arrayBuffer(), {
          weight: '100 900',
          style,
          unicodeRange,
          display: 'swap',
        });
        document.fonts.add(await face.load());
      }),
    ).then(
      () => undefined,
      (error: unknown) => {
        loading.delete(font); // allow a retry; the fallback (Arial) is used meanwhile
        console.warn('[Driftless Reader] Could not load font', font, error);
      },
    );
    loading.set(font, promise);
  }
  return promise;
}
