// Sorts statement lines the keyword rules could not place. Only merchant text is sent to the model: no amounts, dates or card numbers.
// If the model is off, slow or wrong, every answer is null and the screen keeps the keyword guess.
import { z } from 'zod';
import { allow, categorizeWithClaude } from '@/lib/claude';
import { clientKey, readJson } from '@/lib/guard';

export const dynamic = 'force-dynamic';

const Body = z.object({ descs: z.array(z.string().min(1).max(60)).min(1).max(100) });

export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = Body.safeParse(g.body);
  if (!body.success) return Response.json({ error: 'Send up to 100 merchant names.' }, { status: 400 });
  if (!allow(clientKey(req), 12)) return Response.json({ cats: body.data.descs.map(() => null) });
  return Response.json({ cats: (await categorizeWithClaude(body.data.descs)) ?? body.data.descs.map(() => null) });
}
