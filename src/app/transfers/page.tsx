import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';
import limitsFile from '@/data/transfer_limits.json';

export const metadata: Metadata = {
  title: 'Credit card transfer partners and ratios in India',
  description: 'Pick an Indian premium card to see every airline programme its points reach, the cheapest chain, the ratio at each hop and the cap, sourced and dated.',
  alternates: { canonical: '/transfers' },
};
export const revalidate = 300;

type Lim = { limits: { annual: string | null; monthly: string | null }; confidence: string | null };
const LIM = limitsFile as unknown as { last_verified: string; cards: Record<string, Lim> };
// Airline partners shown on every card tile.
const TOP = ['krisflyer', 'qatar-privilege-club', 'ba-executive-club', 'air-india', 'flying-blue'];
const n = (x: number) => x.toLocaleString('en-IN');

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default async function TransfersPage() {
  const { data, source } = await getData();
  const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const groups = BANKS.map(b => ({
    bank: b,
    cards: data.cards.filter(c => c.bank === b.id).map(c => ({ card: c, reach: reachable(data, c.id, 10000000), direct: reachable(data, c.id, 10000000, true) })),
  })).filter(g => g.cards.length);

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Transfer explorer', href: '/transfers' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '28px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Transfer partners and ratios</h1>
        <p className="t-lg muted measure">
          {data.cards.length} cards, {data.programmes.length} programmes and {data.rules.length} transfer pairs, checked {day(data.rulesCheckedOn)}. Pick a card to see every airline programme it reaches by the cheapest chain. {source === 'database' ? 'Read live from the database.' : 'Read from the versioned rules files.'}
        </p>
        <p className="t-sm muted measure"><b>How to read a ratio.</b> Ratio 5:2 means 5 card points become 2 partner miles, so 2.5 points per mile. A smaller first number is better. Caps and fees were last verified {day(LIM.last_verified)}. “Not found” means we found no figure, not that there is no limit.</p>
        <div className="note note-warn"><span>Public sources, not yet matched to the bank portals. Banks change rules without notice, so match each hop on the portal before you transfer.</span></div>
        <p>Want numbers for your balance? <Link href="/calculator">Open the points calculator</Link>.</p>

        {groups.map(g => (
          <section key={g.bank.id} aria-labelledby={`b-${g.bank.id}`} className="stack" style={{ ['--stack' as string]: '12px' }}>
            <h2 id={`b-${g.bank.id}`} className="t-h2">{g.bank.name}</h2>
            <ul className="cols-3" style={{ gap: 12 }}>
              {g.cards.map(({ card, reach, direct }) => {
                const best = reach[0];
                const lim = LIM.cards[card.id];
                const rule = data.rules.find(r => r.from === card.programme && r.annual_cap);
                const annual = rule?.annual_cap ? `${n(rule.annual_cap)} a year` : lim?.limits.annual ? 'stated, see card page' : 'not found';
                return (
                  <li key={card.id} className="card">
                    <h3 className="t-title"><Link href={`/transfers/${card.id}`}>{card.name}</Link></h3>
                    <p className="t-sm muted" style={{ marginTop: 6 }}>{reach.length ? `${reach.length} airline programmes` : 'No airline route yet'}{best ? `. Best rate ${best.pointsPerMile}:1 to ${name(best.programme)}.` : ''}</p>
                    <ul className="t-sm" style={{ marginTop: 8 }} aria-label={`${card.name} direct ratios`}>
                      {TOP.map(pid => {
                        const d = direct.find(x => x.programme === pid);
                        return <li key={pid}>{name(pid)}: <b>{d ? `${d.hops[0].ratio_in}:${d.hops[0].ratio_out}` : 'no direct route'}</b></li>;
                      })}
                    </ul>
                    <p className="t-sm muted" style={{ marginTop: 8 }}>Annual cap: {annual}.{lim?.limits.monthly ? ' Monthly cap stated.' : ''}{lim?.confidence ? ` Confidence ${lim.confidence}.` : ''}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
