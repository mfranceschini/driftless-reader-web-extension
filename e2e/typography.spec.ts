import type { Page } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';

async function open(page: Page, sw: Parameters<typeof toggleReader>[0], path = '/article.html') {
  await page.goto(path);
  await toggleReader(sw, page.url());
  await expect(page.locator(host).locator('.reader')).toBeVisible();
}

const lexendLoaded = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (f) => f.family.includes('Driftless Lexend') && f.status === 'loaded',
    );
  });

test.describe('Reading fonts', () => {
  test('uses bundled Lexend by default with the new starting layout', async ({
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker);
    const pageEl = page.locator(host).locator('.page');
    await expect(pageEl).toHaveCSS('font-family', /Driftless Lexend/);
    await expect(pageEl).toHaveCSS('font-size', '18px');
    await expect.poll(() => lexendLoaded(page)).toBe(true);
  });

  test('loads the bundled font even on sites with a strict CSP', async ({
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker, '/article.csp.html');
    await expect.poll(() => lexendLoaded(page)).toBe(true);
  });

  test('switches fonts from the panel', async ({ page, serviceWorker }) => {
    await open(page, serviceWorker);
    const root = page.locator(host);
    await root.getByRole('button', { name: 'Display settings' }).click();
    await root.getByRole('button', { name: 'Atkinson' }).click();
    await expect(root.locator('.page')).toHaveCSS('font-family', /Driftless Atkinson Next/);
    await root.getByRole('button', { name: 'Arial' }).click();
    await expect(root.locator('.page')).toHaveCSS('font-family', /^Arial/);
  });

  test('letter and word spacing live under "More text options"', async ({
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker);
    const root = page.locator(host);
    await root.getByRole('button', { name: 'Display settings' }).click();
    await expect(root.getByRole('button', { name: 'Increase Letter spacing' })).toHaveCount(0);
    await root.getByRole('button', { name: /More text options/ }).click();
    await root.getByRole('button', { name: 'Increase Letter spacing' }).click();
    await root.getByRole('button', { name: 'Increase Word spacing' }).click();
    // 0.03em × 18px = 0.54px, 0.08em × 18px = 1.44px
    await expect(root.locator('.page')).toHaveCSS('letter-spacing', '0.54px');
    await expect(root.locator('.page')).toHaveCSS('word-spacing', '1.44px');
  });
});

test.describe('WCAG 2.2 SC 1.4.12 Text Spacing', () => {
  test('no clipping or overflow with user text-spacing overrides', async ({
    page,
    serviceWorker,
  }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await open(page, serviceWorker);
    const root = page.locator(host);
    await root.getByRole('button', { name: 'Display settings' }).click();
    await root.getByRole('button', { name: /More text options/ }).click();

    // The exact overrides from SC 1.4.12, applied the way a user stylesheet would.
    await page.evaluate(() => {
      const shadow = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const style = document.createElement('style');
      style.textContent = `
        * { line-height: 1.5 !important; letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }`;
      shadow.append(style);
    });
    await page.waitForTimeout(200);

    const overflowing = await page.evaluate(() => {
      const shadow = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const reader = shadow.querySelector<HTMLElement>('.reader')!;
      const problems: string[] = [];
      if (reader.scrollWidth > reader.clientWidth + 1) problems.push('reader scrolls sideways');
      const panel = shadow.querySelector<HTMLElement>('.panel')!.getBoundingClientRect();
      for (const el of shadow.querySelectorAll<HTMLElement>('.panel *, .topbar *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (el.closest('.panel') && (r.right > panel.right + 1 || r.left < panel.left - 1)) {
          problems.push(`outside panel: ${el.className || el.tagName} "${el.textContent?.trim()}"`);
        }
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') {
          problems.push(`clipped: ${el.className || el.tagName}`);
        }
      }
      return problems;
    });
    expect(overflowing).toEqual([]);
  });
});
