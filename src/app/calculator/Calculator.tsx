'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import PathChain from '@/components/PathChain';
import { Close, Info, Warn } from '@/components/Icons';
import { combine, formatIndian as n, pointsFor, reachable, valuePerPoint, type Data, type Hop, type Reach, type Rule } from '@/lib/engine/engine';
import { loadProfile } from '@/lib/profile';

type CardOpt = { id: string; name: string; bankId: string; bankName: string; programmeId: string };
type Prog = { id: string; name: string; kind: string };
type Tab = 'forward' | 'reverse' | 'pool' | 'value';

const TABS: [Tab, string, string][] = [
  ['forward', 'Points to miles', 'What one card’s points become in every programme it reaches.'],
  ['reverse', 'Miles to points', 'How many points each card needs for the miles you want.'],
  ['pool', 'Combine my cards', 'Cover one award with points from several cards.'],
  ['value', 'Value per point', 'What a redemption is worth against the cash fare.'],
];
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9);
const num = (s: string) => Number(s) || 0;

export default function Calculator({ cards, programmes, rules }: { cards: CardOpt[]; programmes: Prog[]; rules: Rule[] }) {
  const d = useMemo<Data>(() => ({
    rules, rulesCheckedOn: '', cards: cards.map(c => ({ id: c.id, bank: c.bankId, name: c.name, programme: c.programmeId, annual_fee_inr: null })), programmes,
    qsuite: { types: [], status: 'unverified', verified_at: null }, seats: { sample: true, fetched_at: '', rows: [] },
  }), [rules, cards, programmes]);
  const airlines = programmes.filter(p => p.kind === 'airline');
  const pn = (id: string) => programmes.find(p => p.id === id)?.name ?? id;
  const label = (id: string) => { const c = cards.find(x => x.id === id); return c ? `${c.bankName.replace(/ Bank| Card/, '')} ${c.name}` : id; };
  const chain = (h: Hop[]) => ({ nodes: [h[0].from, ...h.map(x => x.to)].map(pn), ratios: h.map(x => `${x.ratio_in}:${x.ratio_out}`) });

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
      setMine(p.cardIds);
      setCardId(p.cardIds[0]);
      setPool(p.cardIds.map(id => ({ cardId: id, balance: p.balances[id] ? String(p.balances[id]) : '' })));
      if (p.balances[p.cardIds[0]]) setPoints(String(p.balances[p.cardIds[0]]));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const fwd = useMemo(() => (num(points) ? reachable(d, cardId, num(points), direct) : []), [d, cardId, points, direct]);
  const fwdDirect = useMemo(() => new Map(reachable(d, cardId, num(points), true).map(r => [r.programme, r])), [d, cardId, points]);
  const rev = useMemo(() => {
    if (!num(miles)) return [];
    return cards.map(c => ({ c, r: pointsFor(d, c.id, target, num(miles), direct) })).filter((x): x is { c: CardOpt; r: Reach } => !!x.r).sort((a, b) => a.r.pointsUsed - b.r.pointsUsed);
  }, [d, cards, target, miles, direct]);
  const pooled = useMemo(() => {
    const held = pool.filter(p => num(p.balance) > 0);
    return combine(d, { cardIds: held.map(p => p.cardId), balances: Object.fromEntries(held.map(p => [p.cardId, num(p.balance)])) }, target, num(miles), direct);
  }, [d, pool, target, miles, direct]);
  const vpp = num(fare) && num(used) ? valuePerPoint(num(fare), num(taxes), num(used)) : null;

  const directToggle = (
    <label className="check-box" style={{ alignSelf: 'end' }}>
      <input type="checkbox" checked={direct} onChange={e => setDirect(e.target.checked)} />
      <span><b>Direct transfers only</b><br /><span className="t-sm muted">Skip multi-hop chains through other airline programmes.</span></span>
    </label>
  );
  const cardSelect = (id: string, set: (v: string) => void, name: string) => (
    <select id={name} value={id} onChange={e => set(e.target.value)}>
      {[...new Set(cards.map(c => c.bankId))].map(b => (
        <optgroup key={b} label={cards.find(c => c.bankId === b)!.bankName}>
          {cards.filter(c => c.bankId === b).map(c => <option key={c.id} value={c.id}>{c.bankName.replace(/ Bank| Card/, '')} {c.name}{mine.includes(c.id) ? ' (yours)' : ''}</option>)}
        </optgroup>
      ))}
    </select>
  );
  const capText = (c: Reach['cap']) => (c.limit ? `${n(c.limit)} a ${c.period === 'year' ? 'year' : 'month'}` : 'no cap found');
  const targetField = (
    <div className="field"><label htmlFor="target">Programme</label>
      <select id="target" value={target} onChange={e => setTarget(e.target.value)}>{airlines.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
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
              <div className="field"><label htmlFor="card">Card</label>{cardSelect(cardId, setCardId, 'card')}</div>
              <div className="field"><label htmlFor="pts">Points on the card</label><input id="pts" inputMode="numeric" value={points ? n(num(points)) : ''} placeholder="For example 1,20,000" onChange={e => setPoints(digits(e.target.value))} />
                <span className="btn-row" style={{ gap: 6 }}>{[50000, 100000, 150000, 500000].map(v => <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => setPoints(String(v))}>{n(v)}</button>)}</span></div>
            </div>
            {directToggle}
            {!num(points) && <div className="note note-info"><Info />Add a balance to see what it buys.</div>}
            {num(points) > 0 && fwd.length === 0 && <div className="note note-info"><Info />{label(cardId)} has no transfer route to an airline in our rules yet.</div>}
            {fwd.length > 0 && (
              <div className="table-wrap" role="status"><table className="data">
                <thead><tr><th>Programme</th><th className="n">Miles</th><th className="n">Rate</th><th>Path</th><th>Cap</th></tr></thead>
                <tbody>{fwd.map((r, i) => {
                  const base = fwdDirect.get(r.programme);
                  const extra = base && r.miles > base.miles ? r.miles - base.miles : base ? 0 : r.miles;
                  return (
                    <tr key={r.programme}>
                      <td><b>{pn(r.programme)}</b>{i === 0 && fwd[1]?.miles !== r.miles && <> <span className="tag tag-best">Most miles</span></>}</td>
                      <td className="n"><b>{n(r.miles)}</b>{r.hops.length > 1 && extra > 0 && <div className="t-sm muted">+{n(extra)} vs direct</div>}</td>
                      <td className="n">{r.pointsPerMile}:1</td>
                      <td><PathChain {...chain(r.hops)} /></td>
                      <td className="t-sm">{capText(r.cap)}{r.cap.monthsNeeded > 1 && <div style={{ color: 'var(--color-warning)' }}>{r.cap.monthsNeeded} months</div>}</td>
                    </tr>
                  );
                })}</tbody>
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
            {num(miles) > 0 && rev.length === 0 && <div className="note note-info"><Info />No card in our rules reaches {pn(target)} yet.</div>}
            {rev.length > 0 && (
              <div className="table-wrap" role="status"><table className="data">
                <thead><tr><th>Card</th><th className="n">Points needed</th><th className="n">Rate</th><th>Path</th><th>Cap</th></tr></thead>
                <tbody>{rev.map(({ c, r }, i) => (
                  <tr key={c.id}>
                    <td><b>{c.bankName.replace(/ Bank| Card/, '')} {c.name}</b>{mine.includes(c.id) && <> <span className="tag">Yours</span></>}{i === 0 && <> <span className="tag tag-best">Fewest points</span></>}</td>
                    <td className="n"><b>{n(r.pointsUsed)}</b></td>
                    <td className="n">{r.pointsPerMile}:1</td>
                    <td><PathChain {...chain(r.hops)} /></td>
                    <td className="t-sm">{capText(r.cap)}{r.cap.monthsNeeded > 1 && <div style={{ color: 'var(--color-warning)' }}>{r.cap.monthsNeeded} months</div>}</td>
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
                <select id="addp" value="" onChange={e => e.target.value && setPool(x => [...x, { cardId: e.target.value, balance: '' }])}>
                  <option value="">Choose a card</option>
                  {cards.filter(c => !pool.some(p => p.cardId === c.id)).map(c => <option key={c.id} value={c.id}>{c.bankName.replace(/ Bank| Card/, '')} {c.name}</option>)}
                </select></div>
            </fieldset>
            {directToggle}
            <div role="status" className="stack" style={{ ['--stack' as string]: '12px' }}>
              {pooled.transfers.map(t => (
                <div className="card" key={t.cardId}>
                  <p><b>{label(t.cardId)}</b>: <span className="t-mono">{n(t.sourcePoints)}</span> points to <span className="t-mono">{n(t.targetMiles)}</span> miles</p>
                  <div style={{ marginTop: 8 }}><PathChain {...chain(t.hops)} /></div>
                  {t.cap.monthsNeeded > 1 && <p className="t-sm" style={{ color: 'var(--color-warning)', marginTop: 8 }}>Cap {capText(t.cap)}: this takes {t.cap.monthsNeeded} months.</p>}
                </div>
              ))}
              {num(miles) > 0 && pooled.shortfall === 0 && pooled.transfers.length > 0 && <div className="note note-ok"><Info />These cards cover {n(num(miles))} miles. Total points spent: {n(pooled.transfers.reduce((s, t) => s + t.sourcePoints, 0))}.</div>}
              {num(miles) > 0 && pooled.shortfall > 0 && <div className="note note-warn"><Warn />You are {n(pooled.shortfall)} miles short with these balances.{pooled.transfers.length === 0 ? ' None of the cards listed reaches this programme.' : ''}</div>}
            </div>
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
