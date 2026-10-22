'use client';

// Points calculator, laid out like an app rather than a form: one big live total, spend groups with sliders,
// and a result card that stays in view. The maths is unchanged: rankCards().
import Link from 'next/link';
import { useMemo, useState } from 'react';
import SpendSliders, { SPEND_CATS } from '@/components/SpendSliders';
import { rankCards, type CalcCard, type Cat, type Spend } from '@/lib/earn';

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

const ENTERED: Cat[] = SPEND_CATS;
const AIRLINES = ['indigo-bluchip', 'air-india', 'emirates-skywards', 'qatar-privilege-club', 'krisflyer', 'ba-executive-club', 'flying-blue', 'etihad-guest', 'cathay-asiamiles', 'virgin-flyingclub', 'miles-and-more', 'turkish-ms'];

export default function EarnCalculator({ cards, programmes, miles }: Props) {
  const [raw, setRaw] = useState<Partial<Record<Cat, string>>>({});
  const [prog, setProg] = useState('');
  const [allAir, setAllAir] = useState(false);
  const [all, setAll] = useState(false);

  const spend: Spend = useMemo(() => Object.fromEntries(ENTERED.map(c => [c, Number(raw[c] ?? '') || 0])), [raw]);
  const total = Object.values(spend).reduce<number>((t, v) => t + (v ?? 0), 0);
  const rate = (id: string) => (prog ? (miles[prog]?.[id] ?? null) : null);

  const ranked = useMemo(() => {
    const r = rankCards(cards, spend);
    if (!prog) return r;
    // with a programme chosen, miles are comparable across banks, card points are not
    const m = (x: (typeof r)[number]) => (miles[prog]?.[x.card.card_id] ? x.points * miles[prog][x.card.card_id]!.perPoint : -1);
    return [...r].sort((a, b) => m(b) - m(a));
  }, [cards, spend, prog, miles]);

  const progName = programmes.find(p => p.id === prog)?.name;
  const airlineList = allAir ? programmes : AIRLINES.map(id => programmes.find(p => p.id === id)).filter((p): p is { id: string; name: string } => !!p);

  const top = ranked[0];
  const topRate = top ? rate(top.card.card_id) : null;
  const topNone = !top || top.computedSpend === 0;
  const next = ranked.slice(1, 3);
  const list = all ? ranked : ranked.slice(0, SHOWN);
  const set = (c: Cat, v: string) => setRaw(r => ({ ...r, [c]: v.replace(/\D/g, '').slice(0, 9) }));

  return (
    <div className="cx">
      <div className="cx-hero">
        <p className="cx-lead">Your typical month</p>
        <div className="cx-total" aria-live="polite">
          <span className="cx-cur">₹</span>
          <b>{inr(total)}</b>
          <small>a month</small>
        </div>
        <p className="cx-sub">Slide each one, or tap the amount to type it. Rough is fine, and anything you skip counts as zero.</p>
      </div>

      <div className="cx-body">
        <div className="cx-groups">
          <SpendSliders raw={raw} set={set} />

          <section className="cx-group" aria-label="Airline miles">
            <h2>Count it in miles</h2>
            <p>Optional. Pick an airline and we turn each card’s points into its miles, through the cheapest transfer chain.</p>
            <div className="cx-chips">
              <button type="button" className="cx-chip" aria-pressed={prog === ''} onClick={() => setProg('')}>Card points only</button>
              {airlineList.map(p => <button key={p.id} type="button" className="cx-chip" aria-pressed={prog === p.id} onClick={() => setProg(prog === p.id ? '' : p.id)}>{p.name}</button>)}
              <button type="button" className="cx-chip ghost" onClick={() => setAllAir(a => !a)}>{allAir ? 'Fewer' : 'More airlines'}</button>
            </div>
          </section>
        </div>

        <aside className="cx-out" aria-label="Your result" aria-live="polite">
          {total === 0 || !top ? (
            <div className="cx-empty"><strong>Move a slider</strong><span>The best card for your spend shows up here, and updates as you go.</span></div>
          ) : (
            <>
              <article className="cx-card">
                <span className="cx-badge">Earns the most</span>
                <h3>{top.card.name}<small>{top.card.bank} · {top.card.currency}</small></h3>
                <div className="cx-num">
                  <b>{topNone ? 'not found' : inr(Math.floor(prog && topRate ? top.points * topRate.perPoint : top.points))}</b>
                  <span>{topNone ? 'no usable rate for this spend' : prog && topRate ? `${progName} miles a month` : 'points a month'}</span>
                </div>
                {prog && !topRate && <p className="cx-why">{progName}: no transfer route from this card.</p>}
                {prog && topRate && !topNone && <p className="cx-why">{topRate.perPoint} {progName} miles per card point over {topRate.hops} transfer {topRate.hops === 1 ? 'hop' : 'hops'}{topRate.monthlyCap ? `. First hop capped at ${inr(topRate.monthlyCap)} points a month` : ''}.</p>}
                <div className="cx-links"><Link href={`/earn#${top.card.card_id}`}>How it earns</Link><Link href={`/transfers/${top.card.card_id}`}>Where points go</Link></div>
              </article>
              {next.length > 0 && (
                <div className="cx-next">
                  <h4>Runners-up</h4>
                  <ol>
                    {next.map(x => {
                      const mr = rate(x.card.card_id);
                      const val = prog ? (mr ? x.points * mr.perPoint : 0) : x.points;
                      return <li key={x.card.card_id}><div><b>{x.card.name}</b><small>{x.card.bank}</small></div><span>{inr(Math.floor(val))}<small>{prog ? 'miles a month' : 'points a month'}</small></span></li>;
                    })}
                  </ol>
                </div>
              )}
              <p className="cx-fine">Every figure is derived from each card’s own rates and caps. Where a rate was not found it is left out, never counted as zero or unlimited.</p>
            </>
          )}
        </aside>
      </div>

      {total > 0 && (
        <section id="calc-all" className="stack" style={{ ['--stack' as string]: '12px' }} aria-label="All cards ranked">
          <h2 className="t-h2">{prog ? `All cards, ranked by ${progName} miles` : 'All cards, ranked by points'}</h2>
          <p className="muted measure">{prog ? 'Miles are comparable across banks.' : 'Points are in each card’s own currency, so compare miles, not points, across banks. Pick an airline above to see miles.'}</p>
          <ol className="earn-rank">
            {list.map((x, i) => {
              const mr = rate(x.card.card_id);
              const none = x.computedSpend === 0;
              return (
                <li key={x.card.card_id} className="card">
                  <div className="earn-rank__head">
                    <span className="earn-rank__n" aria-hidden="true">{i + 1}</span>
                    <div>
                      <h4 className="t-title"><Link href={`/earn#${x.card.card_id}`}>{x.card.bank} {x.card.name}</Link></h4>
                      <p className="t-sm muted">{x.card.currency}</p>
                    </div>
                    <div className="earn-rank__num">
                      <b className="t-num">{none ? 'not found' : `${inr(Math.floor(x.points))} points`}</b>
                      <span className="t-sm muted">{none ? 'no usable rate for this spend' : 'a month, derived'}</span>
                      {prog && <span className="t-sm">{!mr ? `${progName}: no transfer route` : none ? '' : `${inr(Math.floor(x.points * mr.perPoint))} miles a month, derived`}</span>}
                    </div>
                  </div>
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
        </section>
      )}
    </div>
  );
}
