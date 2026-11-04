# Implementation plan

Each phase ends with a build the test user loads unpacked in Edge and uses on real articles.

| #   | Phase                           | Deliverable                                                                                                                              | Status |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0   | Setup                           | WXT + React + TS scaffold, on-demand injection, Shadow DOM shell, CI, license                                                            | ✅     |
| 1   | Focus View                      | Readability extraction, sanitized reader layout, typography & themes, display panel                                                      | ✅     |
| 2   | Anchor marker & progress        | Dwell-based anchor marker, progress bar, learned time left, per-page resume                                                              | ✅     |
| 3   | Drift Guard                     | Away / idle / skim detection, welcome-back recap card, rewind, sensitivity presets                                                       | ✅     |
| 3.5 | Typography (from reading guide) | Bundled Lexend (default) & Atkinson Hyperlegible Next, Arial, Serif; 18px / 1.6 / 68ch defaults; letter & word spacing; WCAG 1.4.12 test | ✅     |
| 4   | Read Aloud                      | Sentence-by-sentence speech, sentence + word highlights (CSS Highlight API), auto-follow, click-to-jump, speed & voice                   | ✅     |
| 5   | Focus band & Chunk mode         | Line dimming band (mouse/keyboard), one-section-at-a-time view                                                                           | ⏳     |
| 6   | Settings                        | Options page, keyboard shortcuts, onboarding                                                                                             |        |
| 7   | Polish                          | Accessibility pass, ~20-site test corpus, performance                                                                                    |        |
| 8   | Store submission                | Icons, screenshots, privacy policy page, Edge Add-ons + Chrome Web Store listings                                                        |        |

## Deferred to v1.1

Focus sprints (timer), bionic bolding (experimental), local stats page, presets.

## Out of scope for now

AI features, PDFs, site blocking, mobile, accounts/sync.

## Design principles

1. **Drift first.** Every feature is judged by whether it helps the reader stay with, or return to, the text.
2. **Calm, not naggy.** Nudges are gentle, rare and easy to turn off.
3. **Private by default.** No network requests (fonts are bundled, never loaded from a CDN); local storage only.
4. **Works without Focus View.** Focus band, Read Aloud and progress also work on the original page when an article can't be extracted.

5. **No medical claims.** Fonts and features are offered as options to try, not as ADHD treatments.
