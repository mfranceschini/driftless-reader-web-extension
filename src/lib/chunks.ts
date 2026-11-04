/**
 * Splits an article into "chunks" for Chunk mode: small, self-contained
 * pieces you read one at a time.
 *
 * Rules:
 *  - a heading always starts a new chunk (and stays with what follows it)
 *  - a chunk closes at a paragraph boundary once it reaches `targetWords`
 *  - a tiny leftover (< `minWords`) is merged into the previous chunk
 */

export interface ChunkInput {
  words: number;
  isHeading: boolean;
}

export interface ChunkOptions {
  targetWords?: number;
  minWords?: number;
}

/** Returns, for each chunk, the [first, last] block indexes (inclusive). */
export function buildChunks(
  blocks: readonly ChunkInput[],
  { targetWords = 180, minWords = 50 }: ChunkOptions = {},
): [number, number][] {
  const chunks: { start: number; end: number; words: number; headed: boolean }[] = [];
  let current: (typeof chunks)[number] | null = null;

  blocks.forEach((block, index) => {
    const startNew =
      !current ||
      (block.isHeading && current.words > 0) ||
      (!block.isHeading && current.words >= targetWords);
    if (startNew) {
      if (current) chunks.push(current);
      current = { start: index, end: index, words: 0, headed: block.isHeading };
    }
    current!.end = index;
    current!.words += block.words;
  });
  if (current) chunks.push(current);

  // Merge tiny chunks into the previous one, unless they start a new section.
  const merged: typeof chunks = [];
  for (const chunk of chunks) {
    const previous = merged[merged.length - 1];
    if (previous && chunk.words < minWords && !chunk.headed) {
      previous.end = chunk.end;
      previous.words += chunk.words;
    } else {
      merged.push({ ...chunk });
    }
  }
  return merged.map((c) => [c.start, c.end]);
}

/** Index of the chunk containing `block` (or -1). */
export function chunkOf(chunks: readonly [number, number][], block: number): number {
  return chunks.findIndex(([start, end]) => block >= start && block <= end);
}
