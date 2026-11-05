import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Narrator, type NarratorState, type SpeechPort } from '../speech/narrator';
import { createFakeSpeechPort, createSpeechSynthesisPort } from '../speech/ports';
import {
  buildSentences,
  buildTextMap,
  rangeFor,
  wordEnd,
  type Sentence,
  type TextMap,
} from '../speech/text-map';
import { getVoices, pickVoice } from '../speech/voices';
import type { ReadingBlock } from '../blocks';
import { READING_LINE } from './useReadingSession';

declare const __E2E__: boolean;

const SENTENCE_HIGHLIGHT = 'driftless-sentence';
const WORD_HIGHLIGHT = 'driftless-word';
/** Keep the spoken sentence between these viewport fractions, else scroll. */
const FOLLOW_BAND = { top: 0.15, bottom: 0.7 } as const;
const MANUAL_SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

export interface ReadAloudState {
  status: NarratorState;
  index: number;
  total: number;
  /** False after the user scrolls away manually; "Follow" re-enables it. */
  following: boolean;
  /** No voices at all (rare: e.g. some Linux setups). */
  unavailable: boolean;
}

interface Options {
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  shadowRoot: () => ShadowRoot | null;
  getBlocks(): ReadingBlock[];
  getCurrentBlock(): number;
  lang: string | null;
  rate: number;
  voiceURI: string | null;
}

function createPort(): SpeechPort {
  return typeof __E2E__ !== 'undefined' && __E2E__
    ? createFakeSpeechPort()
    : createSpeechSynthesisPort();
}

function setHighlight(name: string, range: Range | null) {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  if (range) CSS.highlights.set(name, new Highlight(range));
  else CSS.highlights.delete(name);
}

/**
 * Read Aloud: speaks the article sentence by sentence, highlights the
 * sentence and current word, and keeps the spoken text on screen.
 */
export function useReadAloud(options: Options) {
  const [state, setState] = useState<ReadAloudState>({
    status: 'idle',
    index: 0,
    total: 0,
    following: true,
    unavailable: false,
  });
  const narratorRef = useRef<Narrator | null>(null);
  const dataRef = useRef<{ sentences: Sentence[]; maps: TextMap[] } | null>(null);
  const followingRef = useRef(true);
  const optionsRef = useRef(options);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    optionsRef.current = options;
  });

  const scrollSentenceIntoView = useCallback((index: number, force = false) => {
    const data = dataRef.current;
    const scroller = optionsRef.current.scrollRef.current;
    const sentence = data?.sentences[index];
    if (!data || !scroller || !sentence) return;
    const range = rangeFor(data.maps[sentence.block]!, sentence.start, sentence.end);
    const rect = range?.getBoundingClientRect();
    if (!rect) return;
    const box = scroller.getBoundingClientRect();
    const top = (rect.top - box.top) / scroller.clientHeight;
    const bottom = (rect.bottom - box.top) / scroller.clientHeight;
    if (!force && top >= FOLLOW_BAND.top && bottom <= FOLLOW_BAND.bottom) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      top: scroller.scrollTop + rect.top - box.top - scroller.clientHeight * READING_LINE + 4,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, []);

  /** Lazily builds the sentence list from the indexed reading blocks. */
  const createNarrator = useCallback(async (): Promise<Narrator | null> => {
    const { getBlocks, lang, rate, voiceURI } = optionsRef.current;
    // Right after opening (e.g. via the Read Aloud shortcut) the reading
    // session may still be indexing paragraphs; give it a moment.
    const blocks = await waitForBlocks(getBlocks);
    const maps = blocks.map((b) => buildTextMap(b.el));
    const sentences = buildSentences(maps, lang);
    if (sentences.length === 0) return null;
    dataRef.current = { sentences, maps };

    const isE2E = typeof __E2E__ !== 'undefined' && __E2E__;
    voicesRef.current = isE2E ? [] : await getVoices();
    if (!isE2E && voicesRef.current.length === 0) {
      setState((s) => ({ ...s, unavailable: true }));
      return null;
    }

    const narrator = new Narrator(createPort(), {
      sentences,
      rate,
      lang: lang ?? undefined,
      voice: pickVoice(voicesRef.current, lang, voiceURI),
      onSentence: (index) => {
        const sentence = sentences[index]!;
        setHighlight(
          SENTENCE_HIGHLIGHT,
          rangeFor(maps[sentence.block]!, sentence.start, sentence.end),
        );
        setHighlight(WORD_HIGHLIGHT, null);
        setState((s) => ({ ...s, index }));
        if (followingRef.current) scrollSentenceIntoView(index);
      },
      onWord: (index, charIndex, charLength) => {
        const sentence = sentences[index]!;
        const start = sentence.start + charIndex;
        const end = charLength
          ? start + charLength
          : sentence.start + wordEnd(sentence.text, charIndex);
        setHighlight(WORD_HIGHLIGHT, rangeFor(maps[sentence.block]!, start, end));
      },
      onState: (status, index) => {
        if (status === 'idle' || status === 'ended') setHighlight(WORD_HIGHLIGHT, null);
        if (status === 'idle') setHighlight(SENTENCE_HIGHLIGHT, null);
        setState((s) => ({ ...s, status, index }));
      },
    });
    narratorRef.current = narrator;
    setState((s) => ({ ...s, total: sentences.length }));
    return narrator;
  }, [scrollSentenceIntoView]);

  const creatingRef = useRef<Promise<Narrator | null> | null>(null);
  const ensureNarrator = useCallback((): Promise<Narrator | null> => {
    if (narratorRef.current) return Promise.resolve(narratorRef.current);
    // Two quick presses must not create two narrators (two voices at once).
    creatingRef.current ??= createNarrator().finally(() => {
      creatingRef.current = null;
    });
    return creatingRef.current;
  }, [createNarrator]);

  /** First sentence of the block currently under the reading line. */
  const sentenceAtReadingLine = useCallback(() => {
    const data = dataRef.current;
    if (!data) return 0;
    const block = Math.max(0, optionsRef.current.getCurrentBlock());
    const found = data.sentences.findIndex((s) => s.block >= block);
    return found < 0 ? 0 : found;
  }, []);

  const start = useCallback(async () => {
    const narrator = await ensureNarrator();
    if (!narrator) return;
    followingRef.current = true;
    setState((s) => ({ ...s, following: true }));
    if (narrator.state === 'idle' || narrator.state === 'ended') {
      narrator.play(sentenceAtReadingLine());
    } else {
      narrator.toggle();
    }
  }, [ensureNarrator, sentenceAtReadingLine]);

  const toggle = useCallback(() => {
    if (!narratorRef.current || narratorRef.current.state === 'idle') void start();
    else narratorRef.current.toggle();
  }, [start]);

  const stop = useCallback(() => narratorRef.current?.stop(), []);
  const next = useCallback(() => narratorRef.current?.next(), []);
  const prev = useCallback(() => narratorRef.current?.prev(), []);
  const follow = useCallback(() => {
    followingRef.current = true;
    setState((s) => ({ ...s, following: true }));
    if (narratorRef.current) scrollSentenceIntoView(narratorRef.current.index, true);
  }, [scrollSentenceIntoView]);

  // Rate / voice changes apply from the next sentence.
  useEffect(() => {
    narratorRef.current?.setRate(options.rate);
  }, [options.rate]);
  useEffect(() => {
    narratorRef.current?.setVoice(pickVoice(voicesRef.current, options.lang, options.voiceURI));
  }, [options.voiceURI, options.lang]);

  // While active: manual scrolling pauses auto-follow; clicking text jumps there.
  const active = state.status === 'playing' || state.status === 'paused';
  useEffect(() => {
    if (!active) return;
    const content = options.contentRef.current;
    const stopFollowing = () => {
      if (!followingRef.current) return;
      followingRef.current = false;
      setState((s) => ({ ...s, following: false }));
    };
    const onKey = (event: KeyboardEvent) => {
      if (MANUAL_SCROLL_KEYS.has(event.key)) stopFollowing();
    };
    const onClick = (event: MouseEvent) => {
      const data = dataRef.current;
      const narrator = narratorRef.current;
      if (!data || !narrator || !content) return;
      if ((event.target as Element).closest('a')) return; // links still work
      const offset = clickOffset(event, optionsRef.current.shadowRoot());
      const blocks = optionsRef.current.getBlocks();
      const blockIndex = blocks.findIndex((b) => b.el.contains(event.target as Node));
      if (blockIndex < 0) return;
      const map = data.maps[blockIndex]!;
      const global = offset ? globalOffset(map, offset.node, offset.offset) : null;
      let target = data.sentences.findIndex(
        (s) => s.block === blockIndex && (global === null || global < s.end),
      );
      if (target < 0) target = data.sentences.findIndex((s) => s.block === blockIndex);
      if (target < 0) return;
      followingRef.current = true;
      setState((s) => ({ ...s, following: true }));
      narrator.play(target);
    };
    document.addEventListener('wheel', stopFollowing, { capture: true, passive: true });
    document.addEventListener('touchmove', stopFollowing, { capture: true, passive: true });
    document.addEventListener('keydown', onKey, true);
    content?.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('wheel', stopFollowing, { capture: true });
      document.removeEventListener('touchmove', stopFollowing, { capture: true });
      document.removeEventListener('keydown', onKey, true);
      content?.removeEventListener('click', onClick);
    };
  }, [active, options.contentRef]);

  // Stop speaking when Focus View closes.
  useEffect(
    () => () => {
      narratorRef.current?.stop();
      setHighlight(SENTENCE_HIGHLIGHT, null);
      setHighlight(WORD_HIGHLIGHT, null);
    },
    [],
  );

  return { state, start, toggle, stop, next, prev, follow };
}

async function waitForBlocks(getBlocks: () => ReadingBlock[], timeoutMs = 2000) {
  const start = performance.now();
  let blocks = getBlocks();
  while (blocks.length === 0 && performance.now() - start < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    blocks = getBlocks();
  }
  return blocks;
}

/** Text position under the pointer, piercing our shadow root. */
function clickOffset(event: MouseEvent, root: ShadowRoot | null) {
  const doc = document as Document & {
    caretPositionFromPoint?(
      x: number,
      y: number,
      options?: { shadowRoots?: ShadowRoot[] },
    ): CaretPosition | null;
  };
  const pos = doc.caretPositionFromPoint?.(
    event.clientX,
    event.clientY,
    root ? { shadowRoots: [root] } : undefined,
  );
  return pos && pos.offsetNode.nodeType === Node.TEXT_NODE
    ? { node: pos.offsetNode as Text, offset: pos.offset }
    : null;
}

function globalOffset(map: TextMap, node: Text, offset: number): number | null {
  const entry = map.nodes.find((n) => n.node === node);
  return entry ? entry.start + offset : null;
}
