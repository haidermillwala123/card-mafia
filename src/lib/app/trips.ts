// Saved plans for the signed-in person, in the trips table (owner-only by RLS). The chosen seat is kept in `parsed`.
import { supabase } from '@/lib/supabase';

export type TripStatus = 'exploring' | 'transferring' | 'booked';
export type TripSeat = {
  id: string; // seat id at the time it was saved; the seat itself may be gone later
  programme: string;
  programmeName: string;
  date: string;
  points: number;
  taxesInr: number | null;
  flights: string[];
  cardName: string | null; // the card the plan pays from
  seenAt: string;
};
export type TripParsed = { seat?: TripSeat; note?: string };
export type TripRow = {
  id: string;
  title: string;
  origin: string | null;
  destination: string | null;
  depart_from: string | null;
  depart_to: string | null;
  cabin: string;
  travellers: number;
  status: TripStatus | 'draft' | 'planned' | 'archived';
  parsed: TripParsed | null;
  created_at: string;
  updated_at: string;
};
export type SaveResult = { ok: true; id: string } | { ok: false; error: string; needsSignIn?: boolean };

const COLUMNS = 'id,title,origin_iata,destination,depart_from,depart_to,cabin,travellers,status,parsed,created_at,updated_at';

export async function listTrips(): Promise<TripRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data } = await sb.from('trips').select(COLUMNS).neq('status', 'archived').order('updated_at', { ascending: false });
  return (data ?? []).map(r => ({ ...r, origin: r.origin_iata })) as unknown as TripRow[];
}

export async function saveTrip(input: {
  title: string; origin: string; destination: string; from: string; to: string; cabin: string; travellers: number; status: TripStatus; seat?: TripSeat; note?: string;
}): Promise<SaveResult> {
  const sb = supabase();
  const { data: auth } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !auth.user) return { ok: false, error: 'Sign in to save a trip.', needsSignIn: true };
  const { data, error } = await sb.from('trips').insert({
    user_id: auth.user.id, title: input.title, origin_iata: input.origin, destination: input.destination, depart_from: input.from, depart_to: input.to,
    cabin: input.cabin, travellers: input.travellers, status: input.status, parsed: { seat: input.seat, note: input.note },
  }).select('id').single();
  return error || !data ? { ok: false, error: 'We could not save that trip. Nothing was changed. Try again.' } : { ok: true, id: data.id as string };
}

export async function setTripStatus(id: string, status: TripStatus): Promise<boolean> {
  const { error } = (await supabase()?.from('trips').update({ status, updated_at: new Date().toISOString() }).eq('id', id)) ?? { error: true };
  return !error;
}

export async function deleteTrip(id: string): Promise<boolean> {
  const { error } = (await supabase()?.from('trips').delete().eq('id', id)) ?? { error: true };
  return !error;
}
