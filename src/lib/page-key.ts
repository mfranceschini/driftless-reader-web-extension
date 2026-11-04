/** Query params that identify campaigns/sessions, not content. */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$|spm$)/i;

/**
 * A stable key for "this article", so the same page opened from different
 * links (with tracking params or #fragments) resumes in the same place.
 */
export function pageKey(href: string): string {
  try {
    const url = new URL(href);
    url.hash = '';
    for (const name of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(name)) url.searchParams.delete(name);
    }
    url.searchParams.sort();
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  } catch {
    return href;
  }
}
