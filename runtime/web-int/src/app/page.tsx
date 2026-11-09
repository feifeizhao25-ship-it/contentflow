import Link from 'next/link';

export default function WorkspacePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">International content operations</div>
          <h1>One review-first workflow for every market.</h1>
          <p>Plan, adapt, approve, and measure platform-native content without exposing provider keys in the browser. Recommendations are localized by market, not merely translated.</p>
          <div className="actions"><Link className="button" href="/create">Start a draft</Link><Link className="button secondary" href="/data-network">Review signals</Link></div>
        </div>
        <div className="grid">
          <article className="card"><h3>Market-specific drafts</h3><p>Each market keeps its own claims, tone, and approval state. No sample performance is shown here.</p></article>
          <article className="card"><h3>Human approval</h3><p>A draft stays unpublished until someone on the workspace approves it.</p></article>
          <article className="card"><h3>Stored records only</h3><p>Analytics counts what this workspace saved. Missing platform data stays blank.</p></article>
        </div>
      </section>
      <section><div className="eyebrow">Example workflow</div><h2>Your workspace adapts to what needs attention.</h2>
        <div className="grid">
          <article className="card"><h3>US launch review</h3><p>Three claims need source verification before LinkedIn approval.</p></article>
          <article className="card"><h3>UK tone adaptation</h3><p>Replace sales-heavy phrasing with a proof-led editorial angle.</p></article>
          <article className="card"><h3>APAC timing signal</h3><p>Short-form completion rate is strongest in the evening window.</p></article>
        </div>
      </section>
    </main>
  );
}
