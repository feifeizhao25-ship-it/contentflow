import { fireEvent, render, screen } from '@testing-library/react';
import RegisterPage from './page';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: jest.fn() }),
}));

// Upstream CN backend message ("email already registered"), written as escapes so the INT source stays free of CJK.
const UPSTREAM_ZH_MESSAGE = '\u90ae\u7bb1\u5df2\u88ab\u6ce8\u518c';
const UPSTREAM_ZH_WORD = '\u90ae\u7bb1';

const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  replace.mockReset();
});

function fill() {
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'correct horse' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Terms/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /16 years/ }));
}

it('shows an English alert when registration fails', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ message: UPSTREAM_ZH_MESSAGE }),
  });
  render(<RegisterPage />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Registration failed. Please try again.');
  expect(alert).not.toHaveTextContent(UPSTREAM_ZH_WORD);
  expect(replace).not.toHaveBeenCalled();
});

it('shows an English alert when the network fails', async () => {
  fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.8'));
  render(<RegisterPage />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Registration is temporarily unavailable');
  expect(alert.textContent).not.toContain('10.0.0.8');
});

it('shows the English reason from the registration route', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ message: 'An account with this email already exists.' }),
  });
  render(<RegisterPage />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
});
