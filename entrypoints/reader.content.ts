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
export default defineContentScript({
  registration: 'runtime',
  matches: [],
  main() {
    const existing = window.__driftlessReader;
    if (existing) {
      existing.destroy();
      return;
    }

    const article = isProbablyReaderable(document) ? extractArticle(document) : null;
    window.__driftlessReader = mountReaderShell(article);
  },
});
