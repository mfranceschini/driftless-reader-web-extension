/**
 * Guards legibility of glass surfaces: for each theme, text on a glass
 * panel must keep WCAG AA contrast (4.5:1) even in the worst case, i.e.
 * when the content behind the glass is pure black or pure white.
 * Reads the real tokens from reader.css so the test can't drift from it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the project root.
const css = readFileSync(resolve('src/content/ui/reader.css'), 'utf8');

type RGB = [number, number, number];

function block(selectorStart: string): string {
  const start = css.indexOf(selectorStart);
  if (start < 0) throw new Error(`No block ${selectorStart}`);
  return css.slice(start, css.indexOf('}', start));
}

function token(body: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(body);
  if (!match) throw new Error(`No --${name}`);
  return match[1]!.trim();
}

function hex(value: string): RGB {
  const h = value.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

function rgba(value: string): { rgb: RGB; a: number } {
  const m = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(value)!;
  return { rgb: [+m[1]!, +m[2]!, +m[3]!], a: +m[4]! };
}

const over = (top: RGB, alpha: number, bottom: RGB): RGB =>
  top.map((c, i) => c * alpha + bottom[i]! * (1 - alpha)) as RGB;

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const THEMES = {
  light: '.theme-light,\n.theme-auto {',
  sepia: '.theme-sepia {',
  dark: '.theme-dark {',
};

describe.each(Object.entries(THEMES))('glass contrast: %s theme', (_name, selector) => {
  const body = block(selector);
  const panel = hex(token(body, 'panel'));
  const alpha = parseFloat(token(body, 'glass-alpha'));
  const sheen = rgba(token(body, 'glass-sheen'));

  for (const [backdropName, backdrop] of [
    ['black', [0, 0, 0]],
    ['white', [255, 255, 255]],
  ] as [string, RGB][]) {
    // Tint over the backdrop, then the sheen at its strongest (top edge).
    const surface = over(sheen.rgb, sheen.a, over(panel, alpha, backdrop));
    for (const textToken of ['fg', 'muted']) {
      it(`--${textToken} stays ≥ 4.5:1 over ${backdropName}`, () => {
        expect(contrast(hex(token(body, textToken)), surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
