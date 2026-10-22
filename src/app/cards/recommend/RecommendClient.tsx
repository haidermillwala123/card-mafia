'use client';

// "Best card for you" as an onboarding flow: one question at a time on the left, a live pick on the right.
// Every answer sharpens the pick and none is required; the person can stop whenever they like and take what is on screen.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CalcEntry, MilesRate } from '@/app/earn/EarnCalculator';
import { bankName, CARDS, cardName } from '@/lib/app/catalog';
import { useWallet } from '@/lib/app/wallet';
import { CAT_LABEL, type Cat, type Spend } from '@/lib/earn';
import { feeTier } from '@/lib/fees';
import { recommend } from '@/lib/recommend';

type Props = {
  cards: CalcEntry[];
  fees: Record<string, number | null>;
  programmes: { id: string; name: string }[];
  miles: Record<string, Record<string, MilesRate>>;
};

const SPEND: Cat[] = ['general', 'dining', 'groceries', 'online', 'travel_portal', 'international', 'fuel'];
const MORE: Cat[] = ['utilities', 'insurance', 'rent', 'education', 'other'];
const FIRST = ['indigo-bluchip', 'air-india', 'emirates-skywards', 'qatar-privilege-club', 'krisflyer', 'ba-executive-club', 'flying-blue', 'etihad-guest', 'cathay-asiamiles', 'virgin-flyingclub', 'miles-and-more', 'turkish-ms'];
const DOMESTIC = ['indigo-bluchip', 'air-india', 'spiceclub'];
const SCOPES = [
  { id: 'india', title: 'Mostly within India', sub: 'Domestic flights, the odd trip abroad' },
  { id: 'abroad', title: 'International', sub: 'Long haul is where I want to fly' },
  { id: 'both', title: 'Both', sub: 'India and abroad' },
  { id: 'rare', title: 'Not much yet', sub: 'I want to start collecting' },
] as const;
const FEES: { cap: number; title: string; sub: string }[] = [
  { cap: 0, title: 'Lifetime free', sub: 'No annual fee' },
  { cap: 5000, title: 'Up to ₹5,000', sub: 'Low and mid fee' },
  { cap: 15000, title: 'Up to ₹15,000', sub: 'Premium cards' },
  { cap: 30000, title: 'Up to ₹30,000', sub: 'Luxury cards too' },
  { cap: Infinity, title: 'No limit', sub: 'Show me everything' },
];
const STEPS = ['Flying', 'Airlines', 'Spending', 'Your cards', 'Fees'];
const inr = (n: number) => n.toLocaleString('en-IN');

export default function RecommendClient({ cards, fees, programmes, miles }: Props) {
  const w = useWallet();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [scope, setScope] = useState<string>('');
  const [airlines, setAirlines] = useState<string[]>([]);
  const [raw, setRaw] = useState<Partial<Record<Cat, string>>>({});
  const [more, setMore] = useState(false);
  const [banks, setBanks] = useState<string[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [feeCap, setFeeCap] = useState<number>(Infinity);
  const [feeSet, setFeeSet] = useState(false);
  const [allAir, setAllAir] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Cards from the wallet are the starting point for "what you already have".
  useEffect(() => {
    if (!w.ready || seeded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeeded(true);
    if (w.profile.cardIds.length) { setHeld(w.profile.cardIds); setBanks(w.profile.bankIds); }
  }, [w.ready, w.profile.cardIds, w.profile.bankIds, seeded]);

  const spendAnswered = SPEND.concat(MORE).some(c => Number(raw[c]) > 0);
  const spend: Spend = useMemo(() => {
    if (spendAnswered) return Object.fromEntries([...SPEND, ...MORE].map(c => [c, Number(raw[c]) || 0]));
    return Object.fromEntries(SPEND.map(c => [c, 10000])); // until they say what they spend: the same in each main category
  }, [raw, spendAnswered]);

  const targets = useMemo(() => {
    if (airlines.length) return airlines;
    if (scope === 'india') return ['indigo-bluchip', 'air-india'].filter(p => miles[p]);
    if (scope === 'abroad') return Object.keys(miles).filter(p => !DOMESTIC.includes(p));
    return [];
  }, [airlines, scope, miles]);

  const result = useMemo(() => recommend({ cards, miles, spend, targets, held, fees, feeCap }), [cards, miles, spend, targets, held, fees, feeCap]);
  const answered = [!!scope, airlines.length > 0, spendAnswered, held.length > 0 || banks.length > 0, feeSet].filter(Boolean).length;
  const top = result.picks[0];
  const alsoGood = result.picks.slice(1, done ? 7 : 4);

  const airlineList = useMemo(() => {
    const byId = new Map(programmes.map(p => [p.id, p.name]));
    const first = FIRST.filter(id => byId.has(id)).map(id => ({ id, name: byId.get(id)! }));
    return allAir ? programmes : first;
  }, [programmes, allAir]);
  const toggle = (l: string[], v: string) => (l.includes(v) ? l.filter(x => x !== v) : [...l, v]);
  const bankCards = CARDS.filter(c => banks.includes(c.bank));
  const allBanks = [...new Set(CARDS.map(c => c.bank))];

  const q = (n: number, title: string, hint: string, body: React.ReactNode) => (
    <section className="rw-q" aria-labelledby={`rq${n}`} hidden={step !== n}>
      <span className="rw-step">Question {n + 1} of {STEPS.length}</span>
      <h2 id={`rq${n}`}>{title}</h2>
      <p className="rw-hint">{hint}</p>
      {body}
    </section>
  );

  const pickCard = top && (
    <article className="rw-pick" aria-live="polite">
      <span className="rw-badge">{done ? 'Your pick' : 'Best for you right now'}</span>
      <h3>{top.card.name}<small>{(top.card as CalcEntry).bank}</small></h3>
      <div className="rw-gain"><b>+{inr(Math.round(top.gain))}</b><span>{targets.length === 1 ? `${programmes.find(p => p.id === targets[0])?.name} miles` : 'airline miles'} a month{result.baseline > 0 ? ', on top of your cards' : ''}</span></div>
      <div className="rw-tags">
        <span className={`rw-fee t-${feeTier(fees[top.card.card_id]).id}`}>{feeTier(fees[top.card.card_id]).label}</span>
        {top.programme && <span className="rw-chip">Best with {programmes.find(p => p.id === top.programme)?.name}</span>}
      </div>
      {top.wins.length > 0 && <p className="rw-why">Wins on {top.wins.slice(0, 3).map(x => CAT_LABEL[x.cat].toLowerCase()).join(', ')}.</p>}
      <div className="rw-links"><Link href={`/earn#${top.card.card_id}`}>How it earns</Link><Link href={`/transfers/${top.card.card_id}`}>Where points go</Link></div>
    </article>
  );

  return (
    <div className={`rw${done ? ' is-done' : ''}`}>
      {!done && (
        <div className="rw-form">
          <ol className="rw-dots" aria-label="Progress">
            {STEPS.map((s, i) => <li key={s} className={i === step ? 'now' : i < step ? 'past' : ''}><button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>{s}</button></li>)}
          </ol>

          {q(0, 'Where do you fly?', 'This decides which airline miles matter to you.', (
            <div className="rw-opts">
              {SCOPES.map(s => <button key={s.id} type="button" className="rw-opt" aria-pressed={scope === s.id} onClick={() => { setScope(s.id); setStep(1); }}><b>{s.title}</b><small>{s.sub}</small></button>)}
            </div>
          ))}

          {q(1, 'Which airlines do you use?', scope === 'india' ? 'Pick IndiGo if that is what you fly, and we look for the card that earns the most on it.' : 'Pick all you would happily fly. Skip if you are open.', (
            <div className="rw-chips">
              {airlineList.map(p => <button key={p.id} type="button" className="rw-c" aria-pressed={airlines.includes(p.id)} onClick={() => setAirlines(toggle(airlines, p.id))}>{p.name}</button>)}
              <button type="button" className="rw-c ghost" onClick={() => setAllAir(a => !a)}>{allAir ? 'Fewer' : 'More airlines'}</button>
            </div>
          ))}

          {q(2, 'What do you spend in a month?', 'Rough numbers are fine. Leave out what you do not spend on.', (
            <>
              <div className="rw-grid">
                {SPEND.concat(more ? MORE : []).map(c => (
                  <label key={c} className="rw-in"><span>{CAT_LABEL[c]}</span>
                    <input inputMode="numeric" autoComplete="off" placeholder="₹ 0" value={raw[c] ? inr(Number(raw[c])) : ''} onChange={e => setRaw(r => ({ ...r, [c]: e.target.value.replace(/\D/g, '').slice(0, 9) }))} />
                  </label>
                ))}
              </div>
              <button type="button" className="rw-link" onClick={() => setMore(m => !m)}>{more ? 'Fewer categories' : 'More categories'}</button>
              {!spendAnswered && <p className="rw-note">Until you add yours we use ₹10,000 in each main category.</p>}
            </>
          ))}

          {q(3, 'What do you already have?', 'We will not suggest a card you hold, and we count what your cards already earn.', (
            <>
              {w.profile.cardIds.length > 0 && <p className="rw-note">Filled in from your wallet.</p>}
              <div className="rw-chips">
                {allBanks.map(b => (
                  <button key={b} type="button" className="rw-c" aria-pressed={banks.includes(b)} onClick={() => {
                    const on = banks.includes(b);
                    setBanks(toggle(banks, b));
                    if (on) setHeld(h => h.filter(id => CARDS.find(c => c.id === id)?.bank !== b));
                  }}>{bankName(b)}</button>
                ))}
              </div>
              {bankCards.length > 0 && (
                <>
                  <span className="rw-sub">Tick the cards you hold</span>
                  <div className="rw-chips">{bankCards.map(c => <button key={c.id} type="button" className="rw-c" aria-pressed={held.includes(c.id)} onClick={() => setHeld(toggle(held, c.id))}>{cardName(c.id)}</button>)}</div>
                </>
              )}
            </>
          ))}

          {q(4, 'How much annual fee is OK?', 'Cards above your limit are left out.', (
            <div className="rw-opts">
              {FEES.map(f => <button key={f.title} type="button" className="rw-opt" aria-pressed={feeSet && feeCap === f.cap} onClick={() => { setFeeCap(f.cap); setFeeSet(true); }}><b>{f.title}</b><small>{f.sub}</small></button>)}
            </div>
          ))}

          <div className="rw-nav">
            <button type="button" className="rw-back" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</button>
            <span className="rw-sp" />
            {step < STEPS.length - 1
              ? <button type="button" className="rw-next" onClick={() => setStep(s => s + 1)}>{step === 0 && !scope ? 'Skip' : 'Next'}</button>
              : <button type="button" className="rw-next" onClick={() => setDone(true)}>Show my pick</button>}
          </div>
        </div>
      )}

      <aside className="rw-out" aria-label="Your recommendation">
        {!done && <div className="rw-meter" role="img" aria-label={`${answered} of 5 questions answered`}><i style={{ width: `${(answered / 5) * 100}%` }} /><span>{answered} of 5 answered</span></div>}
        {top ? pickCard : <div className="rw-empty">{result.picks.length === 0 && result.baseline > 0 ? 'Your cards already cover this. Nothing new would add more.' : 'No card matches yet. Loosen the fee limit or pick another airline.'}</div>}
        {top && !done && <p className="rw-caveat">This is the best for you right now. The more you tell us, the more it may change.</p>}
        {top && !done && <button type="button" className="rw-stop" onClick={() => setDone(true)}>That is enough, show my pick</button>}
        {done && <button type="button" className="rw-stop" onClick={() => setDone(false)}>Refine my answers</button>}
        {alsoGood.length > 0 && (
          <div className="rw-more">
            <h4>{done ? 'Also worth a look' : 'Next best'}</h4>
            <ol>
              {alsoGood.map(p => (
                <li key={p.card.card_id}>
                  <div><b>{p.card.name}</b><small>{(p.card as CalcEntry).bank} · {feeTier(fees[p.card.card_id]).label}</small></div>
                  <span>+{inr(Math.round(p.gain))}<small>miles/mo</small></span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}
