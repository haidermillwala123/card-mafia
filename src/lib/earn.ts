// Pure earn maths over src/data/earn_rules.json. Every figure comes from the research rows; anything computed here is derived and labelled so in the UI.
export const CATS = ['general', 'travel_portal', 'international', 'dining', 'groceries', 'online', 'utilities', 'insurance', 'fuel', 'rent', 'education', 'other'] as const;
export type Cat = (typeof CATS)[number];

export const CAT_LABEL: Record<Cat, string> = {
  general: 'Everything else (general)',
  travel_portal: 'Travel portal and airlines',
  international: 'International and forex',
  dining: 'Dining',
  groceries: 'Groceries and retail',
  online: 'Online shopping',
  utilities: 'Utilities and telecom',
  insurance: 'Insurance',
  fuel: 'Fuel',
  rent: 'Rent',
  education: 'Education',
  other: 'Other',
};

export type AccRow = {
  category: string;
  rate_text: string;
  points_per_100_inr: number | null;
  monthly_cap_points: number | null;
  cap_note: string;
  merchants?: string;
  source_url: string;
  source_kind: 'official' | 'secondary';
  evidence?: string;
  cat: Cat[];
};
export type ExclRow = { category: string; note: string; source_url?: string; cat: Cat[]; zero: boolean };
export type Milestone = { spend_inr: number | null; period: string; benefit: string; source_url?: string };
export type EarnCard = {
  card_id: string;
  name: string;
  reward_currency: string;
  annual_fee_inr: number | null;
  joining_fee_inr: number | null;
  base_earn: { rate_text: string; points_per_100_inr: number | null; raw: unknown; source_url: string; evidence?: string };
  accelerated: AccRow[];
  exclusions: ExclRow[];
  milestones: Milestone[];
  welcome_benefit: string | null;
  redemption_value: { best_known: string | null; source_url?: string | null } | null;
  best_way_to_earn: string;
  terms_dated: string | null;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  not_found: string[];
  notes: string;
  source_quality: 'official' | 'mixed' | 'secondary';
  flags: string[];
};
export type EarnFile = { checked_on: string; cards: Record<string, EarnCard> };

// What the maths needs, so the client can receive a slim copy of each card.
export type CalcCard = {
  card_id: string;
  name: string;
  base_earn: { points_per_100_inr: number | null };
  accelerated: Pick<AccRow, 'category' | 'points_per_100_inr' | 'monthly_cap_points' | 'cap_note' | 'cat'>[];
  exclusions: Pick<ExclRow, 'category' | 'cat' | 'zero'>[];
};

export type Spend = Partial<Record<Cat, number>>;
export type CatResult = {
  cat: Cat;
  spend: number;
  points: number;
  how: 'accelerated' | 'base' | 'excluded' | 'skipped';
  rowCategory: string | null;
  rate: number | null; // points per Rs 100 actually used
  capped: boolean;
  capUnknown: boolean;
};
export type MonthlyResult = { points: number; computedSpend: number; skippedSpend: number; byCategory: CatResult[]; notes: string[] };

const per100 = (spend: number, rate: number) => (spend * rate) / 100;

// 'general' only matches rows tagged general and 'other' never matches an accelerated row: those rows are merchant- or threshold-specific.
const rowsFor = (card: CalcCard, cat: Cat) => (cat === 'other' ? [] : card.accelerated.filter(a => a.cat.includes(cat)));

export function monthlyPoints(card: CalcCard, spend: Spend): MonthlyResult {
  const byCategory: CatResult[] = [];
  const notes: string[] = [];
  const base = card.base_earn.points_per_100_inr;
  for (const cat of CATS) {
    const s = spend[cat];
    if (!s || s <= 0) continue;
    const label = CAT_LABEL[cat];
    const res = (r: Partial<CatResult>): CatResult => ({ cat, spend: s, points: 0, how: 'skipped', rowCategory: null, rate: null, capped: false, capUnknown: false, ...r });

    const ex = card.exclusions.find(e => e.zero && e.cat.includes(cat));
    if (ex) {
      byCategory.push(res({ how: 'excluded', rowCategory: ex.category }));
      notes.push(`${label}: no points (${ex.category}).`);
      continue;
    }

    const rows = rowsFor(card, cat);
    const known = rows.filter(r => r.points_per_100_inr !== null);
    const unknown = rows.filter(r => r.points_per_100_inr === null);
    for (const u of unknown) notes.push(`${label}: rate for "${u.category}" not found${known.length ? ', not counted' : ''}.`);
    if (unknown.length && !known.length) {
      byCategory.push(res({ rowCategory: unknown[0].category }));
      continue;
    }

    // best candidate by points actually earned, so a small cap can lose to a lower uncapped rate
    let best: { r: CalcCard['accelerated'][number]; pts: number; capped: boolean; rest: number } | null = null;
    for (const r of known) {
      const rate = r.points_per_100_inr as number;
      const full = per100(s, rate);
      const cap = r.monthly_cap_points;
      const capped = cap !== null && full > cap;
      const accPts = capped ? (cap as number) : full;
      const rest = capped ? Math.max(0, s - ((cap as number) * 100) / rate) : 0;
      const pts = accPts + (base !== null ? per100(rest, base) : 0);
      if (!best || pts > best.pts) best = { r, pts, capped, rest };
    }
    if (best) {
      const { r, capped, rest } = best;
      if (capped && base === null) notes.push(`${label}: cap reached and base rate not found, spend above the cap is not counted.`);
      if (r.monthly_cap_points === null) notes.push(`${label}: monthly cap for "${r.category}" not found, shown without a cap.`);
      else if (capped) notes.push(`${label}: capped at ${r.monthly_cap_points.toLocaleString('en-IN')} points a month, Rs ${Math.round(rest).toLocaleString('en-IN')} falls back to the base rate.`);
      if (/shared/i.test(r.cap_note)) notes.push(`${label}: this cap is shared with other rows, so combined spend may hit it sooner.`);
      byCategory.push(res({ points: best.pts, how: 'accelerated', rowCategory: r.category, rate: r.points_per_100_inr, capped, capUnknown: r.monthly_cap_points === null }));
      continue;
    }

    if (base === null) {
      byCategory.push(res({}));
      notes.push(`${label}: base rate not found, category skipped.`);
      continue;
    }
    byCategory.push(res({ points: per100(s, base), how: 'base', rate: base }));
  }
  const points = byCategory.reduce((t, c) => t + c.points, 0);
  const skippedSpend = byCategory.filter(c => c.how === 'skipped').reduce((t, c) => t + c.spend, 0);
  const totalSpend = byCategory.reduce((t, c) => t + c.spend, 0);
  return { points, computedSpend: totalSpend - skippedSpend, skippedSpend, byCategory, notes };
}

export type Ranked<C extends CalcCard = CalcCard> = { card: C } & MonthlyResult;

// Highest points first. Cards where nothing could be computed go last instead of showing a misleading 0 at the top of their points.
export function rankCards<C extends CalcCard>(cards: C[], spend: Spend): Ranked<C>[] {
  const total = Object.values(spend).reduce<number>((t, v) => t + (v && v > 0 ? v : 0), 0);
  return cards
    .map(card => ({ card, ...monthlyPoints(card, spend) }))
    .sort((a, b) => {
      const ax = total > 0 && a.computedSpend === 0 ? 1 : 0;
      const bx = total > 0 && b.computedSpend === 0 ? 1 : 0;
      return ax - bx || b.points - a.points || a.card.name.localeCompare(b.card.name);
    });
}
