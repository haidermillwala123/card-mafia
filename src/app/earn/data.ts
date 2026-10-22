// Shared by /earn (the card list) and /points-calculator: the earn file joined to the engine's card list.
import earn from '@/data/earn_rules.json';
import { BANKS } from '@/lib/engine/data';
import { reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';
import type { EarnFile } from '@/lib/earn';
import type { BrowseCard } from './EarnBrowser';
import type { CalcEntry, MilesRate } from './EarnCalculator';

export const earnFile = earn as unknown as EarnFile;
export const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export async function loadEarn() {
  const { data } = await getData();
  const bankOf = (id: string) => BANKS.find(b => b.id === id)?.name ?? id;
  const entries = data.cards.flatMap(c => {
    const e = earnFile.cards[c.id];
    return e ? [{ c, e }] : [];
  });

  const browse: BrowseCard[] = entries.map(({ c, e }) => ({
    id: c.id, name: c.name, bankId: c.bank, bank: bankOf(c.bank).replace(/ (Bank|Card)$/, ''), currency: e.reward_currency,
    annualFee: e.annual_fee_inr, joiningFee: e.joining_fee_inr, basePer100: e.base_earn.points_per_100_inr, baseText: e.base_earn.rate_text || null,
    best: e.best_way_to_earn || null, redemption: e.redemption_value?.best_known ?? null, welcome: e.welcome_benefit ?? null,
    accelerated: e.accelerated.map(a => ({ category: a.category, rate: a.rate_text, per100: a.points_per_100_inr, cap: a.monthly_cap_points, cat: a.cat ?? [] })),
    milestones: e.milestones.map(m => ({ spend: m.spend_inr ?? null, benefit: m.benefit })),
    exclusions: e.exclusions.map(x => x.category),
  }));

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

  return { browse, calc, programmes, miles, count: entries.length };
}
