import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import earn from '@/data/earn_rules.json';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';
import { safeUrl } from '@/lib/safe-url';
import type { EarnFile } from '@/lib/earn';
import EarnCalculator, { type CalcEntry, type MilesRate } from './EarnCalculator';
import './earn.css';

export const metadata: Metadata = {
  title: 'How to earn points on every Indian credit card',
  description: 'Base rate, accelerated categories, monthly caps, exclusions, milestones and fees for 58 Indian premium cards, each with its source and confidence, plus a monthly spend calculator.',
  alternates: { canonical: '/earn' },
};
export const revalidate = 300;

const file = earn as unknown as EarnFile;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const inr = (n: number | null | undefined) => (n == null ? 'not found' : `Rs ${n.toLocaleString('en-IN')}`);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

const FLAG: Record<string, string> = {
  conflict_in_notes: 'Sources conflict, see notes',
  derived_points: 'Some points figures are derived',
  low_confidence: 'Low confidence',
  base_rate_not_found: 'Base rate in points per Rs 100 not found',
  no_accelerated_rows: 'No accelerated rows found',
  secondary_accelerated: 'Some rows from secondary sources',
  accelerated_rate_not_found: 'Some row rates not found',
};
const QUALITY: Record<string, string> = { official: 'Official sources', mixed: 'Official and secondary sources', secondary: 'Secondary sources only' };

function SourceLink({ url, kind }: { url: string; kind?: string }) {
  const href = safeUrl(url);
  const label = `${kind === 'secondary' ? 'Secondary' : kind === 'official' ? 'Official' : 'Source'}: ${host(url)}`;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">{label}</a> : <span>{label} (link unavailable)</span>;
}

export default async function EarnPage() {
  const { data } = await getData();
  const bankOf = (id: string) => BANKS.find(b => b.id === id)?.name ?? id;
  const entries = data.cards.flatMap(c => {
    const e = file.cards[c.id];
    return e ? [{ c, e }] : [];
  });

  // miles per card point by the cheapest chain, from one engine pass per card (derived, not researched)
  const miles: Record<string, Record<string, MilesRate>> = {};
  for (const { c } of entries) {
    for (const r of reachable(data, c.id, 10_000_000)) {
      (miles[r.programme] ??= {})[c.id] = { perPoint: r.miles / r.pointsUsed, hops: r.hops.length, monthlyCap: r.cap.period === 'month' ? r.cap.limit : null };
    }
  }
  const programmes = Object.keys(miles).map(id => ({ id, name: data.programmes.find(p => p.id === id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name));
  for (const p of programmes) for (const { c } of entries) miles[p.id][c.id] ??= null;

  const calc: CalcEntry[] = entries.map(({ c, e }) => ({
    card_id: c.id, name: c.name, bank: bankOf(c.bank), currency: e.reward_currency,
    base_earn: { points_per_100_inr: e.base_earn.points_per_100_inr },
    accelerated: e.accelerated.map(a => ({ category: a.category, points_per_100_inr: a.points_per_100_inr, monthly_cap_points: a.monthly_cap_points, cap_note: a.cap_note, cat: a.cat })),
    exclusions: e.exclusions.map(x => ({ category: x.category, cat: x.cat, zero: x.zero })),
  }));

  const groups = BANKS.map(b => ({ bank: b, cards: entries.filter(x => x.c.bank === b.id) })).filter(g => g.cards.length);

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Learn', href: '/learn' }, { name: 'Earn points', href: '/earn' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '28px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">How to earn points on every card</h1>
        <p className="t-lg muted measure">
          {entries.length} Indian premium cards: base rate, accelerated categories, monthly caps, exclusions, milestones and fees. Researched from bank pages and, where the bank does not publish a figure, from named secondary sources. Last checked {day(file.checked_on)}.
        </p>
        <div className="note note-warn"><span>Banks change earn rules without notice. A missing value is shown as &quot;not found&quot;, never as zero or as no limit. Check the bank&apos;s current terms before you rely on a figure. Want to move points? Open the <Link href="/transfers">transfer explorer</Link>.</span></div>

        <EarnCalculator cards={calc} programmes={programmes} miles={miles} />

        <section aria-labelledby="cards-h" className="stack" style={{ ['--stack' as string]: '20px' }}>
          <h2 id="cards-h" className="t-h2">Earn rules by card</h2>
          <nav aria-label="Jump to a bank"><ul className="earn-jump">{groups.map(g => <li key={g.bank.id}><a href={`#bank-${g.bank.id}`}>{g.bank.name}</a></li>)}</ul></nav>

          {groups.map(g => (
            <section key={g.bank.id} id={`bank-${g.bank.id}`} aria-labelledby={`b-${g.bank.id}`} className="stack" style={{ ['--stack' as string]: '14px' }}>
              <h3 id={`b-${g.bank.id}`} className="t-h2">{g.bank.name}</h3>
              {g.cards.map(({ c, e }) => {
                const secondaryRows = e.accelerated.filter(a => a.source_kind !== 'official').length;
                const baseRate = e.base_earn.points_per_100_inr;
                return (
                  <article key={c.id} id={c.id} className="card earn-card" aria-labelledby={`h-${c.id}`}>
                    <header className="earn-card__head">
                      <h4 id={`h-${c.id}`} className="t-title">{e.name}</h4>
                      <ul className="earn-tags" aria-label="Data quality">
                        <li><span className={`tag ${e.confidence === 'high' ? 'tag-ok' : e.confidence === 'medium' ? 'tag-warn' : 'tag-bad'}`}>Confidence: {e.confidence}</span></li>
                        <li><span className={`tag ${e.source_quality === 'official' ? 'tag-ok' : 'tag-warn'}`}>{QUALITY[e.source_quality]}</span></li>
                        {secondaryRows > 0 && <li><span className="tag tag-warn">Secondary source: {secondaryRows} of {e.accelerated.length} rows</span></li>}
                      </ul>
                    </header>

                    <p className="earn-best"><b>Best way to earn.</b> {e.best_way_to_earn || 'not found'}</p>

                    <dl className="earn-dl">
                      <div><dt>Reward currency</dt><dd>{e.reward_currency}</dd></div>
                      <div>
                        <dt>Base rate</dt>
                        <dd>
                          {e.base_earn.rate_text || 'not found'}
                          {baseRate !== null ? <span className="muted"> ({baseRate} points per Rs 100)</span> : <span className="muted"> (points per Rs 100 not found)</span>}
                          {' '}<SourceLink url={e.base_earn.source_url} />
                        </dd>
                      </div>
                      <div><dt>Annual fee</dt><dd>{inr(e.annual_fee_inr)}</dd></div>
                      <div><dt>Joining fee</dt><dd>{inr(e.joining_fee_inr)}</dd></div>
                      <div>
                        <dt>Redemption value</dt>
                        <dd>{e.redemption_value?.best_known ?? 'not found'}{e.redemption_value?.source_url && <> <SourceLink url={e.redemption_value.source_url} /></>}</dd>
                      </div>
                      <div><dt>Welcome benefit</dt><dd>{e.welcome_benefit ?? 'not found'}</dd></div>
                    </dl>

                    <h5 className="earn-h">Accelerated earn</h5>
                    {e.accelerated.length === 0 ? (
                      <p className="muted t-sm">No accelerated categories found.</p>
                    ) : (
                      <div className="earn-scroll" tabIndex={0} role="region" aria-label={`Accelerated earn rows for ${e.name}`}>
                        <table className="earn-table">
                          <thead><tr><th scope="col">Category</th><th scope="col">Rate</th><th scope="col">Monthly cap</th><th scope="col">Source</th></tr></thead>
                          <tbody>
                            {e.accelerated.map((a, i) => (
                              <tr key={i}>
                                <th scope="row">{a.category}{a.merchants && <span className="muted t-sm"><br />{a.merchants}</span>}</th>
                                <td>{a.rate_text}<br /><span className="muted t-sm">{a.points_per_100_inr === null ? 'points per Rs 100 not found' : `${a.points_per_100_inr} points per Rs 100`}</span></td>
                                <td>{a.monthly_cap_points === null ? 'not found' : `${a.monthly_cap_points.toLocaleString('en-IN')} points`}{a.cap_note && <><br /><span className="muted t-sm">{a.cap_note}</span></>}</td>
                                <td><SourceLink url={a.source_url} kind={a.source_kind} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="earn-cols">
                      <div>
                        <h5 className="earn-h">Exclusions and limits</h5>
                        {e.exclusions.length ? <ul className="earn-list t-sm">{e.exclusions.map((x, i) => <li key={i}><b>{x.category}.</b> {x.note}{x.source_url && <> <SourceLink url={x.source_url} /></>}</li>)}</ul> : <p className="muted t-sm">none found</p>}
                      </div>
                      <div>
                        <h5 className="earn-h">Milestones</h5>
                        {e.milestones.length ? <ul className="earn-list t-sm">{e.milestones.map((m, i) => <li key={i}><b>{m.spend_inr == null ? 'Spend not found' : inr(m.spend_inr)} ({m.period}).</b> {m.benefit}</li>)}</ul> : <p className="muted t-sm">none found</p>}
                      </div>
                    </div>

                    {e.flags.length > 0 && (
                      <ul className="earn-flags t-sm" aria-label="Notes on this data">{e.flags.map(f => <li key={f}>{FLAG[f] ?? f}</li>)}</ul>
                    )}
                    {e.not_found.length > 0 && <p className="t-sm muted"><b>Not found:</b> {e.not_found.join('; ')}</p>}
                    {e.notes && <details><summary className="t-sm">Research notes</summary><p className="t-sm muted">{e.notes}</p></details>}
                    <p className="t-sm muted">Checked on {day(file.checked_on)}. Terms dated: {e.terms_dated ?? 'not found'}. <Link href={`/transfers/${c.id}`}>Where these points transfer</Link></p>
                  </article>
                );
              })}
            </section>
          ))}
        </section>
      </div>
    </>
  );
}
