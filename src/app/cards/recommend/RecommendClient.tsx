'use client';

// "Best card for you", laid out like the points calculator: one flowing page, the live pick beside you.
// Every answer sharpens the pick and none is required. The pick looks at the whole person (spend mix, airlines, cards held, fee comfort),
// then suggests a companion card for what the first one is weak at.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CalcEntry, MilesRate } from '@/app/earn/EarnCalculator';
import SpendSliders, { SPEND_CATS } from '@/components/SpendSliders';
import { bankName, CARDS, cardName } from '@/lib/app/catalog';
import { useWallet } from '@/lib/app/wallet';
import { CAT_LABEL, type Cat, type Spend } from '@/lib/earn';
import { type Pick, recommend } from '@/lib/recommend';
import PickTile, { MiniTile } from './PickTile';

type Props = {
  cards: CalcEntry[];
  fees: Record<string, number | null>;
  programmes: { id: string; name: string }[];
  miles: Record<string, Record<string, MilesRate>>;
};

const MAIN: Cat[] = ['general', 'dining', 'groceries', 'online', 'travel_portal', 'international', 'fuel'];
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
const inr = (n: number) => n.toLocaleString('en-IN');
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export default function RecommendClient({ cards, fees, programmes, miles }: Props) {
  const w = useWallet();
  const [scope, setScope] = useState<string>('');
  const [airlines, setAirlines] = useState<string[]>([]);
  const [raw, setRaw] = useState<Partial<Record<Cat, string>>>({});
  const [banks, setBanks] = useState<string[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [feeCap, setFeeCap] = useState<number>(Infinity);
  const [feeSet, setFeeSet] = useState(false);
  const [allAir, setAllAir] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [fromStatement, setFromStatement] = useState(false);

  // Spend worked out from a statement (cards/statement) fills the sliders.
  useEffect(() => {
    try {
      const s = sessionStorage.getItem('cm-spend');
      if (!s) return;
      sessionStorage.removeItem('cm-spend');
      const o = JSON.parse(s) as Record<string, number>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRaw(Object.fromEntries(Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => [k, String(Math.round(v))])));
      setFromStatement(true);
    } catch { /* nothing usable stored */ }
  }, []);

  // Cards from the wallet are the starting point for "what you already have".
  useEffect(() => {
    if (!w.ready || seeded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeeded(true);
    if (w.profile.cardIds.length) { setHeld(w.profile.cardIds); setBanks(w.profile.bankIds); }
  }, [w.ready, w.profile.cardIds, w.profile.bankIds, seeded]);

  const set = (c: Cat, v: string) => setRaw(r => ({ ...r, [c]: v.replace(/\D/g, '').slice(0, 9) }));
  const spendAnswered = SPEND_CATS.some(c => Number(raw[c]) > 0);
  const spend: Spend = useMemo(() => {
    if (spendAnswered) return Object.fromEntries(SPEND_CATS.map(c => [c, Number(raw[c]) || 0]));
    return Object.fromEntries(MAIN.map(c => [c, 10000])); // until they say what they spend: the same in each main category
  }, [raw, spendAnswered]);

  const targets = useMemo(() => {
    if (airlines.length) return airlines;
    if (scope === 'india') return ['indigo-bluchip', 'air-india'].filter(p => miles[p]);
    if (scope === 'abroad') return Object.keys(miles).filter(p => !DOMESTIC.includes(p));
    return [];
  }, [airlines, scope, miles]);

  const result = useMemo(() => recommend({ cards, miles, spend, targets, held, fees, feeCap }), [cards, miles, spend, targets, held, fees, feeCap]);
  const top = result.picks[0];
  const alsoGood = result.picks.slice(1, 4);
  const { companion, stretch } = result;

  const airlineList = useMemo(() => {
    const byId = new Map(programmes.map(p => [p.id, p.name]));
    const first = FIRST.filter(id => byId.has(id)).map(id => ({ id, name: byId.get(id)! }));
    return allAir ? programmes : first;
  }, [programmes, allAir]);
  const progName = (id: string | null) => programmes.find(p => p.id === id)?.name ?? null;
  const toggle = (l: string[], v: string) => (l.includes(v) ? l.filter(x => x !== v) : [...l, v]);
  const bankCards = CARDS.filter(c => banks.includes(c.bank));
  const allBanks = [...new Set(CARDS.map(c => c.bank))];
  const bank = (p: Pick) => (p.card as CalcEntry).bank;
  const winsText = (p: Pick, n = 3) => list(p.wins.slice(0, n).map(x => CAT_LABEL[x.cat].toLowerCase()));

  const reasons = (p: Pick): string[] => {
    const r: string[] = [];
    if (targets.length) r.push(`Its points turn into ${progName(p.programme) ?? 'your airline'} miles at ${Number(p.perPoint.toFixed(2))} per point.`);
    else r.push(`Its points reach ${p.breadth} airline programmes, around ${Number(p.flexPerPoint.toFixed(2))} miles per point at its three best.`);
    if (p.wins.length) r.push(`Earns most on ${winsText(p)}.`);
    if (result.baseline > 0) r.push('Counted on top of what your cards already earn.');
    if (p.costPer1k) r.push(`The annual fee works out to about ₹${inr(Math.round(p.costPer1k))} for every 1,000 miles it adds.`);
    return r;
  };

  return (
    <div className="cx">
      <div className="cx-hero">
        <p className="cx-lead">{top ? 'Your best next card adds' : 'Tell us about you'}</p>
        <div className="cx-total" aria-live="polite">
          {top ? <><span className="cx-cur">+</span><b>{inr(Math.round(top.gain))}</b><small>miles a month</small></> : <b className="cx-soft">Start anywhere</b>}
        </div>
        <p className="cx-sub">Answer what you like and skip the rest. We look at how you spend, where you want to fly and what you already hold, then pick the card that gets you the most.</p>
      </div>

      <div className="cx-body">
        <div className="cx-groups">
          <section className="cx-group" aria-label="Where you fly">
            <h2>Where do you fly?</h2>
            <p>This decides which airline miles matter to you.</p>
            <div className="cx-opts">
              {SCOPES.map(s => <button key={s.id} type="button" className="cx-opt" aria-pressed={scope === s.id} onClick={() => setScope(scope === s.id ? '' : s.id)}><b>{s.title}</b><small>{s.sub}</small></button>)}
            </div>
          </section>

          <section className="cx-group" aria-label="Airlines">
            <h2>Which airlines do you use?</h2>
            <p>{scope === 'india' ? 'Pick IndiGo if that is what you fly, and we look for the card that earns the most on it.' : 'Pick all you would happily fly. Skip if you are open.'}</p>
            <div className="cx-chips">
              {airlineList.map(p => <button key={p.id} type="button" className="cx-chip" aria-pressed={airlines.includes(p.id)} onClick={() => setAirlines(toggle(airlines, p.id))}>{p.name}</button>)}
              <button type="button" className="cx-chip ghost" onClick={() => setAllAir(a => !a)}>{allAir ? 'Fewer' : 'More airlines'}</button>
            </div>
          </section>

          <SpendSliders raw={raw} set={set} />
          <p className="cx-note" style={{ marginTop: -24 }}>
            {!spendAnswered && 'Until you move a slider we assume ₹10,000 in each main category. '}
            {fromStatement ? 'Filled in from your statement.' : <Link href="/cards/statement">Or fill these from a card statement.</Link>}
          </p>

          <section className="cx-group" aria-label="Cards you hold">
            <h2>What do you already have?</h2>
            <p>We will not suggest a card you hold, and we count what your cards already earn.{w.profile.cardIds.length > 0 && ' Filled in from your wallet.'}</p>
            <div className="cx-chips">
              {allBanks.map(b => (
                <button key={b} type="button" className="cx-chip" aria-pressed={banks.includes(b)} onClick={() => {
                  const on = banks.includes(b);
                  setBanks(toggle(banks, b));
                  if (on) setHeld(h => h.filter(id => CARDS.find(c => c.id === id)?.bank !== b));
                }}>{bankName(b)}</button>
              ))}
            </div>
            {bankCards.length > 0 && (
              <>
                <h3 className="cx-sub-h">Tick the cards you hold</h3>
                <div className="cx-chips">{bankCards.map(c => <button key={c.id} type="button" className="cx-chip" aria-pressed={held.includes(c.id)} onClick={() => setHeld(toggle(held, c.id))}>{cardName(c.id)}</button>)}</div>
              </>
            )}
          </section>

          <section className="cx-group" aria-label="Annual fee">
            <h2>How much annual fee is OK?</h2>
            <p>Cards above your limit are left out, and we tell you if one of them would have been much better.</p>
            <div className="cx-opts">
              {FEES.map(f => <button key={f.title} type="button" className="cx-opt" aria-pressed={feeSet && feeCap === f.cap} onClick={() => { setFeeCap(f.cap); setFeeSet(true); }}><b>{f.title}</b><small>{f.sub}</small></button>)}
            </div>
          </section>
        </div>

        <aside className="cx-out" aria-label="Your recommendation" aria-live="polite">
          {!top ? (
            <div className="cx-empty"><strong>No card fits yet</strong><span>{result.picks.length === 0 && result.baseline > 0 ? 'Your cards already cover this. Nothing new would add more.' : 'Loosen the fee limit, pick another airline, or add some spend.'}</span></div>
          ) : (
            <>
              <PickTile pick={top} bank={bank(top)} fee={fees[top.card.card_id]} label="Best for you now" programmeName={progName(top.programme)} chosen={targets.length > 0} unit={targets.length === 1 ? `${progName(targets[0])} miles` : 'airline miles'} />
              <ul className="cx-reasons cx-why">{reasons(top).slice(0, 2).map(r => <li key={r}>{r}</li>)}</ul>

              {companion && (
                <div className="cx-side">
                  <span className="cx-kicker">Pair it with</span>
                  <PickTile pick={companion} bank={bank(companion)} fee={fees[companion.card.card_id]} label="Covers the gaps" programmeName={progName(companion.programme)} chosen={targets.length > 0} unit="airline miles" extra={`Mostly on ${winsText(companion, 2)}, where ${top.card.name} is weaker.${companion.costPer1k ? ` Fee works out to about ₹${inr(Math.round(companion.costPer1k))} per 1,000 miles.` : ''}`} />
                </div>
              )}

              {top.routes.length > 0 && (
                <div className="cx-side">
                  <span className="cx-kicker">Voucher and portal routes</span>
                  <ul className="cx-routes">
                    {top.routes.slice(0, 3).map(r => <li key={r.label}><b>{r.label}</b><span>{r.per100 !== null ? `${Number(r.per100.toFixed(1))} points per ₹100${r.cap ? `, up to ${inr(r.cap)} a month` : ''}` : 'rate not in our data'}</span></li>)}
                  </ul>
                  <p className="cx-note">Buying grocery, dining or shopping vouchers through the bank’s own store can lift those categories above the card’s normal rate. We do not have merchant-level rates, so check the portal before you rely on it.</p>
                </div>
              )}

              {stretch && (
                <div className="cx-flag">
                  <b>Your fee limit is hiding a stronger card.</b>
                  <p>{stretch.card.name} ({bank(stretch)}) would add about {inr(Math.round(stretch.gain - top.gain))} more miles a month for a ₹{inr(fees[stretch.card.card_id] ?? 0)} annual fee.</p>
                  <button type="button" className="cx-chip" onClick={() => { setFeeCap(Infinity); setFeeSet(true); }}>Show me everything</button>
                </div>
              )}

              {alsoGood.length > 0 && (
                <div className="bm-list">
                  <h4 className="bm-h">Also worth a look</h4>
                  {alsoGood.map(p => <MiniTile key={p.card.card_id} pick={p} bank={bank(p)} fee={fees[p.card.card_id]} />)}
                </div>
              )}
              <p className="cx-fine">Miles are measured in comparable long-haul programmes unless you pick airlines. Every figure is derived from each card’s own rates, caps and transfer ratios.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
