/** Lists voices, waiting for them to load (they arrive asynchronously in Chromium). */
export function getVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      window.clearTimeout(timer);
      resolve(speechSynthesis.getVoices());
    };
    const timer = window.setTimeout(done, timeoutMs);
    speechSynthesis.addEventListener('voiceschanged', done);
  });
}

function baseLang(lang: string | null | undefined): string {
  return (lang ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
}

/** Higher is better: same language, then "Natural"/online voices (Edge's best), then default. */
function score(voice: Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'default'>, lang: string) {
  let s = 0;
  if (baseLang(voice.lang) === lang) s += 100;
  if (/natural/i.test(voice.name)) s += 20;
  if (/online|neural|google/i.test(voice.name)) s += 10;
  if (voice.default) s += 5;
  return s;
}

/**
 * Picks the voice to use: the saved one if still available, otherwise the
 * best match for the article's language.
 */
export function pickVoice<
  V extends Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'default' | 'voiceURI'>,
>(
  voices: readonly V[],
  articleLang: string | null | undefined,
  preferredURI: string | null,
): V | null {
  if (preferredURI) {
    const saved = voices.find((v) => v.voiceURI === preferredURI);
    if (saved) return saved;
  }
  const lang = baseLang(articleLang) || baseLang(navigator.language) || 'en';
  return [...voices].sort((a, b) => score(b, lang) - score(a, lang))[0] ?? null;
}

/** Voices for the article's language first, then the rest, each alphabetically. */
export function sortVoicesForLang<V extends Pick<SpeechSynthesisVoice, 'lang' | 'name'>>(
  voices: readonly V[],
  articleLang: string | null | undefined,
): V[] {
  const lang = baseLang(articleLang) || baseLang(navigator.language);
  return [...voices].sort((a, b) => {
    const am = baseLang(a.lang) === lang ? 0 : 1;
    const bm = baseLang(b.lang) === lang ? 0 : 1;
    return am - bm || a.name.localeCompare(b.name);
  });
}
