// A durable per-day cap for routes that cost money or send email. Server only.
// The in-memory limiter in claude.ts resets on every cold start and is per instance, so a script can walk around it; this counter lives in the
// database (api_usage, bump_usage) and is shared by every instance. If the database call fails the request is let through: the per-minute
// limiter still applies, and a counter outage should not take the app down.
import { admin, adminConfigured } from '@/lib/supabase-admin';

async function bump(key: string, limit: number): Promise<boolean> {
  try {
    const { data, error } = await admin().rpc('bump_usage', { p_key: key, p_limit: limit });
    return error ? true : data !== false;
  } catch {
    return true;
  }
}

// `bucket` names the route (e.g. "categorize"); `who` is the caller (an IP). One limit per caller per day, and one for everyone.
export async function underDailyCap(bucket: string, who: string, perCaller: number, overall: number): Promise<boolean> {
  if (!adminConfigured()) return true;
  if (!(await bump(`${bucket}:${who}`, perCaller))) return false;
  return bump(`${bucket}:all`, overall);
}
