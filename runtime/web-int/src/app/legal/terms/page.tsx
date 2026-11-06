import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service · ContentFlow Global', description: 'The rules for using ContentFlow Global.' };

// Plain-language summary. Final wording must be reviewed by counsel before general availability.
const LAST_UPDATED = '2026-10-31';

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
          <h2>Eligibility</h2>
          <p>You must be at least 16 years old to use ContentFlow Global. We do not knowingly provide the service to anyone under 16 and may close an account if we learn the user is under 16.</p>
        </section>
        <section className="card">
          <h2>Your content</h2>
          <p>You own the content you create. You grant us a limited licence to store and process it solely to provide the service to you.</p>
        </section>
        <section className="card">
          <h2>AI output</h2>
          <p>AI drafts can be inaccurate or incomplete. You are responsible for reviewing every draft before it is published. Advertising disclosures follow 16 CFR Part 255 and the FTC Disclosures 101 PDF (https://www.ftc.gov/system/files/ftc_gov/pdf/1001A_Influencer%20Guide_508.pdf). In the UK, follow the ASA influencers&apos; guide (https://www.asa.org.uk/resource/influencers-guide.html). Use a clear label such as #ad where those instruments require it.</p>
          <p>AI transparency references are EU AI Act Article 50 (https://eur-lex.europa.eu/eli/reg/2024/1689/oj), the Commission Code of Practice published on 2026-06-10, and the Commission guidelines of 2026-07-20. Those obligations apply from 2026-08-02. ContentFlow has not confirmed that it has signed the Code of Practice; the instruments are references only. Generated text carries a visible AI label. Generated images and videos are signed on the server. We do not add invisible text watermarks. Publishing to more than one platform requires a separate rewrite and your confirmation. The product does not auto-post.</p>
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
