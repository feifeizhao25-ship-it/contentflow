import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy · ContentFlow Global', description: 'How ContentFlow Global collects, uses and protects your data.' };

// Plain-language summary. Final wording must be reviewed by counsel before general availability.
const LAST_UPDATED = '2026-10-16';

export default function Page() {
  return (
    <main className="shell">
      <div className="eyebrow">Legal</div>
      <h1>Privacy Policy</h1>
      <p>Last updated: {LAST_UPDATED}</p>
      <div className="stack">
        <section className="card">
          <h2>What we collect</h2>
          <p>Account details you give us (work email, name, workspace settings), the drafts and assets you create, and basic usage logs needed to run and secure the service.</p>
        </section>
        <section className="card">
          <h2>How we use it</h2>
          <p>To provide the workspace, generate AI drafts you request, enforce plan limits, keep the service secure, and answer support requests. We do not sell your personal data and we do not use your private drafts to train third-party models.</p>
        </section>
        <section className="card">
          <h2>AI processing</h2>
          <p>When you ask for an AI draft, the relevant prompt and context are sent to our model provider only to produce that output. AI-generated content is labelled as such and is never published without your review.</p>
        </section>
        <section className="card">
          <h2>Cookies</h2>
          <p>Essential cookies keep you signed in. Optional analytics cookies are used only if you accept them in the cookie banner, and you can change that choice at any time.</p>
        </section>
        <section className="card">
          <h2>Your rights</h2>
          <p>Depending on where you live (for example under the GDPR or CCPA), you can request access to, correction of, export of, or deletion of your personal data, and you can object to certain processing. Deleting your account removes your workspace content; records we must keep by law (such as invoices) are retained only as long as required.</p>
        </section>
        <section className="card">
          <h2>Retention and security</h2>
          <p>We keep data only as long as your account is active or as required by law, encrypt data in transit, and restrict staff access on a need-to-know basis.</p>
        </section>
      </div>
    </main>
  );
}
