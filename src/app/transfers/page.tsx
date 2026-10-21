import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import PathChain from '@/components/PathChain';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';

export const metadata: Metadata = {
  title: 'Credit card transfer partners and ratios in India',
  description: 'Every airline programme each Indian premium card reaches, with the cheapest chain, the ratio at each hop and the monthly or annual cap, sourced and dated.',
  alternates: { canonical: '/transfers' },
};
export const revalidate = 300;

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const n = (x: number) => x.toLocaleString('en-IN');

export default async function TransfersPage() {
  const { data, source } = await getData();
  const pn = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const groups = BANKS.map(b => ({
    bank: b,
    cards: data.cards.filter(c => c.bank === b.id).map(c => ({ card: c, reach: reachable(data, c.id, 10000000) })).filter(x => x.reach.length),
  })).filter(g => g.cards.length);
  const airlineRules = data.rules.filter(r => data.programmes.find(p => p.id === r.from)?.kind === 'airline');
  const pairs = groups.reduce((s, g) => s + g.cards.reduce((t, c) => t + c.reach.length, 0), 0);

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Transfer explorer', href: '/transfers' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '28px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Transfer partners and ratios</h1>
        <p className="t-lg muted measure">
          Every airline programme each card reaches, by the cheapest chain. Ratios read as points in : points out. {groups.reduce((s, g) => s + g.cards.length, 0)} cards, {pairs} card-to-programme routes, {data.rules.length} rules, checked {day(data.rulesCheckedOn)}. {source === 'database' ? 'Read live from the database.' : 'Read from the versioned rules files.'}
        </p>
        <div className="note note-warn"><span>Public sources, not yet matched to the bank portals. Banks change rules without notice, so match each hop on the portal before you transfer.</span></div>
        <p>Want numbers for your balance? <Link href="/calculator">Open the points calculator</Link>.</p>

        {groups.map(g => (
          <section key={g.bank.id} aria-labelledby={`b-${g.bank.id}`} className="stack" style={{ ['--stack' as string]: '20px' }}>
            <h2 id={`b-${g.bank.id}`} className="t-h2">{g.bank.name}</h2>
            {g.cards.map(({ card, reach }) => (
              <div key={card.id} className="card">
                <h3 className="t-title">{g.bank.name.replace(/ Bank| Card/, '')} {card.name}</h3>
                <p className="t-sm muted">Earns {pn(card.programme)}</p>
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="data">
                    <thead><tr><th>Programme</th><th className="n">1,000 points =</th><th className="n">Rate</th><th>Path</th><th>Cap</th></tr></thead>
                    <tbody>
                      {reach.map(r => {
                        const first = data.rules.find(x => x.id === r.hops[0].ruleId);
                        return (
                          <tr key={r.programme}>
                            <td><b>{pn(r.programme)}</b></td>
                            <td className="n">{n(Math.floor(1000 / r.pointsPerMile))}</td>
                            <td className="n">{r.pointsPerMile}:1</td>
                            <td><PathChain nodes={[r.hops[0].from, ...r.hops.map(h => h.to)].map(pn)} ratios={r.hops.map(h => `${h.ratio_in}:${h.ratio_out}`)} /></td>
                            <td className="t-sm">{r.cap.limit ? `${n(r.cap.limit)} a ${r.cap.period === 'year' ? 'year' : 'month'}` : 'not found'}{first?.min_multiple ? <div className="muted">multiples of {n(first.min_multiple)}</div> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        ))}

        <section aria-labelledby="hub-h" className="stack">
          <h2 id="hub-h" className="t-h2">Airline-to-airline moves</h2>
          <p className="muted measure">Some programmes move points on to others. These are the hops that make multi-hop chains possible.</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>From</th><th>To</th><th className="n">Ratio</th><th>Source</th></tr></thead>
              <tbody>{airlineRules.map(r => <tr key={r.id}><td><b>{pn(r.from)}</b></td><td>{pn(r.to)}</td><td className="n">{r.ratio_in}:{r.ratio_out}</td><td className="t-sm"><a href={r.source_url} target="_blank" rel="noopener noreferrer">Source</a><div className="muted">{r.source_note}</div></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
