'use client';

import Link from 'next/link';
import Select from '@/components/Select';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataFoot, Note, SeenStamp, Tag } from '@/components/app/ui';
import Ic from '@/components/app/Icons';
import { SeatCard, SeatTable, payable } from '@/components/app/flights/seat-bits';
import { createWatch } from '@/lib/app/alerts';
import { type Cabin, getQuota, type QuotaResponse, type SearchResponse, searchSeats, type SeatView } from '@/lib/app/api';
import { ageLabel, CABIN_LABEL, dateShort, fmt, monthLabel, addDaysIso, todayIso } from '@/lib/app/format';
import programmesJson from '@/data/programmes.json';
import { useWallet } from '@/lib/app/wallet';
import { AIRPORTS, expandDest, GROUPS, INDIAN, label, NEAR } from '@/lib/airports';
import { MAX_DAYS_OUT } from '@/lib/seats/sources';
import './flights.css';

export type InitialParams = { o: string | null; d: string | null; from: string; to: string; cabin: string; n: string; reach: string | null; direct: boolean; p: string; max: string };
type Submitted = { origins: string[]; d: string; from: string; to: string; cabin: Cabin; n: number; reachOnly: boolean };
type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: string } | { status: 'done'; res: SearchResponse; sub: Submitted };

const CABINS = Object.keys(CABIN_LABEL) as Cabin[];
const AIRLINE_PROGRAMMES = (programmesJson.programmes as { id: string; name: string; kind: string }[]).filter(p => p.kind === 'airline').sort((a, b) => a.name.localeCompare(b.name));
const OTHER = AIRPORTS.filter(a => !INDIAN.includes(a.i));
const PAGE = 50;
const PHONE_PAGE = 30;
const IATA = /^[A-Z]{3}$/;

export default function FlightsClient({ initial }: { initial: InitialParams }) {
  const router = useRouter();
  const wallet = useWallet();
  const [o, setO] = useState<string | null>(initial.o);
  const [d, setD] = useState(initial.d ?? 'europe');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [cabin, setCabin] = useState<Cabin>(CABINS.includes(initial.cabin as Cabin) ? (initial.cabin as Cabin) : 'business');
  const [n, setN] = useState(Math.min(9, Math.max(1, Number(initial.n) || 1)));
  const [prog, setProg] = useState(initial.p);
  const [direct, setDirect] = useState(initial.direct);
  const [max, setMax] = useState(initial.max);
  const [reachPref, setReachPref] = useState<boolean | null>(initial.reach === null ? null : initial.reach === '1');
  const [fare, setFare] = useState('');

  const [state, setState] = useState<State>({ status: 'idle' });
  const [route, setRoute] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [shownPhone, setShownPhone] = useState(PHONE_PAGE);
  const [watch, setWatch] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'signin' | 'error'; error?: string }>({ kind: 'idle' });
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const token = useRef(0);
  const ran = useRef(false);

  // defaults that depend on the saved wallet: derived, so nothing is written back into the form
  const originStr = o ?? (wallet.profile.airport || 'BOM');
  const reach = wallet.hasCards && (reachPref ?? true);

  const run = async () => {
    const origins = originStr.split(',').map(s => s.trim().toUpperCase()).filter(s => IATA.test(s)).slice(0, 6);
    const dests = expandDest(d).slice(0, 40);
    if (!origins.length || !dests.length || !from || !to || to < from) {
      setState({ status: 'error', error: 'Check the dates: the end date must be on or after the start date.' });
      return;
    }
    const maxPoints = Number(max.replace(/,/g, ''));
    const sub: Submitted = { origins, d, from, to, cabin, n, reachOnly: reach };
    const qs = new URLSearchParams({ o: origins.join(','), d, from, to, cabin, n: String(n) });
    if (wallet.hasCards) qs.set('reach', reach ? '1' : '0');
    if (direct) qs.set('direct', '1');
    if (prog) qs.set('p', prog);
    if (maxPoints > 0) qs.set('max', String(Math.round(maxPoints)));
    router.replace(`/flights?${qs}`, { scroll: false });

    const mine = ++token.current;
    setState({ status: 'loading' });
    setRoute(null);
    setPicks([]);
    setShown(PAGE);
    setShownPhone(PHONE_PAGE);
    setWatch({ kind: 'idle' });
    const r = await searchSeats({
      origins, dests, from, to, cabin, travellers: n,
      holdings: wallet.hasCards ? wallet.holdings : undefined,
      filters: { reachableOnly: reach || undefined, directOnly: direct || undefined, maxPoints: maxPoints > 0 ? Math.round(maxPoints) : undefined, programmes: prog ? [prog] : undefined },
      limit: 500,
    });
    if (mine !== token.current) return; // a newer search is already running
    setState(r.ok ? { status: 'done', res: r.data, sub } : { status: 'error', error: r.error });
  };

  // A shared link with a destination searches once, after the saved wallet has been read so reach is right.
  useEffect(() => {
    if (!wallet.ready || ran.current || !initial.d) return;
    ran.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.ready]);

  useEffect(() => {
    let live = true;
    getQuota().then(r => live && r.ok && setQuota(r.data));
    return () => {
      live = false;
    };
  }, []);

  const done = state.status === 'done' ? state : null;
  const allRows = useMemo(() => done?.res.rows ?? [], [done]);

  // one entry per origin and destination pair, cheapest first
  const routes = useMemo(() => {
    const m = new Map<string, SeatView>();
    for (const r of allRows) {
      const k = `${r.origin}-${r.dest}`;
      const cur = m.get(k);
      if (!cur || r.miles < cur.miles) m.set(k, r);
    }
    return [...m.entries()].sort((a, b) => a[1].miles - b[1].miles);
  }, [allRows]);

  const activeRoute = route ?? (routes.length === 1 ? routes[0][0] : null);
  const rows = useMemo(() => (route ? allRows.filter(r => `${r.origin}-${r.dest}` === route) : allRows), [allRows, route]);
  const fareNum = Number(fare.replace(/,/g, '')) || null;

  const pick = (id: string) => setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p));
  const top = rows.slice(0, 3);
  const dest = d === '' ? '' : GROUPS.find(g => g.id === d)?.label ?? d;

  // programme x month grid for the chosen route
  const grid = useMemo(() => {
    if (!activeRoute) return null;
    const rs = allRows.filter(r => `${r.origin}-${r.dest}` === activeRoute);
    const months = [...new Set(rs.map(r => r.date.slice(0, 7)))].sort();
    const by = new Map<string, Map<string, number>>();
    for (const r of rs) {
      const row = by.get(r.programme_name) ?? new Map<string, number>();
      const m = r.date.slice(0, 7);
      row.set(m, Math.min(row.get(m) ?? Infinity, r.miles));
      by.set(r.programme_name, row);
    }
    const lines = [...by.entries()].sort((a, b) => Math.min(...a[1].values()) - Math.min(...b[1].values()));
    return { months, lines, lowest: Math.min(...rs.map(r => r.miles)) };
  }, [allRows, activeRoute]);

  const watchRoute = activeRoute?.split('-') ?? null;
  const doWatch = async () => {
    if (!watchRoute || !done) return;
    setWatch({ kind: 'busy' });
    const r = await createWatch({ origin: watchRoute[0], dest: watchRoute[1], from: done.sub.from, to: done.sub.to, cabin: done.sub.cabin, reachableOnly: done.sub.reachOnly, email: true });
    setWatch(r.ok ? { kind: 'ok' } : r.needsSignIn ? { kind: 'signin' } : { kind: 'error', error: r.error });
  };

  const meta = done?.res.meta;
  const outOfRange = to > addDaysIso(MAX_DAYS_OUT, todayIso());
  const q = meta ? { used: meta.quotaUsed, cap: meta.quotaCap } : quota ? { used: quota.used, cap: quota.cap } : null;
  const comparable = picks.length >= 2;

  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Search</span>
        <h1 className="a-hd a-sm">
          Every route from India.
          <br />
          <em>Cheapest first.</em>
        </h1>

        <form className="a-gl a-flights-bar" onSubmit={e => { e.preventDefault(); void run(); }} aria-label="Search seats">
          <div className="a-flights-fields">
            <Field label="From">
              <Select value={originStr} onChange={e => setO(e.target.value)}>
                {!INDIAN.includes(originStr) && !OTHER.some(a => a.i === originStr) && <option value={originStr}>{originStr}</option>}
                <optgroup label="India">{INDIAN.map(i => <option key={i} value={i}>{label(i)}</option>)}</optgroup>
                <optgroup label="Other airports">{OTHER.map(a => <option key={a.i} value={a.i}>{label(a.i)}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label="To">
              <Select value={d} onChange={e => setD(e.target.value)}>
                <optgroup label="Regions">{GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</optgroup>
                <optgroup label="Airports">{AIRPORTS.map(a => <option key={a.i} value={a.i}>{label(a.i)}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label="Earliest date"><input type="date" value={from} onChange={e => setFrom(e.target.value)} required /></Field>
            <Field label="Latest date"><input type="date" value={to} onChange={e => setTo(e.target.value)} required /></Field>
            <Field label="Cabin">
              <Select value={cabin} onChange={e => setCabin(e.target.value as Cabin)}>{CABINS.map(c => <option key={c} value={c}>{CABIN_LABEL[c]}</option>)}</Select>
            </Field>
            <Field label="Travellers">
              <Select value={n} onChange={e => setN(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => <option key={i} value={i}>{i}</option>)}</Select>
            </Field>
            <Field label="Programme">
              <Select value={prog} onChange={e => setProg(e.target.value)}>
                <option value="">All programmes</option>
                {AIRLINE_PROGRAMMES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Max points">
              <input inputMode="numeric" placeholder="No limit" value={max} onChange={e => setMax(e.target.value.replace(/[^\d,]/g, ''))} />
            </Field>
          </div>
          <p className="a-cap">Search covers the next {MAX_DAYS_OUT} days, about 11 months. {outOfRange ? 'Your end date is later, so we will cut it short.' : ''}</p>
          <div className="a-r a-rw">
            <label className="cm-check"><input type="checkbox" checked={direct} onChange={e => setDirect(e.target.checked)} /><span className="cm-check__text"><span className="cm-check__label">Direct only</span></span></label>
            <label className="cm-check">
              <input type="checkbox" checked={reach} disabled={!wallet.hasCards} onChange={e => setReachPref(e.target.checked)} />
              <span className="cm-check__text">
                <span className="cm-check__label">Reachable with my cards</span>
                {!wallet.hasCards && <span className="cm-check__desc">Add cards in <Link href="/wallet">Wallet</Link> to turn this on.</span>}
              </span>
            </label>
            <span className="a-g" />
            <button type="submit" className="a-cta" disabled={state.status === 'loading'}>
              {state.status === 'loading' ? 'Searching' : 'Search'}
              <span className="a-ar"><Ic name="search" /></span>
            </button>
          </div>
        </form>

        {state.status === 'loading' && (
          <div className="a-gl" aria-busy="true">
            <span className="a-cap">Loading seats</span>
            <div className="a-sk" /><div className="a-sk" style={{ width: '70%' }} /><div className="a-sk" /><div className="a-sk" style={{ width: '50%' }} />
          </div>
        )}
        {state.status === 'error' && <Note kind="danger" title="We could not load seats.">{state.error}</Note>}
        {state.status === 'idle' && <Note kind="info" title="Pick a route and press Search.">Results come from saved seat data and show how old each one is.</Note>}

        {done && meta && (
          <>
            <div className="a-r a-rw">
              <div className="a-c a-g">
                <span className="a-eb">
                  {done.sub.origins.join(', ')} → {activeRoute ? activeRoute.split('-')[1] : dest} · {CABIN_LABEL[done.sub.cabin]}
                </span>
                <h2 className="a-hd a-sm a-flights-h" aria-live="polite">
                  {rows.length === 0 ? 'No seats yet.' : `${fmt(rows.length)} ${rows.length === 1 ? 'seat' : 'seats'}${done.sub.reachOnly ? ' you can reach' : ' found'}.`}
                </h2>
              </div>
              {meta.pulledAt && <SeenStamp iso={meta.pulledAt} />}
              {q && <span className="a-cap">Live checks today: {fmt(q.used)}/{fmt(q.cap)}</span>}
            </div>

            {meta.clamped && <Note kind="info" title="Dates shortened.">We searched {dateShort(meta.from)} to {dateShort(meta.to)}. Search covers the next {MAX_DAYS_OUT} days only.</Note>}
            {meta.paused && <Note kind="warning" title="Live checks paused today">Showing saved results{meta.pulledAt ? ` from ${ageLabel(meta.pulledAt)} ago` : ''}.</Note>}
            {(meta.truncated || done.res.total > allRows.length) && (
              <Note kind="info" title="Showing part of the results.">We loaded {fmt(allRows.length)} of {fmt(done.res.total)} matching seats. Narrow the dates or add a filter to see the rest.</Note>
            )}

            {rows.length === 0 && allRows.length === 0 && (
              <div className="a-gl a-dashed">
                <b className="a-t">No seats match yet.</b>
                {(() => {
                  const ds = expandDest(done.sub.d);
                  const near = ds.length === 1 ? NEAR[ds[0]] : undefined;
                  if (!near) return <span className="a-mu">Widen the dates or untick Reachable.</span>;
                  return (
                    <>
                      <span className="a-mu">seats.aero has no award seats listed for {label(ds[0])}, on any date. Try a nearby airport, then press Search.</span>
                      <span className="a-r a-rw">{near.map(c => <button key={c} type="button" className="cm-btn cm-btn--sm" onClick={() => setD(c)}>{label(c)}</button>)}</span>
                    </>
                  );
                })()}
              </div>
            )}

            {routes.length > 1 && (
              <section className="a-c" aria-label="Routes">
                <div className="a-r a-rw">
                  <h2 className="a-sec a-g">Routes, cheapest first</h2>
                  {route && <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => { setRoute(null); setShown(PAGE); }}>Show all routes</button>}
                </div>
                <div className="a-g3">
                  {routes.map(([k, r]) => {
                    const bad = r.reach !== null && !payable(r);
                    return (
                      <button key={k} type="button" aria-pressed={route === k} className={`a-gl a-flights-route${route === k ? ' a-sel' : ''}${bad ? ' a-u' : ''}`} onClick={() => { setRoute(route === k ? null : k); setShown(PAGE); setShownPhone(PHONE_PAGE); }}>
                        <span className="a-cap">{r.origin} → {r.dest}</span>
                        <span className="a-big">{fmt(r.miles)} <small>pts</small></span>
                        <span className="a-mu">Cheapest in {monthLabel(r.date.slice(0, 7))} · {r.programme_name}</span>
                        {payable(r) ? <Tag kind="best">Reachable</Tag> : r.reach?.best && r.reach.best.shortBy > 0 ? <Tag kind="outline">{fmt(r.reach.best.shortBy)} short</Tag> : r.reach ? <Tag kind="outline">Not reachable</Tag> : r.direct ? <Tag kind="direct">Direct</Tag> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {grid && grid.lines.length > 0 && (
              <section className="a-gl" aria-label="Lowest points by programme and month">
                <div className="a-r"><h2 className="a-sec a-g">{activeRoute?.replace('-', ' → ')}: lowest points by month</h2></div>
                <div className="cm-table-wrap">
                  <table className="cm-table">
                    <thead><tr><th>Programme</th>{grid.months.map(m => <th key={m} className="is-num">{monthLabel(m)}</th>)}</tr></thead>
                    <tbody>
                      {grid.lines.map(([name, cells]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          {grid.months.map(m => {
                            const v = cells.get(m);
                            return <td key={m} className="is-num is-mono">{v === undefined ? '—' : v === grid.lowest ? <Tag kind="best" plain>{fmt(v)}</Tag> : fmt(v)}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <span className="a-mu">The mist tag is the lowest points price on this route. A dash means we saw no seat.</span>
              </section>
            )}

            {rows.length > 0 && (
              <>
                <div className="a-r a-rw">
                  <span className="a-cap a-g">Pick up to 3 to compare</span>
                  {comparable ? (
                    <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href={`/flights/compare?ids=${picks.map(encodeURIComponent).join(',')}&n=${done.sub.n}`}>Compare {picks.length}</Link>
                  ) : (
                    <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled>Compare {picks.length ? picks.length : ''}</button>
                  )}
                  <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={!watchRoute || watch.kind === 'busy'} onClick={doWatch}>Watch this route</button>
                  <label className="a-flights-fare">
                    <span className="a-cap">Cash fare per person (₹)</span>
                    <span className="cm-control"><input inputMode="numeric" placeholder="Optional" value={fare} onChange={e => setFare(e.target.value.replace(/[^\d,]/g, ''))} /></span>
                  </label>
                </div>
                {!watchRoute && <span className="a-mu">Choose one route above to watch it.</span>}
                {watch.kind === 'ok' && <Note kind="success" title="Route watched.">We will email you when a matching seat shows up. <Link href="/alerts">See your alerts</Link></Note>}
                {watch.kind === 'signin' && <Note kind="info" title="Sign in to watch a route.">Search works without an account, alerts need one. <Link href="/signin">Sign in</Link></Note>}
                {watch.kind === 'error' && <Note kind="danger" title="We could not watch that route.">{watch.error}</Note>}

                <div className="a-g3 a-flights-top">
                  {top.map((r, i) => (
                    <SeatCard key={r.id} r={r} n={done.sub.n} fare={fareNum} selected={picks.length ? picks.includes(r.id) : i === 0} picked={picks.includes(r.id)} locked={picks.length >= 3} onPick={pick} />
                  ))}
                </div>

                <div className="a-gl a-flights-all">
                  <div className="a-r"><h2 className="a-sec a-g">All rows</h2><Tag kind="outline" plain>Best for your cards first</Tag></div>
                  <SeatTable rows={rows.slice(0, shown)} n={done.sub.n} fare={fareNum} picks={picks} onPick={pick} />
                  {rows.length > shown && <button type="button" className="cm-btn cm-btn--secondary a-pb" style={{ alignSelf: 'center' }} onClick={() => setShown(s => s + PAGE)}>Show more ({fmt(rows.length - shown)} left)</button>}
                  <span className="cm-stamp cm-stamp--stale"><Ic name="clock" small />Rows older than a day fade and carry a warning.</span>
                </div>

                <div className="a-flights-phone">
                  {rows.slice(0, shownPhone).map((r, i) => (
                    <SeatCard key={r.id} r={r} n={done.sub.n} fare={fareNum} selected={picks.length ? picks.includes(r.id) : i === 0} picked={picks.includes(r.id)} locked={picks.length >= 3} onPick={pick} />
                  ))}
                  {rows.length > shownPhone && <button type="button" className="cm-btn cm-btn--secondary a-pb" onClick={() => setShownPhone(s => s + PHONE_PAGE)}>Show more ({fmt(rows.length - shownPhone)} left)</button>}
                </div>
              </>
            )}
          </>
        )}

        <DataFoot />
      </div>
    </div>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="cm-field">
      <span className="cm-field__label">{text}</span>
      <span className="cm-control">{children}</span>
    </label>
  );
}
