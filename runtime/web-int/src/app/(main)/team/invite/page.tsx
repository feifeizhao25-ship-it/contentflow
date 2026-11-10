'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function InviteDecisionPage() {
  return (
    <Suspense fallback={<p>Loading invite…</p>}>
      <InviteDecision />
    </Suspense>
  );
}

function InviteDecision() {
  const token = useSearchParams().get('token') ?? '';
  const [notice, setNotice] = useState('');

  const send = async (path: 'accept' | 'decline') => {
    const response = await fetch(`/api/v1/team/invites/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ token }),
    });
    const envelope = await response.json().catch(() => ({}));
    if (response.ok && envelope?.success !== false && (envelope?.data || envelope?.accepted || envelope?.declined)) {
      setNotice(path === 'accept' ? 'You joined the workspace.' : 'You declined the invite.');
      return;
    }
    setNotice('This invite can no longer be used.');
  };

  return (
    <main className="shell">
      <h1>Team invite</h1>
      <p>An invite can be used once. After it expires, is revoked, or is declined, it cannot be used.</p>
      {!token && <p>This page needs an invite link.</p>}
      {token && (
        <div className="actions">
          <button className="button" type="button" onClick={() => send('accept')}>Accept</button>
          <button className="button secondary" type="button" onClick={() => send('decline')}>Decline</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </main>
  );
}
