'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TodayData {
  signals: { content_7d: number; published_7d: number; failed_7d: number };
  next_step: { id: string; title: string; description: string; href: string; reason: string };
}

/** "What to do today": built only from this workspace's real activity. Hidden when the API is unreachable. */
export function TodayCard() {
  const [data, setData] = useState<TodayData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/v1/home/today', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => alive && setData((b?.data ?? b) && (b?.data ?? b).next_step ? (b?.data ?? b) : null))
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  if (!data) return null;
  const { next_step: n, signals: s } = data;
  return (
    <Link href={n.href} className="block rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4" data-testid="today-card">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">What to do today</p>
      <p className="mt-1 font-bold text-zinc-900">{n.title}</p>
      <p className="mt-1 text-sm text-zinc-600">{n.description}</p>
      <p className="mt-2 text-xs text-emerald-700">Based on: {n.reason} (last 7 days: {s.content_7d} created, {s.published_7d} published, {s.failed_7d} failed)</p>
    </Link>
  );
}
