import { isReaderCommand, type ReaderCommand } from '@/src/lib/commands';

/**
 * Delivers keyboard commands from the background to the open reader.
 *
 * Lives on `window` in the extension's isolated world, which the page's own
 * scripts can't see — so a website can't trigger our commands by
 * dispatching DOM events.
 */
declare global {
  interface Window {
    __driftlessBus?: EventTarget;
    /** A command sent while the reader was opening, handled once it mounts. */
    __driftlessPending?: ReaderCommand;
  }
}

const EVENT = 'command';

export function commandBus(): EventTarget {
  window.__driftlessBus ??= new EventTarget();
  return window.__driftlessBus;
}

/** Subscribes to commands; also delivers a pending one immediately. Returns unsubscribe. */
export function onReaderCommand(handler: (command: ReaderCommand) => void): () => void {
  const pending = window.__driftlessPending;
  if (isReaderCommand(pending)) {
    window.__driftlessPending = undefined;
    queueMicrotask(() => handler(pending));
  }
  const listener = (event: Event) => {
    const command = (event as CustomEvent<unknown>).detail;
    if (isReaderCommand(command)) handler(command); // ignore anything unexpected
  };
  commandBus().addEventListener(EVENT, listener);
  return () => commandBus().removeEventListener(EVENT, listener);
}

export function sendReaderCommand(command: ReaderCommand): void {
  commandBus().dispatchEvent(new CustomEvent(EVENT, { detail: command }));
}
