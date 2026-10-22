// "Which card should I add?" Looks at the whole person, not one number.
// 1. Value is measured in comparable long-haul airline miles, so a regional currency that pays 3 units a point cannot win by being a bigger number.
// 2. A card is scored on how well its points move across many programmes (breadth and ratio), unless the person picked airlines.
// 3. After the main pick we look for a second card that fixes what the first is weak at (groceries, utilities, fuel).
// 4. Fees are shown as rupees per 1,000 extra miles, and a better card hidden by the fee limit is flagged instead of silently dropped.
// Pure maths over the earn rules (monthlyPoints) and the transfer engine's miles per card point. Nothing here is researched: it is derived.
import { type CalcCard, type Cat, CATS, monthlyPoints, type Spend } from './earn.ts';

export type MilesMap = Record<string, Record<string, { perPoint: number } | null>>; // programme -> card -> miles per card point

// Programmes where one unit is an ordinary long-haul mile. Regional and low-cost currencies (IndiGo, SpiceClub, AirAsia) are left out of the default
// basket because their units are worth different amounts; they count when the person picks them.
export const BASKET = [
  'krisflyer', 'flying-blue', 'emirates-skywards', 'qatar-privilege-club', 'ba-executive-club', 'etihad-guest', 'virgin-flyingclub', 'aeroplan',
  'united-mileageplus', 'turkish-ms', 'cathay-asiamiles', 'ana-mileage-club', 'jal-mileage-bank', 'lifemiles', 'miles-and-more', 'thai-royalorchid',
  'finnair-plus', 'american-airlines-aadvantage', 'delta-skymiles', 'qantas-ff', 'air-india',
];

// Rows that mean "buy a voucher or use the bank's portal to earn faster". We only report that the route exists; the merchant-level rate is not guessed.
const ROUTE = /voucher|gift ?card|gyftr|smartbuy|ishop|portal|e-gift/i;

export type Route = { label: string; per100: number | null; cap: number | null };

export type Pick = {
  card: CalcCard;
  held: boolean;
  miles: number; // miles a month if this card took all the spend, at its flexible rate
  gain: number; // extra miles a month on top of the cards already held
  programme: string | null; // the airline programme that gives the best rate for this card
  perPoint: number; // airline miles one card point becomes at that best rate (0.17 means about 6 points for 1 mile)
  breadth: number; // how many programmes in the basket this card's points can reach
  flexPerPoint: number; // average of its best three rates: what a point is worth when you stay flexible
  wins: { cat: Cat; miles: number }[]; // the categories where it beats what is held, biggest first
  annualMiles: number; // gain over a year
  costPer1k: number | null; // annual fee per 1,000 extra miles in a year, null when the fee is unknown or free
  routes: Route[]; // voucher and portal routes this card has in the earn data
};

export type Result = {
  baseline: number;
  picks: Pick[];
  companion: Pick | null; // a second card that covers what the first pick is weak at
  stretch: Pick | null; // a clearly better card that the fee limit left out
};

export function recommend(o: { cards: CalcCard[]; miles: MilesMap; spend: Spend; targets: string[]; held: string[]; fees: Record<string, number | null>; feeCap: number }): Result {
  const chosen = o.targets.length > 0;
  const allProgs = Object.keys(o.miles);
  const basket = allProgs.filter(p => BASKET.includes(p));
  const programmes = chosen ? o.targets : basket.length ? basket : allProgs;

  const rateFor = (id: string) => {
    const rates = programmes.map(p => ({ p, r: o.miles[p]?.[id]?.perPoint ?? 0 })).filter(x => x.r > 0).sort((a, b) => b.r - a.r);
    const best = rates[0];
    // picked airlines: the best of them, because that is what the person asked for. Otherwise the average of the best three, so one lucky programme cannot carry a card.
    const flex = chosen ? (best?.r ?? 0) : rates.slice(0, 3).reduce((s, x) => s + x.r, 0) / 3;
    return { programme: best?.p ?? null, perPoint: best?.r ?? 0, flex, breadth: rates.length };
  };

  const rows = o.cards.map(card => {
    const rate = rateFor(card.card_id);
    const byCat: Partial<Record<Cat, number>> = {};
    for (const b of monthlyPoints(card, o.spend).byCategory) byCat[b.cat] = (byCat[b.cat] ?? 0) + b.points * rate.flex;
    const routes: Route[] = card.accelerated.filter(a => ROUTE.test(a.category)).map(a => ({ label: a.category, per100: a.points_per_100_inr, cap: a.monthly_cap_points }));
    return { card, ...rate, byCat, routes, total: Object.values(byCat).reduce((s, v) => s + (v ?? 0), 0) };
  });

  const coverage = (ids: string[]) => {
    const base: Partial<Record<Cat, number>> = {};
    for (const r of rows.filter(r => ids.includes(r.card.card_id))) for (const c of CATS) base[c] = Math.max(base[c] ?? 0, r.byCat[c] ?? 0);
    return base;
  };
  const sum = (b: Partial<Record<Cat, number>>) => Object.values(b).reduce((s, v) => s + (v ?? 0), 0);
  const fee = (id: string) => o.fees[id] ?? 0;

  const base = coverage(o.held);
  const baseline = sum(base);

  const build = (r: (typeof rows)[number], against: Partial<Record<Cat, number>>): Pick => {
    const wins = CATS.map(c => ({ cat: c, miles: Math.max(0, (r.byCat[c] ?? 0) - (against[c] ?? 0)) })).filter(w => w.miles > 0).sort((a, b) => b.miles - a.miles);
    const gain = wins.reduce((s, w) => s + w.miles, 0);
    const f = o.fees[r.card.card_id];
    return {
      card: r.card, held: false, miles: r.total, gain, programme: r.programme, perPoint: r.perPoint, breadth: r.breadth, flexPerPoint: r.flex, wins,
      annualMiles: gain * 12, costPer1k: f && gain > 0 ? f / ((gain * 12) / 1000) : null, routes: r.routes,
    };
  };

  // Gains within about 5% of each other count as a tie, and a tie goes to the card that costs less per extra mile.
  const bucket = (p: Pick) => Math.floor(Math.log(Math.max(p.gain, 1e-9)) / Math.log(1.05));
  const order = (a: Pick, b: Pick) => bucket(b) - bucket(a) || (a.costPer1k ?? 0) - (b.costPer1k ?? 0) || b.gain - a.gain || fee(a.card.card_id) - fee(b.card.card_id);
  const candidates = rows.filter(r => !o.held.includes(r.card.card_id));
  const picks = candidates.filter(r => fee(r.card.card_id) <= o.feeCap).map(r => build(r, base)).filter(p => p.gain > 0).sort(order);

  // A card the fee limit removed that would clearly beat the best allowed one is worth saying out loud.
  const hidden = candidates.filter(r => fee(r.card.card_id) > o.feeCap).map(r => build(r, base)).filter(p => p.gain > 0).sort(order)[0] ?? null;
  const stretch = hidden && (!picks[0] || hidden.gain >= picks[0].gain * 1.15) ? hidden : null;

  // The second card: measured against everything held plus the first pick, so it only counts for what the first card does badly.
  let companion: Pick | null = null;
  const first = picks[0];
  if (first) {
    const withFirst = coverage([...o.held, first.card.card_id]);
    const second = picks.slice(1).map(p => build(rows.find(r => r.card.card_id === p.card.card_id)!, withFirst)).filter(p => p.gain >= Math.max(1, first.gain * 0.08)).sort(order)[0];
    companion = second ?? null;
  }

  return { baseline, picks, companion, stretch };
}
