'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell">
      <section className="card">
        <div className="eyebrow">Page error</div>
        <h1>This page could not finish loading.</h1>
        <p>Nothing was published. Retry this page, or return to the workspace and start again.</p>
        <button className="button" type="button" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
