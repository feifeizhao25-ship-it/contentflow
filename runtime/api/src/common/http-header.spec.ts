import { asciiHeaderValue, openRouterHeaderValue } from './http-header';

describe('http header values', () => {
  it('never produces a non-Latin-1 character (fetch throws ByteString errors otherwise)', () => {
    for (const input of ['分发侠', 'Fenfa 分发侠', 'Café', '\u0000bad\u0007', '']) {
      const out = asciiHeaderValue(input);
      expect(/^[\x20-\x7e]+$/.test(out)).toBe(true);
    }
  });

  it('falls back when nothing printable is left', () => {
    expect(asciiHeaderValue('分发侠', 'Fenfa AI')).toBe('Fenfa AI');
  });

  it('keeps readable ASCII and accents folded', () => {
    expect(asciiHeaderValue('Café Bar')).toBe('Cafe Bar');
    expect(openRouterHeaderValue('Fenfa AI')).toBe('Fenfa AI');
  });

  it('the value really can be put into a fetch Headers object', () => {
    expect(() => new Headers({ 'X-Title': openRouterHeaderValue('分发侠') })).not.toThrow();
    expect(() => new Headers({ 'X-Title': '分发侠' })).toThrow();
  });
});
