'use client';

// Alerts: say what you want to be told about, and we email you. Seven kinds: seats opening on a route, a seat under your points price,
// points about to expire, an annual fee coming due, a card's transfer rules changing, a balance reaching a target, or any reminder of your own.
// The daily job (api/cron) checks them all.
import Link from 'next/link';
import Select from '@/components/Select';
import { useCallback, useEffect, useState } from 'react';
import Ic from '@/components/app/Icons';
import { Note, SeenStamp, Tag } from '@/components/app/ui';
import DatePicker from '@/components/DatePicker';
import { AIRPORTS, INDIAN, cityOf, label } from '@/lib/airports';
import { createWatch, dismissAlert, listAlerts, listWatches, stopWatch, type AlertRow, type Watch } from '@/lib/app/alerts';
import type { Cabin } from '@/lib/app/api';
import { bankName, CARDS, cardName, programmeName } from '@/lib/app/catalog';
import { createCustom, listCustom, stopCustom } from '@/lib/app/custom-alerts';
import { CABIN_LABEL, addDaysIso, ageLabel, dateShort, fmt, todayIso } from '@/lib/app/format';
import { useUser } from '@/lib/auth';
import type { CustomAlert, Repeat } from '@/lib/custom-alerts';
import programmesJson from '@/data/programmes.json';
import { MAX_DAYS_OUT } from '@/lib/seats/sources';
import './alerts.css';

type Type = 'seat' | 'price' | 'expiry' | 'fee' | 'rule' | 'balance' | 'custom';
// `soon` types are built (the form, the daily check and the email all exist) but switched off on the page until they are launched.
const TYPES: { id: Type; title: string; sub: string; soon?: boolean }[] = [
  { id: 'seat', title: 'Seats open', sub: 'A route gets award seats' },
  { id: 'price', title: 'Seat under a price', sub: 'The cheapest seat drops to your points limit', soon: true },
  { id: 'expiry', title: 'Points expire', sub: 'A nudge before a balance lapses', soon: true },
  { id: 'fee', title: 'Annual fee due', sub: 'A nudge before a card renews', soon: true },
  { id: 'rule', title: 'Transfer rules change', sub: 'Ratios or caps change on one of your cards', soon: true },
  { id: 'balance', title: 'Balance target', sub: 'Your points reach a number', soon: true },
  { id: 'custom', title: 'Anything else', sub: 'Your own reminder and date', soon: true },
];
const KIND_TAG: Record<string, string> = { reminder: 'Reminder', price: 'Price', rule: 'Rule change', balance: 'Balance' };
const CABINS: Cabin[] = ['economy', 'premium_economy', 'business', 'first'];
const FAIL = 'We could not save that. Nothing was changed. Try again.';
const range = (w: Watch) => (w.depart_from === w.depart_to ? dateShort(w.depart_from) : `${dateShort(w.depart_from)} to ${dateShort(w.depart_to)}`);
const PROGRAMMES = (programmesJson.programmes as { id: string; name: string; kind: string }[]).slice().sort((a, b) => a.name.localeCompare(b.name));
const REPEAT: { id: Repeat; label: string }[] = [{ id: 'none', label: 'Once' }, { id: 'monthly', label: 'Every month' }, { id: 'yearly', label: 'Every year' }];
const LEAD = [0, 1, 3, 7, 14, 30, 60, 90];

function describe(c: CustomAlert): string {
  const p = c.params as Record<string, string | number>;
  if (c.kind === 'price') return `${p.origin} to ${p.dest} · ${dateShort(String(p.from))} to ${dateShort(String(p.to))} · ${CABIN_LABEL[p.cabin as Cabin] ?? p.cabin} · at or under ${fmt(Number(p.max_points))} pts`;
  if (c.kind === 'rule') return `We tell you if the ratios or limits on ${cardName(String(p.card_id))} change.`;
  if (c.kind === 'balance') return `When ${cardName(String(p.card_id))} reaches ${fmt(Number(p.at_least))} points.`;
  const when = c.due_on ? dateShort(c.due_on) : '';
  const lead = c.remind_days_before ? `, ${c.remind_days_before} ${c.remind_days_before === 1 ? 'day' : 'days'} before` : '';
  const rep = c.repeat === 'monthly' ? ' · every month' : c.repeat === 'yearly' ? ' · every year' : '';
  return `${when}${lead}${rep}${c.note ? ` · ${c.note}` : ''}`;
}

export default function AlertsClient() {
  const user = useUser();
  const min = todayIso();
  const max = addDaysIso(MAX_DAYS_OUT);
  const [type, setType] = useState<Type>('seat');
  // seat and price
  const [origin, setOrigin] = useState('BOM');
  const [dest, setDest] = useState('');
  const [from, setFrom] = useState(min);
  const [to, setTo] = useState(addDaysIso(30));
  const [cabin, setCabin] = useState<Cabin>('business');
  const [reachable, setReachable] = useState(true);
  const [maxPts, setMaxPts] = useState('');
  // the rest
  const [programme, setProgramme] = useState('');
  const [cardId, setCardId] = useState('');
  const [target, setTarget] = useState('');
  const [dueOn, setDueOn] = useState(addDaysIso(30));
  const [lead, setLead] = useState(14);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(true);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [customs, setCustoms] = useState<CustomAlert[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [w, a, c] = await Promise.all([listWatches(), listAlerts(), listCustom()]);
      setWatches(w);
      setAlerts(a);
      setCustoms(c);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch once the session is known; the state updates arrive after the awaited request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [user, load]);

  const pick = (t: Type) => { setType(t); setFormErr(''); if (t === 'fee') { setRepeat('yearly'); setLead(14); } else if (t === 'expiry') { setRepeat('none'); setLead(30); } else if (t === 'custom') { setRepeat('none'); setLead(0); } };

  async function submit() {
    setFormErr('');
    if (TYPES.find(t => t.id === type)?.soon) return;
    const routeOk = () => {
      if (!dest) return 'Choose where you want to fly.';
      if (dest === origin) return 'Pick two different airports.';
      if (!from || !to || from < min || to > max || from > to) return `Pick dates within the next ${MAX_DAYS_OUT} days, up to ${dateShort(max)}, with the start before the end.`;
      return '';
    };
    setBusy(true);
    let r: { ok: boolean; error?: string } = { ok: false, error: FAIL };
    if (type === 'seat') {
      const e = routeOk();
      if (e) { setBusy(false); return setFormErr(e); }
      r = await createWatch({ origin, dest, from, to, cabin, reachableOnly: reachable, email });
    } else if (type === 'price') {
      const e = routeOk();
      const pts = Number(maxPts.replace(/,/g, ''));
      if (e || !(pts > 0)) { setBusy(false); return setFormErr(e || 'Enter the most points you would pay, such as 60,000.'); }
      r = await createCustom({ kind: 'price', title: `${origin} to ${dest} under ${fmt(pts)} points`, params: { origin, dest, from, to, cabin, max_points: pts }, email });
    } else if (type === 'expiry') {
      if (!programme) { setBusy(false); return setFormErr('Choose the programme.'); }
      if (!dueOn || dueOn < min) { setBusy(false); return setFormErr('Pick the date they expire, from today on.'); }
      r = await createCustom({ kind: 'reminder', title: `${programmeName(programme)} points expire`, note: 'Use them or move them before they lapse.', dueOn, remindDaysBefore: lead, repeat: 'none', email });
    } else if (type === 'fee') {
      if (!cardId) { setBusy(false); return setFormErr('Choose the card.'); }
      if (!dueOn || dueOn < min) { setBusy(false); return setFormErr('Pick the date the fee is charged, from today on.'); }
      r = await createCustom({ kind: 'reminder', title: `${cardName(cardId)} annual fee`, note: 'Decide whether to keep the card before the fee is charged.', dueOn, remindDaysBefore: lead, repeat, email });
    } else if (type === 'rule') {
      if (!cardId) { setBusy(false); return setFormErr('Choose the card.'); }
      r = await createCustom({ kind: 'rule', title: `${cardName(cardId)} transfer rules`, params: { card_id: cardId }, email });
    } else if (type === 'balance') {
      const n = Number(target.replace(/,/g, ''));
      if (!cardId || !(n > 0)) { setBusy(false); return setFormErr('Choose the card and the number of points you are aiming for.'); }
      r = await createCustom({ kind: 'balance', title: `${cardName(cardId)} reaches ${fmt(n)} points`, params: { card_id: cardId, at_least: n }, email });
    } else {
      if (!title.trim()) { setBusy(false); return setFormErr('Give the reminder a name.'); }
      if (!dueOn || dueOn < min) { setBusy(false); return setFormErr('Pick a date, from today on.'); }
      r = await createCustom({ kind: 'reminder', title, note, dueOn, remindDaysBefore: lead, repeat, email });
    }
    setBusy(false);
    if (!r.ok) return setFormErr(r.error ?? FAIL);
    setDest(''); setMaxPts(''); setTarget(''); setTitle(''); setNote('');
    await load();
  }

  async function stop(id: string) {
    setErr('');
    if (!(await stopWatch(id))) return setErr(FAIL);
    setWatches(l => l?.filter(w => w.id !== id) ?? null);
  }
  async function stopC(id: string) {
    setErr('');
    if (!(await stopCustom(id))) return setErr(FAIL);
    setCustoms(l => l?.filter(c => c.id !== id) ?? null);
  }
  async function dismiss(id: string) {
    setErr('');
    if (!(await dismissAlert(id))) return setErr(FAIL);
    setAlerts(l => l?.filter(a => a.id !== id) ?? null);
  }

  const head = (
    <>
      <span className="a-eb">Alerts</span>
      <h1 className="a-hd a-sm">Watch anything.<br /><em>We email you when it matters.</em></h1>
    </>
  );

  if (user === undefined) return <div className="a-pg"><div className="a-body">{head}<p className="a-mu" role="status">Loading</p></div></div>;
  if (!user) {
    return (
      <div className="a-pg"><div className="a-body">
        {head}
        <Note kind="info" title="Alerts need an email sign-in.">
          <Link href="/signin" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in</Link> to set an alert. Search works without an account.
        </Note>
      </div></div>
    );
  }

  const isRoute = type === 'seat' || type === 'price';
  const isDate = type === 'expiry' || type === 'fee' || type === 'custom';
  const needsCard = type === 'fee' || type === 'rule' || type === 'balance';

  return (
    <div className="a-pg"><div className="a-body">
      {head}

      <section aria-label="What to be told about">
        <div className="a-alerts-types">
          {TYPES.map(t => (
            <button key={t.id} type="button" className="a-alerts-type" aria-pressed={type === t.id} disabled={t.soon} onClick={() => !t.soon && pick(t.id)}>
              <b>{t.title}{t.soon && <em className="a-alerts-soon">Coming soon</em>}</b><small>{t.sub}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="a-g2" style={{ alignItems: 'start' }}>
        <div className="a-gl">
          <span className="a-cap">New alert · {TYPES.find(t => t.id === type)?.title}</span>
          <div className="a-alerts-form">
            {isRoute && (
              <>
                <label className="cm-field"><span className="cm-field__label">From</span>
                  <span className="cm-control"><Select value={origin} onChange={e => setOrigin(e.target.value)}>
                    {INDIAN.map(i => <option key={i} value={i}>{label(i)}</option>)}
                  </Select></span></label>
                <label className="cm-field"><span className="cm-field__label">To</span>
                  <span className="cm-control"><Select value={dest} onChange={e => setDest(e.target.value)}>
                    <option value="">Choose an airport</option>
                    {AIRPORTS.filter(a => a.i !== origin).map(a => <option key={a.i} value={a.i}>{label(a.i)}</option>)}
                  </Select></span></label>
                <div className="cm-field"><span className="cm-field__label">Leaving from</span>
                  <span className="cm-control"><DatePicker ariaLabel="Leaving from" min={min} max={max} value={from} onChange={setFrom} /></span></div>
                <div className="cm-field"><span className="cm-field__label">Leaving by</span>
                  <span className="cm-control"><DatePicker ariaLabel="Leaving by" min={min} max={max} value={to} onChange={setTo} /></span></div>
                <label className="cm-field a-alerts-wide"><span className="cm-field__label">Cabin</span>
                  <span className="cm-control"><Select value={cabin} onChange={e => setCabin(e.target.value as Cabin)}>
                    {CABINS.map(c => <option key={c} value={c}>{CABIN_LABEL[c]}</option>)}
                  </Select></span></label>
                {type === 'price' && (
                  <label className="cm-field a-alerts-wide"><span className="cm-field__label">Tell me when a seat costs this many points or fewer</span>
                    <span className="cm-control"><input inputMode="numeric" placeholder="60,000" value={maxPts} onChange={e => setMaxPts(e.target.value.replace(/[^\d,]/g, ''))} /></span></label>
                )}
              </>
            )}

            {type === 'expiry' && (
              <label className="cm-field a-alerts-wide"><span className="cm-field__label">Which programme</span>
                <span className="cm-control"><Select value={programme} onChange={e => setProgramme(e.target.value)}>
                  <option value="">Choose a programme</option>
                  {PROGRAMMES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select></span></label>
            )}

            {needsCard && (
              <label className="cm-field a-alerts-wide"><span className="cm-field__label">Which card</span>
                <span className="cm-control"><Select value={cardId} onChange={e => setCardId(e.target.value)}>
                  <option value="">Choose a card</option>
                  {CARDS.slice().sort((a, b) => cardName(a.id).localeCompare(cardName(b.id))).map(c => <option key={c.id} value={c.id}>{bankName(c.bank)} {c.name}</option>)}
                </Select></span></label>
            )}

            {type === 'balance' && (
              <label className="cm-field a-alerts-wide"><span className="cm-field__label">Tell me when it reaches (points)</span>
                <span className="cm-control"><input inputMode="numeric" placeholder="1,00,000" value={target} onChange={e => setTarget(e.target.value.replace(/[^\d,]/g, ''))} /></span></label>
            )}

            {type === 'custom' && (
              <>
                <label className="cm-field a-alerts-wide"><span className="cm-field__label">What is it</span>
                  <span className="cm-control"><input maxLength={120} placeholder="Transfer bonus ends, book Tokyo, spend target" value={title} onChange={e => setTitle(e.target.value)} /></span></label>
                <label className="cm-field a-alerts-wide"><span className="cm-field__label">A note to yourself (optional)</span>
                  <span className="cm-control"><input maxLength={500} placeholder="Anything you want to remember" value={note} onChange={e => setNote(e.target.value)} /></span></label>
              </>
            )}

            {isDate && (
              <>
                <div className="cm-field"><span className="cm-field__label">{type === 'expiry' ? 'They expire on' : type === 'fee' ? 'Fee is charged on' : 'Date'}</span>
                  <span className="cm-control"><DatePicker ariaLabel="Date" min={min} value={dueOn} onChange={setDueOn} /></span></div>
                <label className="cm-field"><span className="cm-field__label">Email me</span>
                  <span className="cm-control"><Select value={String(lead)} onChange={e => setLead(Number(e.target.value))}>
                    {LEAD.map(n => <option key={n} value={n}>{n === 0 ? 'On the day' : `${n} ${n === 1 ? 'day' : 'days'} before`}</option>)}
                  </Select></span></label>
                {type !== 'expiry' && (
                  <label className="cm-field a-alerts-wide"><span className="cm-field__label">Repeat</span>
                    <span className="cm-control"><Select value={repeat} onChange={e => setRepeat(e.target.value as Repeat)}>
                      {REPEAT.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </Select></span></label>
                )}
              </>
            )}
          </div>
          {type === 'seat' && <label className="cm-switch"><span className="cm-check__label">Only seats my cards can pay for</span><input type="checkbox" checked={reachable} onChange={e => setReachable(e.target.checked)} /></label>}
          <label className="cm-switch"><span className="cm-check__label">Email me</span><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /></label>
          {formErr && <span role="alert" style={{ color: 'var(--danger)' }}>{formErr}</span>}
          <button type="button" className="a-cta" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={submit}>{busy ? 'Saving' : 'Set alert'}<span className="a-ar"><Ic name="arrow" /></span></button>
          <span className="a-mu">We check once a day, so an alert can run up to a day behind. Emails come from Card Mafia.</span>
        </div>

        <div className="a-c" style={{ gap: 12 }}>
          {err && <Note kind="danger" title="We could not do that.">{err}</Note>}
          {failed && <Note kind="danger" title="We could not load your alerts."><button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={load}>Try again</button></Note>}
          {!failed && (watches === null || alerts === null) && <p className="a-mu" role="status">Loading your alerts</p>}

          {alerts?.map(a => {
            const p = a.payload;
            if (p.custom) {
              return (
                <div className="a-gl a-sel" key={a.id}>
                  <div className="a-r"><b className="a-g a-alerts-title">{p.title}</b><Tag kind="best">{KIND_TAG[p.kind ?? 'reminder'] ?? 'Alert'}</Tag></div>
                  <span style={{ whiteSpace: 'pre-line' }}>{p.body}</span>
                  <span className="a-mu">{a.sent_at ? `Email sent ${ageLabel(a.sent_at)} ago` : 'No email sent'}</span>
                  <div className="a-alerts-actions">
                    {p.cta && <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href={p.cta.href}>{p.cta.label}</Link>}
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => dismiss(a.id)}>Dismiss</button>
                  </div>
                </div>
              );
            }
            const b = p.best;
            return (
              <div className="a-gl a-sel" key={a.id}>
                <div className="a-r"><b className="a-g a-alerts-title">{p.origin} to {p.dest}</b><Tag kind="best">Seats opened</Tag></div>
                <span className="a-mu">{p.count} {p.count === 1 ? 'seat' : 'seats'} found · {CABIN_LABEL[p.cabin as Cabin] ?? p.cabin}{p.dest && cityOf(p.dest) !== p.dest ? ` · ${cityOf(p.dest)}` : ''}</span>
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
          {alerts && alerts.length === 0 && watches && <div className="a-gl a-dashed" style={{ textAlign: 'center' }}><span>Nothing has fired yet. When an alert triggers, it shows up here.</span></div>}

          <span className="a-cap">What you are watching</span>
          {watches?.map(w => (
            <div className="a-gl" key={w.id}>
              <div className="a-r"><b className="a-g a-alerts-title">{w.origin_iata} to {w.dest_iata}</b><Tag>Seats open</Tag></div>
              <span className="a-mu">{range(w)} · {CABIN_LABEL[w.cabin] ?? w.cabin}{w.reachable_only ? ' · seats your cards can pay for' : ''}{w.email ? ' · email on' : ''}</span>
              <span>{w.last_checked_at ? `${fmt(w.last_match_count)} ${w.last_match_count === 1 ? 'seat' : 'seats'} matched when we last looked` : 'Not checked yet. The next daily check will look.'}</span>
              <div className="a-alerts-actions">
                {w.last_checked_at && <span className="cm-stamp" suppressHydrationWarning><Ic name="clock" small />Last checked {ageLabel(w.last_checked_at)} ago</span>}
                <span className="a-g" />
                <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href={`/flights?${new URLSearchParams({ o: w.origin_iata, d: w.dest_iata, from: w.depart_from, to: w.depart_to, cabin: w.cabin, n: '1', reach: w.reachable_only ? '1' : '0' })}`}>Search now</Link>
                <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => stop(w.id)}>Stop watching</button>
              </div>
            </div>
          ))}
          {customs?.map(c => (
            <div className="a-gl" key={c.id}>
              <div className="a-r"><b className="a-g a-alerts-title">{c.title}</b><Tag>{KIND_TAG[c.kind] ?? 'Alert'}</Tag></div>
              <span className="a-mu">{describe(c)}{c.email ? ' · email on' : ''}</span>
              <div className="a-alerts-actions">
                <span className="a-g" />
                <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => stopC(c.id)}>Stop</button>
              </div>
            </div>
          ))}
          {watches && customs && watches.length === 0 && customs.length === 0 && (
            <div className="a-gl a-dashed" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span>You are not watching anything yet. Pick a kind of alert above and fill in the form, or find a route first.</span>
              <div className="a-alerts-actions">
                <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href="/flights">Search for trips</Link>
                <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href="/trips/ideas">Trips you can take</Link>
              </div>
            </div>
          )}
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
