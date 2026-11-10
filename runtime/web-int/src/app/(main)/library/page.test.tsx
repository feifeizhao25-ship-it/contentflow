import { render, screen } from '@testing-library/react';
import LibraryPage from './page';

const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});

it('asks the signed-out visitor to sign in and does not show sample drafts', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
  render(<LibraryPage />);
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.getByText(/does not show sample numbers/)).toBeInTheDocument();
  expect(screen.queryByText(/Launch note/)).not.toBeInTheDocument();
});

it('renders only the drafts the API returned', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { contents: [{ title: 'Saved brief', content_type: 'article', status: 'draft', created_at: '2026-11-09T02:00:00.000Z' }] } }),
  });
  render(<LibraryPage />);
  expect(await screen.findByText('Saved brief')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/contents?pageSize=50', { credentials: 'same-origin' });
});

it('says the library is empty instead of inventing a draft', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { contents: [] } }) });
  render(<LibraryPage />);
  expect(await screen.findByText(/has not saved any content/)).toBeInTheDocument();
});
