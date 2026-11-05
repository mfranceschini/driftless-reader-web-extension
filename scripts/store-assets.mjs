// Generates store images into docs/store/images/:
//   screenshot-1..5.png (1280x800), promo-small.png (440x280),
//   promo-marquee.png (1400x560), edge-logo.png (300x300)
// Runs the real extension (test build: fake voice, open shadow root) on
// e2e/fixtures/store-sample.html, then frames each shot with a caption.
//   node scripts/store-assets.mjs
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = resolve('docs/store/images');
const RAW = resolve(tmpdir(), 'driftless-store-raw');
const EXT = resolve('.output/chrome-mv3');
const PORT = 4319;
const URL_ = `http://localhost:${PORT}/store-sample.html`;
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

execSync('pnpm exec wxt build -b chrome', { stdio: 'ignore', env: { ...process.env, E2E: '1' } });
const server = spawn(process.execPath, ['e2e/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const launch = (opts = {}) =>
  chromium.launchPersistentContext('', {
    channel: 'chromium',
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    ...opts,
  });

const ctx = await launch({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const page = await ctx.newPage();
const host = page.locator('#driftless-reader-host');

const BASE = { version: 3, glass: true, driftGuard: true, focusBand: false, chunkMode: true };
async function scene(settings) {
  await sw.evaluate(
    async (s) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ readerSettings: s });
    },
    { ...BASE, ...settings },
  );
  await page.goto(URL_);
  await page.bringToFront();
  await sw.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/reader.js'],
    });
  }, URL_);
  await host.locator('.reader').waitFor();
  await page.waitForTimeout(700);
}
const toLine = (selector, nth = 0) =>
  page.evaluate(
    ([sel, i]) => {
      const r = document.getElementById('driftless-reader-host').shadowRoot;
      const reader = r.querySelector('.reader');
      const el = r.querySelectorAll(sel)[i];
      reader.scrollTop =
        el.getBoundingClientRect().top + reader.scrollTop - reader.clientHeight * 0.35 + 4;
    },
    [selector, nth],
  );
const shot = (name) => page.screenshot({ path: resolve(RAW, `${name}.png`) });

// 1. Focus View + Chunk mode + anchor
await scene({ theme: 'light' });
await toLine('.content h2', 0);
await host.locator('.dl-anchor').waitFor({ timeout: 6000 });
await page.waitForTimeout(600);
await shot('chunk');

// 2. Read Aloud with highlighting (dark)
await scene({ theme: 'dark', chunkMode: false });
await toLine('.content h2', 1);
await page.waitForTimeout(300);
await host.getByRole('button', { name: 'Read aloud' }).click();
await page.waitForTimeout(1200);
await host.getByRole('button', { name: 'Pause', exact: true }).click();
await page.waitForTimeout(250);
await shot('read-aloud');

// 3. Drift Guard welcome back (read a paragraph, step away, come back)
await scene({ theme: 'light', chunkMode: false, driftSensitivity: 'eager' });
await toLine('.content p', 3);
await page.waitForTimeout(7000);
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(9000);
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await host.getByRole('dialog', { name: 'Drift Guard' }).waitFor();
await page.waitForTimeout(500);
await shot('drift');

// 4. Aa panel (sepia)
await scene({ theme: 'sepia', chunkMode: false });
await host.getByRole('button', { name: 'Display settings' }).click();
await page.waitForTimeout(500);
await shot('panel');

// 5. Focus band
await scene({ theme: 'light', chunkMode: false, focusBand: true, focusBandLines: 3 });
await toLine('.content p', 2);
await page.waitForTimeout(500);
await shot('band');
await ctx.close();

// Compose framed screenshots and tiles.
const icon = `data:image/png;base64,${readFileSync('assets-src/icon-mark.png').toString('base64')}`;
const BG =
  'radial-gradient(900px 500px at 80% -20%, #6d28d9 0%, transparent 60%), linear-gradient(160deg, #2a0a6b 0%, #14072f 100%)';
const FONT = `@font-face{font-family:Lexend;src:url(data:font/woff2;base64,${readFileSync('public/fonts/lexend-latin-wght-normal.woff2').toString('base64')}) format('woff2');font-weight:100 900}`;
const frames = [
  [
    'chunk',
    'One piece at a time',
    'Chunk mode shows a small piece of the article and fades the rest. Press Space for the next one.',
  ],
  [
    'read-aloud',
    'Listen and follow along',
    'Read Aloud highlights each sentence and word, and keeps the text on screen for you.',
  ],
  [
    'drift',
    'Drifted away? Pick up in seconds',
    'Drift Guard notices when you leave or skim, and shows the last thing you read.',
  ],
  [
    'panel',
    'Make it comfortable',
    'Lexend or Atkinson Hyperlegible, spacing, line width and themes. Everything is adjustable.',
  ],
  [
    'band',
    'Keep your eyes on the line',
    'The focus band dims everything except the lines you are reading.',
  ],
];
const render = await launch({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const r = await render.newPage();
for (const [i, [name, title, sub]] of frames.entries()) {
  const img = `data:image/png;base64,${readFileSync(resolve(RAW, `${name}.png`)).toString('base64')}`;
  await r.setViewportSize({ width: 1280, height: 800 });
  await r.setContent(`<style>${FONT}*{margin:0;box-sizing:border-box}body{width:1280px;height:800px;overflow:hidden;background:${BG};font-family:Lexend,sans-serif;color:#fff}
    .cap{position:absolute;left:0;right:0;top:34px;text-align:center}.cap h1{font-size:40px;font-weight:650;letter-spacing:-.01em}
    .cap p{margin-top:10px;font-size:19px;color:#d9ccff;font-weight:400}
    .shot{position:absolute;left:120px;top:150px;width:1040px;border-radius:16px;box-shadow:0 30px 80px rgb(0 0 0/.45),0 0 0 1px rgb(255 255 255/.12)}</style>
    <div class="cap"><h1>${title}</h1><p>${sub}</p></div><img class="shot" src="${img}">`);
  await r.waitForTimeout(150);
  await r.screenshot({ path: resolve(OUT, `screenshot-${i + 1}.png`) });
}
const tile = async (w, h, file, html) => {
  await r.setViewportSize({ width: w, height: h });
  await r.setContent(
    `<style>${FONT}*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;overflow:hidden;background:${BG};font-family:Lexend,sans-serif;color:#fff;display:flex;align-items:center}</style>${html}`,
  );
  await r.waitForTimeout(150);
  await r.screenshot({ path: resolve(OUT, file), omitBackground: file === 'edge-logo.png' });
};
await tile(
  440,
  280,
  'promo-small.png',
  `<div style="display:flex;align-items:center;gap:18px;padding:0 30px">
  <img src="${icon}" width="104" height="104" style="border-radius:24px;box-shadow:0 10px 30px rgb(0 0 0/.4)">
  <div><div style="font-size:30px;font-weight:650;line-height:1.1">Driftless<br>Reader</div><div style="margin-top:10px;font-size:15px;color:#d9ccff">Stay with the text.</div></div></div>`,
);
await tile(
  1400,
  560,
  'promo-marquee.png',
  `<div style="display:flex;align-items:center;gap:54px;padding:0 110px">
  <img src="${icon}" width="230" height="230" style="border-radius:52px;box-shadow:0 20px 60px rgb(0 0 0/.45)">
  <div><div style="font-size:72px;font-weight:650;letter-spacing:-.02em">Driftless Reader</div>
  <div style="margin-top:12px;font-size:30px;color:#d9ccff">Stay with the text — an ADHD-friendly way to read the web.</div>
  <div style="margin-top:28px;display:flex;gap:12px;font-size:20px">${['Drift Guard', 'Chunk mode', 'Read Aloud', 'Focus View'].map((t) => `<span style="padding:8px 16px;border-radius:999px;background:rgb(255 255 255/.12);border:1px solid rgb(255 255 255/.18)">${t}</span>`).join('')}</div></div></div>`,
);
await r.setViewportSize({ width: 300, height: 300 });
await r.setContent(
  `<style>*{margin:0}body{background:transparent}</style><img src="${icon}" width="300" height="300">`,
);
await r.screenshot({ path: resolve(OUT, 'edge-logo.png'), omitBackground: true });
await render.close();
server.kill();
console.log(`Store images written to ${OUT}`);
