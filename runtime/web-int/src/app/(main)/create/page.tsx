'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TodayCard } from '@/components/home/TodayCard';
import { readableDraft } from '@/lib/readable-draft';
import { SpeakButton, VoiceMicButton, appendVoice } from '@/components/voice/VoiceControls';

type Hit = { ruleId: string; severity: string; reason: string; matchedTerms: string[] };
type Compliance = { level: string; needsHumanReview: boolean; notice: string; hits: Hit[] };
type Blocked = { stage: string; message: string; hits: Hit[] };
type Draft = { content: string; prompts: string[]; topic: string; market: string; compliance: Compliance | null };
const asText = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
function readHits(raw: unknown): Hit[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).flatMap((h) => {
    if (!h || typeof h !== 'object') return [];
    const hit = h as Record<string, unknown>;
    const ruleId = asText(hit.ruleId, 40);
    if (!ruleId) return [];
    const terms = Array.isArray(hit.matchedTerms) ? hit.matchedTerms.filter((t): t is string => typeof t === 'string').slice(0, 5) : [];
    return [{ ruleId, severity: asText(hit.severity, 10) || 'review', reason: asText(hit.reason), matchedTerms: terms }];
  });
}
function readCompliance(raw: unknown): Compliance | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  return { level: asText(c.level, 20) || 'clear', needsHumanReview: c.needsHumanReview === true, notice: asText(c.notice, 800), hits: readHits(c.hits) };
}
function HitList({ hits }: { hits: Hit[] }) {
  if (!hits.length) return null;
  return <ul>{hits.map((h) => <li key={h.ruleId}><strong>{h.ruleId}</strong> ({h.severity === 'block' ? 'blocked' : 'needs review'}){h.reason ? `: ${h.reason}` : ''}{h.matchedTerms.length > 0 && <> — matched: {h.matchedTerms.map((t) => `“${t}”`).join(', ')}</>}</li>)}</ul>;
}
const failures: Record<number, string> = {
  401: 'Your session has expired or you are not signed in. Sign in before generating a draft.',
  403: 'Your account does not have access to this feature. Review your membership or contact support.',
  429: 'Your generation allowance or request limit has been reached. Review your membership and retry after the limit resets.',
};
export default function CreatePage() {
  const [topic, setTopic] = useState('');
  const [market, setMarket] = useState('United States');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [signIn, setSignIn] = useState(false);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  async function generate() {
    if (inFlight.current || !topic.trim()) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true); setError(''); setSignIn(false); setBlocked(null);
    const brief = topic.trim(); const selectedMarket = market;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch('/api/v1/ai/generate/article', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ topic: brief, platform: 'linkedin', style: `Professional English for ${selectedMarket}` }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok && body?.error?.code === 'CONTENT_COMPLIANCE_BLOCKED') {
        const stage = body.error.stage === 'draft' ? 'draft' : 'brief';
        setBlocked({ stage, message: asText(body.error.message, 600), hits: readHits(body.error.compliance?.hits) });
        return;
      }
      if (!response.ok) {
        setSignIn(response.status === 401);
        throw new Error(failures[response.status] || 'Generation is unavailable right now. Your brief is preserved; please try again later.');
      }
      const data = body?.data ?? body;
      if (typeof data?.content !== 'string' || !data.content.trim()) {
        throw new Error('No draft text was returned. Nothing has been saved or published. Please retry.');
      }
      setDraft({ content: data.content, prompts: Array.isArray(data.visualPrompts) ? data.visualPrompts.filter((p: unknown): p is string => typeof p === 'string') : [], topic: brief, market: selectedMarket, compliance: readCompliance(data.compliance) });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setError(controller.signal.aborted ? 'Generation timed out. Your brief is preserved. Check your usage before retrying; the server may still be processing the request.'
        : Object.values(failures).includes(message) || message.startsWith('No draft text') || message.startsWith('Generation is unavailable') ? message
        : 'We could not complete the connection. Your brief is preserved. Please try again.');
    } finally {
      clearTimeout(timeout); inFlight.current = null; setLoading(false);
    }
  }
  return <main className="shell"><div className="eyebrow">Draft workspace</div><h1>Create for a market, not just a language.</h1>
    <TodayCard />
    <div className="grid two" style={{alignItems:'start'}}><section className="card stack" style={{alignContent:'start'}}>
      <div className="voice-field">
        <label>Topic or campaign brief<textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Explain the offer, audience, proof points, and desired action." /></label>
        <VoiceMicButton onFinal={(spoken) => setTopic((current) => appendVoice(current, spoken))} />
      </div>
      <label>Primary market<select value={market} onChange={e=>setMarket(e.target.value)}><option>United States</option><option>United Kingdom</option><option>Australia</option><option>Singapore</option></select></label>
      <button className="button" disabled={loading || !topic.trim()} onClick={generate}>{loading ? 'Generating…' : 'Generate review draft'}</button>
      {loading && <p role="status">Waiting for the generation service. Please keep this page open.</p>}
      {blocked && <div role="alert" aria-label="Compliance check"><p><strong>{blocked.stage === 'draft' ? 'Draft withheld by the compliance check' : 'Brief blocked by the compliance check'}</strong></p>
        <p>{blocked.message || (blocked.stage === 'draft' ? 'The generated draft matched a blocking rule and was not shown.' : 'The brief matched a blocking rule and was not sent for generation.')}</p>
        <HitList hits={blocked.hits} /><p>Edit the brief and try again. This is an automated keyword screen, not legal advice.</p></div>}
      {error && <div role="alert"><p>{error}</p>{signIn && <Link className="button" href="/login">Sign in</Link>}</div>}
    </section><section className="card" aria-label="Draft output" aria-busy={loading}>
      <span className="status">Human approval required</span><h2>Draft output</h2>
      {draft ? <>
        <p>Generated for {draft.market}. This draft is not saved or published by this page.</p>
        <p style={{overflowWrap:'anywhere'}}>Brief: {draft.topic}</p>
        {draft.compliance && <section aria-label="Compliance check" className={draft.compliance.needsHumanReview ? 'voice-block' : undefined}>
          <h3>{draft.compliance.needsHumanReview ? 'Needs human review' : 'Compliance screen: no rule matched'}</h3>
          {draft.compliance.notice && <p>{draft.compliance.notice}</p>}
          <HitList hits={draft.compliance.hits} />
        </section>}
        {(error || blocked) && <p>The previous successful draft is kept below. The latest attempt did not replace it.</p>}
        <div className="voice-block">
          <div data-testid="draft-content" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.8}}>{readableDraft(draft.content)}</div>
          <SpeakButton text={draft.content} />
        </div>
        {draft.prompts.length > 0 && <section aria-label="Visual prompts"><h3>Image prompts to review</h3><ol className="voice-stack">{draft.prompts.map((prompt,index)=><li key={index} className="voice-block"><span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{readableDraft(prompt)}</span><SpeakButton text={prompt} /></li>)}</ol></section>}
      </> : <p>Your complete draft will appear here. Review its facts and market context before using it.</p>}
    </section></div>
  </main>;
}
