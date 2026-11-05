import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { privateId, sha256Hex } from './hash';

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches Node for multi-block and Unicode input', () => {
    for (const input of [
      'a'.repeat(1000),
      'Leitura com TDAH é difícil 📖',
      'x'.repeat(55),
      'y'.repeat(64),
    ]) {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input).digest('hex'));
    }
  });
});

describe('privateId', () => {
  it('is stable, short and does not contain the input', () => {
    const url = 'https://mail.example.com/inbox?token=secret123';
    expect(privateId(url)).toBe(privateId(url));
    expect(privateId(url)).toHaveLength(32);
    expect(privateId(url)).not.toContain('secret');
  });
});
