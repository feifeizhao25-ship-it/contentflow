import { fireEvent, render, screen } from '@testing-library/react';
import { TeamInvites, invitePayload } from './TeamInvites';

it('builds an email invite or a link invite without inventing an address', () => {
  expect(invitePayload('  person@example.com ', 'editor')).toEqual({ email: 'person@example.com', role: 'editor' });
  expect(invitePayload('   ', 'viewer')).toEqual({ role: 'viewer' });
});

it('shows the single-use link returned by the API and does not claim an email was sent', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { token: 'tok-1', role: 'viewer', email: null } }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<TeamInvites />);
  fireEvent.click(screen.getByRole('button', { name: 'Create invite' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/team/invites', expect.objectContaining({ method: 'POST' }));
  expect(await screen.findByText(/single-use link/)).toHaveTextContent('tok-1');
  expect(screen.getByRole('status')).toHaveTextContent('No email was sent');
});
