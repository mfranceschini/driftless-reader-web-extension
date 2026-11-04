import { describe, expect, it } from 'vitest';
import { buildSentences, buildTextMap, rangeFor, wordEnd } from './text-map';

function block(html: string): HTMLElement {
  const p = document.createElement('p');
  p.innerHTML = html;
  return p;
}

describe('buildTextMap / rangeFor', () => {
  it('maps offsets across nested inline elements', () => {
    const el = block('Read <strong>this bold</strong> and <a href="#">that link</a>.');
    const map = buildTextMap(el);
    expect(map.text).toBe('Read this bold and that link.');
    const start = map.text.indexOf('bold');
    const range = rangeFor(map, start, map.text.indexOf('that') + 4)!;
    expect(range.toString()).toBe('bold and that');
  });

  it('returns null for offsets outside the text', () => {
    const map = buildTextMap(block('Short.'));
    expect(rangeFor(map, 2, 99)).toBeNull();
  });
});

describe('buildSentences', () => {
  it('splits blocks into trimmed sentences with offsets', () => {
    const maps = [
      buildTextMap(block('First one. Dr. Who said 3.5 is fine!')),
      buildTextMap(block('  Second block.  ')),
    ];
    const sentences = buildSentences(maps, 'en');
    expect(sentences.map((s) => [s.block, s.text])).toEqual([
      [0, 'First one.'],
      [0, 'Dr. Who said 3.5 is fine!'],
      [1, 'Second block.'],
    ]);
    const last = sentences[2]!;
    expect(maps[1]!.text.slice(last.start, last.end)).toBe('Second block.');
  });

  it('does not split sentences at line breaks in the source HTML', () => {
    const map = buildTextMap(block('A sentence that\n      continues on the next line. Another.'));
    expect(buildSentences([map], 'en').map((s) => s.text)).toEqual([
      'A sentence that       continues on the next line.',
      'Another.',
    ]);
  });

  it('skips punctuation-only segments', () => {
    expect(buildSentences([buildTextMap(block('— … —'))], 'en')).toEqual([]);
  });
});

describe('wordEnd', () => {
  it('finds the end of the word at an index', () => {
    expect(wordEnd('hello brave world', 6)).toBe(11);
    expect(wordEnd('end', 3)).toBe(3);
  });
});
