import { describe, expect, it } from 'vitest';
import { pageKey } from './page-key';

describe('pageKey', () => {
  it('ignores hashes, tracking params, trailing slashes and host case', () => {
    expect(pageKey('https://Example.com/post/1/?utm_source=x&fbclid=y#comments')).toBe(
      'https://example.com/post/1',
    );
  });

  it('keeps meaningful query params in a stable order', () => {
    expect(pageKey('https://example.com/read?page=2&id=7')).toBe(
      'https://example.com/read?id=7&page=2',
    );
  });

  it('returns invalid input unchanged', () => {
    expect(pageKey('not a url')).toBe('not a url');
  });
});
