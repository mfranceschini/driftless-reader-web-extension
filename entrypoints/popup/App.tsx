import { useEffect, useState } from 'react';
import { MESSAGES, type ActivateMessage, type ActivateResponse } from '@/src/lib/messages';

type Status = 'idle' | 'working' | 'error';

function useToggleShortcut(): string[] {
  const [keys, setKeys] = useState<string[]>([]);
  useEffect(() => {
    void browser.commands.getAll().then((all) => {
      const combo = all.find((c) => c.name === 'toggle-reader')?.shortcut;
      setKeys(combo ? combo.split('+') : []);
    });
  }, []);
  return keys;
}

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>();
  const shortcut = useToggleShortcut();

  async function handleToggle() {
    setStatus('working');
    setError(undefined);
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) {
      setStatus('error');
      setError('No active tab found.');
      return;
    }

    const message: ActivateMessage = { type: MESSAGES.toggleReader, tabId: tab.id };
    const response = (await browser.runtime.sendMessage(message)) as ActivateResponse;
    if (response.ok) {
      window.close();
    } else {
      setStatus('error');
      setError("This page can't be read (browser pages and the extension store are protected).");
    }
  }

  return (
    <main className="popup">
      <header className="brand">
        <img src="/icon/48.png" alt="" width="40" height="40" />
        <h1>Driftless Reader</h1>
        <p className="tagline">Stay with the text.</p>
      </header>

      <button
        type="button"
        className="primary"
        onClick={handleToggle}
        disabled={status === 'working'}
      >
        {status === 'working' ? 'Starting…' : 'Start / stop on this page'}
      </button>

      <p className="hint">
        {shortcut.length > 0 ? (
          <>
            Shortcut:{' '}
            {shortcut.map((key, i) => (
              <span key={key + i}>
                {i > 0 && ' + '}
                <kbd>{key}</kbd>
              </span>
            ))}
          </>
        ) : (
          'No shortcut set — add one in Settings.'
        )}
      </p>

      <button
        type="button"
        className="link"
        onClick={() => {
          void browser.runtime.openOptionsPage();
          window.close();
        }}
      >
        Settings, shortcuts &amp; data
      </button>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
