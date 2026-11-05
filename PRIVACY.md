# Driftless Reader — Privacy Policy

_Last updated: 5 November 2026 · Applies to version 1.0.0 and later_

Driftless Reader is a free, open-source browser extension that makes web articles easier to read.
**It does not collect, sell, or share any personal data.** There are no accounts, servers, analytics,
advertising or tracking of any kind.

## What the extension accesses

- **The page you choose to read.** The extension only runs on a tab after you click its toolbar
  button or press its keyboard shortcut (`activeTab`). It reads that page's text in your browser
  to show it in Focus View. The text is never sent anywhere by the extension.
- **No other tabs or sites.** It has no access to your browsing history, other tabs, or websites
  you haven't activated it on.

## What is stored, and where

Only on your device, in your browser's local extension storage:

| Data                                                    | Purpose                      | Form                                                                                                              |
| ------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Reading settings (font, spacing, theme, Drift Guard, …) | Remember your preferences    | Plain settings values                                                                                             |
| Reading positions for up to 200 articles                | "Pick up where you left off" | One-way SHA-256 hashes of the page address and of the paragraph you reached — not readable addresses or page text |
| Learned reading speed                                   | Estimate time left           | A single number (words per minute)                                                                                |

You can delete all of it at any time from the extension's **Settings → Your data**, or by removing
the extension.

## Read Aloud voices

Read Aloud uses your browser's built-in speech voices. Most voices run on your device. Some voices
offered by your browser are **online voices** (for example Microsoft Edge's "Online (Natural)"
voices); they are marked **"(online)"** in the voice list. When you choose one, **your browser**
sends the text being read to that voice provider to create the speech, under the provider's own
privacy terms (for Edge: the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement)).
Choose a voice without "(online)" to keep everything on your device.

## Network requests

The extension itself makes no network requests. Fonts are bundled inside the extension. Images in
Focus View load from the original website, exactly as they would on the page itself.

## Permissions

| Permission  | Why                                                              |
| ----------- | ---------------------------------------------------------------- |
| `activeTab` | Read the current page only when you start Driftless Reader on it |
| `scripting` | Show the reader on that page when you start it                   |
| `storage`   | Save your settings and reading positions locally                 |

## Children

The extension doesn't collect data from anyone, including children.

## Changes

If this policy changes, the new version will be published at this address with a new date, and in
the extension's source repository.

## Contact

Questions or concerns: open an issue at
<https://github.com/mfranceschini/driftless-reader-web-extension/issues>, or report security issues
privately as described in [SECURITY.md](SECURITY.md).
