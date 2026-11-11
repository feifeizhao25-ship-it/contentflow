import { render, screen } from '@testing-library/react';
import NotFound from './not-found';

it('shows a 404 page instead of a sign-in form', () => {
  render(<NotFound />);
  expect(screen.getByText(/404/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /drifted off the network/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
});
