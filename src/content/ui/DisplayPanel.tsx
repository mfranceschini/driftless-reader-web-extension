import { useEffect, useState, type CSSProperties } from 'react';
import { ensureFont, FONT_STACKS } from '../fonts';
import {
  type DriftSensitivity,
  LIMITS,
  stepSetting,
  type FontFamily,
  type LineWidth,
  type ReaderSettings,
  type Theme,
} from '@/src/lib/settings';

interface DisplayPanelProps {
  settings: ReaderSettings;
  onChange(next: ReaderSettings): void;
}

const THEMES: { value: Theme; label: string; text?: string }[] = [
  { value: 'auto', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Dark' },
];

const FONTS: { value: FontFamily; label: string }[] = [
  { value: 'lexend', label: 'Lexend' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'arial', label: 'Arial' },
  { value: 'serif', label: 'Serif' },
];

const SENSITIVITY: { value: DriftSensitivity; label: string }[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'eager', label: 'Eager' },
];

const WIDTHS: { value: LineWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'medium', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
];

function Stepper({
  label,
  value,
  onDown,
  onUp,
  atMin,
  atMax,
}: {
  label: string;
  value: string;
  onDown(): void;
  onUp(): void;
  atMin: boolean;
  atMax: boolean;
}) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="stepper">
        <button
          type="button"
          className="icon-btn"
          onClick={onDown}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="value" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={onUp}
          disabled={atMax}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </span>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onSelect,
  optionStyle,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onSelect(value: T): void;
  optionStyle?(value: T): CSSProperties;
}) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onSelect(option.value)}
            style={optionStyle?.(option.value)}
          >
            {option.label}
          </button>
        ))}
      </span>
    </div>
  );
}

export function DisplayPanel({ settings, onChange }: DisplayPanelProps) {
  const [moreOpen, setMoreOpen] = useState(settings.letterSpacing > 0 || settings.wordSpacing > 0);
  const set = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const stepper = (key: keyof typeof LIMITS, label: string, format: (n: number) => string) => (
    <Stepper
      label={label}
      value={format(settings[key])}
      onDown={() => onChange(stepSetting(settings, key, -1))}
      onUp={() => onChange(stepSetting(settings, key, 1))}
      atMin={settings[key] <= LIMITS[key].min}
      atMax={settings[key] >= LIMITS[key].max}
    />
  );

  // Preview each font option in its own typeface.
  useEffect(() => {
    for (const font of FONTS) void ensureFont(font.value);
  }, []);

  return (
    <div id="driftless-display-panel" className="panel" role="group" aria-label="Display settings">
      <div className="row">
        <span className="row-label">Theme</span>
        <span className="swatches" role="group" aria-label="Theme">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              className={`swatch ${theme.value}`}
              aria-pressed={settings.theme === theme.value}
              aria-label={theme.label}
              title={theme.label}
              onClick={() => set('theme', theme.value)}
            />
          ))}
        </span>
      </div>

      <Segmented
        label="Font"
        options={FONTS}
        value={settings.fontFamily}
        onSelect={(v) => set('fontFamily', v)}
        optionStyle={(v) => ({ fontFamily: FONT_STACKS[v] })}
      />

      {stepper('fontSize', 'Text size', (n) => `${n}px`)}
      {stepper('lineHeight', 'Line spacing', (n) => n.toFixed(1))}
      {stepper('paragraphSpacing', 'Paragraph gap', (n) => n.toFixed(1))}

      <Segmented
        label="Line width"
        options={WIDTHS}
        value={settings.lineWidth}
        onSelect={(v) => set('lineWidth', v)}
      />

      <button
        type="button"
        className="disclosure"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        <span aria-hidden="true">{moreOpen ? '▾' : '▸'}</span> More text options
      </button>
      {moreOpen && (
        <>
          {stepper('letterSpacing', 'Letter spacing', (n) => (n === 0 ? '0' : `+${n.toFixed(2)}`))}
          {stepper('wordSpacing', 'Word spacing', (n) => (n === 0 ? '0' : `+${n.toFixed(2)}`))}
        </>
      )}

      <p className="panel-section">Drift Guard</p>
      <div className="row">
        <span className="row-label" id="driftless-drift-label">
          Welcome-back &amp; skim nudges
        </span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={settings.driftGuard}
          aria-labelledby="driftless-drift-label"
          onClick={() => set('driftGuard', !settings.driftGuard)}
        />
      </div>
      {settings.driftGuard && (
        <Segmented
          label="Sensitivity"
          options={SENSITIVITY}
          value={settings.driftSensitivity}
          onSelect={(v) => set('driftSensitivity', v)}
        />
      )}
    </div>
  );
}
