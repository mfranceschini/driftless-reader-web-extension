import type { Page } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

async function open(page: Page, sw: Parameters<typeof toggleReader>[0], path = '/article.html') {
  await page.goto(path);
  await page.bringToFront();
  await toggleReader(sw, page.url());
  return page.locator(host);
}

const readerScrollTop = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector('#driftless-reader-host')!.shadowRoot!.querySelector('.reader')!
        .scrollTop,
  );

test.describe('Focus band', () => {
  test('dims all but a few lines at the reading line; arrows move one line', async ({
    page,
    serviceWorker,
  }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Focus band' }).click();
    const edge = root.locator('.focus-band-edge');
    await expect(edge).toBeVisible();
    // 3 lines × 18px × 1.6 + 8px padding
    const bandHeight = async () => Math.round((await edge.boundingBox())!.height);
    await expect.poll(bandHeight).toBe(94);

    const before = await readerScrollTop(page);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => readerScrollTop(page)).toBeCloseTo(before + 28.8, 0);

    await root.getByRole('button', { name: 'Display settings' }).click();
    await root.getByRole('button', { name: '1 line' }).click();
    await expect.poll(bandHeight).toBe(37);

    await root.getByRole('button', { name: 'Mouse' }).click();
    await page.mouse.move(400, 520);
    await expect
      .poll(async () => {
        const box = (await edge.boundingBox())!;
        return Math.round(box.y + box.height / 2);
      })
      .toBe(520);

    await root.getByRole('button', { name: 'Focus band', exact: true }).click();
    await expect(edge).toHaveCount(0);
  });

  test('works on pages without an article and keeps them clickable', async ({
    page,
    serviceWorker,
  }) => {
    const root = await open(page, serviceWorker, '/app.html');
    await root.locator('.pill').getByRole('button', { name: 'Focus band' }).click();
    await expect(root.locator('.page-band .focus-band-edge')).toBeVisible();
    await page.mouse.move(300, 30);
    // The dim layer must not swallow clicks: the page's own element is on top for hit-testing.
    const hit = await page.evaluate(() => document.elementFromPoint(300, 500)?.id);
    expect(hit).not.toBe('driftless-reader-host');
    await root.getByRole('button', { name: '5 lines' }).click();
    await expect(root.getByRole('button', { name: '5 lines' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await root.getByRole('button', { name: 'Turn off focus band' }).click();
    await expect(root).toHaveCount(0);
  });
});

test.describe('Chunk mode', () => {
  test('shows one chunk at a time and steps with Space / Shift+Space', async ({
    page,
    serviceWorker,
  }) => {
    const root = await open(page, serviceWorker);
    await expect(root.locator('.reader')).toBeVisible();
    await root.getByRole('button', { name: 'Chunk mode' }).click();
    const pos = root.locator('.chunk-pos');
    await expect(pos).toHaveText(/^1 \/ \d+$/);
    const total = Number((await pos.textContent())!.split('/')[1]);
    expect(total).toBeGreaterThan(2);
    await expect(root.locator('.content .dl-dim').first()).toBeAttached();

    const firstPara = root.locator('.content p').first();
    await expect(firstPara).not.toHaveClass(/dl-dim/);
    await page.keyboard.press('Space');
    await expect(pos).toHaveText(`2 / ${total}`);
    await expect(firstPara).toHaveClass(/dl-dim/);
    await page.keyboard.press('Shift+Space');
    await expect(pos).toHaveText(`1 / ${total}`);
    await expect(firstPara).not.toHaveClass(/dl-dim/);

    await root.getByRole('button', { name: 'Next chunk (Space)' }).click();
    await expect(pos).toHaveText(`2 / ${total}`);

    await root.getByRole('button', { name: 'Chunk mode' }).click();
    await expect(root.locator('.content .dl-dim')).toHaveCount(0);
    await expect(pos).toHaveCount(0);
  });

  test('remembers the setting next time', async ({ page, serviceWorker }) => {
    const root = await open(page, serviceWorker);
    await root.getByRole('button', { name: 'Chunk mode' }).click();
    await page.keyboard.press('Escape');
    await toggleReader(serviceWorker, page.url());
    await expect(root.getByRole('button', { name: 'Chunk mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(root.locator('.chunk-pos')).toHaveText(/^1 \//);
  });
});
