// Buying points for a seat you cannot yet pay for. The prices come from src/data/buy_points.json: standard, non-promotional prices copied from
// each programme's own page on the date shown. Prices change and promotions beat them, so every figure here is an estimate and the screen says so.

export type BuyEntry = {
  name: string;
  url: string | null; // the programme's own page for buying points (null when it does not sell points)
  price_per_1000: number | null; // null when the programme only shows a price after login or only runs promotions
  currency: string | null;
  price_inr_per_1000?: number | null; // a price already in rupees (for example a programme that sells to India accounts in INR)
  price_kind?: 'listed' | 'guide' | null; // listed: read from the programme's page; guide: from a published guide or a related programme, shown as a rough guide only
  annual_cap: number | null; // most a member can buy in a year, when the programme says
  note: string | null;
  source: string; // who published the price
  source_url: string | null; // the exact page, only when one was read
  source_date: string; // YYYY-MM-DD the price was read
};

export type BuyInfo = {
  programme: string;
  url: string | null;
  sells: boolean; // false when the programme does not sell points at all
  pricePer1000: number | null;
  currency: string | null;
  priceKind: 'listed' | 'guide' | null;
  inrPer1000: number | null; // the same price in rupees (converted at today's rate, or listed in rupees), when known
  annualCap: number | null;
  note: string | null;
  source: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
};

// How many airline points are missing. With a transfer path, the card shortfall divided by the card points one airline point costs
// (the path's ratio is written "cardPoints:1"); with none, all the seat's points. Whatever is already in the programme comes off.
export function pointsShort(o: { need: number; held: number | null; cardShortBy: number | null; cardPointsPerPoint: number | null }): number {
  const gap = o.cardShortBy !== null && o.cardPointsPerPoint && o.cardPointsPerPoint > 0 ? Math.ceil(o.cardShortBy / o.cardPointsPerPoint) : o.need;
  return Math.max(0, Math.min(o.need, gap) - (o.held ?? 0));
}

// Cost to buy `points` at the listed price, rounded up to whole thousands because programmes sell in blocks. Null when no price is listed.
export function buyCost(info: BuyInfo, points: number): { native: number | null; inr: number | null } | null {
  if (points <= 0 || (info.pricePer1000 === null && info.inrPer1000 === null)) return null;
  const blocks = Math.ceil(points / 1000);
  return {
    native: info.pricePer1000 !== null ? Math.round(blocks * info.pricePer1000 * 100) / 100 : null,
    inr: info.inrPer1000 !== null ? Math.round(blocks * info.inrPer1000) : null,
  };
}
