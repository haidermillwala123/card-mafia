'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Note, SeenStamp, Tag, type TagKind } from '@/components/app/ui';
import { cityOf } from '@/lib/airports';
import { fmt, dateShort, CABIN_LABEL } from '@/lib/app/format';
import { deleteTrip, listTrips, setTripStatus, type TripRow, type TripStatus } from '@/lib/app/trips';
import { useUser } from '@/lib/auth';
import './trips.css';

const STATUSES: { id: TripStatus; label: string; kind: TagKind }[] = [
  { id: 'exploring', label: 'Exploring', kind: 'plain' },
  { id: 'transferring', label: 'Transferring', kind: 'warning' },
  { id: 'booked', label: 'Booked', kind: 'verified' },
];
type Tab = 'all' | TripStatus;

// Old or draft rows count as exploring.
const statusOf = (t: TripRow): TripStatus => (t.status === 'transferring' || t.status === 'booked' ? t.status : 'exploring');

function dates(t: TripRow) {
  if (!t.depart_from) return null;
  return t.depart_to && t.depart_to !== t.depart_from ? `${dateShort(t.depart_from)} to ${dateShort(t.depart_to)}` : dateShort(t.depart_from);
}

export default function TripsClient() {
  const user = useUser();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

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

  const head = (
    <>
      <span className="a-eb">Your trips</span>
      <h1 className="a-hd a-sm">Where each plan stands.</h1>
    </>
  );

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

  const all = trips ?? [];
  const count = (s: Tab) => (s === 'all' ? all.length : all.filter(t => statusOf(t) === s).length);
  const shown = tab === 'all' ? all : all.filter(t => statusOf(t) === tab);
  const tabs: { id: Tab; label: string }[] = [{ id: 'all', label: 'All' }, ...STATUSES.map(s => ({ id: s.id, label: s.label }))];
  const empty: Record<Tab, string> = {
    all: 'No trips yet. Save a seat from a search and it will show up here.',
    exploring: 'Nothing here. Plans you are still looking at appear in this tab.',
    transferring: 'Nothing here. Mark a trip as transferring once you start moving points.',
    booked: 'Nothing here. Mark a trip as booked after you book with the airline.',
  };

  return (
    <div className="a-pg"><div className="a-body">
      {head}
      <div className="cm-tabs a-trips-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" className="cm-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}<span className="cm-tab__count">{count(t.id)}</span>
          </button>
        ))}
      </div>

      {err && <Note kind="danger" title="We could not do that.">{err}</Note>}
      {failed && <Note kind="danger" title="We could not load your trips."><button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={load}>Try again</button></Note>}
      {!failed && trips === null && <p className="a-mu" role="status">Loading your trips</p>}

      {trips && (
        <div className="a-c" style={{ gap: 12 }}>
          {shown.length === 0 && (
            <div className="a-gl a-dashed" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span>{empty[tab]}</span>
              <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href="/flights">Search seats</Link>
            </div>
          )}
          {shown.map(t => {
            const s = statusOf(t);
            const meta = STATUSES.find(x => x.id === s)!;
            const seat = t.parsed?.seat;
            const route = t.origin && t.destination ? `${t.origin} to ${t.destination}` : null;
            const when = dates(t);
            return (
              <div className={`a-gl${s === 'transferring' ? ' a-sel' : ''}`} key={t.id}>
                <div className="a-r">
                  <b className="a-g a-trips-title">{t.title}</b>
                  <Tag kind={meta.kind}>{meta.label}</Tag>
                </div>
                <div className="a-mu">
                  {[route && t.destination ? `${cityOf(t.origin ?? '')} to ${cityOf(t.destination)}` : route, when, CABIN_LABEL[t.cabin] ?? t.cabin, `${t.travellers} ${t.travellers === 1 ? 'traveller' : 'travellers'}`].filter(Boolean).join(' · ')}
                </div>
                {seat && (
                  <div className="a-r a-rw">
                    <span className="a-g">
                      {seat.programmeName} · {fmt(seat.points)} pts each on {dateShort(seat.date)}{seat.cardName ? ` · pay from ${seat.cardName}` : ''}
                    </span>
                    <SeenStamp iso={seat.seenAt} />
                  </div>
                )}
                {t.parsed?.note && <span className="a-mu">{t.parsed.note}</span>}
                {s === 'booked' && <span className="a-mu">You marked this booked. We do not check the booking.</span>}
                <div className="a-dsh" />
                {confirm === t.id ? (
                  <div className="a-trips-actions">
                    <span className="a-g">Delete this trip? This cannot be undone.</span>
                    <button type="button" className="cm-btn cm-btn--danger cm-btn--sm a-pb" disabled={busy === t.id} onClick={() => remove(t)}>Delete</button>
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setConfirm(null)}>Keep it</button>
                  </div>
                ) : (
                  <div className="a-trips-actions">
                    {seat && <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href={`/flights/checkout?id=${encodeURIComponent(seat.id)}&n=${t.travellers}`}>Open seat</Link>}
                    {STATUSES.filter(x => x.id !== s).map(x => (
                      <button key={x.id} type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={busy === t.id} onClick={() => setStatus(t, x.id)}>
                        Mark {x.label.toLowerCase()}
                      </button>
                    ))}
                    <span className="a-g" />
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setConfirm(t.id)}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="a-foot">
        <span className="a-cap">Status is set by you. We cannot see your bookings.</span>
        <span className="a-g" />
        <span className="a-cap">A saved seat may be gone by the time you open it.</span>
      </div>
    </div></div>
  );
}
