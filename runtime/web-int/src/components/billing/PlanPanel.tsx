'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { describeGlobalPlan, type PlanSummary } from '@/lib/plan-summary';

/** Current plan, usage caps and renewal. Reads only /billing/subscription. */
export function PlanPanel() {
  const [phase, setPhase] = useState<'loading' | 'hidden' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<PlanSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/billing/subscription', { credentials: 'same-origin' })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setPhase('hidden');
          return;
        }
        if (!response.ok) {
          setPhase('error');
          return;
        }
        const body = await response.json().catch(() => null);
        const summary = describeGlobalPlan(body?.data ?? body);
        if (!summary) {
          setPhase('error');
          return;
        }
        setView(summary);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'hidden' || phase === 'loading') return null;
  return (
    <section className="shell" aria-label="Plan">
      <div className="eyebrow">Plan</div>
      <h2>Your plan and limits</h2>
      {phase === 'error' && <p role="alert">Plan details could not be loaded. Nothing here is estimated.</p>}
      {phase === 'ready' && view && (
        <section className="card">
          <p>{view.notice}</p>
          <table className="record-table">
            <tbody>
              {view.rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><Link className="button" href="/pricing">{view.action}</Link></p>
        </section>
      )}
    </section>
  );
}
