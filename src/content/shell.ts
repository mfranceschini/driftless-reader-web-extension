/**
 * The reader's on-page container. Everything Driftless Reader draws on a page
 * lives inside one Shadow DOM host so page CSS can't break our UI (and our
 * CSS can't leak into the page).
 *
 * Phase 0: only a status pill, to prove injection, isolation and toggling work.
 */

export interface ReaderShell {
  root: ShadowRoot;
  destroy(): void;
}

export interface ShellOptions {
  isArticle: boolean;
}

const HOST_ID = 'driftless-reader-host';

const STYLES = `
  :host { all: initial; }
  .pill {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 999px;
    font: 500 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #f8fafc;
    background: #1e293b;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; }
  .dot.warn { background: #fbbf24; }
  button {
    all: unset;
    cursor: pointer;
    margin-left: 4px;
    padding: 2px 6px;
    border-radius: 6px;
    color: #cbd5e1;
  }
  button:hover, button:focus-visible { background: rgb(255 255 255 / 0.12); color: #fff; }
`;

export function mountReaderShell({ isArticle }: ShellOptions): ReaderShell {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;

  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.setAttribute('role', 'status');

  const dot = document.createElement('span');
  dot.className = isArticle ? 'dot' : 'dot warn';

  const label = document.createElement('span');
  label.textContent = isArticle
    ? 'Driftless Reader is on · article detected'
    : 'Driftless Reader is on · no article found (focus tools still work)';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Turn off Driftless Reader');

  pill.append(dot, label, close);
  root.append(style, pill);
  document.documentElement.append(host);

  const shell: ReaderShell = {
    root,
    destroy() {
      host.remove();
      if (window.__driftlessReader === shell) window.__driftlessReader = undefined;
    },
  };

  close.addEventListener('click', () => shell.destroy());
  return shell;
}
