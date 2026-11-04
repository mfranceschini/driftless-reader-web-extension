/**
 * Maps a block's visible text to DOM positions, so a sentence or word
 * (as character offsets) can be turned back into a DOM Range for
 * highlighting — without changing the article's HTML.
 */

export interface TextMap {
  el: HTMLElement;
  /** Concatenated text of all text nodes, unmodified. */
  text: string;
  nodes: { node: Text; start: number }[];
}

export interface Sentence {
  /** Index of the reading block this sentence belongs to. */
  block: number;
  /** Character offsets within the block's TextMap.text. */
  start: number;
  end: number;
  text: string;
}

export function buildTextMap(el: HTMLElement): TextMap {
  const nodes: TextMap['nodes'] = [];
  let text = '';
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    nodes.push({ node, start: text.length });
    text += node.data;
  }
  return { el, text, nodes };
}

/** Converts [start, end) offsets in `map.text` into a DOM Range. */
export function rangeFor(map: TextMap, start: number, end: number): Range | null {
  const locate = (offset: number, preferNext: boolean) => {
    for (let i = 0; i < map.nodes.length; i += 1) {
      const { node, start: nodeStart } = map.nodes[i]!;
      const nodeEnd = nodeStart + node.data.length;
      const inside = preferNext ? offset < nodeEnd : offset <= nodeEnd;
      if (offset >= nodeStart && inside) return { node, offset: offset - nodeStart };
    }
    return null;
  };
  const from = locate(start, true);
  const to = locate(end, false);
  if (!from || !to) return null;
  const range = map.el.ownerDocument.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

/** Common abbreviations (English, Portuguese, Spanish) that end with a period mid-sentence. */
const ABBREVIATION_END =
  /(?:^|\s)(?:mr|mrs|ms|dr|dra|prof|profa|sr|sra|jr|st|vs|etc|e\.g|i\.e|fig|no|nº|av|ex)\.$/i;

/** Splits each block into sentences using the browser's own sentence segmenter. */
export function buildSentences(maps: readonly TextMap[], lang?: string | null): Sentence[] {
  let segmenter: Intl.Segmenter;
  try {
    segmenter = new Intl.Segmenter(lang ?? undefined, { granularity: 'sentence' });
  } catch {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  }
  const sentences: Sentence[] = [];
  maps.forEach((map, block) => {
    let pending: Sentence | null = null;
    // Source HTML often has line breaks inside paragraphs, and the segmenter
    // treats a line break as a sentence end. Replace each whitespace character
    // with a plain space: same length, so offsets still match the DOM.
    const flat = map.text.replace(/\s/gu, ' ');
    for (const { segment, index } of segmenter.segment(flat)) {
      const leading = segment.length - segment.trimStart().length;
      const trimmed = segment.trim();
      if (!trimmed) continue;
      const start = index + leading;
      if (pending && ABBREVIATION_END.test(pending.text)) {
        // "Dr. Who…" — the segmenter split after an abbreviation; join it back.
        pending.end = start + trimmed.length;
        pending.text = flat.slice(pending.start, pending.end);
        continue;
      }
      if (pending) sentences.push(pending);
      pending = { block, start, end: start + trimmed.length, text: trimmed };
    }
    if (pending) sentences.push(pending);
  });
  return sentences.filter((s) => /[\p{L}\p{N}]/u.test(s.text)); // skip bare punctuation
}

/** End offset of the word starting at `charIndex` (for voices without charLength). */
export function wordEnd(text: string, charIndex: number): number {
  const match = /^[^\s]+/u.exec(text.slice(charIndex));
  return charIndex + (match ? match[0].length : 0);
}
