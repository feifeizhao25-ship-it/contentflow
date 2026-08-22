import { render, screen } from '@testing-library/react';
import PlatformBadge from '@/components/ui/PlatformBadge';

describe('PlatformBadge', () => {
  it('renders TikTok badge', () => {
    render(<PlatformBadge platform="tiktok" />);
    expect(screen.getByText('TikTok')).toBeInTheDocument();
  });

  it('renders Instagram badge', () => {
    render(<PlatformBadge platform="instagram" />);
    expect(screen.getByText('Instagram')).toBeInTheDocument();
  });
  it('renders LinkedIn badge', () => {
    render(<PlatformBadge platform="linkedin" />);
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('renders Reddit badge', () => {
    render(<PlatformBadge platform="reddit" />);
    expect(screen.getByText('Reddit')).toBeInTheDocument();
  });

  it('falls back to TikTok config for unknown platform', () => {
    render(<PlatformBadge platform="unknown-platform" />);
    expect(screen.getByText('TikTok')).toBeInTheDocument();
  });

  it('shows dot by default', () => {
    const { container } = render(<PlatformBadge platform="tiktok" />);
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
  });

  it('hides dot when showDot is false', () => {
    const { container } = render(<PlatformBadge platform="tiktok" showDot={false} />);
    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument();
  });

  it('applies small size classes by default', () => {
    const { container } = render(<PlatformBadge platform="tiktok" />);
    expect(container.firstChild).toHaveClass('text-[10px]');
    expect(container.firstChild).toHaveClass('px-2');
  });

  it('applies medium size classes when size is md', () => {
    const { container } = render(<PlatformBadge platform="tiktok" size="md" />);
    expect(container.firstChild).toHaveClass('text-xs');
    expect(container.firstChild).toHaveClass('px-2.5');
  });
});
