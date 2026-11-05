import { COMMANDS, isReaderCommand, type CommandId } from '@/src/lib/commands';
import { MESSAGES, type ExtensionMessage } from '@/src/lib/messages';
import { ALLOWED_FONT_FILES } from '@/src/content/fonts';

function isExtensionPage(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith(browser.runtime.getURL('/'));
}

function isTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const fontCache = new Map<string, Promise<string>>();

/** Reads a bundled font and returns it base64-encoded (messages are JSON). */
function readFontBase64(file: string): Promise<string> {
  let cached = fontCache.get(file);
  if (!cached) {
    cached = fetch(browser.runtime.getURL(`/${file}` as '/'))
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      });
    cached.catch(() => fontCache.delete(file));
    fontCache.set(file, cached);
  }
  return cached;
}

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

  browser.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    const message = raw as ExtensionMessage | undefined;
    // Only our own extension can message us (no externally_connectable), but
    // content scripts run inside web pages, so treat them as less trusted:
    // they may only ask for fonts or the options page. Opening the reader in
    // a tab / running commands is limited to our own pages (the popup).
    if (sender.id !== browser.runtime.id) return undefined;
    const fromExtensionPage = isExtensionPage(sender.url);

    const run = (task: Promise<void>) => {
      task
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
      return true; // keep the channel open for the async response
    };
    switch (message?.type) {
      case MESSAGES.toggleReader:
        if (!fromExtensionPage || !isTabId(message.tabId)) return undefined;
        return run(toggleReader(message.tabId));
      case MESSAGES.runCommand:
        if (!fromExtensionPage || !isTabId(message.tabId)) return undefined;
        if (!Object.values(COMMANDS).includes(message.command)) return undefined;
        return run(runCommand(message.command, message.tabId));
      case MESSAGES.openOptions:
        return run(browser.runtime.openOptionsPage());
      case MESSAGES.getFont:
        if (typeof message.file !== 'string' || !ALLOWED_FONT_FILES.has(message.file)) {
          sendResponse({ ok: false });
          return undefined;
        }
        void readFontBase64(message.file).then(
          (data) => sendResponse({ ok: true, data }),
          () => sendResponse({ ok: false }),
        );
        return true;
      default:
        return undefined;
    }
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    // First install: a short welcome page (skipped in automated test builds).
    if (reason === 'install' && !isE2E) {
      void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
    }
    // Privacy migration: older versions stored reading positions keyed by
    // full page URLs with a text snippet. Positions are now stored hashed.
    if (reason === 'update') void browser.storage.local.remove('positions');
  });
});
