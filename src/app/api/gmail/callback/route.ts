// Step 2: Google sends the person back here with a one-time code. We swap it for a short-lived access token and keep it in an
// httpOnly cookie for 15 minutes, only so the scan can run. No refresh token is requested, so nothing can read mail later.
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

const back = (q: string) => NextResponse.redirect(`${SITE_URL}/wallet/import?${q}`);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const jar = await cookies();
  const want = jar.get('cm_gstate')?.value ?? '';
  const got = u.searchParams.get('state') ?? '';
  jar.delete({ name: 'cm_gstate', path: '/api/gmail' });
  if (u.searchParams.get('error')) return back('error=denied');
  if (!want || want.length !== got.length || !timingSafeEqual(Buffer.from(want), Buffer.from(got))) return back('error=state');
  const code = u.searchParams.get('code');
  if (!code) return back('error=denied');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${SITE_URL}/api/gmail/callback`, grant_type: 'authorization_code',
    }),
  }).catch(() => null);
  const j = res?.ok ? ((await res.json().catch(() => null)) as { access_token?: string } | null) : null;
  if (!j?.access_token) return back('error=token');

  jar.set('cm_gtoken', j.access_token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/gmail', maxAge: 900 });
  return back('connected=1');
}
