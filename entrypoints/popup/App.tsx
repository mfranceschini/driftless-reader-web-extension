import { useState } from 'react';
import { MESSAGES, type ActivateMessage, type ActivateResponse } from '@/src/lib/messages';

type Status = 'idle' | 'working' | 'error';

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>();

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
        Shortcut: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
