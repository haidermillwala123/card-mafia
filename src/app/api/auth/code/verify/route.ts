// Checks a sign-in code. On success returns a one-time token hash that the browser exchanges for a Supabase session.
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { emailConfigured, sendEmail, welcomeEmail } from '@/lib/email';
import { readJson } from '@/lib/guard';
import { CODE_RE, hashCode } from '@/lib/login-code';
import { SITE_URL } from '@/lib/site';
import { admin, adminConfigured } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/),
  code: z.string().trim().toUpperCase().regex(CODE_RE),
  meta: z.object({ first_name: z.string().trim().max(60).optional(), last_name: z.string().trim().max(60).optional() }).optional(),
});

const MAX_ATTEMPTS = 5;
const WRONG = 'That code is not right or has expired. Try again.';

export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = Body.safeParse(g.body);
  if (!body.success) return Response.json({ error: WRONG }, { status: 400 });
  if (!adminConfigured()) return Response.json({ error: 'Email sign-in is not switched on for this copy.' }, { status: 503 });

  const { email, code, meta } = body.data;
  const sb = admin();
  const { data: row } = await sb.from('login_codes').select('code_hash,expires_at,attempts').eq('email', email).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS) return Response.json({ error: WRONG }, { status: 400 });

  // Count the try before comparing, so a parallel burst cannot get extra guesses.
  const { data: claimed } = await sb.from('login_codes').update({ attempts: row.attempts + 1 }).eq('email', email).eq('attempts', row.attempts).select('email');
  if (!claimed?.length) return Response.json({ error: WRONG }, { status: 400 });

  const a = Buffer.from(hashCode(email, code), 'hex');
  const b = Buffer.from(row.code_hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: WRONG }, { status: 400 });

  await sb.from('login_codes').delete().eq('email', email);

  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email, options: { data: { first_name: meta?.first_name, last_name: meta?.last_name } } });
  if (error || !data?.properties?.hashed_token) return Response.json({ error: 'We could not sign you in. Try again.' }, { status: 500 });

  // A user that was created a moment ago and never signed in is new: send the welcome email once.
  const u = data.user;
  if (u && !u.last_sign_in_at && Date.now() - new Date(u.created_at).getTime() < 5 * 60 * 1000 && emailConfigured()) {
    const mail = welcomeEmail(meta?.first_name || '', SITE_URL);
    void sendEmail(email, mail.subject, mail.html, mail.text);
  }
  return Response.json({ token_hash: data.properties.hashed_token });
}
