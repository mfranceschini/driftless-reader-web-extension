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

describe('sanitizeArticleHtml: attack payloads (page content is untrusted)', () => {
  const cases: [string, string, RegExp][] = [
    [
      'target=_blank (reverse tabnabbing)',
      '<a href="https://x.example" target="_blank">t</a>',
      /target/,
    ],
    ['mXSS via svg/style', '<svg><p><style><img src=x onerror=alert(1)>', /onerror|<style|<img/],
    [
      'mXSS via math/mglyph',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(2)>',
      /onerror|<style|<img/,
    ],
    [
      'obfuscated javascript: URL',
      '<a href="  jav&#x09;ascript:alert(3)">j</a>',
      /javascript|href/,
    ],
    ['javascript: in srcset', '<img srcset="javascript:alert(4) 1x">', /javascript|srcset/],
    ['external svg <use>', '<svg><use href="https://evil.example/x.svg#a"/></svg>', /use|evil/],
    [
      'svg foreignObject',
      '<svg><foreignObject><img src=x onerror=alert(5)></foreignObject></svg>',
      /onerror|foreignObject/i,
    ],
    ['<base> URL hijack', '<base href="https://evil.example/"><a href="/x">rel</a>', /<base|evil/],
    [
      'meta refresh redirect',
      '<meta http-equiv="refresh" content="0;url=https://evil.example">',
      /meta|evil/,
    ],
    ['data: HTML link', '<a href="data:text/html,<script>alert(6)</script>">d</a>', /data:|script/],
    [
      'DOM clobbering name/id',
      '<img src="https://t.example/p.gif" name="body" id="x">',
      /name=|id=/,
    ],
    ['event handler on details', '<details open ontoggle=alert(7)>x</details>', /ontoggle/],
    [
      'non-web URL schemes',
      '<a href="ftp://x.example/f">f</a><a href="xmpp:u@x">x</a>',
      /ftp:|xmpp:/,
    ],
    [
      'iframe / object / embed',
      '<iframe src="https://e.example"></iframe><object data="x"></object><embed src="x">',
      /iframe|object|embed/,
    ],
    [
      'form with formaction',
      '<form><button formaction="javascript:alert(8)">b</button></form>',
      /form|javascript/,
    ],
  ];
  it.each(cases)('neutralizes %s', (_name, payload, forbidden) => {
    expect(sanitizeArticleHtml(payload)).not.toMatch(forbidden);
  });

  it('keeps normal links, mail links and images', () => {
    const clean = sanitizeArticleHtml(
      '<a href="https://ok.example/a">a</a><a href="mailto:me@ok.example">m</a><img src="https://ok.example/i.png" alt="i">',
    );
    expect(clean).toContain('href="https://ok.example/a"');
    expect(clean).toContain('href="mailto:me@ok.example"');
    expect(clean).toContain('src="https://ok.example/i.png"');
  });
});

describe('extractArticle robustness', () => {
  it('returns null instead of throwing on pages that are too large', () => {
    const doc = document.implementation.createHTMLDocument('Huge');
    doc.body.innerHTML = '<div><span>x</span></div>'.repeat(31_000); // 62k elements
    expect(extractArticle(doc)).toBeNull();
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
