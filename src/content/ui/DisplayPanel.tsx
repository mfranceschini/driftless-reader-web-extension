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
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
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
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onSelect(value: T): void;
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
          >
            {option.label}
          </button>
        ))}
      </span>
    </div>
  );
}

export function DisplayPanel({ settings, onChange }: DisplayPanelProps) {
  const set = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) =>
    onChange({ ...settings, [key]: value });

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
      />

      <Stepper
        label="Text size"
        value={`${settings.fontSize}px`}
        onDown={() => onChange(stepSetting(settings, 'fontSize', -1))}
        onUp={() => onChange(stepSetting(settings, 'fontSize', 1))}
        atMin={settings.fontSize <= LIMITS.fontSize.min}
        atMax={settings.fontSize >= LIMITS.fontSize.max}
      />

      <Stepper
        label="Line spacing"
        value={settings.lineHeight.toFixed(1)}
        onDown={() => onChange(stepSetting(settings, 'lineHeight', -1))}
        onUp={() => onChange(stepSetting(settings, 'lineHeight', 1))}
        atMin={settings.lineHeight <= LIMITS.lineHeight.min}
        atMax={settings.lineHeight >= LIMITS.lineHeight.max}
      />

      <Stepper
        label="Paragraph gap"
        value={settings.paragraphSpacing.toFixed(1)}
        onDown={() => onChange(stepSetting(settings, 'paragraphSpacing', -1))}
        onUp={() => onChange(stepSetting(settings, 'paragraphSpacing', 1))}
        atMin={settings.paragraphSpacing <= LIMITS.paragraphSpacing.min}
        atMax={settings.paragraphSpacing >= LIMITS.paragraphSpacing.max}
      />

      <Segmented
        label="Line width"
        options={WIDTHS}
        value={settings.lineWidth}
        onSelect={(v) => set('lineWidth', v)}
      />

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
