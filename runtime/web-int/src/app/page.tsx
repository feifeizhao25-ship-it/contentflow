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
      <section>
        <div className="eyebrow">Workspace records</div>
        <h2>Open what this workspace has saved.</h2>
        <p>These pages read your account. They stay empty until something is stored, and they do not fill in sample performance.</p>
        <div className="actions">
          <Link className="button secondary" href="/library">Library</Link>
          <Link className="button secondary" href="/publishing">Publishing</Link>
          <Link className="button secondary" href="/calendar">Calendar</Link>
          <Link className="button secondary" href="/analytics">Analytics</Link>
          <Link className="button secondary" href="/accounts">Accounts</Link>
          <Link className="button secondary" href="/materials">Files</Link>
          <Link className="button secondary" href="/brand-voice">Voices</Link>
          <Link className="button secondary" href="/team">Team</Link>
          <Link className="button secondary" href="/developers">Developers</Link>
          <Link className="button secondary" href="/settings">Settings</Link>
        </div>
      </section>
      <section><div className="eyebrow">Illustrative example, not your data</div><h2>A workflow sketch, not a performance report.</h2>
        <p>These cards show the kind of step a person might take. They are not measurements, and they do not change with who is signed in.</p>
        <div className="grid">
          <article className="card"><h3>Check a claim</h3><p>Example only: a draft may need a source before someone approves it. This is not a live count.</p></article>
          <article className="card"><h3>Adjust the tone</h3><p>Example only: sales-heavy phrasing can be rewritten before review. This is not your draft.</p></article>
          <article className="card"><h3>No timing score</h3><p>This product does not estimate when a post will perform. There is no evening-window statistic here.</p></article>
        </div>
      </section>
    </main>
  );
}
