'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataFoot, Note, Tag, VerifiedStamp } from '@/components/app/ui';
import Ic from '@/components/app/Icons';
import { type Cabin, type Holdings, searchSeats, type SearchResponse, type SeatView } from '@/lib/app/api';
import { cardName, programmeName } from '@/lib/app/catalog';
import { CABIN_LABEL, dateShort, fmt, inr, monthLabel, monthRange } from '@/lib/app/format';
import { upcomingMonths } from '@/lib/app/parse';
import { useWallet } from '@/lib/app/wallet';
import { airport, cityOf, expandDest, GROUPS } from '@/lib/airports';
import './plan.css';

type Props = { o?: string; d?: string; from?: string; to?: string; cabin?: string; n?: string };
type PlanKind = 'best' | 'fewest' | 'taxes' | 'short';
type Plan = { kind: PlanKind; title: string; seat: SeatView };

const CABINS: Cabin[] = ['economy', 'premium_economy', 'business', 'first'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const reachable = (s: SeatView) => (s.reach?.status === 'ok' || s.reach?.status === 'pooled') && !!s.reach.best;
const used = (s: SeatView) => s.reach?.best?.pointsUsed ?? Infinity;
const hopCount = (s: SeatView) => s.reach?.best?.hops.length ?? Infinity;
const cheapest = (rows: SeatView[]) => rows.reduce<SeatView | null>((m, s) => (!m || used(s) < used(m) ? s : m), null);

// The three plans are picked by code from the rows, nothing else. A plan that repeats an earlier seat is dropped.
function buildPlans(rows: SeatView[]): Plan[] {
  const ok = rows.filter(reachable);
  const plans: Plan[] = [];
  const add = (kind: PlanKind, title: string, seat: SeatView | null | undefined) => {
    if (seat && !plans.some(p => p.seat.id === seat.id)) plans.push({ kind, title, seat });
  };
  add('best', 'Best path', cheapest(ok));
  add('fewest', 'Fewest steps', [...ok].sort((a, b) => hopCount(a) - hopCount(b) || used(a) - used(b))[0]);
  add('taxes', 'Lowest taxes', ok.filter(s => s.taxes_known && s.taxes_inr !== null).sort((a, b) => (a.taxes_inr as number) - (b.taxes_inr as number) || used(a) - used(b))[0]);
  return plans;
}

function whyText(p: Plan, all: Plan[]): string {
  const r = p.seat.reach?.best;
  if (!r) return '';
  const steps = r.hops.length === 1 ? 'One transfer' : `${r.hops.length} transfers`;
  const lead = `${steps} at ${r.ratio}`;
  const pooled = p.seat.reach?.status === 'pooled' ? ', with points pooled from more than one card' : '';
  if (p.kind === 'best') return `${lead}${pooled} and the cheapest reachable seat we saw.`;
  if (p.kind === 'fewest') return `${lead}${pooled}. It has the fewest transfer steps among the seats you can reach.`;
  const best = all.find(x => x.kind === 'best');
  const diff = best ? used(p.seat) - used(best.seat) : 0;
  return `${lead}${pooled}. Taxes are the lowest among the seats you can reach${diff > 0 ? `, for ${fmt(diff)} more points than the best path` : ''}.`;
}

export default function PlanBoard(props: Props) {
  const w = useWallet();
  const nextYm = upcomingMonths(2)[1];
  const o = props.o && /^[A-Z]{3}$/.test(props.o) ? props.o : w.profile.airport || 'BOM';
  const d = props.d && (GROUPS.some(g => g.id === props.d) || /^[A-Z]{3}$/.test(props.d)) ? props.d : 'europe';
  const range = monthRange(nextYm);
  const from = props.from && ISO.test(props.from) ? props.from : range.from;
  const to = props.to && ISO.test(props.to) ? props.to : range.to;
  const cabin: Cabin = CABINS.find(c => c === props.cabin) ?? CABINS.find(c => c === w.profile.cabin) ?? 'business';
  const n = Math.min(9, Math.max(1, Number(props.n) || 1));

  const [res, setRes] = useState<{ key: string; r: Awaited<ReturnType<typeof searchSeats>> } | null>(null);
  const holdings: Holdings = w.holdings;
  const key = [o, d, from, to, cabin, n, w.hasCards ? holdings.cardIds.join() : ''].join('|');

  useEffect(() => {
    if (!w.ready || !w.hasCards) return;
    let live = true;
    searchSeats({ origins: [o], dests: expandDest(d), from, to, cabin, travellers: n, holdings, limit: 200 }).then(r => live && setRes({ key, r }));
    return () => {
      live = false;
    };
    // key already covers every input above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.ready, key]);

  const done = res && res.key === key ? res.r : null;
  const data: SearchResponse | null = done && done.ok ? done.data : null;
  const plans = useMemo(() => (data ? buildPlans(data.rows) : []), [data]);
  const shortSeat = useMemo(() => {
    if (!data || plans.length) return null;
    return cheapest(data.rows.filter(s => s.reach?.status === 'short' && s.reach.best));
  }, [data, plans]);
  const shown: Plan[] = plans.length ? plans : shortSeat ? [{ kind: 'short', title: 'Closest seat', seat: shortSeat }] : [];

  const allSeats = `/flights?${new URLSearchParams({ o, d, from, to, cabin, n: String(n), reach: '1' })}`;
  const destLabel = GROUPS.find(g => g.id === d)?.label ?? (airport(d) ? cityOf(d) : d);
  const loading = w.ready && w.hasCards && !done;
  const maxPts = Math.max(1, ...shown.map(p => used(p.seat)).filter(Number.isFinite));
  const first = plans[0]?.seat.reach?.best ?? null;
  const rulesDate = (s: SeatView) => s.reach?.best?.hops.map(h => h.verifiedOn).filter((x): x is string => !!x).sort()[0] ?? data?.rulesCheckedOn ?? null;

  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Your plan</span>
        <h1 className="a-hd a-sm">
          {shown.length > 1 ? `${shown.length} ways to fly` : shown.length === 1 && plans.length ? 'One way to fly' : 'Flying'} {cityOf(o)} → {destLabel}.
          <br />
          <em>{plans.length ? 'Best path first.' : 'Cards decide the path.'}</em>
        </h1>
        <div className="a-r a-rw">
          <span className="a-chip">
            {cityOf(o)} → {destLabel}
          </span>
          <span className="a-chip">{from.slice(0, 7) === to.slice(0, 7) ? monthLabel(from.slice(0, 7)) : `${dateShort(from)} to ${dateShort(to)}`}</span>
          <span className="a-chip">
            {n} {n === 1 ? 'person' : 'people'}
          </span>
          <span className="a-chip">{CABIN_LABEL[cabin]}</span>
          {w.profile.cardIds.map(id => (
            <span className="a-chip" key={id}>
              {cardName(id)}
            </span>
          ))}
        </div>

        {!w.ready || loading ? (
          <div className="a-g3" aria-busy="true">
            {[0, 1, 2].map(i => (
              <div className="a-gl" key={i}>
                <div className="a-sk" style={{ width: '50%', height: 20 }} />
                <div className="a-sk" style={{ width: '70%' }} />
                <div className="a-sk" style={{ width: '90%' }} />
                <div className="a-sk" style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        ) : !w.hasCards ? (
          <div className="a-gl a-dashed">
            <b className="a-t">Add a card and a trip.</b>
            <span className="a-mu">A plan needs the cards you hold, so we can show which one pays and how.</span>
            <div className="a-r a-rw">
              <Link className="a-cta" href="/wallet">
                Add your cards
                <span className="a-ar">
                  <Ic name="arrow" />
                </span>
              </Link>
              <Link className="a-ghost" href={allSeats.replace('&reach=1', '')}>
                See all seats
              </Link>
            </div>
          </div>
        ) : done && !done.ok ? (
          <Note kind="danger" title="We could not build your plan. ">
            <span className="a-plan-err">{done.error}</span>
          </Note>
        ) : data && shown.length === 0 ? (
          <div className="a-gl a-dashed">
            <b className="a-t">We saw no seats for these dates.</b>
            <span className="a-mu">Try other dates, or look at every seat on the route.</span>
            <Link className="a-ghost" style={{ alignSelf: 'flex-start' }} href={allSeats.replace('&reach=1', '')}>
              See all seats
            </Link>
          </div>
        ) : (
          <>
            {!plans.length && shortSeat && (
              <Note kind="warning" title="No seat is within reach yet. ">
                Here is the cheapest seat we saw, and what is missing.
              </Note>
            )}
            <div className="a-g3">
              {shown.map((p, i) => {
                const s = p.seat;
                const r = s.reach?.best;
                const each = Math.round(used(s) / n);
                return (
                  <div className={`a-gl${i === 0 ? ' a-sel' : ''}`} key={p.kind}>
                    <div className="a-r">
                      <h2 className="a-t a-g">{p.title}</h2>
                      {p.kind === 'short' ? <Tag kind="warning">Short</Tag> : <Tag kind="best">{s.reach?.status === 'pooled' ? 'Pooled' : 'Reachable'}</Tag>}
                    </div>
                    <span className="a-mu">
                      {dateShort(s.date)} · {programmeName(s.programme_id)} · {CABIN_LABEL[s.cabin] ?? s.cabin}
                    </span>
                    {r && (
                      <div className="a-hop">
                        <Tag kind="outline">{r.cardName}</Tag>
                        {r.hops.map(h => (
                          <span key={`${h.from}-${h.to}`} className="a-r" style={{ gap: 6 }}>
                            <span className="a-mono a-mu">{h.ratio}</span>
                            <Tag kind="outline">{programmeName(h.to)}</Tag>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="a-r">
                      <div className="a-g">
                        <span className="a-cap">Points each</span>
                        <div className={`a-fig${i === 0 ? ' a-t' : ''}`}>{fmt(each)}</div>
                      </div>
                      <div>
                        <span className="a-cap">Taxes each</span>
                        <div className="a-fig">{s.taxes_known && s.taxes_inr !== null ? inr(s.taxes_inr) : <span className="a-mu" style={{ font: 'var(--type-body-sm)' }}>Taxes: see airline</span>}</div>
                      </div>
                    </div>
                    <div className="a-bar">
                      <i className={i === 0 ? 'a-t' : ''} style={{ width: `${Math.round((used(s) / maxPts) * 100)}%` }} />
                    </div>
                    <div className="a-kv">
                      <span>For {n} {n === 1 ? 'person' : 'people'}</span>
                      <b>{fmt(used(s))} pts</b>
                    </div>
                    {p.kind === 'short' && r ? (
                      <span className="a-plan-note">
                        You are {fmt(r.shortBy)} points short.
                        {s.reach?.fix ? ` ${s.reach.fix.cardName} closes the gap.` : ''}
                      </span>
                    ) : (
                      s.reach?.pooled && (
                        <span className="a-plan-note">Paid from {s.reach.pooled.transfers.map(t => `${t.cardName} (${fmt(t.sourcePoints)} pts)`).join(' and ')}.</span>
                      )
                    )}
                    <div className="a-dsh" />
                    {rulesDate(s) && <VerifiedStamp>Rules verified {rulesDate(s)}</VerifiedStamp>}
                    <div className="a-r a-plan-actions">
                      {plans.length > 1 && (
                        <Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href={`/flights/compare?${new URLSearchParams({ ids: plans.map(x => x.seat.id).join(','), n: String(n) })}`}>
                          Compare
                        </Link>
                      )}
                      <Link className={`cm-btn cm-btn--sm a-pb ${i === 0 ? 'cm-btn--primary' : 'cm-btn--secondary'}`} href={`/flights/checkout?${new URLSearchParams({ id: s.id, n: String(n) })}`}>
                        Check out
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="a-split">
              <div className="a-main a-gl">
                <span className="a-cap">Why this plan</span>
                {plans.length ? (
                  <p className="a-plan-why">
                    {whyText(plans[0], plans)}
                    {plans.length > 1 && ` ${plans.slice(1).map(p => `${p.title}: ${whyText(p, plans)}`).join(' ')}`}
                  </p>
                ) : (
                  <p className="a-plan-why">No seat on this route is within reach of your cards for these dates. The closest one is shown above.</p>
                )}
                <span className="cm-stamp">
                  <Ic name="shield" small />
                  Plans are picked by code from the seats we saw. Nothing here is a promise of a seat.
                </span>
                <Link className="cm-btn cm-btn--ghost" style={{ alignSelf: 'flex-start' }} href={allSeats}>
                  See all seats
                  <Ic name="arrow" />
                </Link>
              </div>
              <div className="a-side a-gl">
                <span className="a-cap">Safety check before you transfer</span>
                {(() => {
                  const r = first ?? shown[0]?.seat.reach?.best ?? null;
                  return (
                    <>
                      <div className="a-kv">
                        <span>Transfer cap</span>
                        <b className="a-mono">{r?.capLimit ? `${fmt(r.capLimit)} pts per ${r.capPeriod}` : 'None listed'}</b>
                      </div>
                      {r && r.monthsNeeded > 1 && (
                        <div className="a-kv">
                          <span>Months the cap needs</span>
                          <b className="a-mono">{r.monthsNeeded}</b>
                        </div>
                      )}
                      <div className="a-kv">
                        <span>Rules checked</span>
                        <b className="a-mono">{data?.rulesCheckedOn ?? 'Not loaded'}</b>
                      </div>
                      <Tag kind="warning">Transfers cannot be undone</Tag>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        <DataFoot />
      </div>
    </div>
  );
}
