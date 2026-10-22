import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { BANKS } from '@/lib/engine/data';
import { getData } from '@/lib/engine/load';
import RulesBrowser, { type RuleGroup } from './RulesBrowser';

export const metadata: Metadata = {
  title: 'Transfer rules and sources',
  description: 'Every transfer ratio, cap and Qsuite aircraft type Card Mafia uses, and the date we last checked it.',
  alternates: { canonical: '/rules' },
};

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const n = (x: number) => x.toLocaleString('en-IN');

export const revalidate = 300;

export default async function RulesPage() {
  const { data } = await getData();
  const programmeName = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const cardName = (id: string) => {
    const c = data.cards.find(x => x.id === id);
    return c ? `${BANKS.find(b => b.id === c.bank)?.name.replace(/ Bank| Card/, '') ?? ''} ${c.name}`.trim() : id;
  };
  const rules = [...data.rules].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const groups = [...Map.groupBy(rules, r => r.from)];
  // The browser is a client component, so it gets plain strings, not the data objects.
  const browserGroups: RuleGroup[] = groups.map(([from, list]) => ({
    id: from,
    name: programmeName(from),
    rows: list.map(r => ({
      id: r.id,
      to: programmeName(r.to),
      cards: r.cards ? r.cards.map(cardName).join(', ') : null,
      ratio: `${r.ratio_in}:${r.ratio_out}`,
      limit: r.monthly_cap ? `${n(r.monthly_cap)} a month` : r.annual_cap ? `${n(r.annual_cap)} a year` : null,
      multiple: r.min_multiple ? `multiples of ${n(r.min_multiple)}` : null,
    })),
  }));
  const cardProgramme = Object.fromEntries(data.cards.map(c => [c.id, c.programme]));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Rules', href: '/rules' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '24px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Transfer rules and sources</h1>
        <p className="t-lg muted measure">
          These are the rules behind every plan. Ratios read as points in : points out, so 2:1 means two points for one mile. Rules were compiled on {day(data.rulesCheckedOn)}. Check your bank portal before you transfer.
        </p>
        <div className="note note-warn"><span>Banks change rules without notice. Axis removed Qatar in April 2026 and re-added it in July at a worse rate. Always match each hop on the bank portal before you transfer.</span></div>

        <section aria-labelledby="rules-h" className="stack">
          <h2 id="rules-h" className="t-h2">Ratios and caps</h2>
          <p className="muted measure">Search for your card or an airline, or tick “My cards only”. Open a points currency to see every airline or hotel it can move to.</p>
          <RulesBrowser groups={browserGroups} cardProgramme={cardProgramme} />
        </section>

        <section aria-labelledby="qs-h" className="stack">
          <h2 id="qs-h" className="t-h2">Qsuite aircraft</h2>
          <p className="muted measure">Qatar Airways aircraft types we treat as carrying Qsuite. “All” means the whole type has it. “Some” means only part of the fleet does, so a plan on that type says to confirm the aircraft. {data.qsuite.verified_at ? '' : 'This list is not yet verified.'}</p>
          <div className="table-wrap">
            <table className="data" aria-label="Qsuite aircraft types">
              <thead><tr><th scope="col">Aircraft</th><th scope="col">Qsuite fitted</th></tr></thead>
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
