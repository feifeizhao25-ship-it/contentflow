/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { POST as logout } from '../logout/route';

const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
const req = (cookie?: string) => new NextRequest('http://localhost/api/auth/session', { headers: cookie ? { cookie } : {} });

it('no cookie: signed out, the API is not called', async () => {
  const res = await GET(req());
  expect(await res.json()).toEqual({ signedIn: false });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('valid cookie: signed in with the masked email; the token is never echoed', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { user: { email: 'te***@example.invalid' } } }) });
  const res = await GET(req('ff_token=local-test-token'));
  const text = await res.text();
  expect(JSON.parse(text)).toMatchObject({ signedIn: true, confirmed: true, email: 'te***@example.invalid' });
  expect(text).not.toContain('local-test-token');
  expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer local-test-token');
});

it('expired cookie: signed out and the cookie is cleared', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
  const res = await GET(req('ff_token=old'));
  expect(await res.json()).toMatchObject({ signedIn: false, expired: true });
  expect(res.headers.get('set-cookie')).toMatch(/ff_token=;/);
});

it('API unreachable: still treated as signed in (unconfirmed)', async () => {
  fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
  expect(await (await GET(req('ff_token=t'))).json()).toEqual({ signedIn: true, confirmed: false });
});

it('logout clears the HTTP-only cookie', async () => {
  const res = await logout();
  const cookie = res.headers.get('set-cookie') ?? '';
  expect(cookie).toMatch(/ff_token=;/);
  expect(cookie).toMatch(/Max-Age=0/i);
  expect(cookie).toContain('HttpOnly');
});
