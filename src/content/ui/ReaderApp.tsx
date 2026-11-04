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
import {
  DEFAULT_SETTINGS,
  LINE_WIDTH_CH,
  stepSetting,
  type ReaderSettings,
} from '@/src/lib/settings';
import { loadSettings, saveSettings, watchSettings } from '@/src/lib/settings-store';
import { pageKey } from '@/src/lib/page-key';
import { ProgressBar } from './ProgressBar';
import { AnchorButton, ResumeCard } from './AnchorControls';
import { useReadingSession, type SessionObserver } from './useReadingSession';
import { useDriftGuard } from './useDriftGuard';
import { DriftCard } from './DriftCard';
import { Player } from './Player';
import { useReadAloud } from './useReadAloud';
import { useChunkMode } from './useChunkMode';
import { FocusBand } from './FocusBand';
import { ChunkNav } from './ChunkNav';
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
  });
  const { card: driftCard, dismiss: dismissDrift, setPassive } = drift;

  const chunks = useChunkMode({
    enabled: settings.chunkMode,
    contentRef,
    getBlocks: session.getBlocks,
    scrollToBlockAt: session.scrollToBlockAt,
  });

  // One observer feeds every feature that cares about the current block.
  const onDriftBlock = drift.onCurrentBlock;
  const onChunkBlock = chunks.onCurrentBlock;
  useEffect(() => {
    observerRef.current = {
      onCurrentBlock(info, now) {
        onDriftBlock(info, now);
        onChunkBlock(info.index);
      },
    };
  }, [onDriftBlock, onChunkBlock]);

  const refocusArticle = () => containerRef.current?.focus({ preventScroll: true });

  // Focus band (reading-line mode): arrow keys move the text exactly one line.
  const lineHeightPx = settings.fontSize * settings.lineHeight;
  useEffect(() => {
    if (!settings.focusBand || settings.focusBandMode !== 'line') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.composedPath()[0];
      if (target instanceof Element && target.closest('select, input, textarea')) return;
      event.preventDefault();
      containerRef.current?.scrollBy({
        top: event.key === 'ArrowDown' ? lineHeightPx : -lineHeightPx,
      });
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [settings.focusBand, settings.focusBandMode, lineHeightPx]);

  const readAloud = useReadAloud({
    scrollRef: containerRef,
    contentRef,
    shadowRoot: () => (containerRef.current?.getRootNode() as ShadowRoot | undefined) ?? null,
    getBlocks: session.getBlocks,
    getCurrentBlock: session.getCurrentBlock,
    lang: article.lang,
    rate: settings.readAloudRate,
    voiceURI: settings.readAloudVoice,
  });
  const playerOpen = readAloud.state.status !== 'idle';

  // Listening counts as reading: Drift Guard stays quiet while the voice plays.
  useEffect(() => {
    setPassive(readAloud.state.status === 'playing');
  }, [readAloud.state.status, setPassive]);

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
      className={`reader theme-${settings.theme}${playerOpen ? ' with-player' : ''}${settings.chunkMode ? ' chunk-mode' : ''}`}
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
          type="button"
          className="icon-btn"
          aria-label="Focus band"
          aria-pressed={settings.focusBand}
          title="Focus band: dim all but a few lines"
          onClick={() => {
            updateSettings({ ...settings, focusBand: !settings.focusBand });
            refocusArticle(); // so arrow keys move the text, not this button
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 5h16M4 19h16" opacity="0.35" />
            <rect x="2.5" y="9" width="19" height="6" rx="2" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Chunk mode"
          aria-pressed={settings.chunkMode}
          title="Chunk mode: one piece at a time (Space for next)"
          onClick={() => {
            updateSettings({ ...settings, chunkMode: !settings.chunkMode });
            refocusArticle(); // so Space goes to the next chunk instead of re-pressing this button
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3.5" y="3.5" width="17" height="7" rx="2" />
            <path d="M5 15h14M5 19h10" opacity="0.35" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={playerOpen ? 'Pause or resume Read Aloud' : 'Read aloud'}
          aria-pressed={readAloud.state.status === 'playing'}
          title="Read aloud"
          onClick={() => (playerOpen ? readAloud.toggle() : void readAloud.start())}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
          </svg>
        </button>
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
        {panelOpen && (
          <DisplayPanel settings={settings} onChange={updateSettings} lang={article.lang} />
        )}
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
      {readAloud.state.unavailable && (
        <div className="card" role="alert">
          <p className="card-title">No voices available</p>
          <p className="card-body">
            Your system has no text-to-speech voices installed. In Edge, voices come from Windows or
            macOS speech settings.
          </p>
        </div>
      )}

      {playerOpen && (
        <Player
          state={readAloud.state}
          rate={settings.readAloudRate}
          onToggle={readAloud.toggle}
          onPrev={readAloud.prev}
          onNext={readAloud.next}
          onFollow={readAloud.follow}
          onSlower={() => updateSettings(stepSetting(settings, 'readAloudRate', -1))}
          onFaster={() => updateSettings(stepSetting(settings, 'readAloudRate', 1))}
          onClose={readAloud.stop}
        />
      )}
      {settings.focusBand && (
        <FocusBand
          mode={settings.focusBandMode}
          lines={settings.focusBandLines}
          lineHeightAt={() => lineHeightPx}
          scrollRef={containerRef}
        />
      )}

      {settings.chunkMode && (
        <ChunkNav
          index={chunks.chunk.index}
          total={chunks.chunk.total}
          onPrev={chunks.prev}
          onNext={chunks.next}
        />
      )}
    </div>
  );
}
