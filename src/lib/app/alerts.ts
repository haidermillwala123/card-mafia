// Watched routes (alert_watches, owner-only by RLS) and the alerts the daily job wrote for them (alerts table, read-only for the owner).
import { supabase } from '@/lib/supabase';
import type { Cabin } from './api';

export type Watch = {
  id: string; origin_iata: string; dest_iata: string; depart_from: string; depart_to: string; cabin: Cabin;
  reachable_only: boolean; email: boolean; active: boolean; last_match_count: number; last_checked_at: string | null; created_at: string;
};
export type AlertRow = {
  id: string;
  created_at: string;
  sent_at: string | null; // set when the email went out
  payload: {
    watch_id: string; origin: string; dest: string; cabin: Cabin; count: number;
    best: { id: string; points: number; date: string; programme: string; programme_name: string; taxes_inr: number | null; seen_at: string };
  };
};
export type WatchResult = { ok: true; id: string } | { ok: false; error: string; needsSignIn?: boolean };

export async function listWatches(): Promise<Watch[]> {
  const { data } = (await supabase()?.from('alert_watches').select('*').eq('active', true).order('created_at', { ascending: false })) ?? { data: [] };
  return (data ?? []) as Watch[];
}

export async function createWatch(w: { origin: string; dest: string; from: string; to: string; cabin: Cabin; reachableOnly: boolean; email: boolean }): Promise<WatchResult> {
  const sb = supabase();
  const { data: auth } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !auth.user) return { ok: false, error: 'Sign in to watch a route.', needsSignIn: true };
  const { data, error } = await sb.from('alert_watches').insert({
    user_id: auth.user.id, origin_iata: w.origin, dest_iata: w.dest, depart_from: w.from, depart_to: w.to, cabin: w.cabin, reachable_only: w.reachableOnly, email: w.email,
  }).select('id').single();
  return error || !data ? { ok: false, error: 'We could not watch that route. Nothing was changed. Try again.' } : { ok: true, id: data.id as string };
}

export async function stopWatch(id: string): Promise<boolean> {
  const { error } = (await supabase()?.from('alert_watches').update({ active: false }).eq('id', id)) ?? { error: true };
  return !error;
}

export async function listAlerts(limit = 20): Promise<AlertRow[]> {
  const { data } = (await supabase()?.from('alerts').select('id,created_at,sent_at,payload').eq('kind', 'seat').order('created_at', { ascending: false }).limit(limit)) ?? { data: [] };
  return (data ?? []) as AlertRow[];
}

export async function dismissAlert(id: string): Promise<boolean> {
  const { error } = (await supabase()?.from('alerts').delete().eq('id', id)) ?? { error: true };
  return !error;
}
