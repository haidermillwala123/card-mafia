// Step 3: read recent mail from known banks and loyalty programmes, pull out balances with fixed rules, and return only the numbers.
// Email text is parsed in memory and dropped. The Google token is revoked when the scan ends, so access stops here.
import { cookies } from 'next/headers';
import cardsJson from '@/data/cards.json';
import { sameOrigin } from '@/lib/guard';
import { type CatalogCard, type Finding, messageText, newestPerKey, parseEmail, SENDER_DOMAINS } from '@/lib/gmail-parse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CARDS = (cardsJson.cards as { id: string; bank: string; name: string }[]).map<CatalogCard>(c => ({ id: c.id, bank: c.bank, name: c.name }));
const API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const MAX_MAIL = 80;

type Msg = { internalDate?: string; payload?: { headers?: { name: string; value: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown[] } };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'This request came from another site.' }, { status: 403 });
  const jar = await cookies();
  const token = jar.get('cm_gtoken')?.value;
  if (!token) return Response.json({ error: 'Connect Gmail first.' }, { status: 401 });
  const auth = { authorization: `Bearer ${token}` };

  try {
    const q = `from:(${SENDER_DOMAINS.join(' OR ')}) newer_than:2y (balance OR points OR miles OR avios OR dollars)`;
    const list = await fetch(`${API}?${new URLSearchParams({ q, maxResults: String(MAX_MAIL) })}`, { headers: auth });
    if (!list.ok) return Response.json({ error: 'Google would not let us read your mail. Connect again.' }, { status: 502 });
    const ids = ((await list.json()) as { messages?: { id: string }[] }).messages?.map(m => m.id) ?? [];

    const found: Finding[] = [];
    for (let i = 0; i < ids.length; i += 8) {
      const batch = await Promise.all(ids.slice(i, i + 8).map(id => fetch(`${API}/${id}?format=full`, { headers: auth }).then(r => (r.ok ? (r.json() as Promise<Msg>) : null)).catch(() => null)));
      for (const m of batch) {
        if (!m?.payload) continue;
        const h = (n: string) => m.payload!.headers?.find(x => x.name.toLowerCase() === n)?.value ?? '';
        const f = parseEmail(
          { from: h('from'), subject: h('subject'), date: new Date(Number(m.internalDate) || Date.parse(h('date')) || 0).toISOString().slice(0, 10), text: messageText(m.payload as never) },
          CARDS,
        );
        if (f) found.push(f);
      }
    }
    return Response.json({ scanned: ids.length, findings: newestPerKey(found) });
  } finally {
    // End access whatever happened above.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => null);
    jar.delete({ name: 'cm_gtoken', path: '/api/gmail' });
  }
}
