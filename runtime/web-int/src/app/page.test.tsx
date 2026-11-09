import { render, screen } from '@testing-library/react';
import WorkspacePage from './page';

describe('Global workspace evidence labels', () => {
  it('does not present illustrative metrics as verified workspace data', () => {
    render(<WorkspacePage />);
    expect(screen.queryByText('Illustrative')).not.toBeInTheDocument();
    expect(screen.queryByText('sample policy check rate')).not.toBeInTheDocument();
    expect(document.body.textContent || '').not.toMatch(/\d+%/);
    expect(screen.getByText('Stored records only')).toBeInTheDocument();
    expect(screen.queryByText("Today’s priorities")).not.toBeInTheDocument();
  });
});
