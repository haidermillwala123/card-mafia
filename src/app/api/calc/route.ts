import { z } from 'zod';
import { BANKS } from '@/lib/engine/data';
import { combine, pointsFor, reachable, type Data, type Hop, type Reach } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';

const Pts = z.number().int().min(0).max(1000000000);
const Body = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('forward'), cardId: z.string(), points: Pts, direct: z.boolean() }),
  z.object({ mode: z.literal('reverse'), target: z.string(), miles: Pts, direct: z.boolean() }),
  z.object({ mode: z.literal('pool'), target: z.string(), miles: Pts, direct: z.boolean(), rows: z.array(z.object({ cardId: z.string(), balance: Pts })).max(20) }),
]);

// The calculator runs on the server so the whole rules graph never ships to the browser.
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Check the numbers and try again.' }, { status: 400 });
  const { data } = await getData();
  const b = body.data;

  const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const label = (id: string) => {
    const c = data.cards.find(x => x.id === id);
    return c ? `${(BANKS.find(k => k.id === c.bank)?.name ?? '').replace(/ Bank| Card/, '')} ${c.name}`.trim() : id;
  };
  const chain = (h: Hop[]) => ({ nodes: [h[0].from, ...h.map(x => x.to)].map(name), ratios: h.map(x => `${x.ratio_in}:${x.ratio_out}`) });
  const time = (h: Hop[]) => data.rules.find(r => r.id === h[0].ruleId)?.transfer_time ?? null;
  const row = (r: Reach) => ({
    programme: r.programme, name: name(r.programme), miles: r.miles, pointsUsed: r.pointsUsed, rate: r.pointsPerMile, chain: chain(r.hops),
    cap: r.cap, transferTime: time(r.hops), confirmed: r.hops.every(h => h.routeConfirmedOn),
  });

  if (b.mode === 'forward') {
    if (!data.cards.some(c => c.id === b.cardId)) return Response.json({ error: 'Unknown card.' }, { status: 400 });
    const base = new Map(reachable(data, b.cardId, b.points, true).map(r => [r.programme, r.miles]));
    const rows = reachable(data, b.cardId, b.points, b.direct).map(r => ({ ...row(r), vsDirect: Math.max(0, r.miles - (base.get(r.programme) ?? 0)) }));
    return Response.json({ rows, card: label(b.cardId) });
  }
  if (b.mode === 'reverse') {
    const rows = data.cards.map(c => ({ c, r: pointsFor(data, c.id, b.target, b.miles, b.direct) })).filter((x): x is { c: Data['cards'][number]; r: Reach } => !!x.r)
      .sort((a, z) => a.r.pointsUsed - z.r.pointsUsed).map(({ c, r }) => ({ ...row(r), cardId: c.id, card: label(c.id) }));
    return Response.json({ rows, target: name(b.target) });
  }
  const held = b.rows.filter(r => r.balance > 0);
  const out = combine(data, { cardIds: held.map(r => r.cardId), balances: Object.fromEntries(held.map(r => [r.cardId, r.balance])) }, b.target, b.miles, b.direct);
  return Response.json({
    transfers: out.transfers.map(t => ({ cardId: t.cardId, card: label(t.cardId), sourcePoints: t.sourcePoints, targetMiles: t.targetMiles, chain: chain(t.hops), cap: t.cap, transferTime: time(t.hops) })),
    shortfall: out.shortfall, target: name(b.target),
  });
}
