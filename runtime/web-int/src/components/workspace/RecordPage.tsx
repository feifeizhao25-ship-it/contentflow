'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Presented } from '@/lib/workspace-records';

type Phase = 'loading' | 'signed-out' | 'error' | 'ready';

export function RecordPage({
  eyebrow,
  title,
  lede,
  path,
  present,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  path: string;
  present: (payload: unknown) => Presented;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [view, setView] = useState<Presented | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(path, { credentials: 'same-origin' })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setPhase('signed-out');
          return;
        }
        if (!response.ok) {
          setPhase('error');
          return;
        }
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        setView(present(body?.data ?? body));
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [path, present]);

  return (
    <main className="shell">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{lede}</p>
      {phase === 'loading' && <p role="status">Loading stored workspace records.</p>}
      {phase === 'signed-out' && (
        <section className="card">
          <h2>Sign in to see your workspace</h2>
          <p>This page only reads records saved for the signed-in workspace. It does not show sample numbers.</p>
          <Link className="button" href="/login">Sign in</Link>
        </section>
      )}
      {phase === 'error' && (
        <section className="card" role="alert">
          <h2>Records could not be loaded</h2>
          <p>Nothing on this page was filled in with an estimate. Try again after the workspace service responds.</p>
        </section>
      )}
      {phase === 'ready' && view && (
        <section className="card" aria-live="polite">
          {view.notes.map((note) => <p key={note}>{note}</p>)}
          {view.rows.length > 0 && (
            <div className="record-scroll">
              <table className="record-table">
                <thead>
                  <tr>{view.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {view.rows.map((row, index) => (
                    <tr key={`${row.join('|')}-${index}`}>
                      {row.map((cell, cellIndex) => <td key={`${view.headers[cellIndex]}-${index}`}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
