import type { FontFamily } from '@/src/lib/settings';
import { FONT_FILES } from './font-files';
import { MESSAGES, type GetFontResponse } from '@/src/lib/messages';

/**
 * Bundled reading fonts are loaded from the extension package (never from a
 * CDN), as bytes, and registered with the FontFace API. Loading bytes avoids
 * the host page's Content-Security-Policy, and registering on `document.fonts`
 * is required because @font-face rules inside a shadow root are ignored.
 *
 * On web pages the bytes come from the background worker via messaging, so
 * the font files don't have to be web-accessible: any site could otherwise
 * probe chrome-extension://<id>/fonts/… to detect that Driftless Reader
 * (an ADHD tool) is installed.
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

/** Every bundled font file; the background only serves files on this list. */
export const ALLOWED_FONT_FILES: ReadonlySet<string> = new Set(
  Object.values(FONT_FILES).flatMap((files) => files.map((f) => f.file)),
);

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fontBytes(file: string): Promise<ArrayBuffer | Uint8Array<ArrayBuffer>> {
  // Extension pages (options, welcome) can read their own package directly.
  if (location.protocol.endsWith('-extension:')) {
    return (await fetch(browser.runtime.getURL(`/${file}` as '/'))).arrayBuffer();
  }
  const response = (await browser.runtime.sendMessage({
    type: MESSAGES.getFont,
    file,
  })) as GetFontResponse | undefined;
  if (!response?.ok || !response.data) throw new Error(`Font unavailable: ${file}`);
  return base64ToBytes(response.data);
}

/** Loads a bundled font once per page. System fonts resolve immediately. */
export function ensureFont(font: FontFamily): Promise<void> {
  const bundled = BUNDLED[font];
  if (!bundled) return Promise.resolve();
  let promise = loading.get(font);
  if (!promise) {
    promise = Promise.all(
      FONT_FILES[bundled.files].map(async ({ file, unicodeRange, style }) => {
        const face = new FontFace(bundled.family, await fontBytes(file), {
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
