import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service · ContentFlow Global', description: 'The rules for using ContentFlow Global.' };

// Plain-language summary. Final wording must be reviewed by counsel before general availability.
const LAST_UPDATED = '2026-10-16';

export default function Page() {
  return (
    <main className="shell">
      <div className="eyebrow">Legal</div>
      <h1>Terms of Service</h1>
      <p>Last updated: {LAST_UPDATED}</p>
      <div className="stack">
        <section className="card">
          <h2>Using the service</h2>
          <p>You must be authorised to act for your organisation, keep your credentials safe, and use ContentFlow Global only for lawful content that complies with each platform you publish to.</p>
        </section>
        <section className="card">
          <h2>Your content</h2>
          <p>You own the content you create. You grant us a limited licence to store and process it solely to provide the service to you.</p>
        </section>
        <section className="card">
          <h2>AI output</h2>
          <p>AI drafts can be inaccurate or incomplete. You are responsible for reviewing every draft before it is published, including advertising disclosures (such as #ad) required in your market.</p>
        </section>
        <section className="card">
          <h2>Plans and billing</h2>
          <p>Paid plans renew until cancelled. Prices are shown in USD before tax. You can cancel at any time and keep access until the end of the paid period.</p>
        </section>
        <section className="card">
          <h2>Limitation of liability</h2>
          <p>The service is provided as is. To the extent permitted by law, we are not liable for indirect losses, or for platform actions such as account restrictions caused by content you publish.</p>
        </section>
        <section className="card">
          <h2>Changes</h2>
          <p>We will post updates to these terms on this page and notify account owners of material changes before they take effect.</p>
        </section>
      </div>
    </main>
  );
}
