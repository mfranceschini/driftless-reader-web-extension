import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Minimal typing for the extension APIs used inside serviceWorker.evaluate().
declare const chrome: {
  tabs: { query(q: { url: string }): Promise<{ id?: number }[]> };
  scripting: {
    executeScript(o: { target: { tabId: number }; files: string[] }): Promise<unknown>;
  };
};

const extensionPath = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));

/**
 * Fixtures that launch Chromium with the (E2E) extension build loaded.
 * Build first: `E2E=1 pnpm build:chrome` (done by `pnpm test:e2e`).
 */
export const test = base.extend<{ context: BrowserContext; serviceWorker: Worker }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      // Optional: use an already-installed Chromium instead of Playwright's
      // own download (e.g. when the local browser build doesn't match).
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers();
    await use(existing ?? (await context.waitForEvent('serviceworker')));
  },
});

/** Same as clicking the toolbar button: inject/toggle the reader in the page's tab. */
export async function toggleReader(serviceWorker: Worker, url: string): Promise<void> {
  await serviceWorker.evaluate(async (pageUrl) => {
    const [tab] = await chrome.tabs.query({ url: pageUrl });
    if (!tab?.id) throw new Error(`No tab for ${pageUrl}`);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/reader.js'],
    });
  }, url);
}

export const expect = test.expect;
