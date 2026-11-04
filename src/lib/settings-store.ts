import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, normalizeSettings, type ReaderSettings } from './settings';

const settingsItem = storage.defineItem<ReaderSettings>('local:readerSettings', {
  fallback: DEFAULT_SETTINGS,
});

export async function loadSettings(): Promise<ReaderSettings> {
  return normalizeSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: ReaderSettings): Promise<void> {
  await settingsItem.setValue(normalizeSettings(settings));
}

/** Calls `onChange` whenever settings change (e.g. from the popup). Returns an unsubscribe fn. */
export function watchSettings(onChange: (settings: ReaderSettings) => void): () => void {
  return settingsItem.watch((value) => onChange(normalizeSettings(value)));
}
