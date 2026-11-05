import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

const extensionId = (sw: Worker) => new URL(sw.url()).host;

/** Runs a keyboard command exactly as the browser shortcut would. */
async function runCommand(sw: Worker, url: string, command: string) {
  await sw.evaluate(
    async ([pageUrl, cmd]) => {
      const [tab] = await chrome.tabs.query({ url: pageUrl });
      const run = (
        globalThis as unknown as {
          __driftlessRunCommand(c: string, id: number): Promise<void>;
        }
      ).__driftlessRunCommand;
      await run(cmd!, tab!.id!);
    },
    [url, command] as const,
  );
}

declare const chrome: {
  tabs: { query(q: { url: string }): Promise<{ id?: number }[]> };
  storage: {
    local: { get(k: string): Promise<Record<string, unknown>>; set(v: object): Promise<void> };
  };
};

async function openExtensionPage(context: BrowserContext, sw: Worker, page: string): Promise<Page> {
  const tab = await context.newPage();
  await tab.goto(`chrome-extension://${extensionId(sw)}/${page}`);
  return tab;
}

test.describe('Keyboard commands', () => {
  test('Read Aloud shortcut opens the reader and starts reading', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto('/article.html');
    await runCommand(serviceWorker, page.url(), 'read-aloud');
    const root = page.locator(host);
    await expect(root.locator('.reader')).toBeVisible();
    await expect(root.getByRole('region', { name: 'Read Aloud' })).toBeVisible();
    await expect(root.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await runCommand(serviceWorker, page.url(), 'read-aloud');
    await expect(root.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });

  test('focus band and chunk mode shortcuts toggle inside the open reader', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    const root = page.locator(host);
    await expect(root.locator('.reader')).toBeVisible();

    await runCommand(serviceWorker, page.url(), 'focus-band');
    await expect(root.locator('.focus-band-edge')).toBeVisible();
    await runCommand(serviceWorker, page.url(), 'focus-band');
    await expect(root.locator('.focus-band-edge')).toHaveCount(0);

    await runCommand(serviceWorker, page.url(), 'chunk-mode');
    await expect(root.locator('.chunk-pos')).toBeVisible();
  });

  test('focus band shortcut works on pages without an article', async ({ page, serviceWorker }) => {
    await page.goto('/app.html');
    await runCommand(serviceWorker, page.url(), 'focus-band');
    await expect(page.locator(host).locator('.page-band .focus-band-edge')).toBeVisible();
  });

  test('pages cannot reach the command channel', async ({ page, serviceWorker }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    await expect(page.locator(host).locator('.reader')).toBeVisible();
    // The bus lives in the extension's isolated world, invisible to the page.
    expect(await page.evaluate(() => 'driftlessBus' in window || '__driftlessBus' in window)).toBe(
      false,
    );
  });
});

test.describe('Options page', () => {
  test('changes apply to the reader, with a live preview', async ({
    context,
    page,
    serviceWorker,
  }) => {
    const options = await openExtensionPage(context, serviceWorker, 'options.html');
    await expect(options.getByRole('heading', { name: 'Driftless Reader settings' })).toBeVisible();
    await options.getByRole('button', { name: 'Atkinson' }).click();
    await expect(options.locator('.reader-preview .page')).toHaveCSS(
      'font-family',
      /Driftless Atkinson Next/,
    );

    await page.goto('/article.html');
    await page.bringToFront();
    await toggleReader(serviceWorker, page.url());
    await expect(page.locator(host).locator('.page')).toHaveCSS(
      'font-family',
      /Driftless Atkinson Next/,
    );
  });

  test('lists all four shortcuts', async ({ context, serviceWorker }) => {
    const options = await openExtensionPage(context, serviceWorker, 'options.html');
    const table = options.locator('table.keys').first();
    await expect(table.locator('tr')).toHaveCount(4);
    await expect(table).toContainText('Start or stop Driftless Reader');
    await expect(table).toContainText('Read aloud');
    // Chromium silently drops suggested keys that clash with its own
    // shortcuts — every command must actually be assigned.
    await expect(table).not.toContainText('Not set');
    await expect(table).toContainText('D');
    await expect(table).toContainText('K');
  });

  test('forgetting reading positions needs a second click', async ({ context, serviceWorker }) => {
    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({
        positions: {
          'https://a.example/1': {
            anchor: 3,
            fingerprint: 'x',
            totalBlocks: 9,
            percent: 40,
            updatedAt: 1,
          },
          'https://a.example/2': {
            anchor: 1,
            fingerprint: 'y',
            totalBlocks: 9,
            percent: 10,
            updatedAt: 2,
          },
        },
      }),
    );
    const options = await openExtensionPage(context, serviceWorker, 'options.html');
    await expect(options.getByText('2 saved reading positions')).toBeVisible();
    await options.getByRole('button', { name: 'Forget positions' }).click();
    await expect(options.getByText('2 saved reading positions')).toBeVisible();
    await options.getByRole('button', { name: 'Click again to forget' }).click();
    await expect(options.getByText('0 saved reading positions')).toBeVisible();
    expect(await serviceWorker.evaluate(() => chrome.storage.local.get('positions'))).toEqual({
      positions: {},
    });
  });

  test('"All settings" in the Aa panel opens the options page', async ({
    context,
    page,
    serviceWorker,
  }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    const root = page.locator(host);
    await root.getByRole('button', { name: 'Display settings' }).click();
    const [options] = await Promise.all([
      context.waitForEvent('page'),
      root.getByRole('button', { name: /All settings/ }).click(),
    ]);
    await expect(options).toHaveURL(/options\.html/);
  });
});

test.describe('Welcome page', () => {
  test('saves the starting font and Drift Guard choice', async ({ context, serviceWorker }) => {
    const welcome = await openExtensionPage(context, serviceWorker, 'welcome.html');
    await expect(
      welcome.getByRole('heading', { name: 'Welcome to Driftless Reader' }),
    ).toBeVisible();
    await expect(welcome.getByRole('heading', { name: 'Pin it to your toolbar' })).toBeVisible();
    await welcome.getByRole('button', { name: /Serif/ }).click();
    await welcome.getByRole('button', { name: /Eager/ }).click();
    await expect(welcome.getByRole('button', { name: /Eager/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect
      .poll(async () => {
        const { readerSettings } = (await serviceWorker.evaluate(() =>
          chrome.storage.local.get('readerSettings'),
        )) as { readerSettings?: { fontFamily: string; driftSensitivity: string } };
        return `${readerSettings?.fontFamily}/${readerSettings?.driftSensitivity}`;
      })
      .toBe('serif/eager');
  });
});
