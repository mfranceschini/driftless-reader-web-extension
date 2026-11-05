/**
 * The reader's on-page container. Everything Driftless Reader draws on a page
 * lives inside one Shadow DOM host so page CSS can't break our UI (and our
 * CSS can't leak into the page).
 */
import { createRoot } from 'react-dom/client';
import type { Article } from './extract';
import { Root } from './ui/Root';
import styles from './ui/reader.css?raw';
import { SHADOW_MODE } from './security';

export interface ReaderShell {
  destroy(): void;
}

export const HOST_ID = 'driftless-reader-host';

export function mountReaderShell(initialArticle: Article | null): ReaderShell {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: SHADOW_MODE });

  const style = document.createElement('style');
  style.textContent = styles;
  const mountPoint = document.createElement('div');
  shadow.append(style, mountPoint);
  document.documentElement.append(host);

  const previousFocus = document.activeElement as HTMLElement | null;
  const root = createRoot(mountPoint);

  const shell: ReaderShell = {
    destroy() {
      root.unmount();
      host.remove();
      previousFocus?.focus?.({ preventScroll: true });
      if (window.__driftlessReader === shell) window.__driftlessReader = undefined;
    },
  };

  root.render(<Root initialArticle={initialArticle} onClose={() => shell.destroy()} />);
  return shell;
}
