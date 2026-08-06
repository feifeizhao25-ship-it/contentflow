'use client';
import { useState } from 'react';

export default function CreatePage() {
  const [topic, setTopic] = useState('');
  const [market, setMarket] = useState('United States');
  const [result, setResult] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [error, setError] = useState<{message:string; upgradeUrl?:string} | null>(null);
  async function generate() {
    setError(null);
    const response = await fetch('/api/v1/ai/generate/article', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, platform: 'linkedin', style: `Professional English for ${market}`, locale: 'en' }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const payload = body?.data || body;
      setError({
        message: response.status === 429
          ? 'You have reached today’s generation allowance.'
          : payload.message || 'Generation failed. Please review your account and try again.',
        upgradeUrl: payload.upgrade_url || '/billing/plans',
      });
      return;
    }
    const payload = body?.data || body;
    setResult(payload.content || 'Draft created and queued for review.');
    setMetadata(payload);
  }
  return <main className="shell"><div className="eyebrow">Draft workspace</div><h1>Create for a market, not just a language.</h1>
    <div className="grid two"><section className="card stack">
      <label>Topic or campaign brief<textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Explain the offer, audience, proof points, and desired action." /></label>
      <label>Primary market<select value={market} onChange={e=>setMarket(e.target.value)}><option>United States</option><option>United Kingdom</option><option>Australia</option><option>Singapore</option></select></label>
      <button className="button" disabled={!topic.trim()} onClick={generate}>Generate review draft</button>
      {error && <div className="notice error"><strong>{error.message}</strong><p>Upgrade for a larger allowance or try again after your quota resets.</p><a className="button" href={error.upgradeUrl}>Compare plans</a></div>}
    </section><section className="card"><span className="status">Human approval required</span><h2>Draft output</h2><p>{result || 'Your result will appear here with market context and a review reminder.'}</p>
      {metadata && <div className="stack meta-panel">
        <span className="status">{metadata.provenance === 'knowledge-assisted' ? 'Knowledge-assisted draft' : 'AI-generated draft'}</span>
        <p>{metadata.disclaimer}</p>
        {metadata.quality && <div><strong>Quality {metadata.quality.total}/100</strong>
          {[['Accuracy',metadata.quality.accuracy,30],['Professionalism',metadata.quality.professionalism,25],['Platform fit',metadata.quality.platformFit,20],['Citations',metadata.quality.citation,15],['Safety',metadata.quality.safety,10]].map(([label,value,max]) =>
            <div className="score-row" key={String(label)}><span>{label}</span><progress value={Number(value)} max={Number(max)} /><span>{value}/{max}</span></div>)}
        </div>}
        {(metadata.sources || []).map((source:any) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title} · verified {source.verifiedAt}</a>)}
      </div>}
    </section></div>
  </main>;
}
