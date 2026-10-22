// Service-role Supabase client. Server only: the key bypasses RLS and must never reach the browser.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export const adminConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

export function admin(): SupabaseClient {
  if (!adminConfigured()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
