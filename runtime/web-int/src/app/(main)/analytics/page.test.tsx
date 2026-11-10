import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from './page';

const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}), blob: async () => new Blob() });
});

it('links the signed-in weekly spreadsheet and PDF in English', async () => {
  render(<AnalyticsPage />);
  expect(await screen.findByRole('link', { name: "Download this week's spreadsheet" })).toHaveAttribute(
    'href',
    '/api/v1/analytics/weekly-report.xlsx?lang=en',
  );
  expect(screen.getByRole('link', { name: "Download this week's PDF" })).toHaveAttribute(
    'href',
    '/api/v1/analytics/weekly-report.pdf?lang=en',
  );
});

it('uses the cookie session and the existing login page when the report is unauthorized', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  expect(source).toContain("credentials: 'same-origin'");
  expect(source).toContain("window.location.href = '/login'");
  expect(source).toContain('response.status === 401');
});
