  it('renders string icon', () => {
    const { container } = render(<MetricCard label="Test" value="100" icon="trending_up" />);
    expect(container.querySelector('svg.lucide-trending-up')).toBeInTheDocument();
  });