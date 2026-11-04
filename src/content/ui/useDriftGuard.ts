import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { DriftDetector, type DriftEvent } from '@/src/lib/drift-detector';
import type { DriftSensitivity } from '@/src/lib/settings';
import type { AnchorRecap, SessionObserver } from './useReadingSession';

export type DriftCardState =
  | { kind: 'returned'; reason: 'away' | 'idle'; awayMs: number; recap: AnchorRecap }
  | { kind: 'skimming'; recap: AnchorRecap };

interface UseDriftGuardOptions {
  enabled: boolean;
  sensitivity: DriftSensitivity;
  scrollRef: RefObject<HTMLElement | null>;
  getRecap(): AnchorRecap | null;
  /** True while another card (e.g. resume) is showing. */
  suppressed: boolean;
}

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const TICK_MS = 1000;
/** Scrolling this share of a screen while a card is open dismisses it. */
const DISMISS_SCROLL_SHARE = 0.75;

function isPresent(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Wires the DriftDetector to the page: visibility, focus, input and scroll.
 * Returns the card to show (if any) plus the observer that useReadingSession
 * feeds with current-block changes.
 */
export function useDriftGuard({
  enabled,
  sensitivity,
  scrollRef,
  getRecap,
  suppressed,
}: UseDriftGuardOptions) {
  const [card, setCard] = useState<DriftCardState | null>(null);
  const detectorRef = useRef<DriftDetector | null>(null);
  const suppressedRef = useRef(suppressed);
  const getRecapRef = useRef(getRecap);

  useEffect(() => {
    suppressedRef.current = suppressed;
    getRecapRef.current = getRecap;
  }, [suppressed, getRecap]);

  useEffect(() => {
    detectorRef.current?.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    if (!enabled) return;
    const scroller = scrollRef.current;

    const onDrift = (event: DriftEvent) => {
      if (suppressedRef.current) return;
      const recap = getRecapRef.current();
      if (!recap) return; // nothing read yet, nothing to return to
      setCard((current) => {
        if (event.type === 'returned') {
          return { kind: 'returned', reason: event.reason, awayMs: event.awayMs, recap };
        }
        // A welcome-back card is more important than a skim nudge.
        return current?.kind === 'returned' ? current : { kind: 'skimming', recap };
      });
    };

    const detector = new DriftDetector({ sensitivity, onDrift }, performance.now());
    detectorRef.current = detector;
    if (!isPresent()) detector.setPresent(false, performance.now());

    // Presence comes from events (more reliable than polling hasFocus()):
    // leaving = tab hidden or window blurred; returning = visible and focused.
    const onPresence = () => detector.setPresent(isPresent(), performance.now());
    const onBlur = () => detector.setPresent(false, performance.now());
    const onFocus = () =>
      detector.setPresent(document.visibilityState === 'visible', performance.now());
    let lastActivity = 0;
    const onActivity = () => {
      const now = performance.now();
      if (now - lastActivity < 200) return; // throttle pointermove
      lastActivity = now;
      detector.activity(now);
    };

    document.addEventListener('visibilitychange', onPresence);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    for (const type of ACTIVITY_EVENTS) {
      document.addEventListener(type, onActivity, { capture: true, passive: true });
    }
    scroller?.addEventListener('scroll', onActivity, { passive: true });
    const interval = window.setInterval(() => detector.tick(performance.now()), TICK_MS);

    return () => {
      document.removeEventListener('visibilitychange', onPresence);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      for (const type of ACTIVITY_EVENTS) {
        document.removeEventListener(type, onActivity, { capture: true });
      }
      scroller?.removeEventListener('scroll', onActivity);
      window.clearInterval(interval);
      detectorRef.current = null;
    };
    // sensitivity changes are applied by the effect above without resetting state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scrollRef]);

  // Scrolling well away from where a welcome-back card appeared means you've
  // moved on. (Skim nudges stay until answered: you are scrolling by definition.)
  useEffect(() => {
    const scroller = scrollRef.current;
    if (card?.kind !== 'returned' || !scroller) return;
    const start = scroller.scrollTop;
    const onScroll = () => {
      if (Math.abs(scroller.scrollTop - start) > scroller.clientHeight * DISMISS_SCROLL_SHARE) {
        setCard(null);
      }
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [card, scrollRef]);

  const dismiss = useCallback(() => setCard(null), []);
  const muteSkimming = useCallback(() => {
    detectorRef.current?.muteSkimming();
    setCard(null);
  }, []);
  const setPassive = useCallback((passive: boolean) => {
    detectorRef.current?.setPassive(passive, performance.now());
  }, []);

  /** Feed from useReadingSession whenever the block under the reading line changes. */
  const onCurrentBlock = useCallback<NonNullable<SessionObserver['onCurrentBlock']>>(
    (info, now) => {
      const detector = detectorRef.current;
      if (!detector) return;
      detector.setCurrentBlockExpectedMs(info.expectedMs);
      detector.scrolledTo(info.index, info.position, info.beyondAnchor, info.wpm, now);
    },
    [],
  );

  return { card: enabled ? card : null, dismiss, muteSkimming, setPassive, onCurrentBlock };
}
