import AxeBuilder from '@axe-core/playwright';
import type { Page, Worker } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

const host = '#driftless-reader-host';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Runs axe (WCAG 2.2 AA) and returns readable violations. */
async function audit(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(WCAG);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations.map(
    (v) =>
      `${v.impact} ${v.id}: ${v.help} → ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
}

async function openReader(page: Page, sw: Worker, path = '/article.html') {
  await page.goto(path);
  await page.bringToFront();
  await toggleReader(sw, page.url());
  await page.waitForTimeout(500); // let open animations finish
}

const extPage = (sw: Worker, name: string) =>
  `chrome-extension://${new URL(sw.url()).host}/${name}`;

test.describe('Accessibility (axe, WCAG 2.2 AA)', () => {
  test('Focus View', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    expect(await audit(page, host)).toEqual([]);
  });

  test('Aa panel with all sections open', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    const root = page.locator(host);
    await root.getByRole('button', { name: 'Display settings' }).click();
    await root.getByRole('button', { name: /More text options/ }).click();
    await page.waitForTimeout(300);
    expect(await audit(page, host)).toEqual([]);
  });

  test('Read Aloud player, focus band and chunk control', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    const root = page.locator(host);
    await root.getByRole('button', { name: 'Read aloud' }).click();
    await root.getByRole('button', { name: 'Focus band' }).click();
    await page.waitForTimeout(300);
    expect(await audit(page, host)).toEqual([]);
  });

  test('Resume card', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    await page.evaluate(() => {
      const r = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const reader = r.querySelector<HTMLElement>('.reader')!;
      const h2 = r.querySelector<HTMLElement>('.content h2')!;
      reader.scrollTop =
        h2.getBoundingClientRect().top + reader.scrollTop - reader.clientHeight * 0.35 + 4;
    });
    await expect(page.locator(host).locator('.dl-anchor')).toHaveCount(1, { timeout: 4000 });
    await page.keyboard.press('Escape');
    await expect(page.locator(host)).toHaveCount(0);
    await toggleReader(serviceWorker, page.url());
    await expect(page.locator(host).getByRole('dialog', { name: 'Resume reading' })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await audit(page, host)).toEqual([]);
  });

  test('Pill on pages without an article', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker, '/app.html');
    expect(await audit(page, host)).toEqual([]);
  });

  test('keyboard focus stays inside Focus View (modal)', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    const focusInside = () =>
      page.evaluate(() => {
        const hostEl = document.querySelector('#driftless-reader-host')!;
        return document.activeElement === hostEl && hostEl.shadowRoot!.activeElement !== null;
      });
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      expect(await focusInside()).toBe(true);
    }
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInside()).toBe(true);
    }
  });

  test('every toolbar control has a visible focus indicator', async ({ page, serviceWorker }) => {
    await openReader(page, serviceWorker);
    const outlines = await page.evaluate(async () => {
      const root = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const result: string[] = [];
      for (const button of root.querySelectorAll<HTMLButtonElement>('.topbar button')) {
        button.focus({ focusVisible: true } as FocusOptions);
        const style = getComputedStyle(button);
        result.push(
          style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
            ? 'ok'
            : (button.getAttribute('aria-label') ?? '?'),
        );
      }
      return result;
    });
    expect(
      outlines.every((o) => o === 'ok'),
      outlines.join(', '),
    ).toBe(true);
  });

  for (const name of ['options.html', 'welcome.html', 'popup.html']) {
    test(`Extension page: ${name}`, async ({ context, serviceWorker }) => {
      const tab = await context.newPage();
      await tab.goto(extPage(serviceWorker, name));
      await tab.waitForTimeout(500);
      expect(await audit(tab)).toEqual([]);
    });
  }
});
