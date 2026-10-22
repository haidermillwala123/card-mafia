'use client';

// "Best card for you": monthly spend in, three cards out. Points come from the earn rules through rankCards (derived, not researched).
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Select from '@/components/Select';
import type { CalcEntry, MilesRate } from '@/app/earn/EarnCalculator';
import { CAT_LABEL, type Cat, rankCards, type Spend } from '@/lib/earn';

type Props = {
  cards: CalcEntry[];
  fees: Record<string, number | null>;
  programmes: { id: string; name: string }[];
  miles: Record<string, Record<string, MilesRate>>;
};

const MAIN: Cat[] = ['general', 'dining', 'groceries', 'online', 'travel_portal', 'international', 'fuel'];
const MORE: Cat[] = ['utilities', 'insurance', 'rent', 'education', 'other'];
const FEE_CAPS: [string, string, number][] = [['0', 'Any annual fee', Infinity], ['5000', 'Up to ₹5,000', 5000], ['15000', 'Up to ₹15,000', 15000], ['30000', 'Up to ₹30,000', 30000]];
const inr = (n: number) => n.toLocaleString('en-IN');

export default function RecommendClient({ cards, fees, programmes, miles }: Props) {
  const [raw, setRaw] = useState<Partial<Record<Cat, string>>>({});
  const [more, setMore] = useState(false);
  const [prog, setProg] = useState('');
  const [feeKey, setFeeKey] = useState('0');

  const spend: Spend = useMemo(() => Object.fromEntries([...MAIN, ...MORE].map(c => [c, Number(raw[c] ?? '') || 0])), [raw]);
  const total = Object.values(spend).reduce<number>((t, v) => t + (v ?? 0), 0);
  const feeCap = FEE_CAPS.find(f => f[0] === feeKey)![2];

  const top = useMemo(() => {
    if (!total) return [];
    const ranked = rankCards(cards.filter(c => (fees[c.card_id] ?? 0) <= feeCap), spend);
    const value = (r: (typeof ranked)[number]) => (prog ? r.points * (miles[prog]?.[r.card.card_id]?.perPoint ?? 0) : r.points);
    // across banks, points are not comparable: with an airline chosen rank by miles, otherwise by the card's own points
    return [...ranked].sort((a, b) => value(b) - value(a)).filter(r => value(r) > 0).slice(0, 3).map(r => ({ r, v: value(r) }));
  }, [cards, fees, spend, total, feeCap, prog, miles]);

  const field = (c: Cat) => (
    <label className="rc-field" key={c}>
      <span>{CAT_LABEL[c]}</span>
      <input inputMode="numeric" autoComplete="off" placeholder="₹ 0 a month" value={raw[c] ? inr(Number(raw[c])) : ''} onChange={e => setRaw(r => ({ ...r, [c]: e.target.value.replace(/\D/g, '').slice(0, 9) }))} />
    </label>
  );

  return (
    <div className="rc">
      <section className="rc-form" aria-label="Your spending">
        <h2>What do you spend in a month?</h2>
        <div className="rc-grid">{MAIN.map(field)}</div>
        {more && <div className="rc-grid">{MORE.map(field)}</div>}
        <button type="button" className="rc-more" onClick={() => setMore(m => !m)}>{more ? 'Fewer categories' : 'More categories'}</button>
        <div className="rc-opts">
          <div className="rc-sel"><span>Aim for</span>
            <Select value={prog} onChange={e => setProg(e.target.value)}>
              <option value="">Most card points</option>
              {programmes.map(p => <option key={p.id} value={p.id}>Miles on {p.name}</option>)}
            </Select>
          </div>
          <div className="rc-sel"><span>Annual fee</span>
            <Select value={feeKey} onChange={e => setFeeKey(e.target.value)}>{FEE_CAPS.map(f => <option key={f[0]} value={f[0]}>{f[1]}</option>)}</Select>
          </div>
        </div>
      </section>

      <section className="rc-out" aria-live="polite" aria-label="Recommended cards">
        {!total ? <p className="rc-empty">Type a few monthly amounts and your top three cards show up here.</p> : top.length === 0 ? <p className="rc-empty">No card fits. Try a higher fee limit or another airline.</p> : (
          <ol className="rc-list">
            {top.map(({ r, v }, i) => {
              const id = r.card.card_id;
              const best = [...r.byCategory].filter(b => b.points > 0).sort((a, b) => b.points - a.points).slice(0, 2);
              const fee = fees[id];
              return (
                <li key={id} className={`rc-card${i === 0 ? ' is-top' : ''}`}>
                  <span className="rc-rank">{i === 0 ? 'Best for you' : `#${i + 1}`}</span>
                  <h3>{r.card.name}<small>{(r.card as CalcEntry).bank}</small></h3>
                  <div className="rc-num"><b>{inr(Math.round(v))}</b><span>{prog ? 'miles a month' : `${(r.card as CalcEntry).currency} a month`}</span></div>
                  <ul className="rc-why">
                    {best.map(b => <li key={b.cat}>{CAT_LABEL[b.cat]}: {inr(Math.round(b.points))} points{b.rate ? ` at ${Number(b.rate.toFixed(2))} per ₹100` : ''}</li>)}
                    <li>Annual fee: {fee === null || fee === undefined ? 'not found' : fee === 0 ? 'Free' : `₹${inr(fee)}`}</li>
                  </ul>
                  <div className="rc-links"><Link href={`/earn#${id}`}>How it earns</Link><Link href={`/transfers/${id}`}>Where points go</Link></div>
                </li>
              );
            })}
          </ol>
        )}
        {total > 0 && !prog && <p className="rc-note">Points from different banks are worth different amounts. Pick an airline under &quot;Aim for&quot; to compare real miles.</p>}
        {total > 0 && <p className="rc-note">Worked out from each card&apos;s earn rules, monthly caps and excluded spend. Check the bank&apos;s current terms before you apply.</p>}
      </section>
    </div>
  );
}
