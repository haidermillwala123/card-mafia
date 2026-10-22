import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { EMPTY_PROFILE, type Profile } from './profile';
import { supabase } from './supabase';

// undefined while the session is being read, null when signed out.
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const sb = supabase();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!sb) {
      setUser(null);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

export type Tier = 'free' | 'pro';
export type Period = 'monthly' | 'yearly';

// Records that this person wants the paid tier when it opens. No payment is taken and nothing is unlocked by it.
export async function recordInterest(tier: Tier, period: Period): Promise<'saved' | 'exists' | 'error'> {
  const sb = supabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  const email = data.user?.email;
  if (!sb || !email) return 'error';
  const { error } = await sb.from('plan_interest').insert({ email, tier, billing_period: tier === 'pro' ? period : null });
  if (!error) return 'saved';
  return error.code === '23505' ? 'exists' : 'error';
}

// Saves the device setup to the signed-in account. Balances are stored per programme, so cards that share one are added together.
export async function pushProfile(p: Profile, programmeOfCard: Record<string, string>): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const balances: Record<string, number> = {};
  for (const id of p.cardIds) {
    const prog = programmeOfCard[id];
    if (prog && p.balances[id]) balances[prog] = (balances[prog] ?? 0) + p.balances[id];
  }
  const { error } = await sb.rpc('save_onboarding', {
    p_first: p.first.trim(), p_last: p.last.trim(), p_dob: /^\d{4}-\d{2}-\d{2}$/.test(p.dob) ? p.dob : null, p_airport: p.airport, p_cabin: p.cabin,
    p_bank_ids: p.bankIds, p_card_ids: p.cardIds, p_balances: balances,
  });
  return !error;
}

// Brings a returning person's saved setup onto this device. Balances are stored per programme, so each goes to the first card held in it.
export async function pullProfile(): Promise<Profile | null> {
  const sb = supabase();
  const { data: auth } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !auth.user) return null;
  const uid = auth.user.id;
  const [prof, uc, ub, pb, cards] = await Promise.all([
    sb.from('profiles').select('first_name,last_name,date_of_birth,home_airport,preferred_cabin').eq('id', uid).maybeSingle(),
    sb.from('user_cards').select('card_id').eq('user_id', uid),
    sb.from('user_banks').select('bank_id').eq('user_id', uid),
    sb.from('point_balances').select('programme_id,balance').eq('user_id', uid),
    sb.from('cards').select('id,programme_id'),
  ]);
  if (prof.error || !prof.data) return null;
  const cardIds = (uc.data ?? []).map(r => r.card_id as string);
  const programmeOf = new Map((cards.data ?? []).map(c => [c.id as string, c.programme_id as string]));
  const balances: Record<string, number> = {};
  for (const row of pb.data ?? []) {
    const card = cardIds.find(id => programmeOf.get(id) === row.programme_id);
    if (card) balances[card] = Number(row.balance);
  }
  return {
    ...EMPTY_PROFILE,
    first: prof.data.first_name ?? '', last: prof.data.last_name ?? '', dob: prof.data.date_of_birth ?? '', airport: prof.data.home_airport ?? '',
    cabin: prof.data.preferred_cabin ?? 'business', bankIds: (ub.data ?? []).map(r => r.bank_id as string), cardIds, balances,
  };
}
