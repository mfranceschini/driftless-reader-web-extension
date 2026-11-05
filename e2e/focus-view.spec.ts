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
    await expect(reader.locator('.meta')).toContainText('min left');

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

  test('reopening during the close animation opens a fresh reader', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    const root = page.locator(host);
    await expect(root.locator('.reader')).toBeVisible();
    await page.keyboard.press('Escape'); // starts the ~160ms fade-out
    await toggleReader(serviceWorker, page.url()); // pressed again right away
    await expect(root).toHaveCount(1);
    await expect(root.locator('.reader:not(.closing)')).toBeVisible();
    await page.waitForTimeout(400); // the old reader's delayed cleanup must not remove the new one
    await expect(root.locator('.reader')).toBeVisible();
  });

  test('closes instantly with reduced motion', async ({ page, serviceWorker }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/article.html');
    await toggleReader(serviceWorker, page.url());
    const root = page.locator(host);
    await expect(root.locator('.reader')).toBeVisible();
    await expect(root.locator('.page')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Escape');
    await expect(root).toHaveCount(0, { timeout: 100 });
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
    await expect(reader.locator('.page')).toHaveCSS('font-size', '20px');

    await page.keyboard.press('Escape'); // closes panel
    await page.keyboard.press('Escape'); // closes reader
    await expect(page.locator(host)).toHaveCount(0);

    await toggleReader(serviceWorker, page.url());
    await expect(reader).toHaveClass(/theme-sepia/);
    await expect(reader.locator('.page')).toHaveCSS('font-size', '20px');
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
