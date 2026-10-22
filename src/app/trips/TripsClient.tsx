'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BoardingPass from '@/components/BoardingPass';
import EmptyArt from '@/components/EmptyArt';
import { Note, SeenStamp, Tag } from '@/components/app/ui';
import { cityOf } from '@/lib/airports';
import { createWatch } from '@/lib/app/alerts';
import { recheckSeat, type Cabin } from '@/lib/app/api';
import { fmt, dateShort, CABIN_LABEL, todayIso } from '@/lib/app/format';
import { deleteTrip, listTrips, setTripStatus, type TripRow, type TripStatus } from '@/lib/app/trips';
import { useUser } from '@/lib/auth';
import './trips.css';

const STEPS: { id: TripStatus; label: string; hint: string }[] = [
  { id: 'exploring', label: 'Exploring', hint: 'Still looking' },
  { id: 'transferring', label: 'Transferring', hint: 'Moving points' },
  { id: 'booked', label: 'Booked', hint: 'Ticket issued' },
];
type Tab = 'upcoming' | 'booked' | 'all';

// Old or draft rows count as exploring.
const statusOf = (t: TripRow): TripStatus => (t.status === 'transferring' || t.status === 'booked' ? t.status : 'exploring');
const startOf = (t: TripRow) => t.depart_from ?? t.parsed?.seat?.date ?? null;

function dates(t: TripRow) {
  if (!t.depart_from) return null;
  return t.depart_to && t.depart_to !== t.depart_from ? `${dateShort(t.depart_from)} to ${dateShort(t.depart_to)}` : dateShort(t.depart_from);
}
function countdown(iso: string | null) {
  if (!iso) return null;
  const d = Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${todayIso()}T00:00:00Z`).getTime()) / 86400000);
  return d < 0 ? 'Date has passed' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
}

type Check = { state: 'busy' } | { state: 'ok' | 'gone' | 'error'; note: string };

export default function TripsClient() {
  const user = useUser();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [watched, setWatched] = useState<Record<string, 'ok' | 'error'>>({});

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setTrips(await listTrips());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch once the session is known; the state updates arrive after the awaited request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [user, load]);

  async function setStatus(t: TripRow, s: TripStatus) {
    setBusy(t.id);
    setErr('');
    const ok = await setTripStatus(t.id, s);
    setBusy(null);
    if (!ok) return setErr('We could not save that. Nothing was changed. Try again.');
    setTrips(list => list?.map(x => (x.id === t.id ? { ...x, status: s } : x)) ?? null);
  }

  async function remove(t: TripRow) {
    setBusy(t.id);
    setErr('');
    const ok = await deleteTrip(t.id);
    setBusy(null);
    setConfirm(null);
    if (!ok) return setErr('We could not delete that. Nothing was changed. Try again.');
    setTrips(list => list?.filter(x => x.id !== t.id) ?? null);
  }

  async function recheck(t: TripRow) {
    const id = t.parsed?.seat?.id;
    if (!id) return;
    setChecks(c => ({ ...c, [t.id]: { state: 'busy' } }));
    const r = await recheckSeat(id);
    setChecks(c => ({
      ...c,
      [t.id]: !r.ok ? { state: 'error', note: 'We could not check that seat. Try again.' } : r.data.gone ? { state: 'gone', note: r.data.note ?? 'This seat is gone. Search for a similar one.' } : { state: 'ok', note: r.data.refreshed ? 'Still there. We just refreshed it.' : r.data.note ?? 'Still showing in our latest data.' },
    }));
  }

  async function watch(t: TripRow) {
    if (!t.origin || !t.destination || !t.depart_from) return;
    const r = await createWatch({ origin: t.origin, dest: t.destination, from: t.depart_from, to: t.depart_to ?? t.depart_from, cabin: t.cabin as Cabin, reachableOnly: true, email: true });
    setWatched(w => ({ ...w, [t.id]: r.ok ? 'ok' : 'error' }));
  }

  const head = (
    <>
      <span className="a-eb">Your trips</span>
      <h1 className="a-hd a-sm">Where each plan stands.</h1>
    </>
  );

  const all = useMemo(() => [...(trips ?? [])].sort((a, b) => (startOf(a) ?? '9999').localeCompare(startOf(b) ?? '9999')), [trips]);
  const upcoming = all.filter(t => statusOf(t) !== 'booked');
  const booked = all.filter(t => statusOf(t) === 'booked');
  const next = upcoming.find(t => startOf(t) && startOf(t)! >= todayIso());

  if (user === undefined) return <div className="a-pg"><div className="a-body">{head}<p className="a-mu" role="status">Loading</p></div></div>;
  if (!user) {
    return (
      <div className="a-pg"><div className="a-body">
        {head}
        <Note kind="info" title="Trips need an email sign-in.">
          <Link href="/signin" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in</Link> to save plans and track them here. Search works without an account.
        </Note>
      </div></div>
    );
  }

  const shown = tab === 'upcoming' ? upcoming : tab === 'booked' ? booked : all;
  const tabs: { id: Tab; label: string; n: number }[] = [{ id: 'upcoming', label: 'Upcoming', n: upcoming.length }, { id: 'booked', label: 'Booked', n: booked.length }, { id: 'all', label: 'All', n: all.length }];

  return (
    <div className="a-pg"><div className="a-body">
      {head}
      {trips && all.length > 0 && next && <p className="a-mu">Next up: <b>{next.title}</b>, {countdown(startOf(next))?.toLowerCase()}.</p>}
      <div className="cm-tabs a-trips-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" className="cm-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}<span className="cm-tab__count">{t.n}</span>
          </button>
        ))}
      </div>

      {err && <Note kind="danger" title="We could not do that.">{err}</Note>}
      {failed && <Note kind="danger" title="We could not load your trips."><button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={load}>Try again</button></Note>}
      {!failed && trips === null && <p className="a-mu" role="status">Loading your trips</p>}

      {trips && (
        <div className="a-c" style={{ gap: 14 }}>
          {shown.length === 0 && (
            <div className="a-gl a-dashed trips-empty">
              <EmptyArt />
              <b>{tab === 'booked' ? 'No booked trips yet.' : 'No trips here yet.'}</b>
              <span className="a-mu">Find a seat, save it, and it lands here with its status.</span>
              <div className="a-trips-actions">
                <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href="/flights">Search for trips</Link>
                <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href="/trips/ideas">Trips you can take</Link>
                <Link className="cm-btn cm-btn--ghost cm-btn--sm" href="/plan">Plan a trip</Link>
              </div>
            </div>
          )}
          {shown.map(t => {
            const s = statusOf(t);
            const idx = STEPS.findIndex(x => x.id === s);
            const seat = t.parsed?.seat;
            const when = dates(t);
            const cd = countdown(startOf(t));
            const ck = checks[t.id];
            const route = t.origin && t.destination ? `${cityOf(t.origin)} → ${cityOf(t.destination)}` : null;
            return (
              <article className={`a-gl trip${s === 'transferring' ? ' a-sel' : ''}`} key={t.id}>
                {t.origin && t.destination ? (
                  <BoardingPass
                    from={t.origin} to={t.destination} fromCity={cityOf(t.origin)} toCity={cityOf(t.destination)} badge={cd ?? undefined}
                    fields={[
                      { label: 'Trip', value: t.title },
                      { label: 'Date', value: when ?? 'Dates open' },
                      { label: 'Cabin', value: CABIN_LABEL[t.cabin] ?? t.cabin },
                      { label: 'Travellers', value: t.travellers },
                    ]}
                  />
                ) : (
                  <div className="a-r a-rw">
                    <div className="a-g">
                      <b className="a-trips-title">{route ?? t.title}</b>
                      <div className="a-mu">{[when, CABIN_LABEL[t.cabin] ?? t.cabin, `${t.travellers} ${t.travellers === 1 ? 'traveller' : 'travellers'}`].filter(Boolean).join(' · ')}</div>
                    </div>
                    {cd && <Tag kind={cd === 'Date has passed' ? 'warning' : 'outline'} plain>{cd}</Tag>}
                  </div>
                )}

                <ol className="trip-steps" aria-label="Trip status">
                  {STEPS.map((x, i) => (
                    <li key={x.id} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
                      <button type="button" disabled={busy === t.id || i === idx} aria-current={i === idx ? 'step' : undefined} onClick={() => setStatus(t, x.id)}>
                        <i aria-hidden="true">{i < idx ? '✓' : i + 1}</i>
                        <span>{x.label}<small>{x.hint}</small></span>
                      </button>
                    </li>
                  ))}
                </ol>

                {seat && (
                  <div className="trip-seat">
                    <span className="a-g"><b>{fmt(seat.points)} pts</b> each on {dateShort(seat.date)} · {seat.programmeName}{seat.cardName ? ` · pay from ${seat.cardName}` : ''}</span>
                    <SeenStamp iso={seat.seenAt} />
                  </div>
                )}
                {ck && ck.state !== 'busy' && <span className={`trip-check ${ck.state}`} role="status">{ck.note}</span>}
                {t.parsed?.note && <span className="a-mu">{t.parsed.note}</span>}
                {watched[t.id] === 'ok' && <span className="trip-check ok" role="status">Watching this route. We email you when a seat opens. <Link href="/alerts">See alerts</Link></span>}
                {watched[t.id] === 'error' && <span className="trip-check error" role="status">We could not set the alert. Try again from Alerts.</span>}

                {confirm === t.id ? (
                  <div className="a-trips-actions">
                    <span className="a-g">Delete this trip? This cannot be undone.</span>
                    <button type="button" className="cm-btn cm-btn--danger cm-btn--sm a-pb" disabled={busy === t.id} onClick={() => remove(t)}>Delete</button>
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setConfirm(null)}>Keep it</button>
                  </div>
                ) : (
                  <div className="a-trips-actions">
                    {seat && <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href={`/flights/checkout?id=${encodeURIComponent(seat.id)}&n=${t.travellers}`}>Open seat</Link>}
                    {seat && <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={ck?.state === 'busy'} onClick={() => recheck(t)}>{ck?.state === 'busy' ? 'Checking' : 'Check seat again'}</button>}
                    {t.origin && t.destination && t.depart_from && watched[t.id] !== 'ok' && <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" onClick={() => watch(t)}>Watch this route</button>}
                    {t.origin && t.destination && <Link className="cm-btn cm-btn--ghost cm-btn--sm" href={`/flights?${new URLSearchParams({ o: t.origin, d: t.destination, ...(t.depart_from ? { from: t.depart_from, to: t.depart_to ?? t.depart_from } : {}), cabin: t.cabin, n: String(t.travellers) })}`}>Search again</Link>}
                    <span className="a-g" />
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setConfirm(t.id)}>Delete</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div></div>
  );
}
