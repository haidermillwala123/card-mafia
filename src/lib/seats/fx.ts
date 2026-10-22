// Rupee conversion for taxes. One free daily rate file (ExchangeRate-API open access, attribution required),
// stored with its date so every converted tax can say "rate of <date>".
import { admin, adminConfigured } from '../supabase-admin';

export type Rates = { asOf: string; inrPer: Record<string, number> };

const URL_ = 'https://open.er-api.com/v6/latest/INR';
const TTL_MS = 12 * 3600 * 1000;
export const FX_CREDIT = { name: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com' };

let memo: { at: number; rates: Rates } | null = null;

async function fetchRates(): Promise<Rates | null> {
  try {
    const res = await fetch(URL_, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = (await res.json()) as { result: string; time_last_update_utc: string; rates: Record<string, number> };
    if (j.result !== 'success') return null;
    const inrPer: Record<string, number> = {};
    for (const [cur, perInr] of Object.entries(j.rates)) if (perInr > 0) inrPer[cur] = 1 / perInr;
    return { asOf: new Date(j.time_last_update_utc).toISOString().slice(0, 10), inrPer };
  } catch {
    return null;
  }
}

async function readStored(): Promise<Rates | null> {
  if (!adminConfigured()) return null;
  const { data } = await admin().from('fx_rates').select('currency,inr_per_unit,as_of');
  if (!data?.length) return null;
  return { asOf: data.reduce((m, r) => (r.as_of > m ? r.as_of : m), ''), inrPer: Object.fromEntries(data.map(r => [r.currency, Number(r.inr_per_unit)])) };
}

async function store(rates: Rates) {
  if (!adminConfigured()) return;
  const rows = Object.entries(rates.inrPer).map(([currency, inr_per_unit]) => ({ currency, inr_per_unit, as_of: rates.asOf, fetched_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 200) await admin().from('fx_rates').upsert(rows.slice(i, i + 200), { onConflict: 'currency' });
}

// Fresh rates when we can, otherwise the last stored ones, otherwise null (callers then show the original currency).
export async function getRates(): Promise<Rates | null> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.rates;
  const stored = await readStored();
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (stored && stored.asOf >= todayUtc) {
    memo = { at: Date.now(), rates: stored };
    return stored;
  }
  const fresh = await fetchRates();
  if (fresh) {
    memo = { at: Date.now(), rates: fresh };
    await store(fresh).catch(() => undefined);
    return fresh;
  }
  if (stored) memo = { at: Date.now() - TTL_MS + 600000, rates: stored }; // retry in 10 minutes
  return stored;
}

export const toInr = (amount: number, currency: string, rates: Rates | null): number | null => {
  if (currency === 'INR') return Math.round(amount);
  const r = rates?.inrPer[currency];
  return r ? Math.round(amount * r) : null;
};
