// Search = read our cache; pull from seats.aero only when a pair is missing or stale and today's budget allows it.
import { pullRoutes, SeatsError } from './client';
import { getRates, toInr, FX_CREDIT } from './fx';
import { type Cabin, MAX_DAYS_OUT } from './sources';
import { DAILY_CAP, getStore, type Pair, type StoredRow } from './store';

export const STALE_MS = 6 * 3600 * 1000; // older than this, the next search pulls again
export const ONDEMAND_CAP = 700; // searches stop pulling here; the rest of the 1,000 is kept for the daily cron

export type SearchInput = {
  origins: string[]; dests: string[]; from: string; to: string; cabin: Cabin;
  // asked once, right before a live pull; false means this visitor has used their share of today's pulls
  canPull?: () => boolean;
};
export type SeatOut = StoredRow & { taxes_inr: number | null };
export type SearchMeta = {
  from: string; to: string; // the dates actually searched, after the 60-day cap
  clamped: boolean;
  pulledAt: string | null; // oldest successful pull among the searched pairs
  live: boolean; // this request pulled from seats.aero
  paused: boolean; pausedReason: 'quota' | 'provider' | 'error' | null;
  truncated: boolean;
  calls: number; quotaUsed: number; quotaCap: number;
  store: 'database' | 'memory';
  fx: { asOf: string; credit: typeof FX_CREDIT } | null;
};

const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const uniq = <T,>(a: T[]) => [...new Set(a)];

export function windowFor(from: string, to: string) {
  const now = new Date();
  const lo = dayStr(now);
  const hi = dayStr(new Date(now.getTime() + MAX_DAYS_OUT * 86400000));
  const f = from < lo ? lo : from;
  const t = to > hi ? hi : to;
  return { from: f, to: t < f ? f : t, clamped: f !== from || t !== to, full: { from: lo, to: hi } };
}

// taxes in rupees at today's stored rate; null when the rate or the taxes are unknown
export async function withInr(rows: StoredRow[]) {
  const rates = await getRates();
  const out: SeatOut[] = rows.map(r => ({ ...r, taxes_inr: r.taxes_amount === null ? null : toInr(r.taxes_amount, r.taxes_currency, rates) }));
  return { rows: out, rates };
}

// in-flight pulls are shared, so ten people opening one route cost one call
const inflight = new Map<string, Promise<unknown>>();

export async function runSearch(input: SearchInput): Promise<{ rows: SeatOut[]; meta: SearchMeta }> {
  const store = getStore();
  const origins = uniq(input.origins);
  const dests = uniq(input.dests).filter(d => !origins.includes(d));
  const win = windowFor(input.from, input.to);
  const pairs: Pair[] = origins.flatMap(o => dests.map(d => [o, d] as Pair));
  const cabin = input.cabin;

  const fresh = await store.freshness(pairs, cabin);
  const stale = pairs.filter(p => {
    const at = fresh[`${p[0]}-${p[1]}`];
    return !at || Date.now() - new Date(at).getTime() > STALE_MS;
  });

  let live = false;
  let truncated = false;
  let calls = 0;
  let paused = false;
  let pausedReason: SearchMeta['pausedReason'] = null;

  if (stale.length) {
    const used = await store.quotaToday();
    if (used >= ONDEMAND_CAP || (input.canPull && !input.canPull())) {
      paused = true;
      pausedReason = 'quota';
    } else {
      // always pull the whole window so "fresh" means fresh for any dates the person picks next
      const q = { origins: uniq(stale.map(p => p[0])), dests: uniq(stale.map(p => p[1])), from: win.full.from, to: win.full.to, cabin };
      const key = `${q.origins.join()}>${q.dests.join()}|${cabin}`;
      try {
        const job =
          inflight.get(key) ??
          (async () => {
            const pulledAt = new Date().toISOString();
            const r = await pullRoutes({ ...q, maxPages: 8 });
            await store.bump(r.calls);
            await store.upsert(r.rows, pulledAt);
            if (!r.truncated) await store.prune(q, pulledAt);
            await store.touch(stale, cabin, true);
            return r;
          })();
        inflight.set(key, job);
        const r = (await job) as Awaited<ReturnType<typeof pullRoutes>>;
        calls = r.calls;
        truncated = r.truncated;
        live = true;
      } catch (e) {
        paused = true;
        pausedReason = e instanceof SeatsError ? (e.quotaExhausted ? 'quota' : 'provider') : 'error';
        await store.touch(stale, cabin, false).catch(() => undefined);
      } finally {
        inflight.delete(key);
      }
    }
  }
  if (!stale.length || paused) await store.touch(pairs, cabin, false).catch(() => undefined);

  const rows = await store.read({ origins, dests, from: win.from, to: win.to, cabin });
  const { rows: out, rates } = await withInr(rows);
  const after = await store.freshness(pairs, cabin);
  const times = Object.values(after).filter((t): t is string => Boolean(t)).sort();

  return {
    rows: out,
    meta: {
      from: win.from, to: win.to, clamped: win.clamped,
      pulledAt: times[0] ?? null, live, paused, pausedReason, truncated, calls,
      quotaUsed: await store.quotaToday(), quotaCap: DAILY_CAP, store: store.kind,
      fx: rates ? { asOf: rates.asOf, credit: FX_CREDIT } : null,
    },
  };
}
