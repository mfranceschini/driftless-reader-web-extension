import { describe, expect, it } from 'vitest';
import { indexBlocks, resolveSavedAnchor } from './blocks';
import { privateId } from '@/src/lib/hash';

function container(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('indexBlocks', () => {
  it('indexes leaf blocks in order and skips empty or wrapping ones', () => {
    const blocks = indexBlocks(
      container(`
        <h2>Intro</h2>
        <p>One two three.</p>
        <p>   </p>
        <ul><li><p>Nested paragraph here.</p></li><li>Plain item</li></ul>
      `),
    );
    expect(blocks.map((b) => b.fingerprint)).toEqual([
      'Intro',
      'One two three.',
      'Nested paragraph here.',
      'Plain item',
    ]);
    expect(blocks.map((b) => b.words)).toEqual([1, 3, 3, 2]);
  });
});

describe('resolveSavedAnchor', () => {
  const blocks = indexBlocks(container('<p>Alpha text</p><p>Beta text</p><p>Gamma text</p>'));

  it('uses the saved index when the text still matches', () => {
    expect(resolveSavedAnchor(blocks, 1, privateId('Beta text'))).toBe(1);
  });

  it('finds the block by text if the page changed', () => {
    expect(resolveSavedAnchor(blocks, 0, privateId('Gamma text'))).toBe(2);
  });

  it('returns -1 when the block is gone', () => {
    expect(resolveSavedAnchor(blocks, 1, privateId('Deleted paragraph'))).toBe(-1);
  });

  it('never exposes the text in the stored fingerprint', () => {
    expect(blocks[1]!.fingerprintId).not.toContain('Beta');
  });
});
