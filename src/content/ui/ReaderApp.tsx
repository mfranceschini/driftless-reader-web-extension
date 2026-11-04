import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { Article } from '@/src/content/extract';
import { formatTimeLeft } from '@/src/lib/reading-time';
import { DEFAULT_SETTINGS, LINE_WIDTH_CH, type ReaderSettings } from '@/src/lib/settings';
import { loadSettings, saveSettings, watchSettings } from '@/src/lib/settings-store';
import { pageKey } from '@/src/lib/page-key';
import { ProgressBar } from './ProgressBar';
import { AnchorButton, ResumeCard } from './AnchorControls';
import { useReadingSession, type SessionObserver } from './useReadingSession';
import { useDriftGuard } from './useDriftGuard';
import { DriftCard } from './DriftCard';
import { DisplayPanel } from './DisplayPanel';
import { ensureFont, FONT_STACKS } from '../fonts';

export interface ReaderAppProps {
  article: Article;
  onClose(): void;
}

/** Keeps settings in sync with storage (so popup changes apply live). */
function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    loadSettings().then((loaded) => active && setSettings(loaded));
    const unwatch = watchSettings(setSettings);
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  const update = useCallback((next: ReaderSettings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  return [settings, update] as const;
}

export function ReaderApp({ article, onClose }: ReaderAppProps) {
  const [settings, updateSettings] = useReaderSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const displayButtonRef = useRef<HTMLButtonElement>(null);

  // Article HTML is sanitized in extract.ts and set once, outside React's
  // render cycle, so later phases (highlighting, anchors) can annotate it.
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.innerHTML = article.html;
  }, [article.html]);

  // Load the chosen bundled font (Arial is shown until it's ready).
  useEffect(() => {
    void ensureFont(settings.fontFamily);
  }, [settings.fontFamily]);

  // Move keyboard focus into the reader so Space / arrows scroll the article.
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const style = {
    '--font': FONT_STACKS[settings.fontFamily],
    '--font-size': `${settings.fontSize}px`,
    '--line-height': settings.lineHeight,
    '--measure': LINE_WIDTH_CH[settings.lineWidth],
    '--para-space': `${settings.paragraphSpacing}em`,
    '--letter-space': `${settings.letterSpacing}em`,
    '--word-space': `${settings.wordSpacing}em`,
  } as CSSProperties;

  const [key] = useState(() => pageKey(location.href));
  const observerRef = useRef<SessionObserver | null>(null);
  const session = useReadingSession(containerRef, contentRef, key, true, observerRef);
  const { state } = session;
  const drift = useDriftGuard({
    enabled: settings.driftGuard,
    sensitivity: settings.driftSensitivity,
    scrollRef: containerRef,
    getRecap: session.getRecap,
    suppressed: state.resumeOffer !== null,
    observerRef,
  });
  const { card: driftCard, dismiss: dismissDrift } = drift;

  // Esc closes a card or the panel first, then the reader. Listen at the document level
  // (capture) so it works even if focus was lost, e.g. after the panel closes.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (driftCard) {
        dismissDrift();
      } else if (panelOpen) {
        setPanelOpen(false);
        displayButtonRef.current?.focus({ preventScroll: true });
      } else {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [panelOpen, onClose, driftCard, dismissDrift]);
  const timeLeft =
    state.wpm > 0
      ? formatTimeLeft(state.wordsRemaining, state.wpm)
      : formatTimeLeft(article.wordCount).replace('left', 'read');
  const meta = [article.siteName, state.wpm > 0 ? `${state.percent}%` : null, timeLeft]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      ref={containerRef}
      className={`reader theme-${settings.theme}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={`Focus View: ${article.title}`}
      tabIndex={-1}
    >
      <div className="topbar">
        <span className="meta" aria-live="off">
          {meta}
        </span>
        <button
          ref={displayButtonRef}
          type="button"
          className="icon-btn"
          aria-expanded={panelOpen}
          aria-controls="driftless-display-panel"
          aria-label="Display settings"
          title="Display settings"
          onClick={() => setPanelOpen((open) => !open)}
        >
          Aa
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close Focus View (Esc)"
          title="Close (Esc)"
          onClick={onClose}
        >
          ✕
        </button>
        {panelOpen && <DisplayPanel settings={settings} onChange={updateSettings} />}
        <ProgressBar percent={state.percent} />
      </div>

      {state.resumeOffer && (
        <ResumeCard
          percent={state.resumeOffer.percent}
          onContinue={session.acceptResume}
          onStartOver={session.startOver}
          onDismiss={session.dismissResume}
        />
      )}

      <article className="page" lang={article.lang ?? undefined} dir={article.dir ?? undefined}>
        <h1 className="title">{article.title}</h1>
        {article.byline && <p className="byline">{article.byline}</p>}
        <div ref={contentRef} className="content" />
      </article>

      {driftCard && (
        <DriftCard
          card={driftCard}
          onRewind={() => {
            dismissDrift();
            session.jumpToAnchor();
          }}
          onDismiss={dismissDrift}
          onMuteSkimming={drift.muteSkimming}
        />
      )}

      {!state.resumeOffer && !driftCard && state.anchorOffscreen && (
        <AnchorButton direction={state.anchorOffscreen} onClick={session.jumpToAnchor} />
      )}
    </div>
  );
}
