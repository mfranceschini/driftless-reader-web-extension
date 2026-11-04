import { describe, expect, it } from 'vitest';
import { pickVoice, sortVoicesForLang } from './voices';

const v = (name: string, lang: string, extra: Partial<{ default: boolean }> = {}) => ({
  name,
  lang,
  voiceURI: name,
  default: extra.default ?? false,
});

const voices = [
  v('Microsoft David - English (United States)', 'en-US', { default: true }),
  v('Microsoft Aria Online (Natural) - English (United States)', 'en-US'),
  v('Microsoft Francisca Online (Natural) - Portuguese (Brazil)', 'pt-BR'),
];

describe('pickVoice', () => {
  it('prefers a natural voice in the article language', () => {
    expect(pickVoice(voices, 'en', null)?.name).toMatch(/Aria/);
    expect(pickVoice(voices, 'pt-BR', null)?.name).toMatch(/Francisca/);
  });

  it('keeps the saved voice when available', () => {
    expect(pickVoice(voices, 'en', voices[0]!.voiceURI)?.name).toMatch(/David/);
  });

  it('returns null when there are no voices', () => {
    expect(pickVoice([], 'en', null)).toBeNull();
  });
});

describe('sortVoicesForLang', () => {
  it('lists matching-language voices first', () => {
    expect(sortVoicesForLang(voices, 'pt').map((x) => x.lang)).toEqual(['pt-BR', 'en-US', 'en-US']);
  });
});
