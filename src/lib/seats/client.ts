// Server-only seats.aero Partner API client. The key never leaves the server and is never logged.
// Docs: https://developers.seats.aero/reference/overview (base https://seats.aero/partnerapi, header Partner-Authorization).
import { CABIN_API, CABIN_CODE, type Cabin, NO_TAXES_SOURCES, programmeForSource } from './sources';

const BASE = 'https://seats.aero/partnerapi';
const PAGE = 1000; // the API accepts take=1000; a 330-day BOM-LHR business pull is 3 calls instead of 9

export class SeatsError extends Error {
  constructor(message: string, readonly status: number, readonly quotaExhausted = false) {
    super(message);
  }
}

// One flight (or one cabin summary) as Card Mafia stores it.
export type SeatRow = {
  source: string;
  programme_id: string;
  origin: string;
  dest: string;
  date: string;
  cabin: Cabin;
  miles: number;
  taxes_amount: number | null; // major units of taxes_currency; null when seats.aero gives none
  taxes_currency: string;
  taxes_known: boolean;
  seats: number | null;
  airline: string | null;
  flights: string[];
  direct: boolean;
  stops: number;
  departs_at: string | null;
  arrives_at: string | null;
  duration_minutes: number | null;
  aircraft: string | null;
  availability_id: string;
  updated_at: string; // when seats.aero last saw it
};

type Trip = {
  ID: string; Stops: number; Carriers: string; RemainingSeats: number; MileageCost: number; TotalTaxes: number;
  TaxesCurrency: string; FlightNumbers: string; DepartsAt: string; ArrivesAt: string; Cabin: string; TotalDuration: number;
  Aircraft?: string[] | null; UpdatedAt: string;
};
type Availability = Record<string, unknown> & {
  ID: string; Date: string; Source: string; UpdatedAt: string; TaxesCurrency?: string;
  Route: { OriginAirport: string; DestinationAirport: string };
  AvailabilityTrips?: Trip[] | null;
};

const key = () => {
  const k = process.env.SEATS_AERO_API_KEY?.trim();
  if (!k) throw new SeatsError('SEATS_AERO_API_KEY is not set', 500);
  return k;
};

export async function seatsGet<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<{ data: T; remaining: number | null }> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'Partner-Authorization': key(), accept: 'application/json' }, cache: 'no-store' });
  const remainingHeader = res.headers.get('x-ratelimit-remaining');
  const remaining = remainingHeader === null ? null : Number(remainingHeader);
  if (res.status === 429 || (remaining !== null && remaining <= 0 && !res.ok)) throw new SeatsError('seats.aero daily limit reached', 429, true);
  if (res.status === 401 || res.status === 403) throw new SeatsError('seats.aero rejected the key', res.status);
  if (!res.ok) throw new SeatsError(`seats.aero error ${res.status}`, res.status);
  return { data: (await res.json()) as T, remaining };
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const firstCarrier = (s: unknown) => (typeof s === 'string' && s.trim() ? s.split(',')[0].trim() : null);

function rowFrom(a: Availability, cabin: Cabin, trip: Trip | null): SeatRow | null {
  const source = a.Source;
  const programme_id = programmeForSource(source);
  const c = CABIN_CODE[cabin];
  if (!programme_id) return null;
  const miles = trip ? num(trip.MileageCost) : num(a[`${c}MileageCost`]);
  if (!(miles > 0)) return null;
  const currency = (trip?.TaxesCurrency || a.TaxesCurrency || '').toUpperCase();
  const rawTaxes = trip ? num(trip.TotalTaxes) : num(a[`${c}TotalTaxes`]);
  const taxes_known = !NO_TAXES_SOURCES.has(source) && /^[A-Z]{3}$/.test(currency) && rawTaxes > 0;
  const seats = trip ? num(trip.RemainingSeats) : num(a[`${c}RemainingSeats`]);
  const flights = trip?.FlightNumbers ? trip.FlightNumbers.split(',').map(s => s.trim()).filter(Boolean) : [];
  return {
    source, programme_id,
    origin: a.Route.OriginAirport, dest: a.Route.DestinationAirport,
    date: String(a.Date).slice(0, 10), cabin, miles,
    taxes_amount: taxes_known ? Math.round(rawTaxes) / 100 : null, // seats.aero sends minor units
    taxes_currency: taxes_known ? currency : 'USD',
    taxes_known,
    seats: seats > 0 ? seats : null,
    airline: trip ? firstCarrier(trip.Carriers) : firstCarrier(a[`${c}Airlines`]),
    flights,
    direct: trip ? trip.Stops === 0 : Boolean(a[`${c}Direct`]),
    stops: trip ? trip.Stops : a[`${c}Direct`] ? 0 : 1,
    departs_at: trip?.DepartsAt ?? null, arrives_at: trip?.ArrivesAt ?? null,
    duration_minutes: trip?.TotalDuration ?? null,
    aircraft: trip?.Aircraft?.length ? trip.Aircraft.join(', ') : null,
    availability_id: a.ID,
    updated_at: trip?.UpdatedAt ?? a.UpdatedAt,
  };
}

export function normalise(avails: Availability[], cabin: Cabin): SeatRow[] {
  const out: SeatRow[] = [];
  const seen = new Set<string>();
  for (const a of avails) {
    if (!a.Route || !programmeForSource(a.Source)) continue;
    const c = CABIN_CODE[cabin];
    if (!a[`${c}Available`]) continue;
    const trips = (a.AvailabilityTrips ?? []).filter(t => t.Cabin === cabin);
    const rows = trips.length ? trips.map(t => rowFrom(a, cabin, t)) : [rowFrom(a, cabin, null)];
    for (const r of rows) {
      if (!r) continue;
      const k = [r.source, r.origin, r.dest, r.date, r.cabin, r.flights.join('+')].join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

export type PullResult = { rows: SeatRow[]; calls: number; remaining: number | null; truncated: boolean };

// Cached Search for every origin x destination in one request (comma lists), with trips so taxes and flight numbers arrive too.
export async function pullRoutes(opts: { origins: string[]; dests: string[]; from: string; to: string; cabin: Cabin; maxPages?: number }): Promise<PullResult> {
  const maxPages = opts.maxPages ?? 3;
  let skip = 0;
  let cursor: number | undefined;
  let calls = 0;
  let remaining: number | null = null;
  let truncated = false;
  const all: Availability[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, remaining: rem } = await seatsGet<{ data: Availability[]; hasMore: boolean; cursor: number }>('/search', {
      origin_airport: opts.origins.join(','),
      destination_airport: opts.dests.join(','),
      start_date: opts.from,
      end_date: opts.to,
      cabins: CABIN_API[opts.cabin],
      include_trips: true,
      take: PAGE,
      skip: skip || undefined,
      cursor,
    });
    calls += 1;
    remaining = rem;
    all.push(...(data.data ?? []));
    skip += data.data?.length ?? 0;
    cursor = cursor ?? data.cursor;
    if (!data.hasMore) break;
    if (page === maxPages - 1) truncated = true;
  }
  return { rows: normalise(all, opts.cabin), calls, remaining, truncated };
}

// Get Trips for one availability: refreshes flight numbers, times and taxes for a row someone is comparing.
// It also returns the source's own booking links, already filled in with route, date and passengers; the primary one is the seat's own programme.
export type BookingLink = { label: string; url: string; primary: boolean };
export async function pullTrips(availabilityId: string): Promise<{ trips: Trip[]; links: BookingLink[]; remaining: number | null }> {
  const { data, remaining } = await seatsGet<{ data: Trip[]; booking_links?: { label?: string; link?: string; primary?: boolean }[] }>(`/trips/${encodeURIComponent(availabilityId)}`, {});
  const links = (data.booking_links ?? []).flatMap(l => (l.link && l.label ? [{ label: l.label, url: l.link, primary: Boolean(l.primary) }] : []));
  return { trips: data.data ?? [], links, remaining };
}
