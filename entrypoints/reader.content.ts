import { isProbablyReaderable } from '@mozilla/readability';
import { extractArticle } from '@/src/content/extract';
import { mountReaderShell, type ReaderShell } from '@/src/content/shell';

declare global {
  interface Window {
    __driftlessReader?: ReaderShell;
  }
}

/**
 * Injected on demand by the background script (registration: 'runtime'),
 * so it never runs on a page unless the user asks for it.
 * Each injection toggles the reader on/off.
 */
/** Hostile or unusual pages must never crash the reader before it opens. */
function safeIsReaderable(): boolean {
  try {
    return isProbablyReaderable(document);
  } catch {
    return false;
  }
}

export default defineContentScript({
  registration: 'runtime',
  matches: [],
  main() {
    const existing = window.__driftlessReader;
    if (existing) {
      existing.destroy();
      return;
    }

    const article = safeIsReaderable() ? extractArticle(document) : null;
    window.__driftlessReader = mountReaderShell(article);
  },
});
