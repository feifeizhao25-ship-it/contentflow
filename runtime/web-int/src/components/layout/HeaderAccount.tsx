'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Session = { state: 'loading' } | { state: 'out' } | { state: 'in'; label: string | null };

/**
 * Header account control: "Sign in" for a signed-out browser, the account and "Sign out" once signed in.
 * Re-checks on every navigation, so it updates right after the login page redirects.
 */
export default function HeaderAccount() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .catch(() => ({ signedIn: false }))
      .then((body: { signedIn?: boolean; email?: string | null; name?: string | null }) => {
        if (cancelled) return;
        setSession(body?.signedIn ? { state: 'in', label: body.name || body.email || null } : { state: 'out' });
      });
    return () => { cancelled = true; };
  }, [pathname]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSession({ state: 'out' });
    router.replace('/login');
    router.refresh();
  }

  if (session.state === 'loading') return <span className="header-account" aria-hidden="true" />;
  if (session.state === 'out') return <Link href="/login" className="button secondary header-account">Sign in</Link>;
  return (
    <span className="header-account header-account-signed-in">
      <span className="header-account-label">{session.label ? `Signed in as ${session.label}` : 'Signed in'}</span>
      <button type="button" className="button secondary" onClick={signOut}>Sign out</button>
    </span>
  );
}
