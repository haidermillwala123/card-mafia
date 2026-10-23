// Browser-side calls to our own API. Nothing here touches seats.aero; the server does, and only when its cache is stale.
import type { SeatOut, SearchMeta } from '@/lib/seats/search';
import type { SeatView } from '@/lib/seats/reach';

export type { SeatView, SeatOut, SearchMeta };
export type Holdings = { cardIds: string[]; balances: Record<string, number> };
export type Cabin = 'economy' | 'premium_economy' | 'business' | 'first';

export type SearchRequest = {
  origins: string[];
  dests: string[];
  from: string;
  to: string;
  cabin?: Cabin;
  travellers?: number;
  holdings?: Holdings;
  filters?: { reachableOnly?: boolean; directOnly?: boolean; maxPoints?: number; programmes?: string[] };
  limit?: number;
};
export type SearchResponse = { rows: SeatView[]; total: number; meta: SearchMeta; names: Record<string, string>; rulesCheckedOn: string };
export type RowsResponse = { rows: SeatView[]; missing: string[]; names: Record<string, string>; rulesCheckedOn: string; fxAsOf: string | null };
export type HandoffResponse = {
  programme: string;
  url: string | null;
  linkCheckedOn: string | null; // null until a person has checked the link by hand
  prefilled?: boolean; // true when `url` opens the airline's results with this route, date and passengers already filled in
  links?: { label: string; url: string; primary: boolean }[]; // the same seat's other prefilled booking links
  copy: { route: string; date: string; cabin: string; flights: string | null; points: number; taxes: { amount: number; currency: string; inr: number | null } | null; seatSeenAt: string };
};
export type QuotaResponse = { used: number; cap: number; paused: boolean };

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

// A call that hangs ends after timeoutMs instead of leaving a spinner on screen. A first search can legitimately take about 40 seconds.
async function call<T>(url: string, init?: RequestInit, timeoutMs = 20000): Promise<Result<T>> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (body as { error?: string } | null)?.error ?? 'Something went wrong. Nothing was changed. Try again.', status: res.status };
    return { ok: true, data: body as T };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') return { ok: false, error: 'This is taking too long. Nothing was changed. Please try again.', status: 0 };
    return { ok: false, error: 'We could not reach the server. Check your connection and try again.', status: 0 };
  }
}
const post = <T,>(url: string, body: unknown, timeoutMs?: number) => call<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, timeoutMs);

export const searchSeats = (b: SearchRequest) => post<SearchResponse>('/api/search', b, 55000);
export const fetchRows = (ids: string[], travellers: number, holdings?: Holdings) => post<RowsResponse>('/api/search/rows', { ids, travellers, holdings });
export const recheckSeat = (id: string) => post<{ row: SeatOut; refreshed: boolean; gone?: boolean; note?: string }>('/api/search/detail', { id });
export const handoffFor = (id: string) => post<HandoffResponse>('/api/handoff', { id });
export const getQuota = () => call<QuotaResponse>('/api/quota');
