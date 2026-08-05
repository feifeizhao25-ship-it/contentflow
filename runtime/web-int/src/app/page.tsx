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
          <article className="card"><span className="status">Illustrative</span><div className="metric">14</div><p>sample market playbooks</p></article>
          <article className="card"><span className="status">Illustrative</span><div className="metric">28</div><p>sample drafts awaiting approval</p></article>
          <article className="card"><span className="status">Illustrative</span><div className="metric">96%</div><p>sample policy check rate</p></article>
        </div>
      </section>
      <section><div className="eyebrow">Illustrative priorities</div><h2>Your workspace adapts to what needs attention.</h2>
        <div className="grid">
          <article className="card"><h3>US launch review</h3><p>Three claims need source verification before LinkedIn approval.</p></article>
          <article className="card"><h3>UK tone adaptation</h3><p>Replace sales-heavy phrasing with a proof-led editorial angle.</p></article>
          <article className="card"><h3>APAC timing signal</h3><p>Short-form completion rate is strongest in the evening window.</p></article>
        </div>
      </section>
    </main>
  );
}
