// Seat cache. With SUPABASE_SERVICE_ROLE_KEY it lives in seat_snapshots; without it, in server memory
// (fine for local dev and a single warm instance, gone on cold start).
import { createHash } from 'node:crypto';
import { admin, adminConfigured } from '../supabase-admin';
import type { SeatRow } from './client';
import { type Cabin, SOURCE_PROGRAMME } from './sources';

export type StoredRow = SeatRow & { id: string; fetched_at: string };
export type RouteQuery = { origins: string[]; dests: string[]; from: string; to: string; cabin: Cabin };
export type Pair = [string, string];
export type RunPatch = { calls_used?: number; rows_written?: number; pairs?: unknown; errors?: unknown; quota_remaining?: number | null };

export const DAILY_CAP = 1000;
const CONFLICT = 'source,programme_id,origin_iata,dest_iata,travel_date,cabin,flight_numbers';
const PROVIDER = 'seats.aero';
const today = () => new Date().toISOString().slice(0, 10);
const rowKey = (r: SeatRow) => [r.programme_id, r.origin, r.dest, r.date, r.cabin, r.flights.join('+')].join('|');
const pairKey = ([o, d]: Pair) => `${o}-${d}`;

type DbRow = {
  id: string; programme_id: string; origin_iata: string; dest_iata: string; travel_date: string; cabin: Cabin; miles: number;
  taxes_amount: number | null; taxes_currency: string; seats_available: number | null; airline_iata: string | null; aircraft_type: string | null;
  flight_numbers: string[]; is_direct: boolean | null; raw: { source?: string; updated_at?: string } | null; fetched_at: string;
  availability_id: string | null; stops: number | null; departs_at: string | null; arrives_at: string | null; duration_minutes: number | null; taxes_known: boolean;
};

const reverseSource = (programme: string) => Object.entries(SOURCE_PROGRAMME).find(([, p]) => p === programme)?.[0] ?? programme;

const fromDb = (r: DbRow): StoredRow => ({
  id: r.id, source: r.raw?.source ?? reverseSource(r.programme_id), programme_id: r.programme_id,
  origin: r.origin_iata, dest: r.dest_iata, date: r.travel_date, cabin: r.cabin, miles: r.miles,
  taxes_amount: r.taxes_amount === null ? null : Number(r.taxes_amount), taxes_currency: r.taxes_currency, taxes_known: r.taxes_known,
  seats: r.seats_available, airline: r.airline_iata, flights: r.flight_numbers ?? [], direct: Boolean(r.is_direct), stops: r.stops ?? (r.is_direct ? 0 : 1),
  departs_at: r.departs_at, arrives_at: r.arrives_at, duration_minutes: r.duration_minutes, aircraft: r.aircraft_type,
  availability_id: r.availability_id ?? '', updated_at: r.raw?.updated_at ?? r.fetched_at, fetched_at: r.fetched_at,
});

const toDb = (r: SeatRow, pulledAt: string) => ({
  source: PROVIDER, programme_id: r.programme_id, origin_iata: r.origin, dest_iata: r.dest, travel_date: r.date, cabin: r.cabin, miles: r.miles,
  taxes_amount: r.taxes_amount, taxes_currency: r.taxes_currency, seats_available: r.seats, airline_iata: r.airline, aircraft_type: r.aircraft,
  flight_numbers: r.flights, is_direct: r.direct, stops: r.stops, departs_at: r.departs_at, arrives_at: r.arrives_at, duration_minutes: r.duration_minutes,
  availability_id: r.availability_id, taxes_known: r.taxes_known, fetched_at: r.updated_at,
  raw: { source: r.source, updated_at: r.updated_at, pulled_at: pulledAt },
});

export interface Store {
  readonly kind: 'database' | 'memory';
  read(q: RouteQuery): Promise<StoredRow[]>;
  byIds(ids: string[]): Promise<StoredRow[]>;
  upsert(rows: SeatRow[], pulledAt: string): Promise<number>;
  prune(q: RouteQuery, pulledAt: string): Promise<void>;
  freshness(pairs: Pair[], cabin: Cabin): Promise<Record<string, string | null>>;
  touch(pairs: Pair[], cabin: Cabin, fetched: boolean): Promise<void>;
  quotaToday(): Promise<number>;
  bump(n: number): Promise<number>;
  hotPairs(days: number, limit: number): Promise<{ pair: Pair; cabin: Cabin }[]>;
  startRun(trigger: string): Promise<string | null>;
  finishRun(id: string | null, patch: RunPatch): Promise<void>;
  lastRun(): Promise<{ started_at: string; finished_at: string | null; calls_used: number; rows_written: number } | null>;
}

// ---------- database ----------
const db: Store = {
  kind: 'database',
  async read(q) {
    // five 1,000-row pages fetched together; an empty page past the end is cheap
    const pages = await Promise.all([0, 1, 2, 3, 4].map(async page => {
      const { data, error } = await admin().from('seat_snapshots').select('*')
        .in('origin_iata', q.origins).in('dest_iata', q.dests).eq('cabin', q.cabin).gte('travel_date', q.from).lte('travel_date', q.to)
        .order('miles', { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (error) throw new Error(`seat read failed: ${error.message}`);
      return (data as DbRow[]).map(fromDb);
    }));
    return pages.flat();
  },
  async byIds(ids) {
    if (!ids.length) return [];
    const { data, error } = await admin().from('seat_snapshots').select('*').in('id', ids);
    if (error) throw new Error(`seat read failed: ${error.message}`);
    return (data as DbRow[]).map(fromDb);
  },
  async upsert(rows, pulledAt) {
    const unique = [...new Map(rows.map(r => [rowKey(r), r])).values()];
    let n = 0;
    // 500-row chunks, six in flight at a time: a 5,000-row pull used to wait on 13 writes in a row
    const chunks: ReturnType<typeof toDb>[][] = [];
    for (let i = 0; i < unique.length; i += 500) chunks.push(unique.slice(i, i + 500).map(r => toDb(r, pulledAt)));
    for (let i = 0; i < chunks.length; i += 6) {
      await Promise.all(chunks.slice(i, i + 6).map(async chunk => {
        const { error } = await admin().from('seat_snapshots').upsert(chunk, { onConflict: CONFLICT });
        if (error) throw new Error(`seat write failed: ${error.message}`);
        n += chunk.length;
      }));
    }
    return n;
  },
  async prune(q, pulledAt) {
    const { error } = await admin().from('seat_snapshots').delete()
      .in('origin_iata', q.origins).in('dest_iata', q.dests).eq('cabin', q.cabin).gte('travel_date', q.from).lte('travel_date', q.to)
      .lt('raw->>pulled_at', pulledAt);
    if (error) throw new Error(`seat prune failed: ${error.message}`);
  },
  async freshness(pairs, cabin) {
    const out: Record<string, string | null> = Object.fromEntries(pairs.map(p => [pairKey(p), null]));
    if (!pairs.length) return out;
    const { data } = await admin().from('route_requests').select('origin_iata,dest_iata,last_fetched_at').eq('cabin', cabin)
      .in('origin_iata', [...new Set(pairs.map(p => p[0]))]).in('dest_iata', [...new Set(pairs.map(p => p[1]))]);
    for (const r of data ?? []) if (pairKey([r.origin_iata, r.dest_iata]) in out) out[pairKey([r.origin_iata, r.dest_iata])] = r.last_fetched_at;
    return out;
  },
  async touch(pairs, cabin, fetched) {
    if (!pairs.length) return;
    const { data } = await admin().from('route_requests').select('origin_iata,dest_iata,request_count,last_fetched_at').eq('cabin', cabin)
      .in('origin_iata', [...new Set(pairs.map(p => p[0]))]).in('dest_iata', [...new Set(pairs.map(p => p[1]))]);
    const have = new Map((data ?? []).map(r => [pairKey([r.origin_iata, r.dest_iata]), r]));
    const now = new Date().toISOString();
    const rows = pairs.map(p => {
      const old = have.get(pairKey(p));
      return { origin_iata: p[0], dest_iata: p[1], cabin, last_requested_at: now, request_count: (old?.request_count ?? 0) + 1, last_fetched_at: fetched ? now : old?.last_fetched_at ?? null };
    });
    await admin().from('route_requests').upsert(rows, { onConflict: 'origin_iata,dest_iata,cabin' });
  },
  async quotaToday() {
    const { data } = await admin().from('quota_usage').select('calls').eq('day', today()).maybeSingle();
    return data?.calls ?? 0;
  },
  async bump(n) {
    const { data, error } = await admin().rpc('bump_quota', { n });
    if (error) throw new Error(`quota update failed: ${error.message}`);
    return Number(data);
  },
  async hotPairs(days, limit) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await admin().from('route_requests').select('origin_iata,dest_iata,cabin')
      .gte('last_requested_at', since).order('request_count', { ascending: false }).limit(limit);
    return (data ?? []).map(r => ({ pair: [r.origin_iata, r.dest_iata] as Pair, cabin: r.cabin as Cabin }));
  },
  async startRun(trigger) {
    const { data } = await admin().from('ingest_runs').insert({ trigger }).select('id').single();
    return data?.id ?? null;
  },
  async finishRun(id, patch) {
    if (id) await admin().from('ingest_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', id);
  },
  async lastRun() {
    const { data } = await admin().from('ingest_runs').select('started_at,finished_at,calls_used,rows_written').order('started_at', { ascending: false }).limit(1).maybeSingle();
    return data ?? null;
  },
};

// ---------- memory ----------
const mem = {
  rows: new Map<string, StoredRow>(),
  pairs: new Map<string, { requested: string; fetched: string | null; count: number }>(),
  pulled: new Map<string, string>(),
  quota: { day: today(), calls: 0 },
  last: null as { started_at: string; finished_at: string | null; calls_used: number; rows_written: number } | null,
};
const memId = (r: SeatRow) => createHash('sha1').update(rowKey(r)).digest('hex').slice(0, 24);
const inQuery = (r: StoredRow, q: RouteQuery) => q.origins.includes(r.origin) && q.dests.includes(r.dest) && r.cabin === q.cabin && r.date >= q.from && r.date <= q.to;

const memory: Store = {
  kind: 'memory',
  async read(q) { return [...mem.rows.values()].filter(r => inQuery(r, q)).sort((a, b) => a.miles - b.miles); },
  async byIds(ids) { return ids.map(i => mem.rows.get(i)).filter((r): r is StoredRow => Boolean(r)); },
  async upsert(rows, pulledAt) {
    for (const r of rows) {
      const id = memId(r);
      mem.rows.set(id, { ...r, id, fetched_at: r.updated_at });
      mem.pulled.set(id, pulledAt);
    }
    return rows.length;
  },
  async prune(q, pulledAt) {
    for (const [id, r] of mem.rows) if (inQuery(r, q) && (mem.pulled.get(id) ?? '') < pulledAt) mem.rows.delete(id);
  },
  async freshness(pairs, cabin) {
    return Object.fromEntries(pairs.map(p => [pairKey(p), mem.pairs.get(`${pairKey(p)}-${cabin}`)?.fetched ?? null]));
  },
  async touch(pairs, cabin, fetched) {
    const now = new Date().toISOString();
    for (const p of pairs) {
      const k = `${pairKey(p)}-${cabin}`;
      const old = mem.pairs.get(k);
      mem.pairs.set(k, { requested: now, count: (old?.count ?? 0) + 1, fetched: fetched ? now : old?.fetched ?? null });
    }
  },
  async quotaToday() { if (mem.quota.day !== today()) mem.quota = { day: today(), calls: 0 }; return mem.quota.calls; },
  async bump(n) { await memory.quotaToday(); mem.quota.calls += n; return mem.quota.calls; },
  async hotPairs(days, limit) {
    const since = Date.now() - days * 86400000;
    return [...mem.pairs].filter(([, v]) => new Date(v.requested).getTime() >= since).sort((a, b) => b[1].count - a[1].count).slice(0, limit)
      .map(([k]) => {
        const [o, d, cabin] = k.split('-');
        return { pair: [o, d] as Pair, cabin: cabin as Cabin };
      });
  },
  async startRun() { mem.last = { started_at: new Date().toISOString(), finished_at: null, calls_used: 0, rows_written: 0 }; return 'mem'; },
  async finishRun(_id, patch) { if (mem.last) mem.last = { ...mem.last, finished_at: new Date().toISOString(), calls_used: patch.calls_used ?? 0, rows_written: patch.rows_written ?? 0 }; },
  async lastRun() { return mem.last; },
};

export const getStore = (): Store => (adminConfigured() ? db : memory);
