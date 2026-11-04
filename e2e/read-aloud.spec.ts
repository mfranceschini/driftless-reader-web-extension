import type { Page } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

/** Text of a CSS Custom Highlight (shared per document, readable from the page). */
const highlightText = (page: Page, name: string) =>
  page.evaluate((n) => {
    const h = CSS.highlights.get(n);
    if (!h) return null;
    return [...h]
      .map((r) => r.toString())
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }, name);

async function open(page: Page, sw: Parameters<typeof toggleReader>[0]) {
  await page.goto('/article.html');
  await page.bringToFront();
  await toggleReader(sw, page.url());
  await expect(page.locator(host).locator('.reader')).toBeVisible();
  return page.locator(host);
}

test.describe('Read Aloud', () => {
  test('reads sentence by sentence with sentence and word highlights', async ({
    page,
    serviceWorker,
  }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Read aloud' }).click();
    const player = root.getByRole('region', { name: 'Read Aloud' });
    await expect(player).toBeVisible();
    await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();

    await expect
      .poll(() => highlightText(page, 'driftless-sentence'))
      .toBe(
        'Reading with ADHD is hard when the mind drifts away from the page, so small supports matter.',
      );
    const words = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      const w = await highlightText(page, 'driftless-word');
      if (w) words.add(w);
      await page.waitForTimeout(70);
    }
    expect(words.size).toBeGreaterThan(2); // the word highlight moves along

    await expect(player.locator('.player-pos')).toContainText(/^[2-9] \//, { timeout: 5000 });
  });

  test('pause, resume, next and previous', async ({ page, serviceWorker }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Read aloud' }).click();
    const player = root.getByRole('region', { name: 'Read Aloud' });
    await player.getByRole('button', { name: 'Pause' }).click();
    const pos = player.locator('.player-pos');
    const before = await pos.textContent();
    await page.waitForTimeout(1500);
    await expect(pos).toHaveText(before!); // paused: not advancing
    await player.getByRole('button', { name: 'Next sentence' }).click();
    await expect(pos).not.toHaveText(before!);
    await player.getByRole('button', { name: 'Previous sentence' }).click();
    await expect(pos).toHaveText(before!);
    await player.getByRole('button', { name: 'Play' }).click();
    await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('clicking a sentence jumps there while active', async ({ page, serviceWorker }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Read aloud' }).click();
    await root.locator('.content h2').scrollIntoViewIfNeeded();
    await root.locator('.content h2').click();
    await expect.poll(() => highlightText(page, 'driftless-sentence')).toBe('Why drifting happens');
  });

  test('manual scrolling pauses auto-follow until "Follow voice"', async ({
    page,
    serviceWorker,
  }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Read aloud' }).click();
    const follow = root.getByRole('button', { name: 'Follow voice' });
    await expect(follow).toHaveCount(0);
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, 900);
    await expect(follow).toBeVisible();
    await follow.click();
    await expect(follow).toHaveCount(0);
  });

  test('stops and clears highlights when the reader closes', async ({ page, serviceWorker }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Read aloud' }).click();
    await expect.poll(() => highlightText(page, 'driftless-sentence')).not.toBeNull();
    await page.keyboard.press('Escape');
    await expect(root).toHaveCount(0);
    expect(await highlightText(page, 'driftless-sentence')).toBeNull();
    expect(await highlightText(page, 'driftless-word')).toBeNull();
  });
});
