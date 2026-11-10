'use client';

import { RecordPage } from '@/components/workspace/RecordPage';
import { analyticsRows } from '@/lib/workspace-records';

const REPORTS = [
  { href: '/api/v1/analytics/weekly-report.xlsx?lang=en', file: 'weekly-report.xlsx', label: 'Download this week\'s spreadsheet' },
  { href: '/api/v1/analytics/weekly-report.pdf?lang=en', file: 'weekly-report.pdf', label: 'Download this week\'s PDF' },
] as const;

async function saveReport(event: React.MouseEvent<HTMLAnchorElement>, href: string, filename: string) {
  event.preventDefault();
  const response = await fetch(href, { credentials: 'same-origin' });
  if (response.status === 401) {
    window.location.href = '/login';
    return;
  }
  if (!response.ok) return;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  return (
    <>
      <nav aria-label="Weekly report downloads" className="shell report-downloads">
        {REPORTS.map((report) => (
          <a key={report.href} href={report.href} onClick={(event) => void saveReport(event, report.href, report.file)}>
            {report.label}
          </a>
        ))}
      </nav>
      <RecordPage
        eyebrow="Analytics"
        title="What this workspace stored this week."
        lede="Counts are publish tasks and AI generations already saved. Reach and follower movement stay hidden until a platform connection can supply them."
        path="/api/v1/analytics/overview?lang=en"
        present={analyticsRows}
      />
    </>
  );
}
