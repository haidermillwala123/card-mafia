'use client';

import Link from 'next/link';
import Select from '@/components/Select';
import { useEffect, useRef, useState } from 'react';
import PathChain from '@/components/PathChain';
import { Close, Info, Warn } from '@/components/Icons';
import { loadProfile } from '@/lib/profile';
import { formatIndian as n, valuePerPoint } from '@/lib/engine/engine';

type CardOpt = { id: string; name: string; bankId: string; bankName: string };
type Prog = { id: string; name: string };
type Tab = 'forward' | 'reverse' | 'pool' | 'value';
type Chain = { nodes: string[]; ratios: string[] };
type Cap = { limit: number | null; period: 'month' | 'year' | null; ok: boolean; monthsNeeded: number };
type Row = { programme: string; name: string; miles: number; pointsUsed: number; rate: number; chain: Chain; cap: Cap; transferTime: string | null; confirmed: boolean; vsDirect?: number; card?: string; cardId?: string };
type Pool = { transfers: { cardId: string; card: string; sourcePoints: number; targetMiles: number; chain: Chain; cap: Cap; transferTime: string | null }[]; shortfall: number; target: string };

const TABS: [Tab, string, string][] = [
  ['forward', 'Points to miles', 'What one card’s points become in every airline programme it reaches.'],
  ['reverse', 'Miles to points', 'How many points each card needs for the miles you want.'],
  ['pool', 'Combine my cards', 'Cover one award with points from several cards.'],
  ['value', 'Value per point', 'What a redemption is worth against the cash fare.'],
];
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9);
const num = (s: string) => Number(s) || 0;
const capText = (c: Cap) => (c.limit ? `${n(c.limit)} a ${c.period === 'year' ? 'year' : 'month'}` : 'no cap found');

// Calls the server calculator after a short pause, and ignores answers that arrive out of order.
function useCalc<T>(body: object | null) {
  const [out, setOut] = useState<{ data: T | null; error: string }>({ data: null, error: '' });
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify(body);
  useEffect(() => {
    if (!key || key === 'null') return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch('/api/calc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: key });
        const json = await res.json();
        if (id === seq.current) setOut(res.ok ? { data: json, error: '' } : { data: null, error: json.error ?? 'Could not calculate.' });
      } catch {
        if (id === seq.current) setOut({ data: null, error: 'Could not calculate. Check your connection.' });
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [key]);
  return { ...out, busy };
}

export default function Calculator({ cards, airlines }: { cards: CardOpt[]; airlines: Prog[] }) {
  const label = (id: string) => { const c = cards.find(x => x.id === id); return c ? `${c.bankName.replace(/ Bank| Card/, '')} ${c.name}` : id; };
  const [tab, setTab] = useState<Tab>('forward');
  const [cardId, setCardId] = useState('hdfc-infinia');
  const [points, setPoints] = useState('120000');
  const [direct, setDirect] = useState(false);
  const [target, setTarget] = useState('qatar-privilege-club');
  const [miles, setMiles] = useState('140000');
  const [pool, setPool] = useState<{ cardId: string; balance: string }[]>([{ cardId: 'hdfc-infinia', balance: '120000' }, { cardId: 'amex-plat-travel', balance: '65000' }]);
  const [fare, setFare] = useState('');
  const [taxes, setTaxes] = useState('');
  const [used, setUsed] = useState('');
  const [mine, setMine] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Device storage can only be read after mount: reading it during render would not match the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = loadProfile();
    if (p?.cardIds.length) {
      const ids = p.cardIds.filter(id => cards.some(c => c.id === id));
      if (ids.length) {
        setMine(ids);
        setCardId(ids[0]);
        setPool(ids.map(id => ({ cardId: id, balance: p.balances[id] ? String(p.balances[id]) : '' })));
        if (p.balances[ids[0]]) setPoints(String(p.balances[ids[0]]));
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cards]);

  const fwd = useCalc<{ rows: Row[]; card: string }>(tab === 'forward' && num(points) ? { mode: 'forward', cardId, points: num(points), direct } : null);
  const rev = useCalc<{ rows: Row[]; target: string }>(tab === 'reverse' && num(miles) ? { mode: 'reverse', target, miles: num(miles), direct } : null);
  const pooled = useCalc<Pool>(tab === 'pool' && num(miles) ? { mode: 'pool', target, miles: num(miles), direct, rows: pool.map(p => ({ cardId: p.cardId, balance: num(p.balance) })) } : null);
  const vpp = num(fare) && num(used) ? valuePerPoint(num(fare), num(taxes), num(used)) : null;

  const directToggle = (
    <label className="check-box">
      <input type="checkbox" checked={direct} onChange={e => setDirect(e.target.checked)} />
      <span><b>Direct transfers only</b><br /><span className="t-sm muted">Skip multi-hop chains through other programmes.</span></span>
    </label>
  );
  const cardOptions = [...new Set(cards.map(c => c.bankId))].map(b => (
    <optgroup key={b} label={cards.find(c => c.bankId === b)!.bankName}>
      {cards.filter(c => c.bankId === b).map(c => <option key={c.id} value={c.id}>{c.bankName.replace(/ Bank| Card/, '')} {c.name}{mine.includes(c.id) ? ' (yours)' : ''}</option>)}
    </optgroup>
  ));
  const targetField = (
    <div className="field"><label htmlFor="target">Programme</label>
      <Select id="target" value={target} onChange={e => setTarget(e.target.value)}>{airlines.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
  );
  const status = (c: { busy: boolean; error: string }) => (c.error ? <div className="note note-bad" role="alert"><Warn />{c.error}</div> : c.busy ? <p className="t-sm muted" role="status"><span className="spin" /> Calculating</p> : null);
  const capCell = (c: Cap, time: string | null) => (
    <td className="t-sm" data-l="Limit">{capText(c)}{c.monthsNeeded > 1 && <div style={{ color: 'var(--color-warning)' }}>{c.monthsNeeded} months</div>}{time && <div className="muted">{time}</div>}</td>
  );

  return (
    <div className="container flow">
      <div className="stack" style={{ ['--stack' as string]: '20px' }}>
        <h1 className="t-h1">Points calculator</h1>
        <p className="t-lg muted measure">Type a card and a balance. See what it becomes in every airline programme it reaches, including chains through other programmes. Every number comes from the same fixed rules the plans use.</p>

        <div className="btn-row" role="tablist" aria-label="Calculator">
          {TABS.map(([id, name]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => setTab(id)}>{name}</button>)}
        </div>
        <p className="t-sm muted">{TABS.find(t => t[0] === tab)![2]}</p>
        <div className="note note-warn"><Warn /><span>Ratios come from public sources and are not yet matched to the bank portals. <Link href="/rules">See every rule and source</Link>.</span></div>

        {tab === 'forward' && (
          <section className="stack settle" style={{ ['--stack' as string]: '16px' }} aria-label="Points to miles">
            <div className="grid-2">
              <div className="field"><label htmlFor="card">Card</label><Select id="card" value={cardId} onChange={e => setCardId(e.target.value)}>{cardOptions}</Select></div>
              <div className="field"><label htmlFor="pts">Points on the card</label><input id="pts" inputMode="numeric" value={points ? n(num(points)) : ''} placeholder="For example 1,20,000" onChange={e => setPoints(digits(e.target.value))} />
                <span className="btn-row" style={{ gap: 6 }}>{[50000, 100000, 150000, 500000].map(v => <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => setPoints(String(v))}>{n(v)}</button>)}</span></div>
            </div>
            {directToggle}
            {status(fwd)}
            {!num(points) && <div className="note note-info"><Info />Add a balance to see what it buys.</div>}
            {fwd.data && fwd.data.rows.length === 0 && num(points) > 0 && <div className="note note-info"><Info />{fwd.data.card} has no transfer route to an airline in our rules.</div>}
            {fwd.data && fwd.data.rows.length > 0 && (
              <div className="table-wrap" role="status"><table className="data data--cards">
                <thead><tr><th>Programme</th><th className="n">Miles</th><th className="n">Rate</th><th>Path</th><th>Limit</th></tr></thead>
                <tbody>{fwd.data.rows.map((r, i) => (
                  <tr key={r.programme}>
                    <td><b>{r.name}</b>{i === 0 && fwd.data!.rows[1]?.miles !== r.miles && <> <span className="tag tag-best">Most miles</span></>}{r.confirmed && <> <span className="tag tag-ok">Route seen working</span></>}</td>
                    <td className="n" data-l="Miles"><b>{n(r.miles)}</b>{(r.vsDirect ?? 0) > 0 && r.chain.nodes.length > 2 && <div className="t-sm muted">+{n(r.vsDirect!)} vs direct</div>}</td>
                    <td className="n" data-l="Points for 1 mile">{r.rate}:1</td>
                    <td data-l="Route"><PathChain {...r.chain} /></td>
                    {capCell(r.cap, r.transferTime)}
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        )}

        {tab === 'reverse' && (
          <section className="stack settle" style={{ ['--stack' as string]: '16px' }} aria-label="Miles to points">
            <div className="grid-2">
              {targetField}
              <div className="field"><label htmlFor="miles">Miles you want</label><input id="miles" inputMode="numeric" value={miles ? n(num(miles)) : ''} placeholder="For example 1,40,000" onChange={e => setMiles(digits(e.target.value))} /></div>
            </div>
            {directToggle}
            {status(rev)}
            {rev.data && rev.data.rows.length === 0 && <div className="note note-info"><Info />No card in our rules reaches {rev.data.target}.</div>}
            {rev.data && rev.data.rows.length > 0 && (
              <div className="table-wrap" role="status"><table className="data data--cards">
                <thead><tr><th>Card</th><th className="n">Points needed</th><th className="n">Rate</th><th>Path</th><th>Limit</th></tr></thead>
                <tbody>{rev.data.rows.map((r, i) => (
                  <tr key={r.cardId}>
                    <td><b>{r.card}</b>{mine.includes(r.cardId!) && <> <span className="tag">Yours</span></>}{i === 0 && <> <span className="tag tag-best">Fewest points</span></>}</td>
                    <td className="n" data-l="Points needed"><b>{n(r.pointsUsed)}</b></td>
                    <td className="n" data-l="Points for 1 mile">{r.rate}:1</td>
                    <td data-l="Route"><PathChain {...r.chain} /></td>
                    {capCell(r.cap, r.transferTime)}
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        )}

        {tab === 'pool' && (
          <section className="stack settle" style={{ ['--stack' as string]: '16px' }} aria-label="Combine my cards">
            <div className="grid-2">
              {targetField}
              <div className="field"><label htmlFor="miles2">Miles you want</label><input id="miles2" inputMode="numeric" value={miles ? n(num(miles)) : ''} placeholder="For example 1,40,000" onChange={e => setMiles(digits(e.target.value))} /></div>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="t-title">Your cards</legend>
              {pool.map((p, i) => (
                <div className="cardrow" key={p.cardId}>
                  <span className="nm">{label(p.cardId)}</span>
                  <div className="field bal"><label htmlFor={`p-${p.cardId}`} className="sr">Points on {label(p.cardId)}</label>
                    <input id={`p-${p.cardId}`} inputMode="numeric" placeholder="Points" value={p.balance ? n(num(p.balance)) : ''} onChange={e => setPool(x => x.map((y, j) => (j === i ? { ...y, balance: digits(e.target.value) } : y)))} /></div>
                  <button type="button" className="icon-btn" aria-label={`Remove ${label(p.cardId)}`} onClick={() => setPool(x => x.filter((_, j) => j !== i))}><Close /></button>
                </div>
              ))}
              <div className="field" style={{ marginTop: 16, maxWidth: 360 }}><label htmlFor="addp">Add a card</label>
                <Select id="addp" value="" onChange={e => e.target.value && setPool(x => [...x, { cardId: e.target.value, balance: '' }])}>
                  <option value="">Choose a card</option>
                  {cards.filter(c => !pool.some(p => p.cardId === c.id)).map(c => <option key={c.id} value={c.id}>{c.bankName.replace(/ Bank| Card/, '')} {c.name}</option>)}
                </Select></div>
            </fieldset>
            {directToggle}
            {status(pooled)}
            {pooled.data && (
              <div role="status" className="stack" style={{ ['--stack' as string]: '12px' }}>
                {pooled.data.transfers.map(t => (
                  <div className="card" key={t.cardId}>
                    <p><b>{t.card}</b>: <span className="t-mono">{n(t.sourcePoints)}</span> points to <span className="t-mono">{n(t.targetMiles)}</span> miles</p>
                    <div style={{ marginTop: 8 }}><PathChain {...t.chain} /></div>
                    {t.cap.monthsNeeded > 1 && <p className="t-sm" style={{ color: 'var(--color-warning)', marginTop: 8 }}>Cap {capText(t.cap)}: this takes {t.cap.monthsNeeded} months.</p>}
                  </div>
                ))}
                {pooled.data.shortfall === 0 && pooled.data.transfers.length > 0 && <div className="note note-ok"><Info />These cards cover {n(num(miles))} miles in {pooled.data.target}. Total points spent: {n(pooled.data.transfers.reduce((s, t) => s + t.sourcePoints, 0))}.</div>}
                {pooled.data.shortfall > 0 && <div className="note note-warn"><Warn />You are {n(pooled.data.shortfall)} miles short with these balances.{pooled.data.transfers.length === 0 ? ' None of the cards listed reaches this programme.' : ''}</div>}
              </div>
            )}
          </section>
        )}

        {tab === 'value' && (
          <section className="stack settle" style={{ ['--stack' as string]: '16px' }} aria-label="Value per point">
            <div className="grid-2">
              <div className="field"><label htmlFor="fare">Cash fare, in ₹</label><input id="fare" inputMode="numeric" placeholder="For example 6,00,000" value={fare ? n(num(fare)) : ''} onChange={e => setFare(digits(e.target.value))} /></div>
              <div className="field"><label htmlFor="taxes">Cash taxes on the award, in ₹</label><input id="taxes" inputMode="numeric" placeholder="For example 38,000" value={taxes ? n(num(taxes)) : ''} onChange={e => setTaxes(digits(e.target.value))} /></div>
              <div className="field"><label htmlFor="used">Card points you would spend</label><input id="used" inputMode="numeric" placeholder="For example 1,60,000" value={used ? n(num(used)) : ''} onChange={e => setUsed(digits(e.target.value))} /></div>
            </div>
            <p className="t-sm muted">Value per point = (cash fare minus cash taxes) divided by the card points spent. We have no fare feed, so you type the fare.</p>
            <div role="status">{vpp !== null ? <div className="card" data-best="true"><p className="t-num">₹{vpp} per point</p><p className="t-sm muted" style={{ marginTop: 6 }}>Paying ₹{n(num(taxes))} in taxes and {n(num(used))} points instead of ₹{n(num(fare))} in cash.</p></div> : <div className="note note-info"><Info />Add the fare and the points to see the value.</div>}</div>
          </section>
        )}

        <p className="t-sm muted">Not financial advice. Verify with your bank before you transfer. Transfers cannot be undone. <Link href="/plan">Build a full plan</Link> or <Link href="/transfers">explore every transfer route</Link>.</p>
      </div>
    </div>
  );
}
