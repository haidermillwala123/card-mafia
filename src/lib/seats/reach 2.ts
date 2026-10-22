// Which of a person's cards can pay for a seat. The money maths is the existing engine (bestPaths, hopsFor, allocate);
// this file only memoises the path search so 500 rows do not mean 500 graph walks.
import { allocate, bestPaths, type Data, hopsFor, type Holdings, type Rule } from '../engine/engine';
import type { SeatOut } from './search';

export type HopOut = { from: string; to: string; ratio: string; pointsIn: number; pointsOut: number; verifiedOn: string | null };
export type PayOut = {
  cardId: string; cardName: string; pointsUsed: number; enough: boolean; shortBy: number; ratio: string; hops: HopOut[];
  capLimit: number | null; capPeriod: 'month' | 'year' | null; capOk: boolean; monthsNeeded: number;
};
export type ReachOut = {
  status: 'ok' | 'pooled' | 'short' | 'none' | 'unmapped';
  best: PayOut | null;
  others: { cardId: string; cardName: string; pointsUsed: number; enough: boolean }[];
  pooled: { transfers: { cardId: string; cardName: string; sourcePoints: number }[] } | null;
  fix: { cardName: string; pointsNeeded: number } | null;
};

const memo = new WeakMap<Data, Map<string, Map<string, Rule[]>>>();
const pathsFor = (data: Data, cardId: string) => {
  let byCard = memo.get(data);
  if (!byCard) memo.set(data, (byCard = new Map()));
  let p = byCard.get(cardId);
  if (!p) byCard.set(cardId, (p = bestPaths(data, cardId)));
  return p;
};

const cost = (rules: Rule[]) => rules.reduce((c, r) => c * (r.ratio_in / r.ratio_out), 1);
const capOf = (r: Rule): { limit: number | null; period: 'month' | 'year' | null } =>
  r.monthly_cap ? { limit: r.monthly_cap, period: 'month' } : r.annual_cap ? { limit: r.annual_cap, period: 'year' } : { limit: null, period: null };

function payFor(data: Data, cardId: string, programme: string, miles: number, balance: number): PayOut | null {
  const card = data.cards.find(c => c.id === cardId);
  const rules = pathsFor(data, cardId).get(programme);
  if (!card || !rules || miles <= 0) return null;
  const hops = hopsFor(rules, miles);
  const used = hops[0].points_in;
  const cap = capOf(rules[0]);
  return {
    cardId, cardName: card.name, pointsUsed: used, enough: balance >= used, shortBy: Math.max(0, used - balance),
    ratio: `${Number(cost(rules).toFixed(2))}:1`,
    hops: hops.map(h => ({ from: h.from, to: h.to, ratio: `${h.ratio_in}:${h.ratio_out}`, pointsIn: h.points_in, pointsOut: h.points_out, verifiedOn: h.routeConfirmedOn })),
    capLimit: cap.limit, capPeriod: cap.period, capOk: !cap.limit || used <= cap.limit, monthsNeeded: cap.limit ? Math.ceil(used / cap.limit) : 1,
  };
}

export function reachFor(data: Data, holdings: Holdings, programme: string, miles: number): ReachOut {
  if (!data.programmes.some(p => p.id === programme && p.kind === 'airline')) return { status: 'unmapped', best: null, others: [], pooled: null, fix: null };
  const options = holdings.cardIds
    .map(id => payFor(data, id, programme, miles, holdings.balances[id] ?? 0))
    .filter((o): o is PayOut => Boolean(o))
    .sort((a, b) => a.pointsUsed - b.pointsUsed);
  const summary = (o: PayOut) => ({ cardId: o.cardId, cardName: o.cardName, pointsUsed: o.pointsUsed, enough: o.enough });
  const enoughOne = options.find(o => o.enough);
  if (enoughOne) return { status: 'ok', best: enoughOne, others: options.filter(o => o !== enoughOne).map(summary), pooled: null, fix: null };

  if (options.length > 1) {
    const sources = options
      .map(o => ({ cardId: o.cardId, cardName: o.cardName, programme: data.cards.find(c => c.id === o.cardId)!.programme, rules: pathsFor(data, o.cardId).get(programme)!, balance: holdings.balances[o.cardId] ?? 0 }))
      .filter(s => s.balance > 0);
    const pooled = allocate(sources, miles);
    if (pooled.shortfall === 0 && pooled.transfers.length) {
      return {
        status: 'pooled', best: options[0], others: options.slice(1).map(summary),
        pooled: { transfers: pooled.transfers.map(t => ({ cardId: t.cardId, cardName: t.cardName, sourcePoints: t.sourcePoints })) }, fix: null,
      };
    }
  }

  // not payable yet: say which card we do not have would close the gap
  let fix: ReachOut['fix'] = null;
  const held = new Set(holdings.cardIds);
  let cheapest = Infinity;
  for (const card of data.cards) {
    if (held.has(card.id)) continue;
    const rules = pathsFor(data, card.id).get(programme);
    if (!rules) continue;
    const used = hopsFor(rules, miles)[0].points_in;
    if (used < cheapest) {
      cheapest = used;
      fix = { cardName: card.name, pointsNeeded: used };
    }
  }
  return { status: options.length ? 'short' : 'none', best: options[0] ?? null, others: options.slice(1).map(summary), pooled: null, fix };
}

// ---- what the API returns for each seat ----
export type SeatView = SeatOut & { programme_name: string; reach: ReachOut | null; seats_total_ok: boolean };
export type Filters = { reachableOnly?: boolean; directOnly?: boolean; maxPoints?: number; programmes?: string[] };

const RANK: Record<ReachOut['status'], number> = { ok: 0, pooled: 1, short: 2, none: 3, unmapped: 4 };

export function decorate(rows: SeatOut[], data: Data, holdings: Holdings | undefined, travellers: number, f: Filters = {}): SeatView[] {
  const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const views = rows
    .filter(r => !f.directOnly || r.direct)
    .filter(r => !f.maxPoints || r.miles <= f.maxPoints)
    .filter(r => !f.programmes?.length || f.programmes.includes(r.programme_id))
    .map<SeatView>(r => ({
      ...r,
      programme_name: name(r.programme_id),
      seats_total_ok: r.seats === null || r.seats >= travellers, // unknown seat counts are shown, not hidden
      reach: holdings ? reachFor(data, holdings, r.programme_id, r.miles * travellers) : null,
    }));
  const kept = f.reachableOnly && holdings ? views.filter(v => v.reach?.status === 'ok' || v.reach?.status === 'pooled') : views;
  const rank = (v: SeatView) => (v.reach ? RANK[v.reach.status] : 0);
  return kept.sort((a, b) => rank(a) - rank(b) || a.miles - b.miles || a.date.localeCompare(b.date));
}
