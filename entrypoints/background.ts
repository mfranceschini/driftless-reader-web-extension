import { COMMANDS, isReaderCommand, type CommandId } from '@/src/lib/commands';
import { MESSAGES, type ExtensionMessage } from '@/src/lib/messages';

declare const __E2E__: boolean;
const isE2E = typeof __E2E__ !== 'undefined' && __E2E__;

/**
 * Injects (or toggles) the reader content script in the given tab.
 * Relies on the `activeTab` grant that Edge/Chrome give us when the user
 * opens the popup or presses a keyboard shortcut — no host permissions.
 */
async function toggleReader(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/reader.js'],
  });
}

/**
 * Runs a keyboard command. Reader commands (Read Aloud, focus band, chunk
 * mode) open the reader first if needed, then act on it.
 */
export async function runCommand(command: CommandId, tabId: number): Promise<void> {
  if (!isReaderCommand(command)) {
    await toggleReader(tabId);
    return;
  }
  // These small functions run in the content script's isolated world.
  const [{ result: open } = { result: false }] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => Boolean((window as { __driftlessReader?: unknown }).__driftlessReader),
  });
  if (open) {
    await browser.scripting.executeScript({
      target: { tabId },
      args: [command],
      func: (cmd: string) => {
        const bus = (window as { __driftlessBus?: EventTarget }).__driftlessBus;
        bus?.dispatchEvent(new CustomEvent('command', { detail: cmd }));
      },
    });
    return;
  }
  await browser.scripting.executeScript({
    target: { tabId },
    args: [command],
    func: (cmd: string) => {
      (window as { __driftlessPending?: string }).__driftlessPending = cmd;
    },
  });
  await toggleReader(tabId);
}

export default defineBackground(() => {
  // Browser shortcuts can't be pressed from automated tests; test builds
  // expose the same function the shortcuts call.
  if (isE2E) {
    (globalThis as { __driftlessRunCommand?: typeof runCommand }).__driftlessRunCommand =
      runCommand;
  }

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (tab?.id === undefined || !Object.values(COMMANDS).includes(command as CommandId)) return;
    await runCommand(command as CommandId, tab.id);
  });

  browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    const run = (task: Promise<void>) => {
      task
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
      return true; // keep the channel open for the async response
    };
    switch (message?.type) {
      case MESSAGES.toggleReader:
        return run(toggleReader(message.tabId));
      case MESSAGES.runCommand:
        return run(runCommand(message.command, message.tabId));
      case MESSAGES.openOptions:
        return run(browser.runtime.openOptionsPage());
      default:
        return undefined;
    }
  });

  // First install: a short welcome page (skipped in automated test builds).
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install' && !isE2E) {
      void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
    }
  });
});
