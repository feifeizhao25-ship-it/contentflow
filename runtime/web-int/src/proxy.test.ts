/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

it('redirects unsigned workspace visits to login', () => {
  const response = proxy(new NextRequest('http://localhost/create'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('http://localhost/login?next=%2Fcreate');
});

it('lets API handler return JSON auth error instead of login HTML', () => {
  const response = proxy(new NextRequest('http://localhost/api/v1/ai/generate/article'));
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-next')).toBe('1');
});

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

describe('public registration and unknown urls', () => {
  it('lets /register render without sending the visitor to login', () => {
    const res = proxy(new NextRequest('http://localhost/register'));
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });

  it.each(['/this-page-does-not-exist', '/nope/nested', '/pricing/unknown'])(
    'does not redirect unknown %s to login',
    (path) => {
      const res = proxy(new NextRequest(`http://localhost${path}`));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
    },
  );

  it('still protects a nested workspace route', () => {
    const res = proxy(new NextRequest('http://localhost/team/invite'));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fteam%2Finvite');
  });
});
