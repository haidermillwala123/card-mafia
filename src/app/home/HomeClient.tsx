'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import BoardingPass from '@/components/BoardingPass';
import Ic from '@/components/app/Icons';
import { DataFoot, SeenStamp, Tag } from '@/components/app/ui';
import { searchSeats, type SearchResponse, type SeatView } from '@/lib/app/api';
import { programmeName } from '@/lib/app/catalog';
import { addDaysIso, CABIN_LABEL, dateShort, fmt, monthLabel, monthRange, todayIso } from '@/lib/app/format';
import { askNext, type Parsed, parseTrip, type Question, upcomingMonths } from '@/lib/app/parse';
import { listTrips, type TripRow } from '@/lib/app/trips';
import { useWallet } from '@/lib/app/wallet';
import { cityOf, expandDest } from '@/lib/airports';
import CardsHub from './CardsHub';
import Tour from '@/components/Tour';
import './home.css';

const QUICK: [string, string, string][] = [
  ['/cards/recommend', 'Best card for you', 'From what you spend each month'],
  ['/trips/ideas', 'Trips you can take', 'Seats your points can pay for'],
  ['/earn/calculator', 'Points calculator', 'What your monthly spend earns'],
  ['/transfers', 'Transfers', 'Ratios, caps and indirect routes'],
];

const CITIES = [
  { id: 'dubai', name: 'Dubai', sub: 'Skyline and desert', d: 'DXB' },
  { id: 'newyork', name: 'New York', sub: 'Manhattan', d: 'JFK' },
  { id: 'london', name: 'London', sub: 'Tower Bridge', d: 'LHR' },
  { id: 'lisbon', name: 'Lisbon', sub: 'Hills and tiles', d: 'LIS' },
  { id: 'japan', name: 'Japan', sub: 'Fuji and Tokyo', d: 'HND' },
];
const SV = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ACTIONS: [string, string, ReactNode][] = [
  ['/flights', 'Search', <svg key="a" {...SV}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>],
  ['/plan', 'Plan', <svg key="b" {...SV}><path d="M5 19c0-5 7-3 7-8s-6-4-6-7" /><circle cx="5" cy="19" r="1.6" /><circle cx="18" cy="5" r="1.6" /><path d="M12 11c0 5 6 3 6 8" /></svg>],
  ['/cards/recommend', 'Best card', <svg key="c" {...SV}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M7 15h3" /></svg>],
  ['/cards/statement', 'Statement', <svg key="d" {...SV}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>],
  ['/alerts', 'Alerts', <svg key="e" {...SV}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>],
];
const EXAMPLES = ['DEL to Tokyo, business, 1 person', 'BLR to Doha, 2 people', 'BOM to Europe, first class'];
const STRIP_REGIONS = ['middle-east', 'europe', 'southeast-asia'];
const STATUS_LABEL: Record<string, string> = { exploring: 'Exploring', transferring: 'Transferring', booked: 'Booked' };

const planHref = (t: Parsed) => {
  const r = monthRange(t.ym as string);
  return `/plan?${new URLSearchParams({ o: t.o, d: t.d as string, from: r.from, to: r.to, cabin: t.cabin, n: String(t.n) })}`;
};

type Strip = { rows: { seat: SeatView; region: string }[]; meta: SearchResponse['meta'] | null; rulesCheckedOn: string | null; error: string | null };

export default function HomeClient() {
  const router = useRouter();
  const w = useWallet();
  const home = w.profile.airport || 'BOM';

  const [hour, setHour] = useState<number | null>(null);
  // the greeting follows the clock, which only the browser knows, so it is set after the first paint
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHour(new Date().getHours()); }, []);
  const greeting = hour === null ? 'Hello' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const [text, setText] = useState('');
  const [trip, setTrip] = useState<Parsed | null>(null);
  const [q, setQ] = useState<Question | null>(null);

  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [strip, setStrip] = useState<Strip | null>(null);

  const userId = w.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    listTrips().then(r => live && setTrips(r));
    return () => {
      live = false;
    };
  }, [userId]);

  const nextYm = upcomingMonths(2)[1];
  useEffect(() => {
    if (!w.ready || !w.hasCards) return;
    let live = true;
    const { from, to } = monthRange(nextYm);
    // Each region lands as soon as it is ready: a cold region can take 30 s, and the others should not wait for it.
    const got = new Map<string, { seat: SeatView | undefined; meta: SearchResponse['meta']; rules: string } | string>();
    STRIP_REGIONS.forEach(id =>
      searchSeats({ origins: [home], dests: expandDest(id), from, to, cabin: 'business', travellers: 1, holdings: w.hasCards ? w.holdings : undefined, filters: w.hasCards ? { reachableOnly: true } : {}, limit: 20 }).then(r => {
        if (!live) return;
        if (!r.ok) got.set(id, r.error);
        else {
          const best = w.hasCards
            ? r.data.rows.filter(s => s.reach?.best).sort((a, b) => (a.reach?.best?.pointsUsed ?? 0) - (b.reach?.best?.pointsUsed ?? 0))[0]
            : [...r.data.rows].sort((a, b) => a.miles - b.miles)[0];
          got.set(id, { seat: best, meta: r.data.meta, rules: r.data.rulesCheckedOn });
        }
        const rows: Strip['rows'] = [];
        let meta: Strip['meta'] = null;
        let rulesCheckedOn: string | null = null;
        let failed: string | null = null;
        for (const rid of STRIP_REGIONS) {
          const g = got.get(rid);
          if (typeof g === 'string') failed = g;
          else if (g) {
            meta = meta ?? g.meta;
            rulesCheckedOn = rulesCheckedOn ?? g.rules;
            if (g.seat) rows.push({ seat: g.seat, region: rid });
          }
        }
        if (rows.length || got.size === STRIP_REGIONS.length) setStrip({ rows, meta, rulesCheckedOn, error: !rows.length ? failed : null });
      }),
    );
    return () => {
      live = false;
    };
    // holdings identity changes only when cards or balances change
  }, [w.ready, w.hasCards, w.holdings, home, nextYm]);

  const submit = (value = text) => {
    const out = parseTrip(value, home);
    setTrip(out.trip);
    setQ(out.question);
    if (!out.question) router.push(planHref(out.trip));
  };
  const answer = (o: Question['options'][number]) => {
    if (!trip) return;
    const next = { ...trip, ...o.patch };
    setTrip(next);
    const more = o.go ? null : askNext(next);
    setQ(more);
    if (!more) router.push(planHref(next));
  };

  const points = w.profile.cardIds.reduce((s, id) => s + (w.profile.balances[id] ?? 0), 0);
  // the soonest trip that has not passed, else the one touched last
  const latest = trips ? ([...trips].filter(t => t.depart_from && t.depart_from >= todayIso()).sort((a, b) => a.depart_from!.localeCompare(b.depart_from!))[0] ?? trips[0]) : undefined;

  return (
    <div className="a-pg">
      <Tour />
      <section className="hm-hero" aria-label="Plan a trip">
        <div className="hm-top">
          <div>
            <small>{greeting}</small>
            <h1>{w.profile.first.trim() ? `Hi ${w.profile.first.trim()}, where to?` : 'Where to next?'}</h1>
          </div>
          {w.hasCards && <Link className="hm-pts" href="/wallet"><b>{fmt(points)}</b><span>points in your wallet</span></Link>}
        </div>
        <form className="hm-search" onSubmit={e => { e.preventDefault(); submit(); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Try BOM to London, December" aria-label="Describe your trip" maxLength={200} />
          <button type="submit">Search</button>
        </form>
        {q && (
          <div className="hm-q" role="group" aria-label="One more question">
            <b>{q.text}</b>
            <div>{q.options.map(o => <button key={o.label} type="button" onClick={() => answer(o)}>{o.label}</button>)}</div>
          </div>
        )}
        <div className="hm-try">
          {EXAMPLES.map(x => <button key={x} type="button" onClick={() => { setText(x); submit(x); }}>{x}</button>)}
        </div>
        {!w.user && <Link className="hm-signin" href="/signin">Sign in to save trips and watch routes</Link>}
        <nav className="hm-actions" aria-label="Quick actions">
          {ACTIONS.map(([href, label, icon]) => <Link key={href} className="hm-act" href={href}><i>{icon}</i>{label}</Link>)}
        </nav>
      </section>

      <div className="a-body">
        {latest && latest.origin && latest.destination && (
          <section className="hm-next" aria-label="Your next trip">
            <h2>Your next trip</h2>
            <BoardingPass
              href="/trips" from={latest.origin} to={latest.destination} fromCity={cityOf(latest.origin)} toCity={cityOf(latest.destination)}
              badge={STATUS_LABEL[latest.status] ?? latest.status}
              fields={[
                { label: 'Date', value: latest.depart_from ? dateShort(latest.depart_from) : 'Dates open' },
                { label: 'Cabin', value: CABIN_LABEL[latest.cabin] ?? latest.cabin },
                { label: 'Travellers', value: latest.travellers },
                ...(latest.parsed?.seat ? [{ label: 'Points each', value: fmt(latest.parsed.seat.points) }] : []),
              ]}
            />
          </section>
        )}
        <div style={{ marginTop: 8 }}>
          <div className="a-gl">
            <h2 className="a-sec">What can my points buy?</h2>
            {!w.ready ? (
              <>
                <div className="a-sk" style={{ width: '80%' }} />
                <div className="a-sk" style={{ width: '60%' }} />
              </>
            ) : !w.hasCards ? (
              <>
                <span className="a-mu">No cards yet. Add your cards and we show seats you can pay for from {cityOf(home)}.</span>
                <Link className="a-cta" style={{ alignSelf: 'flex-start' }} href="/wallet">
                  Add your cards
                  <span className="a-ar">
                    <Ic name="arrow" />
                  </span>
                </Link>
              </>
            ) : !strip ? (
              <>
                <span className="a-mu">Looking at {monthLabel(nextYm)} from {cityOf(home)}.</span>
                <div className="a-sk" style={{ width: '80%' }} />
                <div className="a-sk" style={{ width: '70%' }} />
                <div className="a-sk" style={{ width: '60%' }} />
              </>
            ) : strip.error ? (
              <span className="a-home-err" role="alert">
                {strip.error}
              </span>
            ) : strip.rows.length === 0 ? (
              <span className="a-mu">We saw no seat in {monthLabel(nextYm)} that your cards can pay for from {cityOf(home)}. Try a plan with other dates.</span>
            ) : (
              <>
                <span className="a-mu">
                  Business seats we saw for {monthLabel(nextYm)} from {cityOf(home)}, one person, cheapest per region.
                </span>
                {strip.rows.map(({ seat: s }) => (
                  <div className="a-row" key={s.id}>
                    <div className="a-g a-home-row-main">
                      <b>
                        {cityOf(s.origin)} → {cityOf(s.dest)}
                      </b>
                      <div className="a-mu">
                        {dateShort(s.date)} · {programmeName(s.programme_id)}
                      </div>
                      <SeenStamp iso={s.updated_at} />
                    </div>
                    <b className="a-mono">{fmt(s.reach?.best?.pointsUsed ?? 0)} pts</b>
                    <Tag kind="best">Reachable</Tag>
                  </div>
                ))}
                <Link className="cm-btn cm-btn--ghost" style={{ alignSelf: 'flex-start' }} href={`/flights?${new URLSearchParams({ o: home, d: 'europe', ...monthRange(nextYm), cabin: 'business', n: '1', reach: '1' })}`}>
                  See all seats
                  <Ic name="arrow" />
                </Link>
              </>
            )}
          </div>

        </div>

        <section className="hm-dest" aria-label="Where to fly">
          <div className="hm-dh"><h2>Where to fly</h2><Link href="/flights">See every route</Link></div>
          <div className="hm-tiles">
            {CITIES.map(c => (
              <Link key={c.id} className="hm-tile" href={`/flights?${new URLSearchParams({ o: home, d: c.d, from: addDaysIso(14, todayIso()), to: addDaysIso(150, todayIso()), cabin: "business", n: "1" })}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/cities/${c.id}-sm.webp`} alt="" loading={c.id === "dubai" ? "eager" : "lazy"} decoding="async" />
                <b>{c.name}</b>
                <small>{c.sub}</small>
              </Link>
            ))}
          </div>
          <Link className="hm-credit" href="/credits">Photos from Wikimedia Commons</Link>
        </section>

        {w.ready && <CardsHub cardIds={w.profile.cardIds} />}

        <nav className="hm-quick" aria-label="More tools">
          <span>Also:</span>
          {QUICK.map(([href, title]) => <Link key={href} href={href}>{title}</Link>)}
        </nav>

        <DataFoot />
      </div>
    </div>
  );
}
