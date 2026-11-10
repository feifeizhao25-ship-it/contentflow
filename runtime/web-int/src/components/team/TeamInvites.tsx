'use client';

import { FormEvent, useState } from 'react';
import { inviteReason } from '@/lib/invite-reason';

type Issued = { token: string; role: string; email: string | null };

export function invitePayload(email: string, role: string): { role: string; email?: string } {
  const trimmed = email.trim();
  return trimmed ? { email: trimmed, role } : { role };
}

export function TeamInvites() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [issued, setIssued] = useState<Issued | null>(null);
  const [notice, setNotice] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    const response = await fetch('/api/v1/team/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(invitePayload(email, role)),
    });
    const envelope = await response.json().catch(() => ({}));
    const payload = envelope?.data ?? envelope;
    if (!response.ok || !payload?.token) {
      setNotice(inviteReason(envelope));
      return;
    }
    setIssued({ token: payload.token, role: payload.role, email: payload.email ?? null });
    setNotice('Invite created. It can be used once. No email was sent by an outside provider.');
  };

  return (
    <section className="card">
      <h2>Invite</h2>
      <p>Only the owner can invite. The person joins with the role on the invite after they accept. Pending invites count toward the plan seat limit.</p>
      <form onSubmit={submit} className="stack">
        <label>Email (optional)
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label>Role on join
          <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Role on join">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="button" type="submit">Create invite</button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {issued && <p>Share this single-use link: /team/invite?token={issued.token}</p>}
    </section>
  );
}
