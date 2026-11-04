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

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Extracts the main article from a document with Mozilla Readability.
 * Works on a clone, because Readability mutates the DOM it parses.
 * Returns null when no readable article is found.
 */
export function extractArticle(doc: Document): Article | null {
  const clone = doc.cloneNode(true) as Document;
  const parsed = new Readability(clone, { charThreshold: 300, keepClasses: false }).parse();
  if (!parsed?.content) return null;

  const html = sanitizeArticleHtml(parsed.content);
  const text = parsed.textContent ?? '';
  const wordCount = countWords(text);
  if (wordCount === 0) return null;

  return {
    title: parsed.title?.trim() || doc.title || 'Untitled',
    byline: parsed.byline?.trim() || null,
    siteName: parsed.siteName?.trim() || null,
    html,
    wordCount,
    lang: parsed.lang || doc.documentElement.lang || null,
    dir: parsed.dir || null,
  };
}
