import { useEffect, useState } from 'react';
import { ensureFont, FONT_STACKS } from '@/src/content/fonts';
import { useReaderSettings } from '@/src/content/ui/useReaderSettings';
import type { DriftSensitivity, FontFamily } from '@/src/lib/settings';

const FONTS: { value: FontFamily; label: string }[] = [
  { value: 'lexend', label: 'Lexend' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'arial', label: 'Arial' },
  { value: 'serif', label: 'Serif' },
];

const SENSITIVITY: { value: DriftSensitivity; label: string; hint: string }[] = [
  { value: 'gentle', label: 'Gentle', hint: 'Only after long breaks (1 min away)' },
  { value: 'balanced', label: 'Balanced', hint: 'After ~20 s away or fast skimming' },
  { value: 'eager', label: 'Eager', hint: 'Catches short drifts too (8 s)' },
];

/** The real, currently assigned shortcut ('' if none, e.g. a clash). */
function useToggleShortcut(): string {
  const [combo, setCombo] = useState('');
  useEffect(() => {
    void browser.commands.getAll().then((all) => {
      setCombo(all.find((c) => c.name === 'toggle-reader')?.shortcut ?? '');
    });
  }, []);
  return combo;
}

export function WelcomeApp() {
  const [settings, update] = useReaderSettings();
  const shortcut = useToggleShortcut();

  useEffect(() => {
    for (const font of FONTS) void ensureFont(font.value);
  }, []);

  async function done() {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
    else window.close();
  }

  return (
    <div className="page-wrap welcome">
      <header className="hero">
        <img src="/icon/128.png" alt="" width="96" height="96" />
        <h1>Welcome to Driftless Reader</h1>
        <p>Stay with the text. Three quick steps, then you&apos;re reading.</p>
      </header>

      <ol className="steps">
        <li className="opt-card">
          <span className="step-num" aria-hidden="true">
            1
          </span>
          <div>
            <h2>Pin it to your toolbar</h2>
            <p className="muted">
              Click the <strong>Extensions</strong> icon (the puzzle piece) next to the address bar,
              then the <strong>pin</strong> next to Driftless Reader.
            </p>
          </div>
        </li>

        <li className="opt-card">
          <span className="step-num" aria-hidden="true">
            2
          </span>
          <div>
            <h2>Open any article and start</h2>
            <p className="muted">
              Click the Driftless Reader icon
              {shortcut ? (
                <>
                  , or press{' '}
                  {shortcut.split('+').map((key, i) => (
                    <span key={key + i}>
                      {i > 0 && ' + '}
                      <kbd>{key}</kbd>
                    </span>
                  ))}
                </>
              ) : (
                <> (you can also add a keyboard shortcut in All settings)</>
              )}
              . It only runs on pages where you start it.
            </p>
          </div>
        </li>

        <li className="opt-card">
          <span className="step-num" aria-hidden="true">
            3
          </span>
          <div className="choices">
            <h2>Pick a starting point</h2>
            <p className="muted">You can change these any time from the Aa button.</p>

            <p className="choice-label" id="font-label">
              Font
            </p>
            <div className="choice-row" role="group" aria-labelledby="font-label">
              {FONTS.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  className="choice"
                  aria-pressed={settings.fontFamily === font.value}
                  style={{ fontFamily: FONT_STACKS[font.value] }}
                  onClick={() => update({ ...settings, fontFamily: font.value })}
                >
                  <span className="choice-sample">Aa</span>
                  {font.label}
                </button>
              ))}
            </div>

            <p className="choice-label" id="drift-label">
              Drift Guard — when should we help you get back on track?
            </p>
            <div className="choice-row" role="group" aria-labelledby="drift-label">
              {SENSITIVITY.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="choice wide"
                  aria-pressed={settings.driftSensitivity === option.value}
                  onClick={() =>
                    update({ ...settings, driftGuard: true, driftSensitivity: option.value })
                  }
                >
                  <strong>{option.label}</strong>
                  <span className="muted">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </li>
      </ol>

      <div className="row-actions finish">
        <button type="button" className="opt-btn primary" onClick={() => void done()}>
          Done — start reading
        </button>
        <button
          type="button"
          className="opt-btn"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          All settings
        </button>
      </div>
    </div>
  );
}
