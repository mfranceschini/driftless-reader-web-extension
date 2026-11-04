import { useEffect, useState } from 'react';
import type { FocusBandLines } from '@/src/lib/settings';
import { loadSettings, saveSettings } from '@/src/lib/settings-store';
import { FocusBand, pageLineHeightAt } from './FocusBand';

interface PageFocusBandProps {
  onClose(): void;
}

const LINE_OPTIONS: FocusBandLines[] = [1, 3, 5];

/**
 * Focus band on the original page, for pages Focus View can't extract
 * (web apps, forums, docs). Follows the mouse and adapts to the site's
 * line height. The page stays fully clickable.
 */
export function PageFocusBand({ onClose }: PageFocusBandProps) {
  const [lines, setLines] = useState<FocusBandLines>(3);

  useEffect(() => {
    void loadSettings().then((s) => setLines(s.focusBandLines));
  }, []);

  const choose = (value: FocusBandLines) => {
    setLines(value);
    void loadSettings().then((s) => saveSettings({ ...s, focusBandLines: value }));
  };

  return (
    <>
      <FocusBand
        mode="pointer"
        lines={lines}
        lineHeightAt={pageLineHeightAt}
        className="page-band"
      />
      <div className="pill page-band-bar" role="group" aria-label="Focus band">
        <span>Focus band</span>
        <span className="pill-seg" role="group" aria-label="Band height">
          {LINE_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={lines === value}
              aria-label={`${value} line${value > 1 ? 's' : ''}`}
              onClick={() => choose(value)}
            >
              {value}
            </button>
          ))}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Turn off focus band"
          title="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </>
  );
}
