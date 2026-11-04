<p align="center">
  <img src="assets-src/logo.png" alt="Driftless Reader logo" width="200" />
</p>

# Driftless Reader

An open-source **Microsoft Edge and Chrome extension** that helps people with ADHD stay with an article from start to finish.

Most reading tools change how text _looks_. Driftless Reader focuses on what actually breaks reading for many ADHD readers: **drifting away halfway through** and losing your place.

## v1 features

| Feature                          | What it does                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 🧭 **Drift Guard**               | Notices when you switch tabs, go idle or skim-scroll, and welcomes you back with the last sentence you read and a _Rewind_ button. |
| ⚓ **Anchor marker**             | Marks the last paragraph you actually read, saved per page, so getting back takes a second.                                        |
| 🔊 **Read Aloud with highlight** | Reads the article with natural voices, highlighting each word as it goes. Click any sentence to start there.                       |
| 📖 **Focus View**                | A clean, distraction-free layout with adjustable font, spacing, line length and theme.                                             |
| 🔦 **Focus band & Chunk mode**   | Dims everything except the lines you're on, or shows one section at a time.                                                        |
| 📊 **Progress bar**              | Shows how far you are and how much time is left.                                                                                   |

> Status: 🚧 early development. See [docs/PLAN.md](docs/PLAN.md).

## Privacy

- No accounts, no servers, no analytics. Everything stays in your browser's local storage.
- Minimal permissions: `activeTab`, `scripting`, `storage`. The extension only touches a page **after you start it** on that page.

## Development

Requirements: Node 22+, pnpm 10+.

```bash
pnpm install
pnpm dev          # opens Edge with the extension loaded (hot reload)
pnpm dev:chrome   # same, in Chrome
pnpm check        # typecheck + lint + format check + unit tests
pnpm test:e2e     # end-to-end tests in Chromium with the extension loaded
pnpm zip          # store-ready zips for Edge and Chrome in .output/
```

### Load the build manually

1. `pnpm build`
2. Edge: open `edge://extensions` → enable **Developer mode** → **Load unpacked** → select `.output/edge-mv3`.
   Chrome: `chrome://extensions` → **Developer mode** → **Load unpacked** → `.output/chrome-mv3`.
3. Open any article and click the toolbar icon, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>.

### Stack

[WXT](https://wxt.dev) · TypeScript · React · [Mozilla Readability](https://github.com/mozilla/readability) · Vitest · Manifest V3

## License

[MIT](LICENSE). Third-party licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
