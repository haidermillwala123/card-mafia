'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import PathChain from '@/components/PathChain';
import { Arrow, Back, Check, Clock, Close, Info, Lock, Warn } from '@/components/Icons';
import { loadProfile } from '@/lib/profile';
import { ageText, type Plan } from '@/lib/engine/engine';
import type { ParsedTrip } from '@/lib/engine/parse';

type CardOpt = { id: string; name: string; bankId: string; bankName: string };
type Row = { cardId: string; balance: string };
type Form = { month: string; travellers: number; origin: string; dest: string; qsuite: boolean; fare: string; rows: Row[] };
type Result = { plans: Plan[]; considered: { seats: number; droppedNotQsuite: number; droppedTooFewSeats: number }; empty: string | null; explanations: string[]; names: Record<string, string>; meta: { sampleSeats: boolean; seatsFetchedAt: string; rulesCheckedOn: string } };
type Phase = 'trip' | 'plans' | 'check' | 'path';

const AIRPORTS = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'PNQ', 'AMD'];
const DESTS = [
  { value: 'US', label: 'Anywhere in the US', codes: ['JFK', 'ORD', 'LAX', 'MIA'] },
  { value: 'JFK', label: 'New York (JFK)', codes: ['JFK'] },
  { value: 'ORD', label: 'Chicago (ORD)', codes: ['ORD'] },
  { value: 'LAX', label: 'Los Angeles (LAX)', codes: ['LAX'] },
  { value: 'MIA', label: 'Miami (MIA)', codes: ['MIA'] },
];
const STEPS: [Phase, string][] = [['trip', 'Trip'], ['plans', 'Plans'], ['check', 'Check'], ['path', 'Transfer']];
const n = (x: number) => x.toLocaleString('en-IN');
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 10);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (m: string) => (m ? new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

export default function PlanFlow({ cards, initialQuery }: { cards: CardOpt[]; initialQuery: string }) {
  const [phase, setPhase] = useState<Phase>('trip');
  const [text, setText] = useState(initialQuery);
  const [form, setForm] = useState<Form>({ month: '', travellers: 1, origin: 'DEL', dest: 'US', qsuite: true, fare: '', rows: [] });
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [via, setVia] = useState<'claude' | 'rules' | null>(null);
  const [busy, setBusy] = useState<'read' | 'plan' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [wordsVia, setWordsVia] = useState<'claude' | 'rules'>('rules');
  const [pick, setPick] = useState(0);
  const [nameOk, setNameOk] = useState(false);
  const [seatOk, setSeatOk] = useState(false);
  const started = useRef(false);

  const label = (id: string) => {
    const c = cards.find(x => x.id === id);
    return c ? `${c.bankName.replace(/ Bank| Card/, '')} ${c.name}` : id;
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Device storage can only be read after mount: reading it during render would not match the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const profile = loadProfile();
    if (profile) {
      setForm(f => ({ ...f, origin: profile.airport || f.origin, rows: profile.cardIds.map(id => ({ cardId: id, balance: profile.balances[id] ? String(profile.balances[id]) : '' })) }));
      if (profile.cardIds.length) setShowForm(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    if (initialQuery) void read(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function read(sentence = text) {
    setBusy('read');
    setError('');
    try {
      const res = await fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: sentence, homeAirport: form.origin }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not read that.');
      const p = body.parsed as ParsedTrip;
      setForm(f => ({
        month: p.month ?? f.month,
        travellers: p.travellers,
        origin: p.origin ?? f.origin,
        dest: p.dests.length === 1 ? p.dests[0] : 'US',
        qsuite: p.mustProduct === 'Qsuite',
        fare: p.cashFareInr ? String(p.cashFareInr) : f.fare,
        rows: p.cardIds.length ? p.cardIds.map(id => ({ cardId: id, balance: p.balances[id] ? String(p.balances[id]) : '' })) : f.rows,
      }));
      setNotes(p.notes);
      setVia(body.via);
      setShowForm(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that. Fill it in yourself below.');
      setShowForm(true);
    } finally {
      setBusy(null);
    }
  }

  const problems: string[] = [];
  if (!form.rows.length) problems.push('Add at least one card.');
  else if (form.rows.some(r => !Number(r.balance))) problems.push('Add a balance for every card.');
  if (!form.month) problems.push('Pick a month.');

  async function build() {
    setBusy('plan');
    setError('');
    const dest = DESTS.find(d => d.value === form.dest) ?? DESTS[0];
    const payload = {
      trip: { origin: form.origin, dests: dest.codes, month: form.month, travellers: form.travellers, cabin: 'business', mustProduct: form.qsuite ? 'Qsuite' : null, cashFareInr: form.fare ? Number(form.fare) : null },
      holdings: { cardIds: form.rows.map(r => r.cardId), balances: Object.fromEntries(form.rows.map(r => [r.cardId, Number(r.balance)])) },
    };
    try {
      const res = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not build the plan.');
      setResult(body);
      setWords(body.explanations);
      setWordsVia('rules');
      setPick(0);
      setNameOk(false);
      setSeatOk(false);
      setPhase('plans');
      scrollTo({ top: 0 });
      if (body.plans.length) {
        fetch('/api/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
          .then(r => (r.ok ? r.json() : null))
          .then(x => {
            if (x?.via === 'claude' && x.explanations.length === body.plans.length) {
              setWords(x.explanations);
              setWordsVia('claude');
            }
          })
          .catch(() => undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the plan.');
    } finally {
      setBusy(null);
    }
  }

  const go = (p: Phase) => {
    setPhase(p);
    scrollTo({ top: 0 });
  };
  const plan = result?.plans[pick];
  const reached = STEPS.findIndex(([p]) => p === phase);
  const nm = (id: string) => result?.names[id] ?? id;
  const chain = (t: Plan['transfers'][number]) => ({ nodes: [t.hops[0].from, ...t.hops.map(h => h.to)].map(nm), ratios: t.hops.map(h => `${h.ratio_in}:${h.ratio_out}`) });

  const stepper = (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map(([p, name], i) => (
        <li key={p} className={i < reached ? 'done' : i === reached ? 'now' : undefined} aria-current={i === reached ? 'step' : undefined}>
          <span className="dot">{i < reached ? <Check size={12} /> : i + 1}</span>
          {name}
        </li>
      ))}
    </ol>
  );

  /* ---------------- step 1: trip ---------------- */
  if (phase === 'trip' || !result) {
    return (
      <div className="container flow">
        <div className="flow-head">{stepper}<span className="tag">Step 1 of 4</span></div>
        <div className="flow-grid two">
          <div className="stack" style={{ ['--stack' as string]: '20px' }}>
            <h1 className="t-h1">Where to, and what are you holding?</h1>
            <div className="field">
              <label htmlFor="trip-text">Your trip</label>
              <textarea id="trip-text" value={text} onChange={e => setText(e.target.value)} maxLength={700} placeholder="US in October, Qsuite from Doha. I hold Infinia and Amex." />
              <span className="help">One sentence is enough. We ask before assuming.</span>
            </div>
            <div className="btn-row">
              <button type="button" className={showForm ? 'btn btn-secondary' : 'btn btn-primary'} disabled={busy !== null || text.trim().length < 3} onClick={() => read()}>
                {busy === 'read' ? <><span className="spin" /> Reading</> : 'Read my trip'}
              </button>
              {!showForm && <button type="button" className="btn btn-ghost" onClick={() => setShowForm(true)}>Fill it in myself</button>}
            </div>
            {error && <div className="note note-bad" role="alert"><Warn />{error}</div>}

            {showForm && (
              <div className="stack settle" style={{ ['--stack' as string]: '20px' }}>
                {(notes.length > 0 || via) && (
                  <div className="note note-info" role="status"><Info /><div>
                    <b>Check what we read.</b>{via === 'claude' ? ' Claude read your sentence.' : ' We read your sentence with fixed rules.'} Fix anything below before you build the plan.
                    {notes.length > 0 && <ul style={{ marginTop: 6 }}>{notes.map(x => <li key={x}>{x}</li>)}</ul>}
                  </div></div>
                )}

                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="t-title" style={{ marginBottom: 4 }}>Your cards</legend>
                  <p className="t-sm muted">Balances are typed, never linked. Points sit on each card’s own account.</p>
                  {form.rows.map((r, i) => {
                    const val = Number(r.balance) || 0;
                    return (
                      <div className="cardrow" key={r.cardId}>
                        <span className="nm">{label(r.cardId)}</span>
                        <div className={'field bal' + (val >= 1000000 ? ' bad' : '')}>
                          <label htmlFor={`bal-${r.cardId}`} className="sr">Points on {label(r.cardId)}</label>
                          <input id={`bal-${r.cardId}`} inputMode="numeric" placeholder="Points, for example 1,20,000" value={r.balance ? n(Number(r.balance)) : ''}
                            onChange={e => setForm(f => ({ ...f, rows: f.rows.map((x, j) => (j === i ? { ...x, balance: digits(e.target.value) } : x)) }))} />
                          {val >= 1000000 && <span className="err">That is 10 lakh or more. Check it: 1.2 lakh is 1,20,000.</span>}
                        </div>
                        <button type="button" className="icon-btn" aria-label={`Remove ${label(r.cardId)}`} onClick={() => setForm(f => ({ ...f, rows: f.rows.filter((_, j) => j !== i) }))}><Close /></button>
                      </div>
                    );
                  })}
                  <div className="field" style={{ marginTop: 16, maxWidth: 360 }}>
                    <label htmlFor="add-card">Add a card</label>
                    <select id="add-card" value="" onChange={e => e.target.value && setForm(f => ({ ...f, rows: [...f.rows, { cardId: e.target.value, balance: '' }] }))}>
                      <option value="">Choose a card</option>
                      {[...new Set(cards.map(c => c.bankId))].map(b => (
                        <optgroup key={b} label={cards.find(c => c.bankId === b)!.bankName}>
                          {cards.filter(c => c.bankId === b && !form.rows.some(r => r.cardId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </fieldset>

                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="t-title" style={{ marginBottom: 12 }}>The trip</legend>
                  <div className="grid-2">
                    <div className="field"><label htmlFor="origin">Starting airport</label>
                      <select id="origin" value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}>{AIRPORTS.map(a => <option key={a}>{a}</option>)}</select></div>
                    <div className="field"><label htmlFor="dest">Going to</label>
                      <select id="dest" value={form.dest} onChange={e => setForm(f => ({ ...f, dest: e.target.value }))}>{DESTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                    <div className="field"><label htmlFor="month">Month</label>
                      <input id="month" type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} /></div>
                    <div className="field"><label htmlFor="pax">Travellers</label>
                      <select id="pax" value={form.travellers} onChange={e => setForm(f => ({ ...f, travellers: Number(e.target.value) }))}>{[1, 2, 3, 4, 5, 6].map(x => <option key={x} value={x}>{x}</option>)}</select></div>
                  </div>
                  <label className="check-box" style={{ marginTop: 16 }}>
                    <input type="checkbox" checked={form.qsuite} onChange={e => setForm(f => ({ ...f, qsuite: e.target.checked }))} />
                    <span><b>Doha to the US must be Qsuite.</b><br /><span className="t-sm muted">We keep only Qatar aircraft types that carry Qsuite. India to Doha stays flexible.</span></span>
                  </label>
                  <div className="field" style={{ marginTop: 16, maxWidth: 360 }}>
                    <label htmlFor="fare">Cash fare for the whole party, in ₹ (optional)</label>
                    <input id="fare" inputMode="numeric" placeholder="For example 6,00,000" value={form.fare ? n(Number(form.fare)) : ''} onChange={e => setForm(f => ({ ...f, fare: digits(e.target.value) }))} />
                    <span className="help">Used for value per point. We have no fare feed yet, so you type it.</span>
                  </div>
                </fieldset>

                {problems.length > 0 && <p className="t-sm" style={{ color: 'var(--color-warning)' }}>{problems.join(' ')}</p>}
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" disabled={problems.length > 0 || busy !== null} onClick={build}>
                    {busy === 'plan' ? <><span className="spin" /> Building</> : <>Build my plan <Arrow /></>}
                  </button>
                </div>
                <p className="t-sm muted"><Lock size={14} /> We never ask for logins or OTPs. Not financial advice: verify with your bank.</p>
              </div>
            )}
          </div>

          <aside className="stack" style={{ ['--stack' as string]: '16px', alignSelf: 'start' }}>
            <div className="card-flat">
              <h2 className="t-title">What we do with this</h2>
              <ul className="stack t-sm muted" style={{ ['--stack' as string]: '10px', marginTop: 12 }}>
                <li>We read your sentence, then you confirm the cards and balances. A misread 1.2 lakh would break every step after it.</li>
                <li>Fixed rules, not guesses, find the cheapest transfer chain, keep only Qsuite aircraft and check the caps.</li>
                <li>Seats come from cached data. Every plan shows how old it is.</li>
              </ul>
            </div>
            <div className="note note-warn"><Warn /><span>Demo seats are a labelled sample for Doha to JFK, ORD, LAX and MIA in October 2027.</span></div>
            <p className="t-sm muted">Want to save your cards? <Link href="/start">Set up once</Link> and they will be here next time.</p>
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------- step 2: plans ---------------- */
  if (phase === 'plans') {
    return (
      <div className="container flow">
        <div className="flow-head">{stepper}<span className="tag">Step 2 of 4</span></div>
        <div className="stack" style={{ ['--stack' as string]: '20px' }}>
          <div>
            <h1 className="t-h1">{result.plans.length ? `Your top ${result.plans.length === 1 ? 'plan' : `${result.plans.length} plans`}` : 'No plan yet'}</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              {DESTS.find(d => d.value === form.dest)?.label} · {monthLabel(form.month)} · {form.travellers} {form.travellers === 1 ? 'traveller' : 'travellers'}{form.qsuite ? ' · Qsuite' : ''}
            </p>
          </div>
          {result.meta.sampleSeats && <div className="note note-warn"><Warn /><span>Seat data is a labelled sample, checked {ageText(Math.round((Date.now() - new Date(result.meta.seatsFetchedAt).getTime()) / 60000))} ago. Live availability needs a seats.aero key.</span></div>}
          {result.empty && <div className="note note-info" role="status"><Info />{result.empty}</div>}
          {result.considered.droppedNotQsuite > 0 && <p className="t-sm muted">We dropped {result.considered.droppedNotQsuite} flights without Qsuite aircraft{result.considered.droppedTooFewSeats ? ` and ${result.considered.droppedTooFewSeats} with too few seats` : ''}.</p>}

          <div className="stack" style={{ ['--stack' as string]: '16px' }}>
            {result.plans.map((p, i) => {
              const gap = p.kind === 'get_card' && p.newCard;
              return (
                <article key={i} className="card plan settle" data-best={p.rank === 1} style={{ animationDelay: `${i * 90}ms` }} aria-labelledby={`plan-${i}`}>
                  <div className="top">
                    <div className="btn-row" style={{ gap: 8 }}>
                      <span className={p.kind === 'best_path' ? 'tag tag-best' : p.kind === 'direct' ? 'tag tag-steel' : 'tag'}>{p.kind === 'best_path' ? 'Best path' : p.kind === 'direct' ? 'Direct' : 'Get a card'}</span>
                      <span className="tag tag-sand">{p.qsuiteFit === 'some' ? 'Qsuite on some' : 'Qsuite'}</span>
                    </div>
                    <span className="t-mono muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Clock size={14} />seats {ageText(p.safety.seatAgeMinutes)} ago</span>
                  </div>
                  <h3 id={`plan-${i}`} className="t-title" style={{ marginTop: 16 }}>{gap ? `Add ${label(p.newCard!.cardId)} to close the gap` : p.headline}</h3>
                  <p className="points t-num">{gap ? `${n(p.newCard!.sourcePointsForShortfall)} points` : `${n(p.sourcePointsTotal)} points`}</p>
                  <p className="t-sm muted">
                    {gap ? `on ${label(p.newCard!.cardId)}, for the ${n(p.shortfallMiles)} Avios you are short` : `${n(p.milesCovered)} of ${n(p.milesNeeded)} Avios in ${nm(p.seat.programme)} · ${p.seat.flights.join(', ')} · ${p.seat.aircraft}`}
                  </p>
                  <div className="stack" style={{ ['--stack' as string]: '10px', marginTop: 16 }}>
                    {gap
                      ? <PathChain {...chain({ ...p.newCard!, cardId: p.newCard!.cardId, cardName: p.newCard!.cardName, sourcePoints: p.newCard!.sourcePointsForShortfall, targetMiles: p.shortfallMiles, cap: { limit: null, period: null, ok: true, monthsNeeded: 1 } })} />
                      : p.transfers.map(t => (
                        <div key={t.cardId}>
                          <p className="t-sm" style={{ marginBottom: 6 }}><b>{label(t.cardId)}</b> · <span className="t-mono">{n(t.sourcePoints)}</span> points</p>
                          <PathChain {...chain(t)} />
                        </div>
                      ))}
                  </div>
                  <p className="why t-lg">{words[i] ?? <><span className="skeleton" /><span className="skeleton" /></>}</p>
                  <div className="stamps">
                    <span className={p.safety.rules.state === 'unverified' ? 'tag tag-warn' : 'tag tag-ok'}>{p.safety.rules.state === 'unverified' ? 'Ratios unverified' : 'Route confirmed'}</span>
                    <span className="tag">Rules checked {day(p.safety.rules.checkedOn)}</span>
                    {p.transfers.length > 0 && <span className={p.safety.cap.ok && p.safety.cap.monthsNeeded <= 1 ? 'tag tag-ok' : 'tag tag-bad'}>{p.safety.cap.ok && p.safety.cap.monthsNeeded <= 1 ? 'Cap OK' : `Cap: ${p.safety.cap.monthsNeeded} months`}</span>}
                    {p.valuePerPoint !== null && <span className="tag">₹{p.valuePerPoint} per point</span>}
                  </div>
                  {p.positioning.seat && <p className="t-sm muted" style={{ marginTop: 12 }}>India to Doha: {p.positioning.seat.origin} on {day(p.positioning.seat.date)}, {n(p.positioning.milesNeeded!)} Avios or pay cash. Not included above.</p>}
                  {p.kind !== 'get_card' && (
                    <div className="acts">
                      <button type="button" className={p.rank === 1 ? 'btn btn-primary' : 'btn btn-secondary'} disabled={p.shortfallMiles > 0}
                        onClick={() => { setPick(i); setNameOk(false); setSeatOk(false); go('check'); }}>
                        Check this plan <Arrow />
                      </button>
                      {p.shortfallMiles > 0 && <span className="t-sm" style={{ marginLeft: 12, color: 'var(--color-warning)' }}>Short by {n(p.shortfallMiles)} Avios</span>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <p className="t-sm muted">{wordsVia === 'claude' ? 'Explanations written by Claude from the numbers above.' : 'Explanations written from the numbers above.'} The numbers come from fixed rules, not from AI.</p>
          <div className="btn-row"><button type="button" className="btn btn-secondary" onClick={() => go('trip')}><Back /> Change trip or cards</button></div>
        </div>
      </div>
    );
  }

  /* ---------------- step 3 and 4 need a real plan ---------------- */
  if (!plan) return null;
  const s = plan.safety;
  const blocked = plan.shortfallMiles > 0;
  const capNote = s.cap.limit ? `${n(s.cap.needed)} / ${n(s.cap.limit)}${s.cap.period === 'year' ? ' a year' : ' a month'}` : 'no cap found';

  if (phase === 'check') {
    return (
      <div className="container flow">
        <div className="flow-head">{stepper}<span className="tag">Step 3 of 4</span></div>
        <div className="flow-grid two">
          <div className="stack" style={{ ['--stack' as string]: '20px' }}>
            <h1 className="t-h1">Before you transfer</h1>
            <ul className="checks" aria-label="Pre-transfer check">
              <li className={s.rules.state === 'unverified' ? 'warn' : 'ok'}>{s.rules.state === 'unverified' ? <Warn /> : <Check />}<span>Ratio and cap checked against public sources, not yet against the bank portal. Match each hop on the portal.</span><span className="val">{day(s.rules.checkedOn)}</span></li>
              <li className={s.cap.ok && s.cap.monthsNeeded <= 1 ? 'ok' : 'bad'}>{s.cap.ok && s.cap.monthsNeeded <= 1 ? <Check /> : <Warn />}<span>{s.cap.ok && s.cap.monthsNeeded <= 1 ? 'Within the cap we know about. We cannot see what you already used this period, so check your bank app.' : `This needs ${s.cap.monthsNeeded} months at the monthly cap.`}</span><span className="val">{capNote}</span></li>
              <li className={s.seatAgeMinutes > 60 ? 'warn' : 'ok'}>{s.seatAgeMinutes > 60 ? <Warn /> : <Check />}<span>Seat data age. A seat can be gone by now.</span><span className="val">{ageText(s.seatAgeMinutes)}</span></li>
              <li className={s.aircraft.fit === 'all' && s.aircraft.listVerified ? 'ok' : 'warn'}>{s.aircraft.fit === 'all' && s.aircraft.listVerified ? <Check /> : <Warn />}<span>{s.aircraft.type}: {s.aircraft.fit === 'all' ? 'fitted with Qsuite' : 'only part of this fleet has Qsuite'}. {s.aircraft.listVerified ? '' : 'Our aircraft list is not yet verified.'}</span><span className="val">{s.aircraft.type}</span></li>
            </ul>
            <label className="check-box"><input type="checkbox" checked={nameOk} onChange={e => setNameOk(e.target.checked)} /><span><b>My name matches my passport</b> on the bank and on the airline account.</span></label>
            <label className="check-box"><input type="checkbox" checked={seatOk} onChange={e => setSeatOk(e.target.checked)} /><span><b>I confirmed the seat and the aircraft</b> on the airline’s site, just now.</span></label>
            <div className="note note-bad"><Lock /><span>Transfers cannot be undone. Once points leave your bank they stay in the airline programme.{s.cap.limit ? ` Cap: ${n(s.cap.limit)} points ${s.cap.period === 'year' ? 'a year' : 'a month'}.` : ''}</span></div>
            {blocked && <div className="note note-warn"><Warn />You are {n(plan.shortfallMiles)} Avios short of this seat. Add a card or pick another plan.</div>}
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={() => go('plans')}><Back /> Back to plans</button>
              <button type="button" className="btn btn-danger" disabled={!nameOk || !seatOk || blocked} onClick={() => go('path')}><Lock size={16} /> Show transfer steps</button>
            </div>
          </div>
          <aside className="card" data-best="true" style={{ alignSelf: 'start' }}>
            <span className="tag tag-best">{plan.kind === 'direct' ? 'Direct' : 'Best path'}</span>
            <h2 className="t-title" style={{ marginTop: 12 }}>{plan.headline}</h2>
            <p className="t-num" style={{ marginTop: 4 }}>{n(plan.sourcePointsTotal)} points</p>
            <p className="t-sm muted">{plan.seat.flights.join(', ')} · {plan.seat.aircraft}</p>
            <hr className="rule-line" />
            <div className="stack" style={{ ['--stack' as string]: '12px' }}>{plan.transfers.map(t => <div key={t.cardId}><p className="t-sm"><b>{label(t.cardId)}</b> · {n(t.sourcePoints)}</p><PathChain {...chain(t)} /></div>)}</div>
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------- step 4: transfer steps ---------------- */
  const directPlan = result.plans.find(p => p.kind === 'direct' && p.seat === plan.seat);
  return (
    <div className="container flow">
      <div className="flow-head">{stepper}<span className="tag">Step 4 of 4</span></div>
      <div className="stack" style={{ ['--stack' as string]: '24px' }}>
        <div>
          <h1 className="t-h1">Your transfer steps</h1>
          <p className="muted measure" style={{ marginTop: 8 }}>Card Mafia does not move points. Make each transfer in your bank’s portal, in this order, and confirm the seat before the first one.</p>
        </div>
        {plan.transfers.map((t, ti) => (
          <section key={t.cardId} className="card" aria-labelledby={`t-${ti}`}>
            <h2 id={`t-${ti}`} className="t-title">From {label(t.cardId)}: {n(t.sourcePoints)} points to {n(t.targetMiles)} Avios</h2>
            <ol className="stack" style={{ ['--stack' as string]: '0px', marginTop: 12 }}>
              {t.hops.map((h, hi) => (
                <li key={h.ruleId} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12, padding: '14px 0', borderTop: '1px solid var(--color-border)' }}>
                  <span className="dot" style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--color-accent-strong)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-accent-strong)' }}>{hi + 1}</span>
                  <div>
                    <p><b>Transfer <span className="t-mono">{n(h.points_in)}</span> {nm(h.from)} to {nm(h.to)}</b> <span className="ratio">at {h.ratio_in}:{h.ratio_out}</span></p>
                    <p className="t-sm muted" style={{ marginTop: 4 }}>You receive {n(h.points_out)}. {h.sourceNote} {h.sourceUrl && <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {directPlan && <div className="note note-info"><Info /><span>The direct route for this seat needs {n(directPlan.sourcePointsTotal)} points. This chain needs {n(plan.sourcePointsTotal)}.</span></div>}
        <section aria-labelledby="risk-h">
          <h2 id="risk-h" className="t-title">Know these risks first</h2>
          <ul className="stack" style={{ ['--stack' as string]: '8px', marginTop: 12 }}>
            {plan.risks.map(r => <li key={r} className="note note-warn"><Warn />{r}</li>)}
          </ul>
        </section>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => go('check')}><Back /> Back to the check</button>
          <button type="button" className="btn btn-secondary" onClick={() => go('plans')}>All plans</button>
        </div>
      </div>
    </div>
  );
}
