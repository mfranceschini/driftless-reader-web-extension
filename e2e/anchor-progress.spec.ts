import type { Page } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

/** Scrolls Focus View so the element matching `selector` sits on the reading line. */
async function scrollToReadingLine(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const root = document.querySelector('#driftless-reader-host')!.shadowRoot!;
    const reader = root.querySelector<HTMLElement>('.reader')!;
    const el = root.querySelector<HTMLElement>(sel)!;
    const top = el.getBoundingClientRect().top + reader.scrollTop;
    reader.scrollTop = top - reader.clientHeight * 0.35 + 4;
  }, selector);
}

async function scrollToEnd(page: Page) {
  await page.evaluate(() => {
    const reader = document
      .querySelector('#driftless-reader-host')!
      .shadowRoot!.querySelector<HTMLElement>('.reader')!;
    reader.scrollTop = reader.scrollHeight;
  });
}

async function openReader(page: Page, serviceWorker: Parameters<typeof toggleReader>[0]) {
  await page.goto('/article.html');
  await page.bringToFront();
  await toggleReader(serviceWorker, page.url());
  await expect(page.locator(host).locator('.reader')).toBeVisible();
}

test.describe('Progress bar', () => {
  test('starts at 0% and reaches 100% at the end', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    const bar = page.locator(host).getByRole('progressbar', { name: 'Reading progress' });
    expect(Number(await bar.getAttribute('aria-valuenow'))).toBeLessThan(5);
    await expect(page.locator(host).locator('.meta')).toContainText('min left');

    await scrollToReadingLine(page, '.content h2');
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
      .toBeGreaterThan(20);

    await scrollToEnd(page);
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator(host).locator('.meta')).toContainText('Done');
  });
});

test.describe('Anchor marker', () => {
  test('marks a block only after you dwell on it, not while skimming', async ({
    page,
    serviceWorker,
  }) => {
    await openReader(page, serviceWorker);
    const anchor = page.locator(host).locator('.content .dl-anchor');

    await scrollToReadingLine(page, '.content h2');
    await page.waitForTimeout(400);
    await expect(anchor).toHaveCount(0); // too quick to count as read

    await expect(anchor).toHaveText('Why drifting happens', { timeout: 4000 });
  });

  test('offers a way back after scrolling away, and resumes next time', async ({
    page,
    serviceWorker,
  }) => {
    await openReader(page, serviceWorker);
    const root = page.locator(host);
    await scrollToReadingLine(page, '.content h2');
    await expect(root.locator('.content .dl-anchor')).toHaveCount(1, { timeout: 4000 });

    // Skim to the end: the anchor stays put and a "back" button appears.
    await scrollToEnd(page);
    const back = root.getByRole('button', { name: /Back to where you were/ });
    await expect(back).toBeVisible();
    await expect(root.locator('.content .dl-anchor')).toHaveText('Why drifting happens');
    await back.click();
    await expect(root.locator('.content .dl-anchor')).toBeInViewport();
    await expect(back).toBeHidden();

    // Close and reopen: the position is remembered per page.
    await page.keyboard.press('Escape');
    await expect(root).toHaveCount(0);
    await page.reload();
    await page.bringToFront();
    await toggleReader(serviceWorker, page.url());
    const resume = root.getByRole('dialog', { name: 'Resume reading' });
    await expect(resume).toContainText('% through this article');
    await resume.getByRole('button', { name: 'Continue' }).click();
    await expect(root.locator('.content .dl-anchor')).toBeInViewport();

    // Start over clears it.
    await page.keyboard.press('Escape');
    await toggleReader(serviceWorker, page.url());
    await resume.getByRole('button', { name: 'Start over' }).click();
    await expect(root.locator('.content .dl-anchor')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await toggleReader(serviceWorker, page.url());
    await expect(root.locator('.reader')).toBeVisible();
    await expect(resume).toHaveCount(0);
  });
});
