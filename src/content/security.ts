/**
 * Security helpers for code that runs inside web pages.
 *
 * Threat model: every page Driftless Reader runs on is untrusted. Its
 * scripts share the DOM with us (not our JavaScript), so they can dispatch
 * fake events and inspect open shadow roots.
 */

declare const __E2E__: boolean;

/** True only in automated-test builds (never in store builds). */
export const IS_E2E = typeof __E2E__ !== 'undefined' && __E2E__;

/**
 * Closed in real builds so page scripts can't read or click our UI via
 * `element.shadowRoot`. Open in test builds only, because Playwright can
 * only reach into open shadow roots.
 */
export const SHADOW_MODE: ShadowRootMode = IS_E2E ? 'open' : 'closed';

/**
 * Only react to real user input. Pages can `dispatchEvent` synthetic
 * keyboard/pointer events at the document; those have isTrusted = false.
 */
export function isTrustedEvent(event: Event): boolean {
  return event.isTrusted;
}

/**
 * Window focus/blur, used by Drift Guard. Test builds also accept synthetic
 * events, because headless Chromium never moves focus between tabs.
 */
export function isTrustedPresenceEvent(event: Event): boolean {
  return event.isTrusted || IS_E2E;
}
