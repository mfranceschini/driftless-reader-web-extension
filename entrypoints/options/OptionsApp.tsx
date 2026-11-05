import { useCallback, useEffect, useState } from 'react';
import { DisplayPanel } from '@/src/content/ui/DisplayPanel';
import { useReaderSettings } from '@/src/content/ui/useReaderSettings';
import { ensureFont } from '@/src/content/fonts';
import { getVoices, pickVoice } from '@/src/content/speech/voices';
import { COMMAND_LABELS, shortcutsPageUrl, type CommandId } from '@/src/lib/commands';
import { DEFAULT_SETTINGS } from '@/src/lib/settings';
import {
  clearAllPositions,
  countPositions,
  loadReadingSpeed,
  resetReadingSpeed,
} from '@/src/lib/positions-store';
import { ConfirmButton } from '@/src/pages/ConfirmButton';
import { Preview } from '@/src/pages/Preview';
import { useReaderStyles } from '@/src/pages/ReaderStyles';

const REPO = 'https://github.com/mfranceschini/driftless-reader-web-extension';

const IN_READER_KEYS: [string, string][] = [
  ['Esc', 'Close a card, then the panel, then the reader'],
  ['Space / Shift + Space', 'Next / previous piece (Chunk mode)'],
  ['↑ / ↓', 'Move the text one line (Focus band on the reading line)'],
  ['Click a sentence', 'Read aloud from there (while Read Aloud is on)'],
];

interface Shortcut {
  name: CommandId;
  description: string;
  shortcut: string;
}

function useShortcuts(): Shortcut[] {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  useEffect(() => {
    const load = () =>
      void browser.commands.getAll().then((all) =>
        setShortcuts(
          all
            .filter(
              (c): c is typeof c & { name: CommandId } => !!c.name && c.name in COMMAND_LABELS,
            )
            .map((c) => ({
              name: c.name,
              description: COMMAND_LABELS[c.name],
              shortcut: c.shortcut ?? '',
            })),
        ),
      );
    load();
    // Pick up changes made on the browser's shortcuts page.
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);
  return shortcuts;
}

function Keys({ combo }: { combo: string }) {
  if (!combo) return <span className="muted">Not set</span>;
  return (
    <>
      {combo.split('+').map((key, i) => (
        <span key={key + i}>
          {i > 0 && ' + '}
          <kbd>{key}</kbd>
        </span>
      ))}
    </>
  );
}

export function OptionsApp() {
  useReaderStyles();
  const [settings, updateSettings] = useReaderSettings();
  const shortcuts = useShortcuts();
  const [saved, setSaved] = useState({ positions: 0, wpm: 0 });
  const [notice, setNotice] = useState('');

  const refreshData = useCallback(async () => {
    const [positions, wpm] = await Promise.all([countPositions(), loadReadingSpeed()]);
    setSaved({ positions, wpm });
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([countPositions(), loadReadingSpeed()]).then(([positions, wpm]) => {
      if (active) setSaved({ positions, wpm });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void ensureFont(settings.fontFamily);
  }, [settings.fontFamily]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  async function testVoice() {
    const voices = await getVoices();
    const utterance = new SpeechSynthesisUtterance(
      'Hi! This is how Driftless Reader will read articles to you.',
    );
    utterance.voice = pickVoice(voices, navigator.language, settings.readAloudVoice);
    utterance.rate = settings.readAloudRate;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  const version = browser.runtime.getManifest().version;

  return (
    <div className="page-wrap">
      <header className="page-header">
        <img src="/icon/96.png" alt="" width="56" height="56" />
        <div>
          <h1>Driftless Reader settings</h1>
          <p>Changes save automatically and apply to open articles right away.</p>
        </div>
      </header>

      <div className="options-grid">
        <section className="opt-card embedded-panel" aria-labelledby="reading-heading">
          <h2 id="reading-heading">Reading</h2>
          <p className="lead">The same controls as the Aa panel in Focus View.</p>
          <div className={`theme-auto${settings.glass ? ' glass-on' : ''}`}>
            <DisplayPanel settings={settings} onChange={updateSettings} />
          </div>
          <div className="row-actions voice-test">
            <button type="button" className="opt-btn" onClick={() => void testVoice()}>
              ▶ Test voice
            </button>
            <span className="muted">Uses the voice and speed selected above.</span>
          </div>
        </section>

        <aside className="preview-column">
          <div className="opt-card preview-card">
            <Preview settings={settings} />
          </div>
        </aside>
      </div>

      <div className="stack below">
        <section className="opt-card" aria-labelledby="keys-heading">
          <h2 id="keys-heading">Keyboard shortcuts</h2>
          <p className="lead">
            These work on any page. You can change them in your browser&apos;s shortcuts settings.
          </p>
          <table className="keys">
            <tbody>
              {shortcuts.map((s) => (
                <tr key={s.name}>
                  <td>{s.description}</td>
                  <td>
                    <Keys combo={s.shortcut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="opt-btn"
              onClick={() => void browser.tabs.create({ url: shortcutsPageUrl() })}
            >
              Change shortcuts
            </button>
          </div>

          <h3 className="subhead">Inside the reader</h3>
          <table className="keys">
            <tbody>
              {IN_READER_KEYS.map(([keys, what]) => (
                <tr key={keys}>
                  <td>{what}</td>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="opt-card" aria-labelledby="data-heading">
          <h2 id="data-heading">Your data</h2>
          <p className="lead">
            Everything stays in this browser. Nothing is sent anywhere — there are no accounts,
            servers or analytics.
          </p>
          <ul className="data-list">
            <li>
              <span>
                <strong>{saved.positions}</strong> saved reading position
                {saved.positions === 1 ? '' : 's'}
              </span>
              <ConfirmButton
                label="Forget positions"
                confirmLabel="Click again to forget"
                onConfirm={async () => {
                  await clearAllPositions();
                  await refreshData();
                  flash('Reading positions forgotten.');
                }}
              />
            </li>
            <li>
              <span>
                Learned reading speed: <strong>{saved.wpm}</strong> words per minute
              </span>
              <ConfirmButton
                label="Reset speed"
                confirmLabel="Click again to reset"
                onConfirm={async () => {
                  await resetReadingSpeed();
                  await refreshData();
                  flash('Reading speed reset.');
                }}
              />
            </li>
            <li>
              <span>All settings on this page</span>
              <ConfirmButton
                label="Reset settings"
                confirmLabel="Click again to reset"
                onConfirm={() => {
                  updateSettings(DEFAULT_SETTINGS);
                  flash('Settings reset to defaults.');
                }}
              />
            </li>
          </ul>
          <p className="notice" role="status" aria-live="polite">
            {notice}
          </p>
        </section>

        <section className="opt-card" aria-labelledby="about-heading">
          <h2 id="about-heading">About</h2>
          <p className="lead">
            Driftless Reader {version} · free and open source (MIT). Fonts: Lexend and Atkinson
            Hyperlegible Next (SIL Open Font License).
          </p>
          <div className="row-actions">
            <a href={REPO} target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              Report a problem
            </a>
            <a href={browser.runtime.getURL('/welcome.html')}>Welcome guide</a>
          </div>
        </section>
      </div>
    </div>
  );
}
