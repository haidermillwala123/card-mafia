// Step 1 of connecting Gmail: send the browser to Google's consent screen with read-only access to mail.
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Only a click on our own "Connect Gmail" button may start this. A typed or pasted link carries no same-origin marker and goes to sign-in.
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return NextResponse.redirect(`${SITE_URL}/signin?next=${encodeURIComponent('/wallet/import')}`);
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id || !process.env.GOOGLE_CLIENT_SECRET?.trim()) return NextResponse.redirect(`${SITE_URL}/wallet/import?error=not-configured`);
  const state = randomBytes(16).toString('hex');
  (await cookies()).set('cm_gstate', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/gmail', maxAge: 600 });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: id, redirect_uri: `${SITE_URL}/api/gmail/callback`, response_type: 'code', state,
    scope: 'https://www.googleapis.com/auth/gmail.readonly', access_type: 'online', prompt: 'consent',
  }).toString();
  return NextResponse.redirect(url);
}
