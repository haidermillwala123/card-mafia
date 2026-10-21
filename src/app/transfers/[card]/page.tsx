import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import PathChain from '@/components/PathChain';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';

export const revalidate = 300;
const n = (x: number) => x.toLocaleString('en-IN');

export async function generateStaticParams() {
  const { data } = await getData();
  return data.cards.map(c => ({ card: c.id }));
}

const cardTitle = (bank: string, name: string) => `${bank.replace(/ Bank| Card/, '')} ${name}`;

export async function generateMetadata({ params }: { params: Promise<{ card: string }> }): Promise<Metadata> {
  const { card: id } = await params;
  const { data } = await getData();
  const card = data.cards.find(c => c.id === id);
  if (!card) return {};
  const title = cardTitle(BANKS.find(b => b.id === card.bank)?.name ?? '', card.name);
  const air = reachable(data, card.id, 10000000);
  const best = air[0];
  const name = (pid: string) => data.programmes.find(p => p.id === pid)?.name ?? pid;
  return {
    title: `${title} transfer partners and ratios`,
    description: `${title} points reach ${air.length} airline programmes.${best ? ` Best rate ${best.pointsPerMile}:1 to ${name(best.programme)}.` : ''} Ratios, caps and the chain for each, sourced and dated.`.slice(0, 158),
    alternates: { canonical: `/transfers/${card.id}` },
  };
}

export default async function CardTransfers({ params }: { params: Promise<{ card: string }> }) {
  const { card: id } = await params;
  const { data } = await getData();
  const card = data.cards.find(c => c.id === id);
  if (!card) notFound();
  const bank = BANKS.find(b => b.id === card.bank);
  const title = cardTitle(bank?.name ?? '', card.name);
  const name = (pid: string) => data.programmes.find(p => p.id === pid)?.name ?? pid;
  const air = reachable(data, card.id, 10000000);
  const hotels = data.rules.filter(r => r.from === card.programme && data.programmes.find(p => p.id === r.to)?.kind === 'hotel');
  const siblings = data.cards.filter(c => c.bank === card.bank && c.id !== card.id);

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Transfer explorer', href: '/transfers' }, { name: title, href: `/transfers/${card.id}` }]} />
      <div className="container stack" style={{ ['--stack' as string]: '24px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">{title} transfer partners</h1>
        <p className="t-lg muted measure">
          {title} earns {name(card.programme)}. It reaches {air.length} airline {air.length === 1 ? 'programme' : 'programmes'}{hotels.length ? ` and ${hotels.length} hotel ${hotels.length === 1 ? 'programme' : 'programmes'}` : ''}, directly or through another programme. Ratios read as points in : points out.
        </p>
        <div className="note note-warn"><span>Public sources, not yet matched to the bank portal. Rules checked {new Date(`${data.rulesCheckedOn}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}. Match each hop on the portal before you transfer.</span></div>
        <div className="btn-row"><Link className="btn btn-primary" href="/calculator">Open the calculator</Link><Link className="btn btn-secondary" href="/plan">Build a plan</Link></div>

        <section aria-labelledby="air-h" className="stack">
          <h2 id="air-h" className="t-h2">Airline programmes</h2>
          {air.length === 0 ? <p className="muted">No airline route in our rules yet.</p> : (
            <div className="table-wrap"><table className="data">
              <thead><tr><th>Programme</th><th className="n">1,000 points =</th><th className="n">Rate</th><th>Path</th><th>Cap and time</th></tr></thead>
              <tbody>{air.map(r => {
                const first = data.rules.find(x => x.id === r.hops[0].ruleId);
                return (
                  <tr key={r.programme}>
                    <td><b>{name(r.programme)}</b>{r.hops.every(h => h.routeConfirmedOn) && <> <span className="tag tag-ok">Route seen working</span></>}</td>
                    <td className="n">{n(Math.floor(1000 / r.pointsPerMile))}</td>
                    <td className="n">{r.pointsPerMile}:1</td>
                    <td><PathChain nodes={[r.hops[0].from, ...r.hops.map(h => h.to)].map(name)} ratios={r.hops.map(h => `${h.ratio_in}:${h.ratio_out}`)} /></td>
                    <td className="t-sm">{r.cap.limit ? `${n(r.cap.limit)} a ${r.cap.period === 'year' ? 'year' : 'month'}` : 'no cap found'}{first?.min_multiple ? <div className="muted">multiples of {n(first.min_multiple)}</div> : null}{first?.transfer_time && <div className="muted">{first.transfer_time}</div>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </section>

        {hotels.length > 0 && (
          <section aria-labelledby="hotel-h" className="stack">
            <h2 id="hotel-h" className="t-h2">Hotel and loyalty programmes</h2>
            <div className="table-wrap"><table className="data">
              <thead><tr><th>Programme</th><th className="n">Rate</th><th>Time</th></tr></thead>
              <tbody>{hotels.map(h => <tr key={h.id}><td><b>{name(h.to)}</b></td><td className="n">{h.ratio_in}:{h.ratio_out}</td><td className="t-sm">{h.transfer_time ?? 'not found'}</td></tr>)}</tbody>
            </table></div>
          </section>
        )}

        {siblings.length > 0 && (
          <section aria-labelledby="sib-h" className="stack">
            <h2 id="sib-h" className="t-title">More {bank?.name} cards</h2>
            <ul className="btn-row">{siblings.map(c => <li key={c.id}><Link className="btn btn-secondary btn-sm" href={`/transfers/${c.id}`}>{c.name}</Link></li>)}</ul>
          </section>
        )}
      </div>
    </>
  );
}
