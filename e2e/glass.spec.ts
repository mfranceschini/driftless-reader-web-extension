import type { Page } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

async function open(page: Page, sw: Parameters<typeof toggleReader>[0]) {
  await page.goto('/article.html');
  await toggleReader(sw, page.url());
  const root = page.locator(host);
  await expect(root.locator('.reader')).toBeVisible();
  return root;
}

test.describe('Glass effects', () => {
  test('frosts floating controls by default, never the reading surface', async ({
    page,
    serviceWorker,
  }) => {
    const root = await open(page, serviceWorker);
    await expect(root.locator('.topbar')).toHaveCSS('backdrop-filter', /blur\(14px\)/);
    await root.getByRole('button', { name: 'Display settings' }).click();
    await expect(root.locator('.panel')).toHaveCSS('backdrop-filter', /blur\(16px\)/);

    await expect(root.locator('.reader')).toHaveCSS('backdrop-filter', 'none');
    await expect(root.locator('.page')).toHaveCSS('backdrop-filter', 'none');
    await root.getByRole('button', { name: 'Focus band' }).click();
    await expect(root.locator('.focus-band-dim').first()).toHaveCSS('backdrop-filter', 'none');
  });

  test('can be turned off, and stays off', async ({ page, serviceWorker }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Display settings' }).click();
    const toggle = root.getByRole('switch', { name: 'Glass effects' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(root.locator('.topbar')).toHaveCSS('backdrop-filter', 'none');
    await expect(root.locator('.panel')).toHaveCSS('backdrop-filter', 'none');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await toggleReader(serviceWorker, page.url());
    await expect(root.locator('.topbar')).toHaveCSS('backdrop-filter', 'none');
  });

  test('falls back to solid with "reduce transparency" or forced colors', async ({
    page,
    serviceWorker,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    const root = await open(page, serviceWorker);
    await expect(root.locator('.topbar')).toHaveCSS('backdrop-filter', 'none');

    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    await expect(root.locator('.topbar')).toHaveCSS('backdrop-filter', /blur/);

    await page.emulateMedia({ forcedColors: 'active' });
    await expect(root.locator('.topbar')).toHaveCSS('backdrop-filter', 'none');
  });
});
