import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import { countWords } from '@/src/lib/reading-time';

export interface Article {
  title: string;
  byline: string | null;
  siteName: string | null;
  /** Sanitized article HTML, safe to render inside our shadow root. */
  html: string;
  wordCount: number;
  lang: string | null;
  dir: string | null;
}

/**
 * Elements and attributes we never want in Focus View. DOMPurify already
 * strips scripts and event handlers; this also drops embeds and forms that
 * add noise (and distraction) without helping reading.
 */
const FORBID_TAGS = [
  'style',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
];
const FORBID_ATTR = ['style', 'class', 'id', 'width', 'height'];

/**
 * Links and images may only use web/mail/phone URLs or relative paths.
 * Stricter than DOMPurify's default list (which also allows ftp:, sms:,
 * cid:, xmpp:, …). data: images are still allowed via DATA_URI_TAGS.
 */
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/**
 * Sanitizes page HTML before it's shown in Focus View. Page content is
 * untrusted: this removes scripts, event handlers, javascript:/data: links,
 * forms, embeds, styles, ids/classes (DOM clobbering) and known
 * mutation-XSS vectors (see extract.test.ts for the payloads covered).
 */
export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP,
  });
}

const normalizeHeading = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\s\p{P}]+/gu, ' ')
    .trim()
    .toLowerCase();

/**
 * Removes a leading heading that repeats the article title (we show the
 * title separately). Readability does this itself, but only compares Latin
 * letters, so Arabic, Hebrew, CJK, Cyrillic… titles appeared twice.
 */
export function removeDuplicateTitle(html: string, title: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const firstHeading = template.content.querySelector('h1, h2');
  const firstText = template.content.textContent?.trim() ?? '';
  if (
    firstHeading &&
    normalizeHeading(firstHeading.textContent ?? '') === normalizeHeading(title) &&
    firstText.startsWith((firstHeading.textContent ?? '').trim())
  ) {
    firstHeading.remove();
    return template.innerHTML;
  }
  return html;
}

/** Very large pages are skipped instead of freezing the tab (hostile or huge DOMs). */
export const MAX_ELEMENTS_TO_PARSE = 60_000;

/**
 * Extracts the main article from a document with Mozilla Readability.
 * Works on a clone, because Readability mutates the DOM it parses.
 * Returns null when no readable article is found.
 */
export function extractArticle(doc: Document): Article | null {
  let parsed: ReturnType<Readability['parse']>;
  try {
    const clone = doc.cloneNode(true) as Document;
    parsed = new Readability(clone, {
      charThreshold: 300,
      keepClasses: false,
      maxElemsToParse: MAX_ELEMENTS_TO_PARSE,
    }).parse();
  } catch {
    return null; // too large or malformed: fall back to the on-page tools
  }
  if (!parsed?.content) return null;

  const title = parsed.title?.trim() || doc.title || 'Untitled';
  const html = removeDuplicateTitle(sanitizeArticleHtml(parsed.content), title);
  const text = parsed.textContent ?? '';
  const wordCount = countWords(text);
  if (wordCount === 0) return null;

  return {
    title,
    byline: parsed.byline?.trim() || null,
    siteName: parsed.siteName?.trim() || null,
    html,
    wordCount,
    lang: parsed.lang || doc.documentElement.lang || null,
    dir: parsed.dir || null,
  };
}
