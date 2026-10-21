// Rules come from the Supabase database, so a corrected ratio reaches the app without a deploy.
// If the database is unreachable or empty, the versioned files in src/data are used instead.
import { createClient } from '@supabase/supabase-js';
import type { Card, Data, Programme, Rule } from './engine';
import { data as files } from './data';

export type Loaded = { data: Data; source: 'database' | 'files' };

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: Loaded } | null = null;

type RuleRow = {
  id: string; from_programme_id: string; to_programme_id: string; card_id: string | null; ratio_in: number | string; ratio_out: number | string;
  monthly_cap_points: number | null; annual_cap_points: number | null; min_multiple: number | null; route_confirmed_on: string | null;
  source_url: string | null; source_note: string | null;
};

export async function getData(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = (await fromDatabase()) ?? { data: files, source: 'files' as const };
  cache = { at: Date.now(), value };
  return value;
}

async function fromDatabase(): Promise<Loaded | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const [progs, cards, rules, aircraft] = await Promise.all([
      sb.from('programmes').select('id,name,kind'),
      sb.from('cards').select('id,bank_id,name,programme_id,annual_fee_inr').eq('active', true),
      sb.from('transfer_rules').select('id,from_programme_id,to_programme_id,card_id,ratio_in,ratio_out,monthly_cap_points,annual_cap_points,min_multiple,route_confirmed_on,source_url,source_note'),
      sb.from('aircraft_products').select('aircraft_type,notes,verified_at').eq('airline_iata', 'QR').eq('product_name', 'Qsuite').eq('is_true_product', true),
    ]);
    if (progs.error || cards.error || rules.error || aircraft.error || !rules.data?.length || !cards.data?.length) return null;

    // one database row per card; merge rows that differ only by card so the rules table stays readable
    const merged = new Map<string, Rule>();
    for (const r of rules.data as RuleRow[]) {
      const k = [r.from_programme_id, r.to_programme_id, r.ratio_in, r.ratio_out, r.monthly_cap_points, r.annual_cap_points, r.min_multiple, r.route_confirmed_on, r.source_note].join('|');
      const have = merged.get(k);
      if (have && r.card_id) have.cards = [...(have.cards ?? []), r.card_id];
      else if (!have) {
        merged.set(k, {
          id: r.id, from: r.from_programme_id, to: r.to_programme_id, cards: r.card_id ? [r.card_id] : undefined,
          ratio_in: Number(r.ratio_in), ratio_out: Number(r.ratio_out), monthly_cap: r.monthly_cap_points, annual_cap: r.annual_cap_points,
          min_multiple: r.min_multiple, route_confirmed_on: r.route_confirmed_on, source_url: r.source_url ?? '', source_note: r.source_note ?? '',
        });
      }
    }
    const verified = aircraft.data.map(a => a.verified_at).filter(Boolean).sort().pop() ?? null;
    return {
      source: 'database',
      data: {
        ...files,
        rules: [...merged.values()],
        programmes: progs.data as Programme[],
        cards: cards.data.map(c => ({ id: c.id, bank: c.bank_id, name: c.name, programme: c.programme_id, annual_fee_inr: c.annual_fee_inr })) as Card[],
        qsuite: {
          types: aircraft.data.map(a => ({ type: a.aircraft_type, fit: /Fit: all/.test(a.notes ?? '') ? ('all' as const) : ('some' as const) })),
          status: verified ? 'verified' : 'unverified',
          verified_at: verified,
        },
      },
    };
  } catch {
    return null;
  }
}
