'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check } from '@/components/Icons';
import { useDayPass } from '@/lib/day-pass';
import { PRICES } from '@/lib/prices';

const hoursLeft = (until: string) => Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 36e5));

export default function DayPassCard() {
  const { pass, buy } = useDayPass();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function get() {
    setBusy(true);
    const r = await buy();
    setBusy(false);
    setMsg(r === 'ok' ? null : r === 'used' ? 'This account has already used its day pass.' : 'Could not start the pass. Try again in a moment.');
  }

  return (
    <div className="tier" aria-label="Day pass">
      <div className="top"><b className="t-title">Day pass</b><span className="tag tag-best">24 hours</span></div>
      <p className="t-num" style={{ marginTop: 8 }}>₹{PRICES.dayPass}<span className="t-sm muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}> / one day</span></p>
      <p className="t-sm muted">One time, once per account</p>
      <p className="t-sm" style={{ marginTop: 12 }}><b>Everything in Free, plus the Pro extras for a day:</b></p>
      <ul className="stack t-sm" style={{ ['--stack' as string]: '8px', marginTop: 8 }}>
        <li><Check size={14} /> A seat re-check right before you transfer</li>
        <li><Check size={14} /> Alerts when a rule on your path changes</li>
        <li><Check size={14} /> Saved plans and trip history on every device</li>
      </ul>
      <div style={{ marginTop: 16 }}>
        {pass.state === 'active' ? (
          <p className="t-sm"><b>Your day pass is on.</b> About {hoursLeft(pass.until)} h left.</p>
        ) : pass.state === 'signed-out' ? (
          <Link className="btn btn-primary" href="/signin">Sign in to get the day pass</Link>
        ) : pass.state === 'loading' ? (
          <button className="btn btn-primary" type="button" disabled>Get the day pass · ₹{PRICES.dayPass}</button>
        ) : pass.state === 'expired' ? (
          <p className="t-sm muted">Your day pass has ended. It is once per account.</p>
        ) : (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={get}>{busy ? 'Starting…' : `Get the day pass · ₹${PRICES.dayPass}`}</button>
        )}
        <p className="t-sm muted" style={{ marginTop: 8 }}>Demo checkout: no money moves yet.</p>
        {msg && <p className="t-sm" role="alert" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </div>
  );
}
