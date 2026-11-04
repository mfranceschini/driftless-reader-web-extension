import { MESSAGES, type ActivateMessage } from '@/src/lib/messages';

/**
 * Injects (or toggles) the reader content script in the given tab.
 * Relies on the `activeTab` grant that Edge/Chrome give us when the user
 * opens the popup or presses the keyboard shortcut — no host permissions.
 */
async function toggleReader(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/reader.js'],
  });
}

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'toggle-reader' || tab?.id === undefined) return;
    await toggleReader(tab.id);
  });

  browser.runtime.onMessage.addListener((message: ActivateMessage, _sender, sendResponse) => {
    if (message?.type !== MESSAGES.toggleReader) return;
    toggleReader(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true; // keep the channel open for the async response
  });
});
