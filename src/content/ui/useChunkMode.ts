import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { buildChunks, chunkOf } from '@/src/lib/chunks';
import type { ReadingBlock } from '../blocks';

const DIM_CLASS = 'dl-dim';
/** Media that sit between text blocks and should dim with their chunk. */
const MEDIA_SELECTOR = 'img, picture, svg, video, table, hr';
/** Where the next chunk's first block lands when you press Next. */
const CHUNK_START_LINE = 0.3;

interface Options {
  enabled: boolean;
  contentRef: RefObject<HTMLElement | null>;
  getBlocks(): ReadingBlock[];
  scrollToBlockAt(index: number, line: number): void;
}

interface ChunkData {
  chunks: [number, number][];
  /** Every dimmable element with the chunk it belongs to. */
  items: { el: Element; chunk: number }[];
}

function isFormTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, input, select, textarea, a');
}

/**
 * Chunk mode: the article is split into small pieces; everything except
 * the current piece is dimmed. Space / Shift+Space move between pieces.
 * Dimming (not hiding) keeps layout, progress and the anchor accurate.
 */
export function useChunkMode({ enabled, contentRef, getBlocks, scrollToBlockAt }: Options) {
  const [chunk, setChunk] = useState({ index: 0, total: 0 });
  const dataRef = useRef<ChunkData | null>(null);
  const currentRef = useRef(-1);

  const build = useCallback((): ChunkData | null => {
    if (dataRef.current) return dataRef.current;
    const content = contentRef.current;
    const blocks = getBlocks();
    if (!content || blocks.length === 0) return null;
    const chunks = buildChunks(
      blocks.map((b) => ({ words: b.words, isHeading: /^H[1-6]$/.test(b.el.tagName) })),
    );
    const blockIndex = new Map<Element, number>(blocks.map((b) => [b.el, b.index]));
    const items: ChunkData['items'] = [];
    let lastBlock = 0;
    const selector = `${MEDIA_SELECTOR}, ${[...new Set(blocks.map((b) => b.el.tagName.toLowerCase()))].join(', ')}`;
    for (const el of content.querySelectorAll(selector)) {
      const index = blockIndex.get(el);
      if (index !== undefined) {
        lastBlock = index;
        items.push({ el, chunk: chunkOf(chunks, index) });
      } else if (!blocks.some((b) => b.el.contains(el) || el.contains(b.el))) {
        items.push({ el, chunk: Math.max(0, chunkOf(chunks, lastBlock)) });
      }
    }
    dataRef.current = { chunks, items };
    return dataRef.current;
  }, [contentRef, getBlocks]);

  const apply = useCallback((index: number) => {
    const data = dataRef.current;
    if (!data) return;
    currentRef.current = index;
    for (const item of data.items) item.el.classList.toggle(DIM_CLASS, item.chunk !== index);
    setChunk({ index, total: data.chunks.length });
  }, []);

  const clear = useCallback(() => {
    for (const item of dataRef.current?.items ?? []) item.el.classList.remove(DIM_CLASS);
    currentRef.current = -1;
  }, []);

  /** Called by the reading session when the block under the reading line changes. */
  const onCurrentBlock = useCallback(
    (blockIndex: number) => {
      if (!enabled) return;
      const data = build();
      if (!data) return;
      const index = Math.max(0, chunkOf(data.chunks, blockIndex));
      if (index !== currentRef.current) apply(index);
    },
    [enabled, build, apply],
  );

  const goTo = useCallback(
    (index: number) => {
      const data = build();
      if (!data) return;
      const target = Math.max(0, Math.min(index, data.chunks.length - 1));
      apply(target);
      scrollToBlockAt(data.chunks[target]![0], CHUNK_START_LINE);
    },
    [build, apply, scrollToBlockAt],
  );

  const next = useCallback(() => goTo(currentRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(currentRef.current - 1), [goTo]);

  // Turning on: dim around wherever you are now. Turning off: undim everything.
  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }
    const data = build();
    if (data) apply(Math.max(0, currentRef.current));
    return clear;
  }, [enabled, build, apply, clear]);

  // Space / Shift+Space step through chunks.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isFormTarget(event.composedPath()[0] ?? null)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) prev();
      else next();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [enabled, next, prev]);

  return { chunk, next, prev, onCurrentBlock };
}
