// Custom alerts, from the browser: the person's own rows in custom_alerts (owner-only by row-level security).
// The daily job in api/cron does the checking and the emailing; this file only reads, adds and stops them.
import type { CustomAlert, CustomKind, Repeat } from '@/lib/custom-alerts';
import { supabase } from '@/lib/supabase';

export type NewCustom = {
  kind: CustomKind;
  title: string;
  note?: string;
  dueOn?: string;
  remindDaysBefore?: number;
  repeat?: Repeat;
  params?: Record<string, unknown>;
  email: boolean;
};
export type CustomResult = { ok: true; id: string } | { ok: false; error: string; needsSignIn?: boolean };

export async function listCustom(): Promise<CustomAlert[]> {
  const { data } = (await supabase()?.from('custom_alerts').select('*').eq('active', true).order('created_at', { ascending: false })) ?? { data: [] };
  return (data ?? []) as CustomAlert[];
}

export async function createCustom(a: NewCustom): Promise<CustomResult> {
  const sb = supabase();
  const { data: auth } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !auth.user) return { ok: false, error: 'Sign in to set an alert.', needsSignIn: true };
  const title = a.title.trim().slice(0, 120);
  if (!title) return { ok: false, error: 'Give the alert a name.' };
  const { data, error } = await sb.from('custom_alerts').insert({
    user_id: auth.user.id, kind: a.kind, title, note: a.note?.trim().slice(0, 500) || null, due_on: a.dueOn || null,
    remind_days_before: a.remindDaysBefore ?? 0, repeat: a.repeat ?? 'none', params: a.params ?? {}, email: a.email,
  }).select('id').single();
  // 42P01 is "table does not exist": the database update for custom alerts has not been applied yet
  if (error?.code === '42P01' || error?.message?.includes('custom_alerts')) return { ok: false, error: 'Custom alerts are not switched on yet. Try again soon.' };
  return error || !data ? { ok: false, error: 'We could not save that alert. Nothing was changed. Try again.' } : { ok: true, id: data.id as string };
}

export async function stopCustom(id: string): Promise<boolean> {
  const { error } = (await supabase()?.from('custom_alerts').update({ active: false }).eq('id', id)) ?? { error: true };
  return !error;
}
