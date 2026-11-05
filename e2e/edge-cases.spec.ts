import type { Page, Worker } from '@playwright/test';
import { expect, test, toggleReader } from './extension';

/**
 * Synthetic pages that mimic patterns found on real sites (RTL languages,
 * Portuguese abbreviations, documentation with code, very long articles).
 * They complement — not replace — testing on real websites.
 */
const host = '#driftless-reader-host';

async function open(page: Page, sw: Worker, path: string) {
  await page.goto(path);
  await page.bringToFront();
  const started = Date.now();
  await toggleReader(sw, page.url());
  await page.locator(host).locator('.reader').waitFor();
  return Date.now() - started;
}

const sentenceHighlight = (page: Page) =>
  page.evaluate(() =>
    [...(CSS.highlights.get('driftless-sentence') ?? [])]
      .map((r) => r.toString())
      .join('')
      .replace(/\s+/g, ' ')
      .trim(),
  );

test.describe('Edge cases', () => {
  test('right-to-left article: direction and anchor side', async ({ page, serviceWorker }) => {
    await open(page, serviceWorker, '/rtl.html');
    const root = page.locator(host);
    await expect(root.locator('article.page')).toHaveAttribute('dir', 'rtl');
    await page.evaluate(() => {
      const r = document.querySelector('#driftless-reader-host')!.shadowRoot!;
      const reader = r.querySelector<HTMLElement>('.reader')!;
      const h2 = r.querySelector<HTMLElement>('.content h2')!;
      reader.scrollTop =
        h2.getBoundingClientRect().top + reader.scrollTop - reader.clientHeight * 0.35 + 4;
    });
    const anchor = root.locator('.content .dl-anchor');
    await expect(anchor).toHaveCount(1, { timeout: 4000 });
    // The amber bar sits at the start of the line: the right side in RTL.
    const side = await anchor.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      return { right: before.right, left: before.left };
    });
    expect(side.right).toBe('-18px');
  });

  test('Portuguese: abbreviations and decimals stay inside sentences', async ({
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker, '/pt-br.html');
    const root = page.locator(host);
    await expect(root.locator('article.page')).toHaveAttribute('lang', 'pt-BR');
    await root.getByRole('button', { name: 'Read aloud' }).click();
    const player = root.getByRole('region', { name: 'Read Aloud' });
    await player.getByRole('button', { name: 'Pause' }).click();
    await root.locator('.content p').first().scrollIntoViewIfNeeded();
    await root
      .locator('.content p')
      .first()
      .click({ position: { x: 5, y: 5 } });
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await expect.poll(() => sentenceHighlight(page)).not.toBe(seen[seen.length - 1] ?? '');
      seen.push(await sentenceHighlight(page));
      await player.getByRole('button', { name: 'Next sentence' }).click();
    }
    expect(seen).toEqual([
      'A Dra. Ana Souza explica que a leitura com TDAH exige pausas curtas.',
      'O Sr. João, paciente há três anos, concorda: "Sem ajuda, eu me perco no meio do texto."',
      'Segundo o estudo, 62,5% dos participantes relataram melhora.',
    ]);
  });

  test('documentation: code and tables are kept; Read Aloud skips code', async ({
    page,
    serviceWorker,
  }) => {
    await open(page, serviceWorker, '/docs.html');
    const root = page.locator(host);
    await expect(root.locator('.content pre')).toContainText('pnpm build');
    await expect(root.locator('.content table')).toBeVisible();
    await expect(root.locator('.content')).not.toContainText('Getting started'); // sidebar removed

    await root.getByRole('button', { name: 'Read aloud' }).click();
    const player = root.getByRole('region', { name: 'Read Aloud' });
    await player.getByRole('button', { name: 'Pause' }).click();
    const total = Number((await player.locator('.player-pos').textContent())!.split('/')[1]);
    const spoken: string[] = [];
    for (let i = 0; i < total; i += 1) {
      spoken.push(await sentenceHighlight(page));
      await player.getByRole('button', { name: 'Next sentence' }).click();
    }
    expect(spoken.some((s) => s.includes('pnpm'))).toBe(false);
    expect(spoken.some((s) => s.includes('Step one: open an article.'))).toBe(true);
  });

  test('very long article: opens fast, lazy images resolve, scrolling stays smooth', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto('/long.html');
    await page.evaluate(() => {
      const w = window as unknown as { __longTasks: number[] };
      w.__longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: false });
    });
    const openMs = await open(page, serviceWorker, page.url().replace(/^.*localhost:\d+/, ''));
    const root = page.locator(host);
    await expect(root.locator('.chunk-pos')).toHaveText(/^1 \/ \d{2,}$/);
    const firstImg = await root.locator('.content img').first().getAttribute('src');
    expect(firstImg).toContain('/missing-0.png'); // data-src lazy image resolved

    // Scroll through a long stretch with glass on and measure main-thread stalls.
    await page.evaluate(() => {
      (window as unknown as { __longTasks: number[] }).__longTasks = [];
    });
    await page.mouse.move(640, 400);
    for (let i = 0; i < 40; i += 1) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    const longTasks = await page.evaluate(
      () => (window as unknown as { __longTasks: number[] }).__longTasks,
    );
    const worst = Math.max(0, ...longTasks);
    console.log(
      `PERF long.html open=${openMs}ms scrollLongTasks=${longTasks.length} worst=${Math.round(worst)}ms`,
    );
    // Shared CI machines are slower and noisier than a laptop.
    expect(openMs).toBeLessThan(process.env.CI ? 5000 : 2500);
    expect(worst).toBeLessThan(process.env.CI ? 400 : 200);
  });
});
