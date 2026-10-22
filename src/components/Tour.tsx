'use client';

// First-visit tour in the app's flight theme: one boarding pass per feature, a plane moving along the route as you go.
// Opens once per browser (localStorage), or any time at /home?tour=1.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const KEY = 'cm-tour-v1';
const STEPS = [
  { gate: 'Gate 1', title: 'Search seats', body: 'Every award seat from India, cheapest first. Filter by stops, airline and dates.', href: '/flights', cta: 'Open Search', from: 'HOME', to: 'SEATS' },
  { gate: 'Gate 2', title: 'Add your cards', body: 'Type your cards and balances once. We never ask for logins.', href: '/wallet', cta: 'Open Wallet', from: 'SEATS', to: 'CARDS' },
  { gate: 'Gate 3', title: 'See where points go', body: 'Transfer ratios and caps for 58 cards, and what a balance becomes at each airline.', href: '/transfers', cta: 'Open Transfers', from: 'CARDS', to: 'MILES' },
  { gate: 'Gate 4', title: 'Plan and save trips', body: 'Say where you want to go. We build the top plans and keep them in Trips.', href: '/plan', cta: 'Open Plan', from: 'MILES', to: 'TRIP' },
  { gate: 'Gate 5', title: 'Watch a route', body: 'Set an alert and we email you when a matching seat opens.', href: '/alerts', cta: 'Open Alerts', from: 'TRIP', to: 'ALERT' },
];

export default function Tour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const go = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch { /* private mode: show it */ }
    const forced = new URLSearchParams(window.location.search).get('tour') === '1';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (forced || !seen) setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  useEffect(() => { if (open) go.current?.focus(); }, [open, i]);

  if (!open) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Quick tour of Card Mafia">
      <div className="tour-pass">
        <div className="tour-track" aria-hidden="true">
          <span className="tour-line"><i style={{ width: `${(i / (STEPS.length - 1)) * 100}%` }} /></span>
          <span className="tour-plane" style={{ left: `${(i / (STEPS.length - 1)) * 100}%` }}>
            <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><path d="M30 16 3 7l4 9-4 9 27-9Zm-17 0 8-1.6L11 12l2 4Z" /></svg>
          </span>
          {STEPS.map((_, k) => <b key={k} className={k <= i ? 'on' : ''} style={{ left: `${(k / (STEPS.length - 1)) * 100}%` }} />)}
        </div>
        <div className="tour-main">
          <div className="tour-route"><span>{s.from}</span><i aria-hidden="true">✈</i><span>{s.to}</span></div>
          <span className="tour-gate">{s.gate} of {STEPS.length}</span>
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </div>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={close}>Skip tour</button>
          <span className="tour-sp" />
          {i > 0 && <button type="button" className="cm-btn cm-btn--ghost" onClick={() => setI(i - 1)}>Back</button>}
          <Link ref={go} className="cm-btn cm-btn--secondary" href={s.href} onClick={close}>{s.cta}</Link>
          {last
            ? <button type="button" className="cm-btn cm-btn--primary" onClick={close}>Start planning</button>
            : <button type="button" className="cm-btn cm-btn--primary" onClick={() => setI(i + 1)}>Next</button>}
        </div>
      </div>
    </div>
  );
}
