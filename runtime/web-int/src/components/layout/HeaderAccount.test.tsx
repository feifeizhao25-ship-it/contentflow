import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HeaderAccount from './HeaderAccount';

const replace = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ replace, refresh }) }));

const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); replace.mockReset(); });
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

// 2026-11-21 test: the header kept showing "Sign in" after signing in.
it('shows Sign in when the browser is signed out', async () => {
  fetchMock.mockResolvedValue(json({ signedIn: false }));
  render(<HeaderAccount />);
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
});

it('shows the account and Sign out, not Sign in, when signed in', async () => {
  fetchMock.mockResolvedValue(json({ signedIn: true, confirmed: true, email: 'te***@example.invalid' }));
  render(<HeaderAccount />);
  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.getByText('Signed in as te***@example.invalid')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
});

it('Sign out clears the session and goes to the login page', async () => {
  fetchMock.mockResolvedValueOnce(json({ signedIn: true })).mockResolvedValueOnce(json({ signedIn: false }));
  render(<HeaderAccount />);
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout', { method: 'POST' });
  expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
});

it('falls back to Sign in when the session check fails', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  render(<HeaderAccount />);
  expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
});
