'use client';

// Trips you could take with the points in your wallet: the cheapest seat your cards can pay for, per region, from your home airport.
import { cityPhoto } from '@/lib/photos';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import FlightLoader from '@/components/FlightLoader';
import { SeenStamp } from '@/components/app/ui';
import { type SeatView, searchSeats } from '@/lib/app/api';
import { addDaysIso, dateShort, fmt, todayIso } from '@/lib/app/format';
import { programmeName } from '@/lib/app/catalog';
import { useWallet } from '@/lib/app/wallet';
import { cityOf, expandDest, GROUPS } from '@/lib/airports';

const REGIONS = GROUPS.filter(g => ['europe', 'middle-east', 'southeast-asia', 'east-asia', 'north-america', 'oceania'].includes(g.id));

type Idea = { region: string; seat: SeatView };
// a photo only where we have one for the region

export default function IdeasClient() {
  const w = useWallet();
  const home = w.profile.airport || 'BOM';
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [pending, setPending] = useState(REGIONS.length);

  const from = addDaysIso(14, todayIso());
  const to = addDaysIso(150, todayIso());

  useEffect(() => {
    if (!w.ready || !w.hasCards) return;
    let live = true;
    // A cold region can take 30 s, so each one lands as soon as it is ready.
    REGIONS.forEach(g =>
      searchSeats({ origins: [home], dests: expandDest(g.id), from, to, cabin: 'business', travellers: 1, holdings: w.holdings, filters: { reachableOnly: true }, limit: 20 }).then(r => {
        if (!live) return;
        setPending(p => p - 1);
        if (!r.ok) return;
        const seat = r.data.rows.filter(s => s.reach?.best).sort((a, b) => (a.reach?.best?.pointsUsed ?? 0) - (b.reach?.best?.pointsUsed ?? 0))[0];
        if (seat) setIdeas(list => [...list, { region: g.id, seat }].sort((a, b) => (a.seat.reach?.best?.pointsUsed ?? 0) - (b.seat.reach?.best?.pointsUsed ?? 0)));
      }),
    );
    return () => { live = false; };
    // holdings identity changes only when cards or balances change
  }, [w.ready, w.hasCards, w.holdings, home, from, to]);

  if (!w.ready) return <FlightLoader label="Loading your wallet" />;
  if (!w.hasCards) {
    return (
      <div className="a-gl a-dashed" style={{ alignItems: 'flex-start' }}>
        <b>Add your cards to see trips you can take.</b>
        <span className="a-mu">We match your points to seats from {cityOf(home)}.</span>
        <Link className="a-cta" href="/wallet">Open Wallet</Link>
      </div>
    );
  }

  return (
    <div className="a-c" style={{ gap: 16 }}>
      <span className="a-mu">Business seats from {cityOf(home)} in the next five months, one person. Cheapest one your cards can pay for, per region.</span>
      {pending > 0 && <FlightLoader size="sm" label={`Checking ${pending} ${pending === 1 ? 'region' : 'regions'}`} />}
      <div className="a-g3">
        {ideas.map(({ region, seat: s }) => (
          <Link key={region} className="a-gl a-home-card" href={`/flights?${new URLSearchParams({ o: s.origin, d: region, from, to, cabin: 'business', n: '1', reach: '1' })}`}>
            {cityPhoto(s.dest) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="idea-img" src={`/cities/${cityPhoto(s.dest)}-sm.webp`} alt="" loading="lazy" decoding="async" />
            )}
            <span className="a-cap">{GROUPS.find(g => g.id === region)?.label}</span>
            <b className="a-t">{cityOf(s.origin)} → {cityOf(s.dest)}</b>
            <div className="a-big">{fmt(s.reach?.best?.pointsUsed ?? 0)} <small>card pts</small></div>
            <span className="a-mu">{dateShort(s.date)} · {programmeName(s.programme_id)}{s.reach?.best ? ` · via ${s.reach.best.cardName}` : ''}</span>
            <SeenStamp iso={s.updated_at} />
          </Link>
        ))}
      </div>
      {pending === 0 && ideas.length === 0 && <div className="a-gl a-dashed"><span className="a-mu">We saw no seat your cards can pay for yet. Add more points in Wallet or search other dates.</span></div>}
    </div>
  );
}
