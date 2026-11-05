// Real-site test run: opens each URL in Chromium with the extension,
// starts Focus View and records what happened. Writes a Markdown report
// and screenshots to real-sites-report/ (git-ignored).
//
//   pnpm real-sites                      # uses scripts/real-sites.json
//   pnpm real-sites https://example.com  # or specific URLs
//
// Needs network access to the sites. First time on a new machine:
//   pnpm exec playwright install chromium
//
// Uses a local test build (E2E + REAL_SITES): access to all sites and an
// open shadow root so the reader can be inspected. Never shipped —
// scripts/verify-build.mjs rejects such builds.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('real-sites-report');
const EXT = resolve('.output/chrome-mv3');
const list = process.argv.slice(2).length
  ? process.argv.slice(2).map((url) => ({ url, expect: 'either', note: '' }))
  : JSON.parse(readFileSync('scripts/real-sites.json', 'utf8'));

console.log('Building a local test copy with access to all sites (never shipped)…');
execSync('pnpm exec wxt build -b chrome', {
  stdio: 'ignore',
  env: { ...process.env, E2E: '1', REAL_SITES: '1' },
});
mkdirSync(OUT, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

/** Same as clicking the toolbar button on the page's tab. */
const startReader = (url) =>
  worker.evaluate(async (pageUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === pageUrl) ?? tabs[tabs.length - 1];
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/reader.js'],
    });
  }, url);

const rows = [];
for (const [i, site] of list.entries()) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const row = { ...site, result: 'error', notes: [] };
  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500); // late content, consent banners
    await page.bringToFront();
    const started = Date.now();
    await startReader(page.url());
    await page.locator('#driftless-reader-host').waitFor({ state: 'attached', timeout: 10_000 });
    await page.waitForFunction(
      () =>
        document
          .getElementById('driftless-reader-host')
          ?.shadowRoot?.querySelector('.reader, .pill'),
      null,
      { timeout: 10_000 },
    );
    row.openMs = Date.now() - started;
    await page.waitForTimeout(800);
    Object.assign(
      row,
      await page.evaluate(() => {
        const root = document.getElementById('driftless-reader-host').shadowRoot;
        const content = root.querySelector('.content');
        if (!content) return { result: 'no-article' };
        const text = content.textContent ?? '';
        return {
          result: 'article',
          title: root.querySelector('.title')?.textContent ?? '',
          words: text.trim().split(/\s+/).length,
          chunks: (root.querySelector('.chunk-pos')?.textContent ?? '').split('/')[1]?.trim() ?? '',
          images: content.querySelectorAll('img').length,
          brokenImages: [...content.querySelectorAll('img')].filter(
            (img) => img.complete && img.naturalWidth === 0,
          ).length,
          code: content.querySelectorAll('pre').length,
          dir: root.querySelector('article.page')?.getAttribute('dir') ?? '',
        };
      }),
    );
    const shot = `${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: resolve(OUT, shot) });
    row.screenshot = shot;
  } catch (error) {
    row.notes.push(
      String(error.message ?? error)
        .split('\n')[0]
        .slice(0, 160),
    );
  }
  if (row.brokenImages) row.notes.push(`${row.brokenImages} image(s) failed to load`);
  if (row.result === 'article' && row.words < 150) row.notes.push('very little text extracted');
  if (pageErrors.length) row.notes.push(`${pageErrors.length} page script error(s)`);
  const matches = site.expect === 'either' || site.expect === row.result;
  row.verdict = row.result === 'error' ? '❌' : matches ? '✅' : '⚠️';
  rows.push(row);
  console.log(`${row.verdict} ${String(row.result).padEnd(10)} ${site.url}`);
  await page.close();
}
await context.close();

const cell = (v) => String(v ?? '').replace(/\|/g, '\\|');
const md = [
  `# Real-site run — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
  '',
  '| # | | Site | Expected | Got | Title | Words | Chunks | Images | Code | Open (ms) | Notes |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r, i) =>
      `| ${i + 1} | ${r.verdict} | [${new URL(r.url).host}](${r.url}) ${cell(r.note)} | ${r.expect} | ${r.result} | ${cell(r.title).slice(0, 50)} | ${r.words ?? ''} | ${r.chunks ?? ''} | ${r.images ?? ''} | ${r.code ?? ''} | ${r.openMs ?? ''} | ${cell([...r.notes, r.screenshot ? `[screenshot](${r.screenshot})` : ''].filter(Boolean).join('; '))} |`,
  ),
].join('\n');
writeFileSync(resolve(OUT, 'report.md'), md + '\n');
const ok = rows.filter((r) => r.verdict === '✅').length;
console.log(`\n${ok}/${rows.length} as expected. Report: ${resolve(OUT, 'report.md')}`);
