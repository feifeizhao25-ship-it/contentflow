import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="shell">
      <div className="eyebrow">404 · Page not found</div>
      <h1>This page drifted off the network.</h1>
      <p>
        The link may be outdated, or the page may have been moved. Head back to the
        workspace to keep your distribution on track.
      </p>
      <div className="actions">
        <Link className="button" href="/">Back to home</Link>
        <Link className="button secondary" href="/pricing">View plans</Link>
      </div>
    </main>
  );
}
