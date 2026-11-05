import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FocusBandLines, FocusBandMode } from '@/src/lib/settings';
import { READING_LINE } from './useReadingSession';
import { isTrustedEvent } from '../security';

interface FocusBandProps {
  mode: FocusBandMode;
  lines: FocusBandLines;
  /** Line height in px at a given screen Y (lets on-page mode adapt to the site). */
  lineHeightAt(y: number): number;
  /** In 'line' mode, the scroller whose reading line the band sits on. */
  scrollRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Dims everything except a horizontal band a few lines tall. Two fixed
 * panels (above and below) with pointer-events: none, so the page stays
 * fully interactive.
 */
export function FocusBand({ mode, lines, lineHeightAt, scrollRef, className }: FocusBandProps) {
  const [center, setCenter] = useState(() => window.innerHeight * READING_LINE);
  const [lineHeight, setLineHeight] = useState(() =>
    lineHeightAt(window.innerHeight * READING_LINE),
  );
  const lineHeightAtRef = useRef(lineHeightAt);

  useEffect(() => {
    lineHeightAtRef.current = lineHeightAt;
  });

  useEffect(() => {
    if (mode === 'line') {
      const update = () => {
        const scroller = scrollRef?.current;
        const box = scroller?.getBoundingClientRect();
        const y = box
          ? box.top + scroller!.clientHeight * READING_LINE
          : window.innerHeight * READING_LINE;
        setCenter(y);
        setLineHeight(lineHeightAtRef.current(y));
      };
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    let frame = 0;
    let lastY = center;
    const onMove = (event: PointerEvent) => {
      if (!isTrustedEvent(event)) return;
      lastY = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCenter(lastY);
        setLineHeight(lineHeightAtRef.current(lastY));
      });
    };
    document.addEventListener('pointermove', onMove, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scrollRef]);

  const height = lines * lineHeight + 8;
  const top = Math.max(0, center - height / 2);
  return (
    <div className={`focus-band ${className ?? ''}`} aria-hidden="true">
      <div className="focus-band-dim" style={{ top: 0, height: top }} />
      <div className="focus-band-edge" style={{ top, height }} />
      <div className="focus-band-dim" style={{ top: top + height, bottom: 0 }} />
    </div>
  );
}

/** Line height of the text under a screen point (for pages we don't control). */
export function pageLineHeightAt(y: number): number {
  const el = document.elementFromPoint(window.innerWidth / 2, y);
  if (!el) return 28;
  const style = getComputedStyle(el);
  const parsed = parseFloat(style.lineHeight);
  const value = Number.isFinite(parsed) ? parsed : parseFloat(style.fontSize) * 1.2;
  return Math.min(64, Math.max(16, value || 28));
}
