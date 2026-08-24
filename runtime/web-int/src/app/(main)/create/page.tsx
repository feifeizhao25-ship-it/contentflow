'use client';
import { useState } from 'react';

export default function CreatePage() {
  const [topic, setTopic] = useState('');
  const [market, setMarket] = useState('United States');
  const [result, setResult] = useState('');
  async function generate() {
    const response = await fetch('/api/v1/ai/generate/article', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, platform: 'linkedin', style: `Professional English for ${market}` }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setResult(body.message || 'Generation failed. Please review your account and try again.');
    setResult(body?.data?.content || body?.content || 'Draft created and queued for review.');
  }
  return <main className="shell"><div className="eyebrow">Draft workspace</div><h1>Create for a market, not just a language.</h1>
    <div className="grid two"><section className="card stack">
      <label>Topic or campaign brief<textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Explain the offer, audience, proof points, and desired action." /></label>
      <label>Primary market<select value={market} onChange={e=>setMarket(e.target.value)}><option>United States</option><option>United Kingdom</option><option>Australia</option><option>Singapore</option></select></label>
      <button className="button" disabled={!topic.trim()} onClick={generate}>Generate review draft</button>
    </section><section className="card"><span className="status">Human approval required</span><h2>Draft output</h2><p>{result || 'Your result will appear here with market context and a review reminder.'}</p></section></div>
  </main>;
}
