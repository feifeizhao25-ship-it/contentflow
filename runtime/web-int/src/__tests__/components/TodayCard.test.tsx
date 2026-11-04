import { render, screen, waitFor } from '@testing-library/react';
import { TodayCard } from '@/components/home/TodayCard';

const body = { data: { signals: { content_7d: 2, published_7d: 1, failed_7d: 0 }, next_step: { id: 'review_content', title: '2 items waiting for review', description: 'Content must be approved before it can be published.', href: '/create', reason: 'You have 2 items in pending review' } } };
beforeEach(() => { (global as any).fetch = jest.fn(); });

it('shows the next step with the real numbers it is based on, in English', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => body });
  render(<TodayCard />);
  expect(await screen.findByTestId('today-card')).toHaveTextContent('2 items waiting for review');
  expect(screen.getByTestId('today-card')).toHaveTextContent('2 created, 1 published, 0 failed');
  expect(screen.getByTestId('today-card')).toHaveAttribute('href', '/create');
});

it('renders nothing when the API is unreachable or unauthorised (no invented card)', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) });
  const { container } = render(<TodayCard />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
