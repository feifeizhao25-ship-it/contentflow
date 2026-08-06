import { render, screen } from '@testing-library/react';
import WorkspacePage from './page';

describe('Global workspace evidence labels', () => {
  it('does not present illustrative metrics as verified workspace data', () => {
    render(<WorkspacePage />);
    expect(screen.getAllByText('Illustrative')).toHaveLength(3);
    expect(screen.getByText('sample policy check rate')).toBeInTheDocument();
    expect(screen.queryByText("Today’s priorities")).not.toBeInTheDocument();
  });
});
