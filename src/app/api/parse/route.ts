import { z } from 'zod';
import { allow, parseWithClaude } from '@/lib/claude';
import { data } from '@/lib/engine/data';
import { parseTrip, reviewNotes, unsupportedNotes, type ParsedTrip } from '@/lib/engine/parse';
import { clientKey, readJson } from '@/lib/guard';

const Body = z.object({ text: z.string().trim().min(3).max(700), homeAirport: z.string().regex(/^[A-Z]{3}$/).default('DEL') });

export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  if (!allow(clientKey(req))) return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  const body = Body.safeParse(g.body);
  if (!body.success) return Response.json({ error: 'Write one sentence about your trip and cards.' }, { status: 400 });
  const { text, homeAirport } = body.data;
  const today = new Date();
  const fromClaude = await parseWithClaude(text, today.toISOString().slice(0, 10), data.cards, homeAirport);
  const byRules = parseTrip(text, today, data.cards, homeAirport);
  // where cached seats exist: only plans in these months and cities can come back non-empty
  const legB = data.seats.rows.filter(s => s.origin === 'DOH' && s.cabin === 'business');
  const seatMonths = [...new Set(legB.map(s => s.date.slice(0, 7)))].sort();
  const seatDests = [...new Set(legB.map(s => s.dest))];
  const review = (p: ParsedTrip): ParsedTrip => ({ ...p, notes: [...p.notes, ...reviewNotes(text, p, seatMonths, seatDests).filter(n => !p.notes.includes(n))] });
  if (!fromClaude) return Response.json({ parsed: review(byRules), via: 'rules' });
  // Claude may have guessed a balance like "12L"; code decides what is ambiguous and asks instead
  const balances = { ...fromClaude.balances };
  for (const a of byRules.ambiguous) delete balances[a.cardId];
  const extra = unsupportedNotes(text, fromClaude.month, today);
  const notes = [...fromClaude.notes.filter(n => !(n.startsWith('We can plan Doha') && extra.some(e => e.startsWith('We cannot plan')))), ...extra];
  return Response.json({ parsed: review({ ...fromClaude, balances, ambiguous: byRules.ambiguous, notes }), via: 'claude' });
}
