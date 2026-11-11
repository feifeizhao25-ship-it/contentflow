'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CJK = /[\u3400-\u9fff]/;

export function registrationError(body: { message?: unknown } | null): string {
  const fallback = 'Registration failed. Please try again.';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || CJK.test(message)) return fallback;
  return message;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [age, setAge] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    if (!agreed || !age) {
      setError('Please agree to the Terms and Privacy Policy and confirm you are at least 16.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(tenantName.trim() ? { tenantName: tenantName.trim() } : {}),
          agreedToTerms: true,
          confirmedAge16: true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(registrationError(body));
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Registration is temporarily unavailable. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">New workspace</div>
          <h1>Create your global command center.</h1>
          <p>Self-serve signup opens a free workspace. Team invites still add people to a workspace that already exists.</p>
        </div>
        <form className="card stack" onSubmit={submit}>
          <h2>Create account</h2>
          <label>Name (optional)<input type="text" autoComplete="name" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Workspace name (optional)<input type="text" maxLength={100} value={tenantName} onChange={(e) => setTenantName(e.target.value)} /></label>
          <label>Work email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required minLength={6} maxLength={20} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>Confirm password<input type="password" required minLength={6} maxLength={20} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to the <Link href="/legal/terms">Terms</Link> and <Link href="/legal/privacy">Privacy Policy</Link>.</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={age} onChange={(e) => setAge(e.target.checked)} />
            <span>I am at least 16 years old.</span>
          </label>
          {error && <p role="alert" style={{ color: '#ffb4b4' }}>{error}</p>}
          <button className="button" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
          <p>Already have an account? <Link href="/login">Sign in</Link></p>
        </form>
      </section>
    </main>
  );
}
