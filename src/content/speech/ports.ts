import type { SpeakRequest, SpeechPort } from './narrator';

/** The real Web Speech API. */
export function createSpeechSynthesisPort(): SpeechPort {
  // Keep a reference: Chrome can garbage-collect a playing utterance and
  // silently drop its events.
  let current: SpeechSynthesisUtterance | null = null;
  return {
    speak(request: SpeakRequest) {
      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.rate = request.rate;
      if (request.voice) utterance.voice = request.voice;
      if (request.lang) utterance.lang = request.voice?.lang ?? request.lang;
      utterance.onboundary = (event) => {
        if (event.name === 'word' || event.name === undefined) {
          request.onBoundary(event.charIndex, event.charLength || undefined);
        }
      };
      utterance.onend = () => request.onEnd();
      utterance.onerror = (event) => {
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        request.onError(event.error);
      };
      current = utterance;
      speechSynthesis.speak(utterance);
    },
    cancel() {
      if (current) {
        // Detach handlers so a cancelled utterance can't report late events.
        current.onboundary = current.onend = current.onerror = null;
        current = null;
      }
      speechSynthesis.cancel();
    },
  };
}

/**
 * Deterministic fake for end-to-end tests (headless Chromium has no voices).
 * Only included in E2E builds.
 */
/** Marker the release-build check looks for: must never appear in store builds. */
export const FAKE_SPEECH_MARKER = 'driftless:e2e-fake-speech';

export function createFakeSpeechPort(msPerWord = 60): SpeechPort {
  console.debug(FAKE_SPEECH_MARKER);
  let timers: number[] = [];
  const clear = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };
  return {
    speak(request) {
      clear();
      const step = msPerWord / request.rate;
      const words = [...request.text.matchAll(/\S+/g)];
      words.forEach((match, i) => {
        timers.push(
          window.setTimeout(() => request.onBoundary(match.index, match[0].length), i * step),
        );
      });
      timers.push(window.setTimeout(() => request.onEnd(), words.length * step + 10));
    },
    cancel: clear,
  };
}
