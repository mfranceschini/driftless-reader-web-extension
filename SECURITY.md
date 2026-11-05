# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/mfranceschini/driftless-reader-web-extension/security/advisories/new)
for this repository. You'll get a reply within 7 days.

## Threat model

Driftless Reader runs inside web pages the user chooses. **Every page is treated as untrusted**:
its scripts share the DOM with the extension (not its JavaScript, which runs in an isolated world).

| Asset                | Protection                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The user's browser   | Least privilege: only `activeTab`, `scripting`, `storage`. No host permissions, no content scripts on every site. The reader is injected only into the tab the user activates.                                                                                                                                             |
| Extension privileges | Background accepts messages only from this extension; content scripts (inside web pages) may only request fonts and the options page. Tab IDs and command names are validated.                                                                                                                                             |
| Focus View rendering | Page HTML is sanitized with DOMPurify (scripts, event handlers, `javascript:`/`data:` links, forms, embeds, styles, ids/classes, mXSS vectors removed; only http(s)/mailto/tel URLs). Regression tests cover known payloads.                                                                                               |
| Reader UI integrity  | Closed shadow root (page scripts can't read or click it); keyboard/pointer/focus events must be `isTrusted`, so pages can't fake shortcuts or Drift Guard cards; commands travel on a bus only visible in the isolated world.                                                                                              |
| User privacy         | No network requests from the extension. No `web_accessible_resources`, so sites can't detect the extension. Reading positions are stored as SHA-256 hashes of the URL and paragraph (no readable history or page text). Online TTS voices are labelled, with a disclosure that the spoken text goes to the voice provider. |
| Availability         | Very large pages (> 60k elements) are skipped instead of freezing the tab; extraction errors fall back to the on-page tools.                                                                                                                                                                                               |
| Extension pages      | Strict CSP: `script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. No `eval`.                                                                                                                                                                                                |
| Supply chain         | Lockfile + `minimumReleaseAge` (7 days), `pnpm audit` in CI, Actions pinned to commit SHAs, read-only CI token, Dependabot. `scripts/verify-build.mjs` fails the release build if test-only code, extra permissions or web-accessible resources appear.                                                                    |
