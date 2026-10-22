'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Select from '@/components/Select';
import { CAT_LABEL, CATS, rankCards, type CalcCard, type Cat, type Spend } from '@/lib/earn';

export type CalcEntry = CalcCard & { bank: string; currency: string };
export type MilesRate = { perPoint: number; hops: number; monthlyCap: number | null } | null;
type Props = {
  cards: CalcEntry[];
  programmes: { id: string; name: string }[];
  // programme id -> card id -> miles per card point by the cheapest chain, null when the card cannot reach it
  miles: Record<string, Record<string, MilesRate>>;
};

const inr = (n: number) => n.toLocaleString('en-IN');
const SHOWN = 10;

export default function EarnCalculator({ cards, programmes, miles }: Props) {
  const [raw, setRaw] = useState<Partial<Record<Cat, string>>>({});
  const [prog, setProg] = useState('');
  const [all, setAll] = useState(false);

  const spend: Spend = useMemo(() => Object.fromEntries(CATS.map(c => [c, Number(raw[c] ?? '') || 0])), [raw]);
  const total = Object.values(spend).reduce<number>((t, v) => t + (v ?? 0), 0);
  const rate = (id: string) => (prog ? (miles[prog]?.[id] ?? null) : null);

  const ranked = useMemo(() => {
    const r = rankCards(cards, spend);
    if (!prog) return r;
    // with a programme chosen, miles are comparable across banks, card points are not
    const m = (x: (typeof r)[number]) => (miles[prog]?.[x.card.card_id] ? x.points * miles[prog][x.card.card_id]!.perPoint : -1);
    return [...r].sort((a, b) => m(b) - m(a));
  }, [cards, spend, prog, miles]);
  const list = all ? ranked : ranked.slice(0, SHOWN);
  const progName = programmes.find(p => p.id === prog)?.name;

  return (
    <section aria-labelledby="calc-h" className="stack" style={{ ['--stack' as string]: '16px' }}>
      <h2 id="calc-h" className="t-h2">Monthly spend calculator</h2>
      <p className="muted measure">
        Enter what you spend in a typical month. Each card is scored with its own best matching rate, its monthly caps and its excluded categories. Points are in each card&apos;s own currency, so compare miles, not points, across banks.
      </p>

      <form className="earn-grid" onSubmit={e => e.preventDefault()} aria-label="Monthly spend by category">
        {CATS.map(c => (
          <div className="field" key={c}>
            <label htmlFor={`sp-${c}`}>{CAT_LABEL[c]} (Rs a month)</label>
            <input
              id={`sp-${c}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={raw[c] ? inr(Number(raw[c])) : ''}
              onChange={e => setRaw(r => ({ ...r, [c]: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
            />
          </div>
        ))}
        <div className="field">
          <label htmlFor="earn-prog">Airline programme (optional)</label>
          <Select id="earn-prog" value={prog} onChange={e => setProg(e.target.value)}>
            <option value="">Card points only</option>
            {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <span className="help">Adds airline miles a month through the cheapest transfer chain.</span>
        </div>
      </form>

      <div className="note note-info" role="note"><span>
        Every points and miles figure below is <b>derived</b> by this page from the rates in the card sections. Where a rate or cap was not found it is marked &quot;not found&quot; and left out, never counted as zero or as unlimited. &quot;Other&quot; spend earns the base rate only.
      </span></div>

      <div aria-live="polite">
        {total === 0 ? (
          <p className="muted">Enter at least one amount to rank the {cards.length} cards.</p>
        ) : (
          <>
            <h3 className="t-h3">{prog ? `Ranked by airline miles a month into ${progName}` : 'Ranked by points a month, in each card’s own currency'}</h3>
            <ol className="earn-rank">
              {list.map((x, i) => {
                const mr = rate(x.card.card_id);
                const none = x.computedSpend === 0;
                return (
                  <li key={x.card.card_id} className="card">
                    <div className="earn-rank__head">
                      <span className="earn-rank__n" aria-hidden="true">{i + 1}</span>
                      <div>
                        <h4 className="t-title"><Link href={`#${x.card.card_id}`}>{x.card.bank} {x.card.name}</Link></h4>
                        <p className="t-sm muted">{x.card.currency}</p>
                      </div>
                      <div className="earn-rank__num">
                        <b className="t-num">{none ? 'not found' : `${inr(Math.floor(x.points))} points`}</b>
                        <span className="t-sm muted">{none ? 'no usable rate for this spend' : 'a month, derived'}</span>
                        {prog && (
                          <span className="t-sm">
                            {!mr ? `${progName}: no transfer route` : none ? '' : `${inr(Math.floor(x.points * mr.perPoint))} miles a month, derived`}
                          </span>
                        )}
                      </div>
                    </div>
                    {mr && !none && (
                      <p className="t-sm muted">{mr.perPoint} {progName} miles per card point over {mr.hops} transfer {mr.hops === 1 ? 'hop' : 'hops'}, derived{mr.monthlyCap ? `. First hop capped at ${inr(mr.monthlyCap)} points a month` : ''}.</p>
                    )}
                    {x.skippedSpend > 0 && !none && <p className="t-sm muted">Counted Rs {inr(x.computedSpend)} of Rs {inr(x.computedSpend + x.skippedSpend)}; the rest has no known rate.</p>}
                    {x.notes.length > 0 && (
                      <details>
                        <summary className="t-sm">{x.notes.length} note{x.notes.length === 1 ? '' : 's'} on caps, exclusions and missing data</summary>
                        <ul className="earn-list t-sm">{x.notes.map((n, k) => <li key={k}>{n}</li>)}</ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
            {ranked.length > SHOWN && (
              <button type="button" className="btn btn-secondary" onClick={() => setAll(a => !a)} aria-expanded={all}>
                {all ? `Show top ${SHOWN} only` : `Show all ${ranked.length} cards`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
