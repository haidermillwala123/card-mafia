import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import PathChain from '@/components/PathChain';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';
import { safeUrl } from '@/lib/safe-url';
import limitsFile from '@/data/transfer_limits.json';
import indirectFile from '@/data/indirect_routes.json';

export const revalidate = 300;
const n = (x: number) => x.toLocaleString('en-IN');

type Src = { url: string; type: string; date: string };
type Lim = {
  currency: string | null; last_verified: string; confidence: string | null;
  fees: { joining: string | null; annual: string | null; source: string | null };
  limits: { daily: string | null; weekly: string | null; monthly: string | null; annual: string | null };
  min_transfer: string | null; multiple_of: string | null; transfer_fee: string | null; per_partner: string | null;
  notes: string | null; conflicts: string[]; sources: Src[];
};
type Route = { via: string; to: string; leg1: string; leg2: string; effective: string; cost: number; time: string; caps: string[]; notes: string[]; direct: string | null; beats_direct: boolean | null };
const LIM = limitsFile as unknown as { cards: Record<string, Lim> };
const IND = indirectFile as unknown as { last_verified: string; source_url: string; cards: Record<string, Route[]> };
const MAX_ROUTES = 12;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const nf = (v: string | null) => v ?? <span className="muted">not found</span>;

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
  const lim = LIM.cards[card.id];
  const eligible = (IND.cards[card.id] ?? []).filter(r => r.beats_direct !== false)
    .sort((a, b) => Number(b.beats_direct === true) - Number(a.beats_direct === true) || a.cost - b.cost);
  const routes = eligible.slice(0, MAX_ROUTES);
  const limitRows: [string, string | null][] = [
    ['Daily cap', lim?.limits.daily ?? null], ['Weekly cap', lim?.limits.weekly ?? null], ['Monthly cap', lim?.limits.monthly ?? null], ['Annual cap', lim?.limits.annual ?? null],
    ['Minimum transfer', lim?.min_transfer ?? null], ['Transfer in multiples of', lim?.multiple_of ?? null], ['Transfer fee', lim?.transfer_fee ?? null], ['Fee or cap per partner', lim?.per_partner ?? null],
  ];

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
            <div className="table-wrap"><table className="data" aria-label="Airline programmes this card reaches">
              <thead><tr><th scope="col">Programme</th><th scope="col" className="n">1,000 points =</th><th scope="col" className="n">Rate</th><th scope="col">Path</th><th scope="col">Cap and time</th></tr></thead>
              <tbody>{air.map(r => {
                const first = data.rules.find(x => x.id === r.hops[0].ruleId);
                return (
                  <tr key={r.programme}>
                    <td><b>{name(r.programme)}</b>{r.hops.every(h => h.routeConfirmedOn) && <></>}</td>
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
            <div className="table-wrap"><table className="data" aria-label="Hotel and loyalty programmes this card reaches">
              <thead><tr><th scope="col">Programme</th><th scope="col" className="n">Rate</th><th scope="col">Time</th></tr></thead>
              <tbody>{hotels.map(h => <tr key={h.id}><td><b>{name(h.to)}</b></td><td className="n">{h.ratio_in}:{h.ratio_out}</td><td className="t-sm">{h.transfer_time ?? 'not found'}</td></tr>)}</tbody>
            </table></div>
          </section>
        )}

        <section aria-labelledby="lim-h" className="stack">
          <h2 id="lim-h" className="t-h2">Limits and fees</h2>
          {!lim ? <p className="muted">No limits research for this card yet. Every limit is not found.</p> : (
            <>
              <p className="muted measure">
                “Not found” means no figure turned up in the sources. It does not mean there is no limit.
              </p>
              <div className="table-wrap"><table className="data" aria-label="Transfer limits and fees">
                <thead><tr><th scope="col">Item</th><th scope="col">What the sources say</th></tr></thead>
                <tbody>
                  <tr><td><b>Joining fee</b></td><td>{nf(lim.fees.joining)}</td></tr>
                  <tr><td><b>Annual fee</b></td><td>{nf(lim.fees.annual)}{lim.fees.source && <div className="t-sm muted">Source: {lim.fees.source}</div>}</td></tr>
                  {limitRows.map(([k, v]) => <tr key={k}><td><b>{k}</b></td><td>{nf(v)}</td></tr>)}
                </tbody>
              </table></div>
              {lim.notes && <details><summary>Notes from the research</summary><p className="t-sm measure" style={{ marginTop: 8 }}>{lim.notes}</p></details>}
              {lim.conflicts.length > 0 && (
                <div className="note note-warn"><div><b>Sources disagree.</b><ul>{lim.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul></div></div>
              )}
              {lim.sources.length > 0 && (
                <div>
                  <h3 className="t-title">Sources</h3>
                  <ul className="t-sm">{lim.sources.map((s, i) => {
                    const href = safeUrl(s.url);
                    return <li key={i}>{href ? <a href={href} rel="noopener noreferrer" target="_blank">{s.url}</a> : s.url} <span className="muted">({s.type}, {s.date})</span></li>;
                  })}</ul>
                </div>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="ind-h" className="stack">
          <h2 id="ind-h" className="t-h2">Indirect routes</h2>
          {routes.length === 0 ? <p className="muted">No indirect route in the research that beats a direct one or fills a gap.</p> : (
            <>
              <p className="muted measure">
                Two transfers through an intermediate programme. Shown when the chain beats the direct rate or the card has no direct route. Best {routes.length} of {eligible.length}, best first. Composed from points.casa pair ratios, checked {day(IND.last_verified)}; the research gives no confidence grade for routes. <a href={safeUrl(IND.source_url)} rel="noopener noreferrer" target="_blank">Source</a>. Each leg is a separate transfer and cannot be reversed.
              </p>
              <div className="table-wrap"><table className="data" aria-label="Indirect routes this card can use">
                <thead><tr><th scope="col">Destination</th><th scope="col">Path and leg ratios</th><th scope="col" className="n">Effective</th><th scope="col">Direct</th><th scope="col">Caps and time</th></tr></thead>
                <tbody>{routes.map(r => (
                  <tr key={`${r.via}-${r.to}`}>
                    <td><b>{r.to}</b></td>
                    <td><PathChain nodes={[name(card.programme), r.via, r.to]} ratios={[r.leg1, r.leg2]} /></td>
                    <td className="n">{r.effective}</td>
                    <td className="t-sm">{r.direct ? <>{r.direct} <span className="tag tag-ok">Chain is cheaper</span></> : <span className="muted">no direct route found</span>}</td>
                    <td className="t-sm">{r.caps.length ? r.caps.join('; ') : <span className="muted">cap not found</span>}<div className="muted">{r.time}</div>{r.notes.map((t, i) => <div key={i} className="muted">{t}</div>)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </>
          )}
        </section>

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
