// Sends a six-character sign-in code by email. The code is hashed before it is stored and is never returned to the browser.
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { codeEmail, emailConfigured, sendEmail } from '@/lib/email';
import { clientKey, readJson } from '@/lib/guard';
import { ALPHABET, hashCode } from '@/lib/login-code';
import { underDailyCap } from '@/lib/usage';
import { admin, adminConfigured } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/) });

const TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;
const MAX_PER_HOUR = 5;

// shortcut: per-instance memory, so serverless instances do not share it; the per-email limits in the table are the real cap.
const hits = new Map<string, number[]>();
function ipLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 10 * 60 * 1000)) hits.delete(k);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = Body.safeParse(g.body);
  if (!body.success) return Response.json({ error: 'We could not read that address. Check for a typo.' }, { status: 400 });
  if (!adminConfigured() || !emailConfigured()) return Response.json({ error: 'Email sign-in is not switched on for this copy.' }, { status: 503 });
  if (ipLimited(clientKey(req))) return Response.json({ error: 'Too many codes requested. Try again in a few minutes.' }, { status: 429 });
  // durable caps across all instances: per visitor per day, and for the whole app per day (protects the sender's reputation and mail quota)
  if (!(await underDailyCap('authcode', clientKey(req), 40, 500))) return Response.json({ error: 'Too many codes requested today. Try again tomorrow.' }, { status: 429 });

  const { email } = body.data;
  const sb = admin();
  const now = Date.now();
  const { data: row } = await sb.from('login_codes').select('sent_at,hour_start,sends_in_hour').eq('email', email).maybeSingle();

  let hourStart = now;
  let sends = 1;
  if (row) {
    if (now - new Date(row.sent_at).getTime() < COOLDOWN_MS) return Response.json({ error: 'Wait a few seconds before asking for another code.' }, { status: 429 });
    if (now - new Date(row.hour_start).getTime() < 3600 * 1000) {
      hourStart = new Date(row.hour_start).getTime();
      sends = row.sends_in_hour + 1;
      if (sends > MAX_PER_HOUR) return Response.json({ error: 'Too many codes sent. Try again in an hour.' }, { status: 429 });
    }
  }

  const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const { error } = await sb.from('login_codes').upsert({
    email,
    code_hash: hashCode(email, code),
    expires_at: new Date(now + TTL_MS).toISOString(),
    attempts: 0,
    sent_at: new Date(now).toISOString(),
    hour_start: new Date(hourStart).toISOString(),
    sends_in_hour: sends,
  });
  if (error) return Response.json({ error: 'We could not send the code. Try again.' }, { status: 500 });

  const mail = codeEmail(code);
  const res = await sendEmail(email, mail.subject, mail.html, mail.text);
  if (res !== 'sent') return Response.json({ error: 'We could not send the code. Check the address and try again.' }, { status: 502 });
  return Response.json({ ok: true });
}
