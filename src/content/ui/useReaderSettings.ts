import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type ReaderSettings } from '@/src/lib/settings';
import { loadSettings, saveSettings, watchSettings } from '@/src/lib/settings-store';

/** Keeps settings in sync with storage (changes from the panel, popup or options page apply live everywhere). */
export function useReaderSettings() {
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
