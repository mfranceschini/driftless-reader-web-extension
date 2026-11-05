import readerCss from '@/src/content/ui/reader.css?raw';

let injected = false;

/**
 * Lets extension pages reuse the reader's controls (the same DisplayPanel)
 * by adding the reader stylesheet to the page once.
 */
export function useReaderStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.driftless = 'reader';
  style.textContent = readerCss;
  document.head.append(style);
}
