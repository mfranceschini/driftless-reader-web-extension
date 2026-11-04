import { isProbablyReaderable } from '@mozilla/readability';
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
      window.__driftlessReader = undefined;
      return;
    }

    window.__driftlessReader = mountReaderShell({
      isArticle: isProbablyReaderable(document),
    });
  },
});
