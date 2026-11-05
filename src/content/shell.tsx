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
  /** Stop counting as "the open reader" (closing animation started). */
  release(): void;
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

  let destroyed = false;
  const shell: ReaderShell = {
    release() {
      // A shortcut pressed during the fade-out must open a new reader,
      // not "close" the one already on its way out.
      if (window.__driftlessReader === shell) window.__driftlessReader = undefined;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      shell.release();
      root.unmount();
      host.remove();
      // Don't steal focus from a reader that was reopened meanwhile.
      if (!window.__driftlessReader) previousFocus?.focus?.({ preventScroll: true });
    },
  };

  root.render(
    <Root
      initialArticle={initialArticle}
      onCloseStart={() => shell.release()}
      onClose={() => shell.destroy()}
    />,
  );
  return shell;
}
