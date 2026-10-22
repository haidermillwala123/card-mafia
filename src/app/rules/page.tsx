import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { BANKS } from '@/lib/engine/data';
import { getData } from '@/lib/engine/load';

export const metadata: Metadata = {
  title: 'Transfer rules and sources',
  description: 'Every transfer ratio, cap and Qsuite aircraft type Card Mafia uses, with its source and the date we last checked it. Public-source rules, not yet bank-verified.',
  alternates: { canonical: '/rules' },
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const n = (x: number) => x.toLocaleString('en-IN');
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
};

export const revalidate = 300;

export default async function RulesPage() {
  const { data, source } = await getData();
  const programmeName = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const cardName = (id: string) => {
    const c = data.cards.find(x => x.id === id);
    return c ? `${BANKS.find(b => b.id === c.bank)?.name.replace(/ Bank| Card/, '') ?? ''} ${c.name}`.trim() : id;
  };
  const rules = [...data.rules].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Rules', href: '/rules' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '24px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Transfer rules and sources</h1>
        <p className="t-lg muted measure">
          These are the rules behind every plan. Ratios read as points in : points out, so 2:1 means two points for one mile. Rules were compiled from public sources on {day(data.rulesCheckedOn)} and are not yet matched to the bank portals. Where a route has been seen working it says so.
        </p>
        <p className="t-sm muted">{source === 'database' ? 'Read live from the Card Mafia database.' : 'Read from the versioned rules files. The database was not reachable.'}</p>
        <div className="note note-warn"><span>Banks change rules without notice. Axis removed Qatar in April 2026 and re-added it in July at a worse rate. Always match each hop on the bank portal before you transfer.</span></div>

        <section aria-labelledby="rules-h" className="stack">
          <h2 id="rules-h" className="t-h2">Ratios and caps</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>From</th><th>To</th><th className="n">Ratio</th><th>Cap</th><th>Status</th><th>Source</th></tr></thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id}>
                    <td><b>{programmeName(r.from)}</b>{r.cards && <div className="t-sm muted">{r.cards.map(cardName).join(', ')}</div>}</td>
                    <td>{programmeName(r.to)}</td>
                    <td className="n">{r.ratio_in}:{r.ratio_out}</td>
                    <td>{r.monthly_cap ? `${n(r.monthly_cap)} a month` : r.annual_cap ? `${n(r.annual_cap)} a year` : <span className="muted">not found</span>}{r.min_multiple ? <div className="t-sm muted">multiples of {n(r.min_multiple)}</div> : null}</td>
                    <td>{r.route_confirmed_on ? <span className="tag tag-ok">Route seen working {day(r.route_confirmed_on)}</span> : <span className="tag tag-warn">Unverified</span>}</td>
                    <td className="t-sm">{r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer">{host(r.source_url)}</a> : <span className="muted">no link</span>}<div className="muted">{r.source_note}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="qs-h" className="stack">
          <h2 id="qs-h" className="t-h2">Qsuite aircraft</h2>
          <p className="muted measure">Qatar Airways aircraft types we treat as carrying Qsuite. “All” means the whole type has it. “Some” means only part of the fleet does, so a plan on that type says to confirm the aircraft. {data.qsuite.verified_at ? '' : 'This list is not yet verified.'}</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Aircraft</th><th>Qsuite fitted</th></tr></thead>
              <tbody>{data.qsuite.types.map(t => <tr key={t.type}><td><b>{t.type}</b></td><td>{t.fit === 'all' ? 'All of the type' : 'Some of the type'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="seat-h" className="stack">
          <h2 id="seat-h" className="t-h2">Seat data</h2>
          <p className="muted measure">{data.seats.sample ? 'The demo runs on a labelled sample of Doha to JFK, ORD, LAX and MIA, and India to Doha, for October 2027. It is not live availability.' : 'Seats come from cached seats.aero availability.'} Every plan shows how old the seat data is.</p>
        </section>
      </div>
    </>
  );
}
