# Store submission — Driftless Reader 1.0.0

Everything needed to publish on **Microsoft Edge Add-ons** and the **Chrome Web Store**.
Text fields are ready to paste; images are in [`images/`](images/).

## 0. Before you start (one-time)

| Step                     | Where                                                                                   | Notes                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turn on GitHub Pages     | Repo → **Settings → Pages** → _Deploy from a branch_ → `main` / `/docs`                 | Makes the privacy policy live at **https://mfranceschini.github.io/driftless-reader-web-extension/privacy.html** (stores reject a repository front page as a privacy policy) |
| Edge developer account   | [Partner Center — Edge program](https://partner.microsoft.com/dashboard/microsoftedge/) | Free                                                                                                                                                                         |
| Chrome developer account | [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)   | One-time US$5 registration fee                                                                                                                                               |
| Build the packages       | `pnpm install && pnpm zip`                                                              | Creates `.output/driftless-reader-web-extension-1.0.0-edge.zip` and `…-chrome.zip`, then runs the release check (must print ✔)                                               |

## 1. Shared listing values

| Field                               | Value                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Name                                | Driftless Reader                                                                                                           |
| Summary / short description (≤ 132) | ADHD-friendly reading: stay with long articles using Drift Guard, an anchor marker, Read Aloud, Focus View and Chunk mode. |
| Description                         | Paste [`description.txt`](description.txt)                                                                                 |
| Category                            | **Accessibility** if offered; otherwise **Productivity**                                                                   |
| Language                            | English                                                                                                                    |
| Price                               | Free                                                                                                                       |
| Website                             | https://mfranceschini.github.io/driftless-reader-web-extension/                                                            |
| Support                             | https://github.com/mfranceschini/driftless-reader-web-extension/issues                                                     |
| Privacy policy URL                  | https://mfranceschini.github.io/driftless-reader-web-extension/privacy.html                                                |
| Search terms (Edge, max 7)          | ADHD · reading · focus · reader mode · read aloud · text to speech · accessibility                                         |

### Images

| File                         | Size     | Edge                              | Chrome                        |
| ---------------------------- | -------- | --------------------------------- | ----------------------------- |
| `images/edge-logo.png`       | 300×300  | Extension logo (required)         | —                             |
| `images/store-icon-128.png`  | 128×128  | —                                 | Store icon                    |
| `images/promo-small.png`     | 440×280  | Small promotional tile            | Small promo tile              |
| `images/promo-marquee.png`   | 1400×560 | Large promotional tile (optional) | Marquee promo tile (optional) |
| `images/screenshot-1..5.png` | 1280×800 | Screenshots (up to 10)            | Screenshots (up to 5)         |

Screenshot order: 1 Chunk mode · 2 Read Aloud · 3 Drift Guard · 4 Settings · 5 Focus band.
Regenerate with `node scripts/store-assets.mjs`.

## 2. Microsoft Edge Add-ons (Partner Center)

1. **Create new extension** → upload `driftless-reader-web-extension-1.0.0-edge.zip`.
2. **Availability:** Visibility **Public** · Markets **all**.
3. **Properties:** Category (above) · Privacy policy: _"Does this extension access, collect or transmit personal information?"_ → **No**, and add the privacy policy URL anyway · Website and support URLs (above) · Mature content: **No**.
4. **Store listings → English:** description, short description, search terms, logo, small tile, screenshots, large tile.
5. **Submit** with these **Notes for certification**:

```text
Driftless Reader shows the current article in a distraction-free reader.
It runs only after the user activates it on a tab (toolbar button or Alt+Shift+D);
there are no content scripts on page load and no host permissions.

How to test:
1. Open any article, e.g. https://en.wikipedia.org/wiki/Reading
2. Click the toolbar icon → "Start / stop on this page" (or press Alt+Shift+D).
3. Focus View opens. Press Space to move between chunks; click the speaker icon
   for Read Aloud; open "Aa" for settings; press Esc to close.
4. On a non-article page (e.g. a web app), a small pill offers "Try anyway"
   and "Focus band".

No account or login is needed. No data is collected or transmitted; settings
and hashed reading positions are stored locally (see privacy policy).
Source code: https://github.com/mfranceschini/driftless-reader-web-extension
```

Review usually takes **up to 7 business days**.

## 3. Chrome Web Store (Developer Dashboard)

1. **New item** → upload `driftless-reader-web-extension-1.0.0-chrome.zip`.
2. **Store listing:** description, category, language, store icon, screenshots, small promo tile, marquee (optional), website and support URLs.
3. **Privacy practices:**

| Field                     | Paste                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single purpose            | Driftless Reader makes long web articles easier to read and stay focused on, by showing the current page in a distraction-free reader with reading-position and focus aids (chunking, drift reminders, read aloud, focus band). |
| `activeTab` justification | Reads and displays the article of the tab the user is on, only after the user clicks the toolbar button or presses the extension's shortcut. No access to other tabs or sites.                                                  |
| `scripting` justification | Injects the reader into the active tab on demand, after the user activates it. The extension has no content scripts that run automatically.                                                                                     |
| `storage` justification   | Saves the user's reading settings and reading positions (stored as one-way hashes) locally in the browser. Nothing is synced or sent anywhere.                                                                                  |
| Remote code               | **No**, I am not using remote code. All code is bundled in the package.                                                                                                                                                         |
| Data usage                | Check **none** of the data types. Tick all three certifications (not sold to third parties; not used for unrelated purposes; not used for creditworthiness).                                                                    |
| Privacy policy URL        | (above)                                                                                                                                                                                                                         |

4. **Distribution:** Public · Free · All regions.
5. **Submit for review.** New publishers' first reviews can take longer than later updates.

## 4. After approval

- Add the store links to the README.
- Tag the release: `git tag v1.0.0 && git push origin v1.0.0`, and attach both zips to a GitHub release.
- For updates: bump `version` in `package.json`, `pnpm zip`, upload the new zip in each dashboard.

## Wording rules used in the listing

- No medical claims ("treats", "cures", "improves ADHD"). The description says it's a reading aid, not a medical device.
- Features described as tools to try ("keep what helps"), matching what the extension actually does.
- The online-voice behavior is disclosed, consistent with the privacy policy.
