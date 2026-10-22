'use client';

import Link from 'next/link';
import Select from '@/components/Select';
import { useCallback, useEffect, useState } from 'react';
import Ic from '@/components/app/Icons';
import { Note, SeenStamp, Tag } from '@/components/app/ui';
import { AIRPORTS, INDIAN, cityOf, label } from '@/lib/airports';
import { createWatch, dismissAlert, listAlerts, listWatches, stopWatch, type AlertRow, type Watch } from '@/lib/app/alerts';
import type { Cabin } from '@/lib/app/api';
import { CABIN_LABEL, addDaysIso, ageLabel, dateShort, fmt, todayIso } from '@/lib/app/format';
import { useUser } from '@/lib/auth';
import './alerts.css';

const CABINS: Cabin[] = ['economy', 'premium_economy', 'business', 'first'];
const FAIL = 'We could not save that. Nothing was changed. Try again.';
const range = (w: Watch) => (w.depart_from === w.depart_to ? dateShort(w.depart_from) : `${dateShort(w.depart_from)} to ${dateShort(w.depart_to)}`);

export default function AlertsClient() {
  const user = useUser();
  const min = todayIso();
  const max = addDaysIso(60);
  const [origin, setOrigin] = useState('BOM');
  const [dest, setDest] = useState('');
  const [from, setFrom] = useState(min);
  const [to, setTo] = useState(addDaysIso(30));
  const [cabin, setCabin] = useState<Cabin>('business');
  const [reachable, setReachable] = useState(true);
  const [email, setEmail] = useState(true);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [w, a] = await Promise.all([listWatches(), listAlerts()]);
      setWatches(w);
      setAlerts(a);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch once the session is known; the state updates arrive after the awaited request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [user, load]);

  async function submit() {
    setFormErr('');
    if (!dest) return setFormErr('Choose where you want to fly.');
    if (dest === origin) return setFormErr('Pick two different airports.');
    if (!from || !to || from < min || to > max || from > to) return setFormErr(`Pick dates within the next 60 days, up to ${dateShort(max)}, with the start before the end.`);
    setBusy(true);
    const r = await createWatch({ origin, dest, from, to, cabin, reachableOnly: reachable, email });
    setBusy(false);
    if (!r.ok) return setFormErr(r.error);
    setDest('');
    await load();
  }

  async function stop(id: string) {
    setErr('');
    if (!(await stopWatch(id))) return setErr(FAIL);
    setWatches(l => l?.filter(w => w.id !== id) ?? null);
  }

  async function dismiss(id: string) {
    setErr('');
    if (!(await dismissAlert(id))) return setErr(FAIL);
    setAlerts(l => l?.filter(a => a.id !== id) ?? null);
  }

  const head = (
    <>
      <span className="a-eb">Alerts</span>
      <h1 className="a-hd a-sm">Tell us the route.<br /><em>We watch the seats.</em></h1>
    </>
  );

  if (user === undefined) return <div className="a-pg"><div className="a-body">{head}<p className="a-mu" role="status">Loading</p></div></div>;
  if (!user) {
    return (
      <div className="a-pg"><div className="a-body">
        {head}
        <Note kind="info" title="Alerts need an email sign-in.">
          <Link href="/signin" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in</Link> to watch a route. Search works without an account.
        </Note>
      </div></div>
    );
  }

  return (
    <div className="a-pg"><div className="a-body">
      {head}
      <div className="a-g2" style={{ alignItems: 'start' }}>
        <div className="a-gl">
          <span className="a-cap">New alert</span>
          <div className="a-alerts-form">
            <label className="cm-field"><span className="cm-field__label">From</span>
              <span className="cm-control"><Select value={origin} onChange={e => setOrigin(e.target.value)}>
                {INDIAN.map(i => <option key={i} value={i}>{label(i)}</option>)}
              </Select></span></label>
            <label className="cm-field"><span className="cm-field__label">To</span>
              <span className="cm-control"><Select value={dest} onChange={e => setDest(e.target.value)}>
                <option value="">Choose an airport</option>
                {AIRPORTS.filter(a => a.i !== origin).map(a => <option key={a.i} value={a.i}>{label(a.i)}</option>)}
              </Select></span></label>
            <label className="cm-field"><span className="cm-field__label">Leaving from</span>
              <span className="cm-control"><input type="date" min={min} max={max} value={from} onChange={e => setFrom(e.target.value)} /></span></label>
            <label className="cm-field"><span className="cm-field__label">Leaving by</span>
              <span className="cm-control"><input type="date" min={min} max={max} value={to} onChange={e => setTo(e.target.value)} /></span></label>
            <label className="cm-field a-alerts-wide"><span className="cm-field__label">Cabin</span>
              <span className="cm-control"><Select value={cabin} onChange={e => setCabin(e.target.value as Cabin)}>
                {CABINS.map(c => <option key={c} value={c}>{CABIN_LABEL[c]}</option>)}
              </Select></span></label>
          </div>
          <label className="cm-switch"><span className="cm-check__label">Only seats my cards can pay for</span><input type="checkbox" checked={reachable} onChange={e => setReachable(e.target.checked)} /></label>
          <label className="cm-switch"><span className="cm-check__label">Email me when seats open</span><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /></label>
          {formErr && <span role="alert" style={{ color: 'var(--danger)' }}>{formErr}</span>}
          <button type="button" className="a-cta" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={submit}>{busy ? 'Saving' : 'Watch route'}<span className="a-ar"><Ic name="arrow" /></span></button>
          <span className="a-mu">Alerts check our saved results once a day, so they can run a day behind the airline.</span>
        </div>

        <div className="a-c" style={{ gap: 12 }}>
          {err && <Note kind="danger" title="We could not do that.">{err}</Note>}
          {failed && <Note kind="danger" title="We could not load your alerts."><button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={load}>Try again</button></Note>}
          {!failed && (watches === null || alerts === null) && <p className="a-mu" role="status">Loading your alerts</p>}

          {alerts?.map(a => {
            const p = a.payload;
            const b = p.best;
            return (
              <div className="a-gl a-sel" key={a.id}>
                <div className="a-r"><b className="a-g a-alerts-title">{p.origin} to {p.dest}</b><Tag kind="best">Seats opened</Tag></div>
                <span className="a-mu">{p.count} {p.count === 1 ? 'seat' : 'seats'} found · {CABIN_LABEL[p.cabin] ?? p.cabin}{cityOf(p.dest) !== p.dest ? ` · ${cityOf(p.dest)}` : ''}</span>
                {b && <span>Cheapest: {fmt(b.points)} pts on {dateShort(b.date)} · {b.programme_name}</span>}
                <div className="a-r a-rw">
                  {b && <SeenStamp iso={b.seen_at} />}
                  <span className="a-mu">{a.sent_at ? `Email sent ${ageLabel(a.sent_at)} ago` : 'No email sent'}</span>
                </div>
                <div className="a-alerts-actions">
                  {b && <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href={`/flights/checkout?id=${encodeURIComponent(b.id)}&n=1`}>See the seat</Link>}
                  <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => dismiss(a.id)}>Dismiss</button>
                </div>
              </div>
            );
          })}
          {alerts && alerts.length === 0 && watches && <div className="a-gl a-dashed" style={{ textAlign: 'center' }}><span>No alerts yet. When a watched route has seats, they show up here.</span></div>}

          <span className="a-cap">Your watches</span>
          {watches?.map(w => (
            <div className="a-gl" key={w.id}>
              <div className="a-r"><b className="a-g a-alerts-title">{w.origin_iata} to {w.dest_iata}</b><Tag>Watching</Tag></div>
              <span className="a-mu">{range(w)} · {CABIN_LABEL[w.cabin] ?? w.cabin}{w.reachable_only ? ' · seats your cards can pay for' : ''}{w.email ? ' · email on' : ''}</span>
              <span>{w.last_checked_at ? `${fmt(w.last_match_count)} ${w.last_match_count === 1 ? 'seat' : 'seats'} matched when we last looked` : 'Not checked yet. The next daily check will look.'}</span>
              <div className="a-alerts-actions">
                {w.last_checked_at && <span className="cm-stamp" suppressHydrationWarning><Ic name="clock" small />Last checked {ageLabel(w.last_checked_at)} ago</span>}
                <span className="a-g" />
                <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => stop(w.id)}>Stop watching</button>
              </div>
            </div>
          ))}
          {watches && watches.length === 0 && <div className="a-gl a-dashed" style={{ textAlign: 'center' }}><span>You are not watching any routes. Add one on the left.</span></div>}
        </div>
      </div>
      <div className="a-foot">
        <span className="a-cap">Alerts need an email sign-in.</span>
        <span className="a-g" />
        <span className="a-cap">Seats can disappear before you transfer.</span>
      </div>
    </div></div>
  );
}
