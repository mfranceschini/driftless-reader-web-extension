import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AnchorTracker } from '@/src/lib/anchor-tracker';
import { buildBlockStats, progressAt } from '@/src/lib/progress';
import {
  clearPosition,
  loadPosition,
  loadReadingSpeed,
  savePosition,
  saveReadingSpeed,
} from '@/src/lib/positions-store';
import { blockAtLine, indexBlocks, resolveSavedAnchor, type ReadingBlock } from '../blocks';

/** The reading line sits a bit above the middle of the screen, where eyes rest. */
export const READING_LINE = 0.35;
const TICK_MS = 250;
const SAVE_THROTTLE_MS = 1500;
export const ANCHOR_CLASS = 'dl-anchor';
const FLASH_CLASS = 'dl-flash';

export interface ReadingSessionState {
  percent: number;
  wordsRemaining: number;
  wpm: number;
  /** Anchor block index (-1 = none yet). */
  anchor: number;
  /** Where the anchor is relative to the screen, if it is off-screen. */
  anchorOffscreen: 'above' | 'below' | null;
  /** Saved position found on open that the user hasn't accepted or dismissed yet. */
  resumeOffer: { percent: number } | null;
}

const INITIAL: ReadingSessionState = {
  percent: 0,
  wordsRemaining: 0,
  wpm: 0,
  anchor: -1,
  anchorOffscreen: null,
  resumeOffer: null,
};

/** Information about the block under the reading line, for Drift Guard. */
export interface CurrentBlockInfo {
  index: number;
  /** Words before this block. */
  position: number;
  /** Blocks between the anchor and here (negative = before the anchor). */
  beyondAnchor: number;
  wpm: number;
  /** Expected time to read this block at the learned speed. */
  expectedMs: number;
}

export interface SessionObserver {
  onCurrentBlock?(info: CurrentBlockInfo, now: number): void;
}

/** What to show in a "welcome back" recap. */
export interface AnchorRecap {
  anchor: number;
  /** Full text of the anchor block. */
  text: string;
  /** Nearest heading at or before the anchor, if any. */
  section: string | null;
}

interface Session {
  blocks: ReadingBlock[];
  tracker: AnchorTracker;
  stats: ReturnType<typeof buildBlockStats>;
}

/**
 * Tracks reading position in Focus View: progress, time left, the anchor
 * (last paragraph actually read), learned speed and per-page resume.
 */
export function useReadingSession(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  pageKey: string,
  ready: boolean,
  observerRef?: RefObject<SessionObserver | null>,
) {
  const [state, setState] = useState<ReadingSessionState>(INITIAL);
  const sessionRef = useRef<Session | null>(null);

  const markAnchor = useCallback((index: number) => {
    const session = sessionRef.current;
    if (!session) return;
    for (const block of session.blocks) block.el.classList.remove(ANCHOR_CLASS);
    session.blocks[index]?.el.classList.add(ANCHOR_CLASS);
  }, []);

  const scrollToBlock = useCallback(
    (index: number) => {
      const scroller = scrollRef.current;
      const block = sessionRef.current?.blocks[index];
      if (!scroller || !block) return;
      const top =
        block.el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        scroller.clientHeight * READING_LINE +
        8;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
      block.el.classList.remove(FLASH_CLASS);
      void block.el.offsetWidth; // restart the animation
      block.el.classList.add(FLASH_CLASS);
    },
    [scrollRef],
  );

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!ready || !scroller || !content) return;

    let disposed = false;
    let frame = 0;
    let interval = 0;
    let lastSave = 0;
    let saveTimer = 0;
    let lastReported = -2;

    const blocks = indexBlocks(content);
    const stats = buildBlockStats(blocks.map((b) => b.words));

    function persist(session: Session, force = false) {
      const { anchor } = session.tracker.snapshot;
      const block = session.blocks[anchor];
      if (!block) return;
      const write = () => {
        lastSave = Date.now();
        const { percent } = progressAt(session.stats, anchor + 1);
        void savePosition(pageKey, {
          anchor,
          fingerprint: block.fingerprint,
          totalBlocks: session.blocks.length,
          percent,
          updatedAt: lastSave,
        });
      };
      window.clearTimeout(saveTimer);
      if (force || Date.now() - lastSave > SAVE_THROTTLE_MS) write();
      else saveTimer = window.setTimeout(write, SAVE_THROTTLE_MS);
    }

    function measure() {
      frame = 0;
      const session = sessionRef.current;
      if (!session || !scroller) return;
      const viewport = scroller.getBoundingClientRect();
      const lineY = viewport.top + scroller.clientHeight * READING_LINE;
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;

      let current = blockAtLine(session.blocks, lineY);
      let fraction = 0;
      if (atBottom) {
        current = session.blocks.length - 1;
        fraction = 1;
      } else if (current >= 0) {
        const rect = session.blocks[current]!.el.getBoundingClientRect();
        fraction = rect.height > 0 ? (lineY - rect.top) / rect.height : 0;
      }
      const now = performance.now();
      session.tracker.setCurrent(current, now);
      if (current !== lastReported && current >= 0) {
        lastReported = current;
        const snap = session.tracker.snapshot;
        const words = session.stats.words[current] ?? 0;
        observerRef?.current?.onCurrentBlock?.(
          {
            index: current,
            position: session.stats.before[current] ?? 0,
            // Before anything is read there's no anchor to drift from.
            beyondAnchor: snap.anchor < 0 ? 0 : current - snap.anchor,
            wpm: snap.wpm,
            expectedMs: (words / Math.max(1, snap.wpm)) * 60_000,
          },
          now,
        );
      }

      const progress = atBottom
        ? { percent: 100, wordsRemaining: 0 }
        : progressAt(session.stats, Math.max(0, current), fraction);
      const { anchor, wpm } = session.tracker.snapshot;

      let anchorOffscreen: ReadingSessionState['anchorOffscreen'] = null;
      const anchorEl = session.blocks[anchor]?.el;
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        if (rect.bottom < viewport.top + 48) anchorOffscreen = 'above';
        else if (rect.top > viewport.bottom) anchorOffscreen = 'below';
      }

      setState((prev) => ({ ...prev, ...progress, wpm, anchor, anchorOffscreen }));
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    (async () => {
      const [wpm, saved] = await Promise.all([loadReadingSpeed(), loadPosition(pageKey)]);
      if (disposed) return;

      const savedAnchor = saved ? resolveSavedAnchor(blocks, saved.anchor, saved.fingerprint) : -1;
      const tracker = new AnchorTracker({
        words: stats.words,
        wpm,
        initialAnchor: savedAnchor,
        onAnchor: (index) => {
          markAnchor(index);
          persist(session, index === blocks.length - 1);
          schedule();
        },
        onSpeed: (next) => void saveReadingSpeed(next),
      });
      const session: Session = { blocks, tracker, stats };
      sessionRef.current = session;
      markAnchor(savedAnchor);

      // Offer to resume unless you were at the very start or had finished.
      const offer =
        savedAnchor > 0 && savedAnchor < blocks.length - 1 && saved
          ? { percent: progressAt(stats, savedAnchor + 1).percent }
          : null;
      setState((prev) => ({ ...prev, resumeOffer: offer }));

      scroller.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      interval = window.setInterval(() => {
        const active = document.visibilityState === 'visible' && document.hasFocus();
        tracker.tick(performance.now(), active);
      }, TICK_MS);
      measure();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      const session = sessionRef.current;
      if (session) {
        window.clearTimeout(saveTimer);
        persist(session, true);
      }
      sessionRef.current = null;
    };
  }, [ready, pageKey, scrollRef, contentRef, markAnchor, observerRef]);

  const getRecap = useCallback((): AnchorRecap | null => {
    const session = sessionRef.current;
    if (!session) return null;
    const { anchor } = session.tracker.snapshot;
    const block = session.blocks[anchor];
    if (!block) return null;
    let section: string | null = null;
    for (let i = anchor; i >= 0; i -= 1) {
      const el = session.blocks[i]!.el;
      if (/^H[1-6]$/.test(el.tagName)) {
        section = el.textContent?.trim() || null;
        break;
      }
    }
    return { anchor, text: block.el.textContent ?? '', section };
  }, []);

  const jumpToAnchor = useCallback(() => {
    const anchor = sessionRef.current?.tracker.snapshot.anchor ?? -1;
    if (anchor >= 0) scrollToBlock(anchor);
  }, [scrollToBlock]);

  const acceptResume = useCallback(() => {
    setState((prev) => ({ ...prev, resumeOffer: null }));
    jumpToAnchor();
  }, [jumpToAnchor]);

  const startOver = useCallback(() => {
    const session = sessionRef.current;
    session?.tracker.setAnchor(-1);
    markAnchor(-1);
    void clearPosition(pageKey);
    setState((prev) => ({ ...prev, anchor: -1, anchorOffscreen: null, resumeOffer: null }));
    scrollRef.current?.scrollTo({ top: 0 });
  }, [markAnchor, pageKey, scrollRef]);

  const dismissResume = useCallback(() => {
    setState((prev) => ({ ...prev, resumeOffer: null }));
  }, []);

  return { state, jumpToAnchor, acceptResume, startOver, dismissResume, getRecap };
}
