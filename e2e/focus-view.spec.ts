import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

test.describe('Focus View', () => {
  test('opens a clean reader for an article and closes with Esc', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());

    const reader = page.locator(host).locator('.reader');
    await expect(reader).toBeVisible();
    await expect(reader.locator('.title')).toHaveText('How to Stay With a Long Article');
    await expect(reader.locator('.content')).toContainText('Why drifting happens');
    await expect(reader.locator('.content')).not.toContainText('Subscribe now');
    await expect(reader.locator('.content')).not.toContainText('advertisement');
    await expect(reader.locator('.meta')).toContainText('min read');

    // Page behind is locked while reading
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      'hidden',
    );

    await page.keyboard.press('Escape');
    await expect(page.locator(host)).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe(
      'hidden',
    );
  });

  test('toggling again closes the reader', async ({ page, serviceWorker }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    await expect(page.locator(host).locator('.reader')).toBeVisible();
    await toggleReader(serviceWorker, page.url());
    await expect(page.locator(host)).toHaveCount(0);
  });

  test('does not run page event handlers inside the reader', async ({ page, serviceWorker }) => {
    await page.goto('/article.html');
    await page.evaluate(() => {
      (window as unknown as { __pwned?: boolean }).__pwned = undefined;
    });
    await toggleReader(serviceWorker, page.url());
    await expect(page.locator(host).locator('.content img')).toHaveCount(1);
    await page.waitForTimeout(300);
    // Content scripts run in an isolated world, so check from the page's world too.
    expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBe(
      undefined,
    );
    const img = page.locator(host).locator('.content img');
    expect(await img.getAttribute('onerror')).toBeNull();
  });

  test('display settings apply and persist between sessions', async ({ page, serviceWorker }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    const reader = page.locator(host).locator('.reader');

    await reader.getByRole('button', { name: 'Display settings' }).click();
    await reader.getByRole('button', { name: 'Increase Text size' }).click();
    await reader.getByRole('button', { name: 'Sepia' }).click();
    await expect(reader).toHaveClass(/theme-sepia/);
    await expect(reader.locator('.page')).toHaveCSS('font-size', '22px');

    await page.keyboard.press('Escape'); // closes panel
    await page.keyboard.press('Escape'); // closes reader
    await expect(page.locator(host)).toHaveCount(0);

    await toggleReader(serviceWorker, page.url());
    await expect(reader).toHaveClass(/theme-sepia/);
    await expect(reader.locator('.page')).toHaveCSS('font-size', '22px');
  });
});

test.describe('Pages without an article', () => {
  test('shows a pill with "Try anyway"', async ({ page, serviceWorker }) => {
    await page.goto('/app.html');
    await toggleReader(serviceWorker, page.url());
    const pill = page.locator(host).locator('.pill');
    await expect(pill).toContainText('No article found');
    await pill.getByRole('button', { name: 'Try anyway' }).click();
    // Either a reader opens or a clear failure message is shown — never a crash.
    await expect(
      page.locator(host).locator('.reader, .pill:has-text("Couldn\'t find readable text")'),
    ).toBeVisible();
  });
});
