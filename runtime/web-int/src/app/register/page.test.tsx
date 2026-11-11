import { fireEvent, render, screen } from '@testing-library/react';
import RegisterPage from './page';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: jest.fn() }),
}));

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
    json: async () => ({ message: '邮箱已被注册' }),
  });
  render(<RegisterPage />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Registration failed. Please try again.');
  expect(alert).not.toHaveTextContent('邮箱');
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
