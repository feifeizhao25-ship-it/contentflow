/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('legal pages are public', () => {
  it.each(['/legal/privacy', '/legal/terms'])('%s is reachable without signing in', (p) => {
    const res = proxy(new NextRequest(`https://example.test${p}`));
    expect(res.headers.get('location')).toBeNull();
  });
  it('workspace routes still require sign-in', () => {
    const res = proxy(new NextRequest('https://example.test/create'));
    expect(res.headers.get('location')).toContain('/login');
  });
});
