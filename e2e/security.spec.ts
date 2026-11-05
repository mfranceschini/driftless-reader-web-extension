import type { Page, Worker } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

declare const chrome: {
  tabs: { query(q: { url: string }): Promise<{ id?: number }[]> };
  storage: { local: { get(k: string): Promise<Record<string, unknown>> } };
  scripting: {
    executeScript(o: {
      target: { tabId: number };
      func: (...args: never[]) => unknown;
      args?: unknown[];
    }): Promise<{ result: unknown }[]>;
  };
};

async function open(page: Page, sw: Worker) {
  await page.goto('/article.html');
  await page.bringToFront();
  await toggleReader(sw, page.url());
  await expect(page.locator(host).locator('.reader')).toBeVisible();
}

test.describe('Security: the page is untrusted', () => {
  test('page scripts cannot close the reader with fake key events', async ({
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker);
    await page.evaluate(() => {
      for (const type of ['keydown', 'keyup']) {
        document.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', bubbles: true }));
      }
    });
    await page.waitForTimeout(200);
    await expect(page.locator(host).locator('.reader')).toBeVisible();
    // A real key press still works.
    await page.keyboard.press('Escape');
    await expect(page.locator(host)).toHaveCount(0);
  });

  test('websites cannot detect the extension through its files', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto('/article.html');
    const id = new URL(serviceWorker.url()).host;
    const reachable = await page.evaluate(async (extId) => {
      try {
        const r = await fetch(`chrome-extension://${extId}/fonts/lexend-latin-wght-normal.woff2`);
        return r.ok;
      } catch {
        return false;
      }
    }, id);
    expect(reachable).toBe(false);
  });

  test('saved positions contain no readable URL or page text', async ({ page, serviceWorker }) => {
    await open(page, serviceWorker);
    await page.evaluate(() => {
      const root = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const reader = root.querySelector<HTMLElement>('.reader')!;
      const h2 = root.querySelector<HTMLElement>('.content h2')!;
      reader.scrollTop =
        h2.getBoundingClientRect().top + reader.scrollTop - reader.clientHeight * 0.35 + 4;
    });
    await expect(page.locator(host).locator('.content .dl-anchor')).toHaveCount(1, {
      timeout: 4000,
    });
    await page.keyboard.press('Escape'); // saving happens on close at the latest
    const stored = JSON.stringify(
      await serviceWorker.evaluate(() => chrome.storage.local.get('positionsV2')),
    );
    expect(stored).toMatch(/[0-9a-f]{32}/);
    expect(stored).not.toContain('localhost');
    expect(stored).not.toContain('article.html');
    expect(stored).not.toContain('drifting');
  });

  test('content scripts cannot make the background act on other tabs', async ({
    context,
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker);
    const victim = await context.newPage();
    await victim.goto('/app.html');
    // Run code in the content script's world (as a compromised page context
    // would) and ask the background to inject the reader into the other tab.
    const response = await serviceWorker.evaluate(
      async (urls) => {
        const [tab] = await chrome.tabs.query({ url: urls.attacker });
        const [target] = await chrome.tabs.query({ url: urls.victim });
        const [first] = await chrome.scripting.executeScript({
          target: { tabId: tab!.id! },
          args: [target!.id!],
          func: (tabId: number) =>
            (
              globalThis as unknown as {
                chrome: { runtime: { sendMessage(m: unknown): Promise<unknown> } };
              }
            ).chrome.runtime
              .sendMessage({ type: 'driftless/toggle-reader', tabId })
              .then(
                (r) => r ?? 'no response',
                () => 'rejected',
              ),
        });
        return first?.result;
      },
      { attacker: page.url(), victim: victim.url() },
    );
    expect(response).not.toEqual({ ok: true });
    await victim.waitForTimeout(300);
    await expect(victim.locator(host)).toHaveCount(0);
  });

  test('the background only serves known font files', async ({ page, serviceWorker }) => {
    await open(page, serviceWorker);
    const results = await serviceWorker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      const [first] = await chrome.scripting.executeScript({
        target: { tabId: tab!.id! },
        func: () => {
          const send = (m: unknown) =>
            (
              globalThis as unknown as {
                chrome: {
                  runtime: { sendMessage(m: unknown): Promise<{ ok: boolean; data?: string }> };
                };
              }
            ).chrome.runtime.sendMessage(m);
          return Promise.all([
            send({ type: 'driftless/get-font', file: 'fonts/lexend-latin-wght-normal.woff2' }),
            send({ type: 'driftless/get-font', file: 'manifest.json' }),
            send({ type: 'driftless/get-font', file: '../../etc/passwd' }),
          ]).then((r) => r.map((x) => Boolean(x?.ok && x.data)));
        },
      });
      return first?.result;
    }, page.url());
    expect(results).toEqual([true, false, false]);
  });
});
