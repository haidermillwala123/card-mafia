'use client';

// Points calculator as a short guided form: a few spend questions on the left, the live ranking on the right.
// Same shape as "Best card for you" so the two tools feel like one product. The maths is unchanged: rankCards().
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CAT_LABEL, rankCards, type CalcCard, type Cat, type Spend } from '@/lib/earn';

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

const STEPS: { title: string; q: string; hint: string; cats: Cat[] }[] = [
  { title: 'Everyday', q: 'What do you spend day to day?', hint: 'A typical month. Leave out what you do not spend on.', cats: ['general', 'dining', 'groceries', 'online'] },
  { title: 'Travel', q: 'And on travel and abroad?', hint: 'Flights, hotels, forex and fuel.', cats: ['travel_portal', 'international', 'fuel'] },
  { title: 'Bills', q: 'Bills and big payments?', hint: 'These often earn less, but they add up.', cats: ['utilities', 'insurance', 'rent', 'education', 'other'] },
  { title: 'Miles', q: 'Which airline do you collect?', hint: 'Optional. We turn each card’s points into miles for it, through the cheapest transfer chain.', cats: [] },
];
const ENTERED: Cat[] = STEPS.flatMap(s => s.cats);
const AIRLINES = ['indigo-bluchip', 'air-india', 'emirates-skywards', 'qatar-privilege-club', 'krisflyer', 'ba-executive-club', 'flying-blue', 'etihad-guest', 'cathay-asiamiles', 'virgin-flyingclub', 'miles-and-more', 'turkish-ms'];

export default function EarnCalculator({ cards, programmes, miles }: Props) {
  const [raw, setRaw] = useState<Partial<Record<Cat, string>>>({});
  const [prog, setProg] = useState('');
  const [step, setStep] = useState(0);
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
  const stepFilled = (i: number) => STEPS[i].cats.some(c => Number(raw[c]) > 0) || (i === 3 && !!prog);
  const done = [0, 1, 2, 3].filter(stepFilled).length;

  const top = ranked[0];
  const topRate = top ? rate(top.card.card_id) : null;
  const topNone = !top || top.computedSpend === 0;
  const next = ranked.slice(1, 4);
  const list = all ? ranked : ranked.slice(0, SHOWN);

  return (
    <section aria-label="Points calculator" className="stack" style={{ ['--stack' as string]: '20px' }}>
      <div className="rw">
        <div className="rw-form">
          <ol className="rw-dots" aria-label="Progress">
            {STEPS.map((s, i) => <li key={s.title} className={i === step ? 'now' : i < step ? 'past' : ''}><button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>{s.title}</button></li>)}
          </ol>

          {STEPS.map((s, i) => (
            <section key={s.title} className="rw-q" aria-labelledby={`cq${i}`} hidden={step !== i}>
              <span className="rw-step">Question {i + 1} of {STEPS.length}</span>
              <h2 id={`cq${i}`}>{s.q}</h2>
              <p className="rw-hint">{s.hint}</p>
              {s.cats.length > 0 ? (
                <div className="rw-grid">
                  {s.cats.map(c => (
                    <label key={c} className="rw-in"><span>{CAT_LABEL[c]}</span>
                      <input inputMode="numeric" autoComplete="off" placeholder="₹ 0 a month" value={raw[c] ? inr(Number(raw[c])) : ''} onChange={e => setRaw(r => ({ ...r, [c]: e.target.value.replace(/\D/g, '').slice(0, 9) }))} />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rw-chips">
                  <button type="button" className="rw-c" aria-pressed={prog === ''} onClick={() => setProg('')}>Card points only</button>
                  {airlineList.map(p => <button key={p.id} type="button" className="rw-c" aria-pressed={prog === p.id} onClick={() => setProg(prog === p.id ? '' : p.id)}>{p.name}</button>)}
                  <button type="button" className="rw-c ghost" onClick={() => setAllAir(a => !a)}>{allAir ? 'Fewer' : 'More airlines'}</button>
                </div>
              )}
            </section>
          ))}

          <div className="rw-nav">
            <button type="button" className="rw-back" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</button>
            <span className="rw-sp" />
            {step < STEPS.length - 1
              ? <button type="button" className="rw-next" onClick={() => setStep(s => s + 1)}>{stepFilled(step) ? 'Next' : 'Skip'}</button>
              : <button type="button" className="rw-next" onClick={() => { setAll(true); document.getElementById('calc-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} disabled={total === 0}>See all {ranked.length} cards</button>}
          </div>
        </div>

        <aside className="rw-out" aria-label="Your result" aria-live="polite">
          <div className="rw-meter" role="img" aria-label={`${done} of 4 questions answered`}><i style={{ width: `${(done / 4) * 100}%` }} /><span>{total > 0 ? `₹${inr(total)} a month entered` : `${done} of 4 answered`}</span></div>
          {total === 0 ? (
            <div className="rw-empty">Type any amount and the best card for that spend appears here. Rough numbers are fine.</div>
          ) : top && (
            <article className="rw-pick">
              <span className="rw-badge">Earns the most</span>
              <h3>{top.card.name}<small>{top.card.bank} · {top.card.currency}</small></h3>
              <div className="rw-gain">
                <b>{topNone ? 'not found' : inr(Math.floor(prog && topRate ? top.points * topRate.perPoint : top.points))}</b>
                <span>{topNone ? 'no usable rate for this spend' : prog && topRate ? `${progName} miles a month, derived` : 'points a month, in the card’s own currency'}</span>
              </div>
              {prog && !topRate && <p className="rw-why">{progName}: no transfer route from this card.</p>}
              {prog && topRate && !topNone && <p className="rw-why">{topRate.perPoint} {progName} miles per card point over {topRate.hops} transfer {topRate.hops === 1 ? 'hop' : 'hops'}{topRate.monthlyCap ? `. First hop capped at ${inr(topRate.monthlyCap)} points a month` : ''}.</p>}
              <div className="rw-links"><Link href={`/earn#${top.card.card_id}`}>How it earns</Link><Link href={`/transfers/${top.card.card_id}`}>Where points go</Link></div>
            </article>
          )}
          {total > 0 && next.length > 0 && (
            <div className="rw-more">
              <h4>Next best</h4>
              <ol>
                {next.map(x => {
                  const mr = rate(x.card.card_id);
                  const v = prog ? (mr ? x.points * mr.perPoint : 0) : x.points;
                  return <li key={x.card.card_id}><div><b>{x.card.name}</b><small>{x.card.bank}</small></div><span>{inr(Math.floor(v))}<small>{prog ? 'miles/mo' : 'points/mo'}</small></span></li>;
                })}
              </ol>
            </div>
          )}
          <p className="rw-caveat">Every figure is derived from each card’s own rates and caps. Where a rate was not found it is left out, never counted as zero or unlimited.</p>
        </aside>
      </div>

      {total > 0 && (
        <div id="calc-all" className="stack" style={{ ['--stack' as string]: '12px' }}>
          <h3 className="t-h3">{prog ? `All cards ranked by ${progName} miles a month` : 'All cards ranked by points a month, in each card’s own currency'}</h3>
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
        </div>
      )}
    </section>
  );
}
