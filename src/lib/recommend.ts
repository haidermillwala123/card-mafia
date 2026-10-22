// "Which card should I add?" Ranks cards by the airline miles they would add each month on top of the cards a person already holds.
// Pure maths over the earn rules (monthlyPoints) and the transfer engine's miles per card point. Nothing here is researched: it is derived.
import { type CalcCard, type Cat, CATS, monthlyPoints, type Spend } from './earn.ts';

export type MilesMap = Record<string, Record<string, { perPoint: number } | null>>; // programme -> card -> miles per card point

export type Pick = {
  card: CalcCard;
  held: boolean;
  miles: number; // miles a month if this card took all the spend
  gain: number; // extra miles a month on top of the cards already held
  programme: string | null; // the airline programme that gives the best rate for this card
  wins: { cat: Cat; miles: number }[]; // the categories where it beats what is held, biggest first
};

export type Result = { baseline: number; picks: Pick[] };

export function recommend(o: { cards: CalcCard[]; miles: MilesMap; spend: Spend; targets: string[]; held: string[]; fees: Record<string, number | null>; feeCap: number }): Result {
  const programmes = o.targets.length ? o.targets : Object.keys(o.miles);
  const bestRate = (id: string) => {
    let best = { programme: null as string | null, perPoint: 0 };
    for (const p of programmes) {
      const r = o.miles[p]?.[id];
      if (r && r.perPoint > best.perPoint) best = { programme: p, perPoint: r.perPoint };
    }
    return best;
  };

  const rows = o.cards.map(card => {
    const rate = bestRate(card.card_id);
    const byCat: Partial<Record<Cat, number>> = {};
    for (const b of monthlyPoints(card, o.spend).byCategory) byCat[b.cat] = (byCat[b.cat] ?? 0) + b.points * rate.perPoint;
    return { card, programme: rate.programme, byCat, total: Object.values(byCat).reduce((s, v) => s + (v ?? 0), 0) };
  });

  // what the cards already held cover, category by category
  const base: Partial<Record<Cat, number>> = {};
  for (const r of rows.filter(r => o.held.includes(r.card.card_id))) for (const c of CATS) base[c] = Math.max(base[c] ?? 0, r.byCat[c] ?? 0);
  const baseline = Object.values(base).reduce((s, v) => s + (v ?? 0), 0);

  const picks = rows
    .filter(r => !o.held.includes(r.card.card_id) && (o.fees[r.card.card_id] ?? 0) <= o.feeCap)
    .map<Pick>(r => {
      const wins = CATS.map(c => ({ cat: c, miles: Math.max(0, (r.byCat[c] ?? 0) - (base[c] ?? 0)) })).filter(w => w.miles > 0).sort((a, b) => b.miles - a.miles);
      return { card: r.card, held: false, miles: r.total, gain: wins.reduce((s, w) => s + w.miles, 0), programme: r.programme, wins };
    })
    .filter(p => p.gain > 0)
    .sort((a, b) => b.gain - a.gain || (o.fees[a.card.card_id] ?? 0) - (o.fees[b.card.card_id] ?? 0));

  return { baseline, picks };
}
