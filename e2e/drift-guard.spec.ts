import type { Page } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

async function scrollBlockToLine(page: Page, selector: string, nth = 0) {
  await page.evaluate(
    ([sel, i]) => {
      const root = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const reader = root.querySelector<HTMLElement>('.reader')!;
      const el = root.querySelectorAll<HTMLElement>(sel as string)[i as number]!;
      reader.scrollTop =
        el.getBoundingClientRect().top + reader.scrollTop - reader.clientHeight * 0.35 + 4;
    },
    [selector, nth] as const,
  );
}

async function openAndAnchorHeading(page: Page, serviceWorker: Parameters<typeof toggleReader>[0]) {
  await page.goto('/article.html');
  await page.bringToFront();
  await toggleReader(serviceWorker, page.url());
  const root = page.locator(host);
  await expect(root.locator('.reader')).toBeVisible();
  await scrollBlockToLine(page, '.content h2');
  await expect(root.locator('.content .dl-anchor')).toHaveText('Why drifting happens', {
    timeout: 4000,
  });
  return root;
}

test.describe('Drift Guard', () => {
  test('nudges when skimming far past the anchor', async ({ page, serviceWorker }) => {
    const root = await openAndAnchorHeading(page, serviceWorker);
    const paragraphs = await root.locator('.content p').count();
    const afterHeading = await page.evaluate(() => {
      const r = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const all = [...r.querySelectorAll('.content p, .content h2')];
      return all.findIndex((el) => el.tagName === 'H2');
    });
    // Skim quickly through the paragraphs after the heading.
    for (let i = afterHeading; i < paragraphs; i += 1) {
      await scrollBlockToLine(page, '.content p', i);
      await page.waitForTimeout(150);
    }

    const card = root.getByRole('dialog', { name: 'Drift Guard' });
    await expect(card).toContainText('Skimming ahead?');
    await expect(card).toContainText('Why drifting happens');

    await card.getByRole('button', { name: 'Back to anchor' }).click();
    await expect(card).toHaveCount(0);
    await expect(root.locator('.content .dl-anchor')).toBeInViewport();
  });

  test('"skimming on purpose" mutes nudges for this article', async ({ page, serviceWorker }) => {
    const root = await openAndAnchorHeading(page, serviceWorker);
    const count = await root.locator('.content p').count();
    const skim = async () => {
      for (let i = 3; i < count; i += 1) {
        await scrollBlockToLine(page, '.content p', i);
        await page.waitForTimeout(150);
      }
    };
    await skim();
    const card = root.getByRole('dialog', { name: 'Drift Guard' });
    await card.getByRole('button', { name: /skimming on purpose/i }).click();
    await expect(card).toHaveCount(0);
    await scrollBlockToLine(page, '.content h2');
    await skim();
    await page.waitForTimeout(500);
    await expect(card).toHaveCount(0);
  });

  test('welcomes you back after switching away, with a recap', async ({ page, serviceWorker }) => {
    test.slow();
    const root = await openAndAnchorHeading(page, serviceWorker);

    // Use the eager preset (8s) so the test stays quick.
    await root.getByRole('button', { name: 'Display settings' }).click();
    await root.getByRole('button', { name: 'Eager' }).click();
    await page.keyboard.press('Escape');

    // Headless Chromium doesn't change focus between tabs, so simulate the
    // window losing and regaining focus (the same events a real switch fires).
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(9_000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    const card = root.getByRole('dialog', { name: 'Drift Guard' });
    await expect(card).toContainText('Welcome back — you were away');
    await expect(card).toContainText('You were just starting:');
    await expect(card).toContainText('Why drifting happens');

    // Esc closes the card first, not the reader.
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(root.locator('.reader')).toBeVisible();
  });

  test('can be turned off', async ({ page, serviceWorker }) => {
    const root = await openAndAnchorHeading(page, serviceWorker);
    await root.getByRole('button', { name: 'Display settings' }).click();
    const toggle = root.getByRole('switch', { name: /Welcome-back/ });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');

    const count = await root.locator('.content p').count();
    for (let i = 3; i < count; i += 1) {
      await scrollBlockToLine(page, '.content p', i);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(500);
    await expect(root.getByRole('dialog', { name: 'Drift Guard' })).toHaveCount(0);
  });
});
