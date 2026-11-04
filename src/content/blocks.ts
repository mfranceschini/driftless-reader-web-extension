import { countWords } from '@/src/lib/reading-time';

/** Elements that hold one readable unit of text. */
const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, figcaption, dt, dd, td, th';

export interface ReadingBlock {
  el: HTMLElement;
  index: number;
  words: number;
  /** First ~80 characters of normalized text, used to re-find the block later. */
  fingerprint: string;
}

export function fingerprintOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * Finds the readable blocks inside `container`, in document order.
 * Skips empty blocks and outer blocks that contain other blocks
 * (e.g. a <li> wrapping <p>s), so no text is counted twice.
 */
export function indexBlocks(container: HTMLElement): ReadingBlock[] {
  const candidates = [...container.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)];
  const blocks: ReadingBlock[] = [];
  for (const el of candidates) {
    if (el.querySelector(BLOCK_SELECTOR)) continue;
    const text = el.textContent ?? '';
    const words = countWords(text);
    if (words === 0) continue;
    blocks.push({ el, index: blocks.length, words, fingerprint: fingerprintOf(text) });
  }
  return blocks;
}

/**
 * Resolves a saved anchor to a block index on the current page: trusts the
 * saved index if its text still matches, otherwise searches by fingerprint.
 * Returns -1 if the block can't be found.
 */
export function resolveSavedAnchor(
  blocks: readonly ReadingBlock[],
  savedIndex: number,
  fingerprint: string,
): number {
  if (blocks[savedIndex]?.fingerprint === fingerprint) return savedIndex;
  const found = blocks.find((block) => block.fingerprint === fingerprint);
  return found ? found.index : -1;
}

/**
 * Index of the block under a horizontal "reading line" at `lineY`
 * (viewport coordinates), using binary search over block positions.
 * Returns the last block that starts above the line.
 */
export function blockAtLine(blocks: readonly ReadingBlock[], lineY: number): number {
  let low = 0;
  let high = blocks.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const top = blocks[mid]!.el.getBoundingClientRect().top;
    if (top <= lineY) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
