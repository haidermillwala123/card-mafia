import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';

export const metadata: Metadata = {
  title: 'Credit card transfer partners and ratios in India',
  description: 'Pick an Indian premium card to see every airline programme its points reach, the cheapest chain, the ratio at each hop and the cap, sourced and dated.',
  alternates: { canonical: '/transfers' },
};
export const revalidate = 300;

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default async function TransfersPage() {
  const { data, source } = await getData();
  const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const groups = BANKS.map(b => ({
    bank: b,
    cards: data.cards.filter(c => c.bank === b.id).map(c => ({ card: c, reach: reachable(data, c.id, 10000000) })),
  })).filter(g => g.cards.length);

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Transfer explorer', href: '/transfers' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '28px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Transfer partners and ratios</h1>
        <p className="t-lg muted measure">
          {data.cards.length} cards, {data.programmes.length} programmes and {data.rules.length} transfer pairs, checked {day(data.rulesCheckedOn)}. Pick a card to see every airline programme it reaches by the cheapest chain. {source === 'database' ? 'Read live from the database.' : 'Read from the versioned rules files.'}
        </p>
        <div className="note note-warn"><span>Public sources, not yet matched to the bank portals. Banks change rules without notice, so match each hop on the portal before you transfer.</span></div>
        <p>Want numbers for your balance? <Link href="/calculator">Open the points calculator</Link>.</p>

        {groups.map(g => (
          <section key={g.bank.id} aria-labelledby={`b-${g.bank.id}`} className="stack" style={{ ['--stack' as string]: '12px' }}>
            <h2 id={`b-${g.bank.id}`} className="t-h2">{g.bank.name}</h2>
            <ul className="cols-3" style={{ gap: 12 }}>
              {g.cards.map(({ card, reach }) => {
                const best = reach[0];
                return (
                  <li key={card.id} className="card">
                    <h3 className="t-title"><Link href={`/transfers/${card.id}`}>{card.name}</Link></h3>
                    <p className="t-sm muted" style={{ marginTop: 6 }}>{reach.length ? `${reach.length} airline programmes` : 'No airline route yet'}{best ? `. Best rate ${best.pointsPerMile}:1 to ${name(best.programme)}.` : ''}</p>
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
