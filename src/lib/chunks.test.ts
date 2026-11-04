import { describe, expect, it } from 'vitest';
import { buildChunks, chunkOf } from './chunks';

const p = (words: number) => ({ words, isHeading: false });
const h = (words = 3) => ({ words, isHeading: true });

describe('buildChunks', () => {
  it('starts a new chunk at each heading, keeping the heading with its text', () => {
    expect(buildChunks([p(60), h(), p(60), h(), p(60)])).toEqual([
      [0, 0],
      [1, 2],
      [3, 4],
    ]);
  });

  it('splits long sections at paragraph boundaries near the target size', () => {
    const blocks = [h(), p(100), p(100), p(100), p(100)];
    expect(buildChunks(blocks, { targetWords: 180 })).toEqual([
      [0, 2],
      [3, 4],
    ]);
  });

  it('merges a tiny leftover into the previous chunk', () => {
    expect(buildChunks([p(200), p(10)], { targetWords: 180, minWords: 50 })).toEqual([[0, 1]]);
  });

  it('never merges a heading chunk backwards', () => {
    expect(buildChunks([p(200), h(2)], { minWords: 50 })).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('handles empty input', () => {
    expect(buildChunks([])).toEqual([]);
  });
});

describe('chunkOf', () => {
  it('finds the chunk for a block', () => {
    const chunks: [number, number][] = [
      [0, 2],
      [3, 5],
    ];
    expect(chunkOf(chunks, 4)).toBe(1);
    expect(chunkOf(chunks, 9)).toBe(-1);
  });
});
