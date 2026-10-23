'use client';

import Link from 'next/link';
import Select from '@/components/Select';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataFoot, Note, SeenStamp, Tag } from '@/components/app/ui';
import Ic from '@/components/app/Icons';
import { SeatCard, SeatTable, payable } from '@/components/app/flights/seat-bits';
import SeatFilters, { applyFilters, EMPTY, type Filters } from '@/components/app/flights/seat-filters';
import FlightLoader from '@/components/FlightLoader';
import DestinationGallery from '@/components/DestinationGallery';
import DatePicker from '@/components/DatePicker';
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
const PAGE = 24;
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
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const [state, setState] = useState<State>({ status: 'idle' });
  const [route, setRoute] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [watch, setWatch] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'signin' | 'error'; error?: string }>({ kind: 'idle' });
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const token = useRef(0);
  const ran = useRef(false);

  // defaults that depend on the saved wallet: derived, so nothing is written back into the form
  const originStr = o ?? (wallet.profile.airport || 'BOM');
  const reach = wallet.hasCards && (reachPref ?? true);

  const run = async (destOverride?: string) => {
    const origins = originStr.split(',').map(s => s.trim().toUpperCase()).filter(s => IATA.test(s)).slice(0, 6);
    const dd = destOverride ?? d;
    const dests = expandDest(dd).slice(0, 40);
    if (!origins.length || !dests.length || !from || !to || to < from) {
      setState({ status: 'error', error: 'Check the dates: the end date must be on or after the start date.' });
      return;
    }
    const maxPoints = Number(max.replace(/,/g, ''));
    const sub: Submitted = { origins, d: dd, from, to, cabin, n, reachOnly: reach };
    const qs = new URLSearchParams({ o: origins.join(','), d: dd, from, to, cabin, n: String(n) });
    if (wallet.hasCards) qs.set('reach', reach ? '1' : '0');
    if (direct) qs.set('direct', '1');
    if (prog) qs.set('p', prog);
    if (maxPoints > 0) qs.set('max', String(Math.round(maxPoints)));
    router.replace(`/flights?${qs}`, { scroll: false });

    const mine = ++token.current;
    setState({ status: 'loading' });
    setRoute(null);
    setPicks([]);
    setFilters(EMPTY);
    setShown(PAGE);
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

  // Nothing found in the chosen cabin: look at the other cabins for the same trip, so the person sees what does exist instead of a dead end.
  const [alts, setAlts] = useState<{ cabin: Cabin; rows: SeatView[] }[] | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!done || allRows.length > 0) { setAlts(null); return; }
    setAlts(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    let live = true;
    (async () => {
      const out: { cabin: Cabin; rows: SeatView[] }[] = [];
      for (const c of (['business', 'premium_economy', 'economy', 'first'] as Cabin[]).filter(x => x !== done.sub.cabin)) {
        const r = await searchSeats({
          origins: done.sub.origins, dests: expandDest(done.sub.d).slice(0, 40), from: done.sub.from, to: done.sub.to, cabin: c, travellers: done.sub.n,
          holdings: wallet.hasCards ? wallet.holdings : undefined, filters: { directOnly: direct || undefined, programmes: prog ? [prog] : undefined }, limit: 12,
        });
        if (!live) return;
        if (r.ok && r.data.rows.length) out.push({ cabin: c, rows: r.data.rows });
      }
      if (live) setAlts(out);
    })();
    return () => { live = false; };
    // the other cabins are searched once per finished search that found nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

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
  const routeRows = useMemo(() => (route ? allRows.filter(r => `${r.origin}-${r.dest}` === route) : allRows), [allRows, route]);
  const rows = useMemo(() => applyFilters(routeRows, filters), [routeRows, filters]);
  const fareNum = Number(fare.replace(/,/g, '')) || null;

  const pick = (id: string) => setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p));
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
              <Select aria-label="From" value={originStr} onChange={e => setO(e.target.value)}>
                {!INDIAN.includes(originStr) && !OTHER.some(a => a.i === originStr) && <option value={originStr}>{originStr}</option>}
                <optgroup label="India">{INDIAN.map(i => <option key={i} value={i}>{label(i)}</option>)}</optgroup>
                <optgroup label="Other airports">{OTHER.map(a => <option key={a.i} value={a.i}>{label(a.i)}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label="To">
              <Select aria-label="To" value={d} onChange={e => setD(e.target.value)}>
                <optgroup label="Regions">{GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</optgroup>
                <optgroup label="Airports">{AIRPORTS.map(a => <option key={a.i} value={a.i}>{label(a.i)}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label="Earliest date"><DatePicker ariaLabel="Earliest date" value={from} max={to || undefined} onChange={setFrom} /></Field>
            <Field label="Latest date"><DatePicker ariaLabel="Latest date" value={to} min={from || undefined} onChange={setTo} /></Field>
          </div>
          <details className="fx-opts" open={cabin !== 'business' || n !== 1 || !!prog || !!max}>
            <summary>More options <span>{CABIN_LABEL[cabin]} · {n} {n === 1 ? 'traveller' : 'travellers'}{prog ? ' · ' + (AIRLINE_PROGRAMMES.find(p => p.id === prog)?.name ?? '') : ''}{max ? ' · up to ' + max + ' pts' : ''}</span></summary>
          <div className="a-flights-fields">
            <Field label="Cabin">
              <Select aria-label="Cabin" value={cabin} onChange={e => setCabin(e.target.value as Cabin)}>{CABINS.map(c => <option key={c} value={c}>{CABIN_LABEL[c]}</option>)}</Select>
            </Field>
            <Field label="Travellers">
              <Select aria-label="Travellers" value={n} onChange={e => setN(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => <option key={i} value={i}>{i}</option>)}</Select>
            </Field>
            <Field label="Programme">
              <Select aria-label="Programme" value={prog} onChange={e => setProg(e.target.value)}>
                <option value="">All programmes</option>
                {AIRLINE_PROGRAMMES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Max points">
              <input aria-label="Max points" inputMode="numeric" placeholder="No limit" value={max} onChange={e => setMax(e.target.value.replace(/[^\d,]/g, ''))} />
            </Field>
          </div>
          </details>
          {outOfRange && <p className="a-cap">Search covers the next {MAX_DAYS_OUT} days. Your end date is later, so we will cut it short.</p>}
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
          <div className="a-gl" aria-busy="true"><FlightLoader label="Finding seats. A new route can take up to 30 seconds." /></div>
        )}
        {state.status === 'error' && <Note kind="danger" title="We could not load seats.">{state.error}</Note>}
        {state.status === 'idle' && (
          <section className="fx-dest" aria-labelledby="fx-dest-h">
            <h2 id="fx-dest-h">Not sure where? Start here.</h2>
            <DestinationGallery onPick={c => { setD(c.d); void run(c.d); }} />
            <div className="fx-regions">
              <span>Or a whole region</span>
              {GROUPS.slice(0, 8).map(g => <button key={g.id} type="button" className="fx-r" onClick={() => { setD(g.id); void run(g.id); }}>{g.label}</button>)}
            </div>
          </section>
        )}

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
                      <span className="a-mu">We found no award seats listed for {label(ds[0])}, on any date. Try a nearby airport:</span>
                      <span className="a-r a-rw">{near.map(c => <button key={c} type="button" className="cm-btn cm-btn--sm" onClick={() => { setD(c); void run(c); }}>{label(c)}</button>)}</span>
                    </>
                  );
                })()}
              </div>
            )}

            {allRows.length === 0 && (alts === null
              ? <p className="a-mu" role="status">Checking the other cabins for the same trip</p>
              : alts.length > 0 && (
                <section className="a-c" aria-label="Seats in other cabins">
                  <h2 className="a-sec">Nothing in {CABIN_LABEL[done.sub.cabin]}. These seats are open in other cabins.</h2>
                  {alts.map(a => (
                    <div className="a-c" key={a.cabin}>
                      <span className="a-cap">{CABIN_LABEL[a.cabin]} · {fmt(a.rows.length)} {a.rows.length === 1 ? 'seat' : 'seats'}, cheapest first</span>
                      <div className="sc-grid">
                        {a.rows.slice(0, 6).map(r => <SeatCard key={r.id} r={r} n={done.sub.n} fare={fareNum} selected={false} picked={false} locked onPick={pick} />)}
                      </div>
                    </div>
                  ))}
                </section>
              ))}

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
                      <button key={k} type="button" aria-pressed={route === k} className={`a-gl a-flights-route${route === k ? ' a-sel' : ''}${bad ? ' a-u' : ''}`} onClick={() => { setRoute(route === k ? null : k); setShown(PAGE); }}>
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

            {routeRows.length > 0 && (
              <>
                <SeatFilters rows={routeRows} f={filters} setF={f => { setFilters(f); setShown(PAGE); }} shown={rows.length} />
                <div className="a-r a-rw">
                  <span className="a-cap a-g">Pick up to 3 to compare</span>
                  {comparable ? (
                    <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href={`/flights/compare?ids=${picks.map(encodeURIComponent).join(',')}&n=${done.sub.n}`}>Compare {picks.length}</Link>
                  ) : (
                    <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled>Compare {picks.length ? picks.length : ''}</button>
                  )}
                  <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={!watchRoute || watch.kind === 'busy'} onClick={doWatch}>Watch this route</button>
                  <label className="a-flights-fare">
                    <span className="a-cap">Cash fare per person (₹), to compare points with paying cash</span>
                    <span className="cm-control"><input inputMode="numeric" placeholder="Optional" value={fare} onChange={e => setFare(e.target.value.replace(/[^\d,]/g, ''))} /></span>
                  </label>
                </div>
                {!watchRoute && <span className="a-mu">Choose one route above to watch it.</span>}
                {watch.kind === 'ok' && <Note kind="success" title="Route watched.">We will email you when a matching seat shows up. <Link href="/alerts">See your alerts</Link></Note>}
                {watch.kind === 'signin' && <Note kind="info" title="Sign in to watch a route.">Search works without an account, alerts need one. <Link href="/signin">Sign in</Link></Note>}
                {watch.kind === 'error' && <Note kind="danger" title="We could not watch that route.">{watch.error}</Note>}

                <div className="sc-head">
                  <span className="a-cap">{done.sub.reachOnly ? "Seats your cards can pay for" : "All seats"}</span>
                  <div className="seg" role="group" aria-label="View">
                    <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>Cards</button>
                    <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
                  </div>
                </div>

                {view === "cards" ? (
                  <div className="sc-grid">
                    {rows.slice(0, shown).map((r, i) => (
                      <SeatCard key={r.id} r={r} n={done.sub.n} fare={fareNum} selected={picks.length ? picks.includes(r.id) : i === 0} picked={picks.includes(r.id)} locked={picks.length >= 3} onPick={pick} />
                    ))}
                  </div>
                ) : (
                  <div className="a-gl a-flights-all"><SeatTable rows={rows.slice(0, shown)} n={done.sub.n} fare={fareNum} picks={picks} onPick={pick} /></div>
                )}
                {rows.length > shown && <button type="button" className="cm-btn cm-btn--secondary a-pb" style={{ alignSelf: "center" }} onClick={() => setShown(x => x + PAGE)}>Show more ({fmt(rows.length - shown)} left)</button>}
                {rows.length === 0 && <p className="a-mu">No seats match these filters. Use Reset all above.</p>}
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
    <div className="cm-field">
      <span className="cm-field__label">{text}</span>
      <span className="cm-control">{children}</span>
    </div>
  );
}
