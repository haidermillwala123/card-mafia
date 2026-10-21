import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import PathChain from '@/components/PathChain';
import { Check, Lock, Warn } from '@/components/Icons';
import { data, programmeName } from '@/lib/engine/data';
import { ageMinutes, ageText, bestPaths, buildPlans, hopsFor, type Hop, type Trip } from '@/lib/engine/engine';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { title: 'Card Mafia: know the plan before you move the points', description: 'A verified award-flight plan for Indian premium cardholders, checked before you transfer.', url: '/' },
};
export const revalidate = 3600; // the seat age on the sample card moves, so rebuild hourly

const FAQ = [
  { q: 'Do you link to my bank accounts?', a: 'No. You type your balances. We never ask for logins or OTPs, and nothing is read from your bank or your email.' },
  { q: 'Can Card Mafia transfer my points?', a: 'No. It plans the path and checks it. You make the transfer in your bank’s portal. A points transfer cannot be undone, so the check comes first.' },
  { q: 'How fresh are the seats?', a: 'Seats come from cached availability, and every plan shows how old that data is. Confirm the seat on the airline’s site before you transfer. A live re-check is planned for a later version.' },
  { q: 'Why can the same card need different points for the same seat?', a: 'Transfer rules form a chain, not a table. Moving HDFC points to Qatar directly runs at 2:1. Moving them through Finnair and British Airways runs at 1:1 on each hop, which halves the points.' },
  { q: 'Is a Qsuite seat promised?', a: 'No. Airlines can swap the aircraft after booking. Card Mafia keeps only aircraft types that carry Qsuite and tells you to confirm the aircraft on the airline’s site.' },
];

const sampleTrip: Trip = { origin: 'DEL', dests: ['JFK'], month: '2027-10', travellers: 1, cabin: 'business', mustProduct: 'Qsuite', cashFareInr: null };
const chainOf = (hops: Hop[]) => ({ nodes: [hops[0].from, ...hops.map(h => h.to)].map(programmeName), ratios: hops.map(h => `${h.ratio_in}:${h.ratio_out}`) });

export default function Home() {
  const now = new Date();
  const best = buildPlans(data, sampleTrip, { cardIds: ['hdfc-infinia'], balances: { 'hdfc-infinia': 150000 } }, now).plans[0];
  const miles = best.milesNeeded;
  const multi = chainOf(best.transfers[0].hops);
  const directRules = bestPaths(data, 'hdfc-infinia', true).get(best.seat.programme)!;
  const direct = hopsFor(directRules, miles);
  const seatAge = ageText(ageMinutes(now, data.seats.fetched_at));
  const n = (x: number) => x.toLocaleString('en-IN');

  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'en-IN' }} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1 className="t-display">Know the plan before you move the points.</h1>
            <p className="t-lg sub">Card Mafia turns a trip goal into a verified award-flight plan for Indian premium cardholders. One sentence in. The cheapest path from your cards to a business-class seat out.</p>
            <form action="/plan" method="get" className="stack" style={{ ['--stack' as string]: '12px' }}>
              <div className="field">
                <label htmlFor="q">Your trip</label>
                <textarea id="q" name="q" required minLength={3} maxLength={700} placeholder="US in October, Qsuite from Doha. I hold Infinia and Amex." />
                <span className="help">One sentence is enough. We ask before assuming.</span>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" type="submit">Build my plan</button>
                <Link className="btn btn-ghost" href="/start">Set up your cards first</Link>
              </div>
              <p className="t-sm muted"><Lock size={14} /> We never ask for logins or OTPs. Balances are typed, never linked.</p>
            </form>
          </div>

          <aside className="card settle" data-best="true" aria-label="Sample plan">
            <div className="plan">
              <div className="top">
                <span className="tag tag-best">Best path</span>
                <span className="tag tag-sand">Qsuite</span>
                <span className="tag tag-warn">Sample trip</span>
              </div>
              <h2 className="t-h3" style={{ marginTop: 'var(--space-md)' }}>Doha to New York</h2>
              <p className="points t-num">{n(best.sourcePointsTotal)} points</p>
              <p className="t-sm muted">from 1 HDFC Infinia balance of {n(150000)}, for {n(miles)} Avios in Qatar Privilege Club</p>
              <hr className="rule-line" />
              <PathChain {...multi} />
              <p className="t-sm muted" style={{ marginTop: 12 }}>
                Direct at {direct[0].ratio_in}:{direct[0].ratio_out} needs <b className="t-mono" style={{ color: 'var(--color-text)' }}>{n(direct[0].points_in)}</b> points for the same seat.
              </p>
              <div className="stamps">
                <span className="tag tag-warn">Ratios unverified</span>
                <span className="tag">Rules checked 21 Oct 2026</span>
                <span className="tag">Seats {seatAge} old</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section" aria-labelledby="chain-h">
        <div className="container cols-2">
          <div className="stack">
            <h2 id="chain-h" className="t-h1">Transfer rules are a chain, not a table.</h2>
            <p className="t-lg muted measure">Cardholders report that Infinia points reach Qatar at 1:1 through Finnair and British Airways, instead of 2:1 directly. Card Mafia reads every hop in your bank rules and picks the cheapest chain for each programme.</p>
            <p className="measure">That is the difference between {n(direct[0].points_in)} points and {n(best.transfers[0].sourcePoints)} for one seat. It is also why each hop shows its ratio, its cap and the date we checked it.</p>
          </div>
          <div className="stack">
            <div className="card">
              <span className="tag tag-steel">Direct</span>
              <div style={{ marginTop: 12 }}><PathChain nodes={[programmeName(direct[0].from), programmeName(direct[0].to)]} ratios={[`${direct[0].ratio_in}:${direct[0].ratio_out}`]} /></div>
              <p className="t-num" style={{ marginTop: 12 }}>{n(direct[0].points_in)} <span className="t-sm muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>points</span></p>
            </div>
            <div className="card" data-best="true">
              <span className="tag tag-best">Best path</span>
              <div style={{ marginTop: 12 }}><PathChain {...multi} /></div>
              <p className="t-num" style={{ marginTop: 12 }}>{n(best.transfers[0].sourcePoints)} <span className="t-sm muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>points</span></p>
            </div>
            <div className="note note-warn"><Warn /><span>Reported by cardholders, not yet matched to bank portals. Verify each hop before you start.</span></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="check-h" style={{ background: 'var(--color-surface-sunken)' }}>
        <div className="container cols-2">
          <div className="stack">
            <h2 id="check-h" className="t-h1">Check the plan. Then make the one move that cannot be undone.</h2>
            <p className="t-lg muted measure">Every plan carries a pre-transfer check built from the data we hold, and tells you what we cannot see.</p>
          </div>
          <div>
            <ul className="checks" aria-label="What the pre-transfer check covers">
              <li className="ok"><Check /><span>Ratio and cap for every hop, with the date we last checked them</span></li>
              <li className="ok"><Check /><span>Whether the transfer fits inside the monthly cap, and how many months it needs if not</span></li>
              <li className="warn"><Warn /><span>How old the seat data is, shown next to the points figure</span></li>
              <li className="ok"><Check /><span>A name check: your name must match on the bank and the airline account</span></li>
              <li className="warn"><Warn /><span>An instruction to confirm the seat and the aircraft on the airline’s site first</span></li>
            </ul>
            <div className="note note-bad" style={{ marginTop: 16 }}><Lock /><span>Transfers cannot be undone. Once points leave your bank they stay in the airline programme.</span></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="how-h">
        <div className="container">
          <h2 id="how-h" className="t-h1">From a sentence to a plan.</h2>
          <ol className="steps-list" style={{ marginTop: 'var(--space-xl)' }}>
            <li><span className="n" aria-hidden="true">1</span><div><h3 className="t-title">Tell us the trip</h3><p className="muted measure">“US in October, Qsuite from Doha. I hold Infinia and Amex.” We read it and show you what we understood.</p></div></li>
            <li><span className="n" aria-hidden="true">2</span><div><h3 className="t-title">Confirm your cards and balances</h3><p className="muted measure">A misread 1.2 lakh breaks every later step, so you confirm each number before we search.</p></div></li>
            <li><span className="n" aria-hidden="true">3</span><div><h3 className="t-title">Read your top 3 plans</h3><p className="muted measure">Best path, direct, and the card to add if you fall short. Only true Qsuite aircraft survive the filter.</p></div></li>
            <li><span className="n" aria-hidden="true">4</span><div><h3 className="t-title">Check, then transfer in your bank portal</h3><p className="muted measure">You get the transfer steps with amounts and caps. We do not move any points for you.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="limits-h" style={{ background: 'var(--color-surface-sunken)' }}>
        <div className="container cols-2">
          <h2 id="limits-h" className="t-h1">What this version does not do.</h2>
          <ul className="stack" style={{ ['--stack' as string]: '12px' }}>
            <li className="measure"><b>It is not live search.</b> Seats are cached and the age is shown. The demo currently runs on a labelled sample for Doha to the US in October 2027.</li>
            <li className="measure"><b>It does not book or transfer.</b> You confirm the seat on the airline’s site and move the points in your bank portal.</li>
            <li className="measure"><b>Rules are public-source, not bank-verified.</b> Each rule links its source and shows when we checked it. <Link href="/rules">See every rule</Link>.</li>
            <li className="measure"><b>Fees and welcome bonuses are not in the catalogue yet.</b> When we name a card to add, check its terms with the bank.</li>
          </ul>
        </div>
      </section>

      <section className="section faq" aria-labelledby="faq-h">
        <div className="container">
          <h2 id="faq-h" className="t-h1" style={{ marginBottom: 'var(--space-xl)' }}>Questions people ask first.</h2>
          {FAQ.map(f => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container stack" style={{ ['--stack' as string]: '20px' }}>
          <h2 className="t-h1">No loose ends.</h2>
          <p className="t-lg muted measure">Tell us the trip and the cards you hold. See the plan before you move a single point.</p>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/plan">Build my plan</Link>
            <Link className="btn btn-secondary" href="/rules">Read the rules</Link>
          </div>
        </div>
      </section>
    </>
  );
}
