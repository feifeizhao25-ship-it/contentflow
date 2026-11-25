'use client';

import { useState } from 'react';

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  const message = body?.error?.message ?? body?.message;
  return typeof message === 'string' && message.trim() ? message : 'The request could not be completed.';
}

/** Export, delete, and cancel. These call the existing account APIs. No payment is started. */
export function AccountControls() {
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shell" aria-label="Your data">
      <div className="eyebrow">Your data</div>
      <h2>Export, cancel, or delete</h2>
      <section className="card stack">
        <p>Export downloads the personal data this workspace stores for you. Cancel stops a paid plan at the end of the current period. Delete removes the account after you confirm the password. This does not start a payment.</p>
        <div className="actions">
          <button className="button secondary" type="button" disabled={busy} onClick={() => run(async () => {
            const response = await fetch('/api/v1/users/me/export', { credentials: 'same-origin' });
            if (response.status === 401) throw new Error('Sign in before exporting your data.');
            if (!response.ok) throw new Error(await readError(response));
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'contentflow-export.json';
            link.click();
            URL.revokeObjectURL(url);
            setNotice('Your export download has started.');
          })}>Export my data</button>
          <button className="button secondary" type="button" disabled={busy} onClick={() => run(async () => {
            const response = await fetch('/api/v1/billing/subscription/cancel', { method: 'POST', credentials: 'same-origin' });
            if (response.status === 401) throw new Error('Sign in before managing a subscription.');
            if (!response.ok) throw new Error(await readError(response));
            setNotice('Cancellation was requested. A paid plan stops at the end of the current period.');
          })}>Cancel subscription</button>
        </div>
        <label>Password to delete this account
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="button" type="button" disabled={busy || password.length < 8} onClick={() => run(async () => {
          const response = await fetch('/api/v1/users/me/delete-account', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
          });
          if (response.status === 401) throw new Error('Sign in before deleting an account.');
          if (!response.ok) throw new Error(await readError(response));
          setPassword('');
          setNotice('The account delete request was accepted.');
        })}>Delete account</button>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </section>
  );
}
