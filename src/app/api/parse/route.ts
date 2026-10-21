import { z } from 'zod';
import { allow, parseWithClaude } from '@/lib/claude';
import { data } from '@/lib/engine/data';
import { parseTrip } from '@/lib/engine/parse';

const Body = z.object({ text: z.string().trim().min(3).max(700), homeAirport: z.string().regex(/^[A-Z]{3}$/).default('DEL') });

export async function POST(req: Request) {
  if (!allow(req.headers.get('x-forwarded-for') ?? 'local')) return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Write one sentence about your trip and cards.' }, { status: 400 });
  const { text, homeAirport } = body.data;
  const today = new Date();
  const fromClaude = await parseWithClaude(text, today.toISOString().slice(0, 10), data.cards, homeAirport);
  return Response.json({ parsed: fromClaude ?? parseTrip(text, today, data.cards, homeAirport), via: fromClaude ? 'claude' : 'rules' });
}
