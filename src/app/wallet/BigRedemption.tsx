'use client';

// The one thing to look at on the wallet: the biggest business seat the balances can pay for, found from the same cached search the home page uses.
// "Biggest" is the seat with the highest full price in points that one card, or the cards together, can pay for in full.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type Holdings, searchSeats, type SeatView } from '@/lib/app/api';
import { addDaysIso, dateShort, fmt, todayIso } from '@/lib/app/format';
import { checkoutHref } from '@/components/app/flights/seat-bits';
import { cityOf, expandDest } from '@/lib/airports';
import './big.css';

const REGIONS = ['europe', 'middle-east', 'southeast-asia', 'east-asia', 'north-america'];

type State = { kind: 'loading' } | { kind: 'none' } | { kind: 'error'; message: string } | { kind: 'seat'; seat: SeatView };

export default function BigRedemption({ holdings, home, total }: { holdings: Holdings; home: string; total: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    const from = addDaysIso(7, todayIso());
    const to = addDaysIso(120, todayIso());
    Promise.all(REGIONS.map(r => searchSeats({ origins: [home], dests: expandDest(r), from, to, cabin: 'business', travellers: 1, holdings, filters: { reachableOnly: true }, limit: 20 }))).then(results => {
      if (!live) return;
      const seats = results.flatMap(r => (r.ok ? r.data.rows : [])).filter(s => s.reach?.best && (s.reach.status === 'ok' || s.reach.status === 'pooled'));
      const best = seats.sort((a, b) => b.miles - a.miles || (a.reach?.best?.pointsUsed ?? 0) - (b.reach?.best?.pointsUsed ?? 0))[0];
      const failed = results.find(r => !r.ok);
      if (best) setState({ kind: 'seat', seat: best });
      else if (failed && !failed.ok && results.every(r => !r.ok)) setState({ kind: 'error', message: failed.error });
      else setState({ kind: 'none' });
    });
    return () => { live = false; };
  }, [holdings, home, tries]);

  if (state.kind === 'loading') {
    return (
      <section className="bg" aria-label="Your biggest redemption today" aria-busy="true">
        <span className="bg-eb">Your biggest move today</span>
        <div className="bg-sk" /><div className="bg-sk bg-sk-s" />
        <p className="bg-mu" role="status">Looking for the biggest business seat your points can pay for</p>
      </section>
    );
  }
  if (state.kind !== 'seat') {
    return (
      <section className="bg bg-empty" aria-label="Your biggest redemption today">
        <span className="bg-eb">Your biggest move today</span>
        <h2>{state.kind === 'error' ? 'We could not look just now' : 'Nothing big is payable yet'}</h2>
        <p className="bg-mu">{state.kind === 'error' ? state.message : `We saw no business seat from ${cityOf(home)} in the next four months that your balances can pay for in full. Add a balance or another card below.`}</p>
        {state.kind === 'error' && <button type="button" className="cm-btn cm-btn--secondary" onClick={() => { setState({ kind: 'loading' }); setTries(t => t + 1); }}>Try again</button>}
      </section>
    );
  }

  const s = state.seat;
  const pay = s.reach!.best!;
  const pooled = s.reach!.status === 'pooled';
  return (
    <section className="bg" aria-label="Your biggest redemption today">
      <span className="bg-eb">Your {fmt(total)} points can take you to</span>
      <h2>{cityOf(s.dest)} in business</h2>
      <div className="bg-pts"><b>{fmt(s.miles)}</b><span>{s.programme_name} miles, one way</span></div>
      <dl className="bg-facts">
        <div><dt>Route</dt><dd>{cityOf(s.origin)} → {cityOf(s.dest)}</dd></div>
        <div><dt>Date</dt><dd>{dateShort(s.date)}</dd></div>
        <div><dt>You pay</dt><dd>{pooled ? 'Points from several cards' : `${fmt(pay.pointsUsed)} points from ${pay.cardName}`}</dd></div>
      </dl>
      <Link className="a-cta" href={checkoutHref(s.id, 1)}>See how to pay</Link>
    </section>
  );
}
