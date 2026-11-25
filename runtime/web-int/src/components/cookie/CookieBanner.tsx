'use client';

import { useEffect, useState } from 'react';
import { COOKIE_CHOICE_KEY, readCookieChoice, type CookieChoice } from '@/lib/cookie-choice';

export const OPEN_COOKIE_SETTINGS = 'contentflow:open-cookie-settings';

function save(choice: CookieChoice) {
  window.localStorage.setItem(COOKIE_CHOICE_KEY, choice);
}

/** EU and UK default: optional analytics stay off until Accept. */
export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOpen(readCookieChoice(window.localStorage) == null);
    setReady(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
  }, []);

  if (!ready) return null;
  if (!open) {
    return (
      <button
        type="button"
        className="button secondary"
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 40 }}
        onClick={() => setOpen(true)}
      >
        Cookie settings
      </button>
    );
  }
  return (
    <section className="card" role="dialog" aria-label="Cookie choices" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 40, maxWidth: 720, margin: '0 auto' }}>
      <h2>Cookies</h2>
      <p>Essential cookies keep you signed in. Optional analytics cookies stay off unless you accept them. You can change this choice at any time.</p>
      <div className="actions">
        <button type="button" className="button secondary" onClick={() => { save('rejected'); setOpen(false); }}>Reject optional cookies</button>
        <button type="button" className="button" onClick={() => { save('accepted'); setOpen(false); }}>Accept analytics cookies</button>
      </div>
    </section>
  );
}

export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}
      style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
    >
      Cookie settings
    </button>
  );
}
