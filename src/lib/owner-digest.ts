// Daily summary of new activity, emailed to the owner by the cron. Server only. Counts come straight from the tables; a failed query counts as unknown, never zero.
import { OWNER_EMAIL, sendEmail } from '@/lib/email';
import { admin } from '@/lib/supabase-admin';

const DAY = 24 * 3600 * 1000;

export async function sendOwnerDigest(): Promise<'sent' | 'quiet' | 'failed'> {
  const sb = admin();
  const since = new Date(Date.now() - DAY).toISOString();

  const { data: list, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) return 'failed';
  const users = list.users;
  const fresh = users.filter(u => u.created_at >= since);

  const count = async (table: string) => {
    const { count: n, error: e } = await sb.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since);
    return e ? 'unknown' : String(n ?? 0);
  };
  const [trips, watches, cards] = await Promise.all([count('trips'), count('alert_watches'), count('user_cards')]);
  const signedIn = users.filter(u => u.last_sign_in_at && u.last_sign_in_at >= since).length;

  if (!fresh.length && signedIn === 0 && trips === '0' && watches === '0' && cards === '0') return 'quiet';

  const who = fresh.map(u => `  - ${u.email ?? 'no email'}${u.user_metadata?.first_name ? ` (${u.user_metadata.first_name})` : ''}`).join('\n') || '  none';
  const text = [
    'Card Mafia, last 24 hours',
    '',
    `New users: ${fresh.length}`,
    who,
    '',
    `People who signed in: ${signedIn}`,
    `Trips saved: ${trips}`,
    `Routes watched: ${watches}`,
    `Cards added: ${cards}`,
    '',
    `All users so far: ${users.length}`,
  ].join('\n');
  const html = `<pre style="font:14px/1.6 ui-monospace,Menlo,monospace;white-space:pre-wrap">${text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)}</pre>`;
  return (await sendEmail(OWNER_EMAIL, `Card Mafia: ${fresh.length} new ${fresh.length === 1 ? 'user' : 'users'} today`, html, text)) === 'sent' ? 'sent' : 'failed';
}
