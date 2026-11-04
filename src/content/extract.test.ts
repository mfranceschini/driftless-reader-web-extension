import { describe, expect, it } from 'vitest';
import { extractArticle, sanitizeArticleHtml } from './extract';

const paragraph = `<p>${'Reading with ADHD is hard when the mind drifts away from the page. '.repeat(10)}</p>`;

function makeDoc(body: string, title = 'Test Article'): Document {
  const doc = document.implementation.createHTMLDocument(title);
  doc.body.innerHTML = body;
  return doc;
}

describe('extractArticle', () => {
  it('extracts the main article and drops page chrome', () => {
    const doc = makeDoc(`
      <nav>Home · About · Subscribe</nav>
      <article><h1>Test Article</h1>${paragraph.repeat(6)}</article>
      <footer>© Somebody</footer>
    `);
    const article = extractArticle(doc);
    expect(article).not.toBeNull();
    expect(article?.title).toBe('Test Article');
    expect(article?.wordCount).toBeGreaterThan(500);
    expect(article?.html).not.toContain('Subscribe');
  });

  it('does not modify the original document', () => {
    const doc = makeDoc(`<nav>Menu</nav><article>${paragraph.repeat(6)}</article>`);
    const before = doc.body.innerHTML;
    extractArticle(doc);
    expect(doc.body.innerHTML).toBe(before);
  });

  it('returns null when there is no readable text', () => {
    expect(extractArticle(makeDoc('<div><img src="a.png"></div>'))).toBeNull();
  });
});

describe('sanitizeArticleHtml', () => {
  it('removes scripts, event handlers, inline styles and embeds', () => {
    const dirty =
      '<p style="color:red" onclick="alert(1)">Hi<script>alert(2)</script></p>' +
      '<img src="x.png" onerror="alert(3)"><iframe src="https://ads.example"></iframe>' +
      '<a href="javascript:alert(4)">bad</a>';
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).toContain('<p>Hi</p>');
    expect(clean).toContain('<img src="x.png">');
    expect(clean).not.toMatch(/script|onclick|onerror|style=|iframe|javascript:/i);
  });
});
