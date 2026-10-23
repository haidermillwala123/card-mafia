// Card Mafia as MCP tools. One tool per feature of the app. Every tool is read-only: nothing is booked, transferred or saved.
// Anything the model writes (parse, explain, merchant sorting) comes from Gemini through the app's own routes; every number comes from the rules engine.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { POST as buyPoints } from '@/app/api/buy-points/route';
import { POST as calc } from '@/app/api/calc/route';
import { POST as explain } from '@/app/api/explain/route';
import { POST as handoff } from '@/app/api/handoff/route';
import { POST as parse } from '@/app/api/parse/route';
import { POST as plan } from '@/app/api/plan/route';
import { GET as quota } from '@/app/api/quota/route';
import { POST as search } from '@/app/api/search/route';
import { POST as categorize } from '@/app/api/statement/categorize/route';
import { loadEarn } from '@/app/earn/data';
import { AIRPORTS, expandDest, GROUPS } from '@/lib/airports';
import { BANKS, data } from '@/lib/engine/data';
import { CATS, rankCards, type Spend } from '@/lib/earn';
import { callRoute, text } from './call';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const LIVE = { ...READ, openWorldHint: true } as const;

const iata = z.string().regex(/^[A-Za-z]{3}$/).transform(s => s.toUpperCase());
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD');
const holdings = {
  cardIds: z.array(z.string()).max(12).default([]).describe('Card ids the person holds, from card_mafia_catalog (kind "cards").'),
  balances: z.record(z.string(), z.number().int().min(0)).default({}).describe('Points balance per card id, for example {"axis-atlas": 120000}.'),
};
const seatId = z.string().describe('A seat id from search_award_seats (the "id" of a row).');

export function registerTools(server: McpServer, req: Request) {
  server.registerTool('card_mafia_catalog', {
    title: 'Look up card, bank, programme, airport and region ids',
    description: 'Start here. Returns the exact ids the other tools need: Indian premium cards, banks, airline and hotel programmes, airports and destination regions. Use "search" to narrow by name.',
    inputSchema: { kind: z.enum(['cards', 'banks', 'programmes', 'airports', 'regions']), search: z.string().max(60).optional() },
    annotations: READ,
  }, async ({ kind, search: q }) => {
    const hit = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
    const rows =
      kind === 'cards' ? data.cards.filter(c => hit(`${c.name} ${c.bank}`)).map(c => ({ id: c.id, name: c.name, bank: BANKS.find(b => b.id === c.bank)?.name ?? c.bank, programme: c.programme }))
      : kind === 'banks' ? BANKS.filter(b => hit(b.name))
      : kind === 'programmes' ? data.programmes.filter(p => hit(p.name)).map(p => ({ id: p.id, name: p.name }))
      : kind === 'airports' ? AIRPORTS.filter(a => hit(`${a.i} ${a.c}`)).map(a => ({ code: a.i, city: a.c, region: a.g }))
      : GROUPS.filter(g => hit(g.label)).map(g => ({ id: g.id, label: g.label }));
    return text({ kind, count: rows.length, items: rows.slice(0, 80), ...(rows.length > 80 ? { note: 'Showing 80. Narrow with "search".' } : {}) });
  });

  server.registerTool('parse_trip_text', {
    title: 'Turn a sentence into a structured trip',
    description: 'Reads one plain sentence such as "Doha to Chicago in October, 2 of us, Infinia with 1.2 lakh points" and returns the trip, the cards and the balances it found, plus anything it is unsure about. Uses Gemini, then checks the result with rules.',
    inputSchema: { text: z.string().min(3).max(700), homeAirport: iata.default('DEL') },
    annotations: LIVE,
  }, ({ text: t, homeAirport }) => callRoute(parse, { text: t, homeAirport }, req));

  server.registerTool('plan_trip', {
    title: 'Build the cheapest points plans for a trip',
    description: 'Builds up to three award plans (direct and multi-hop transfers) for a business class trip from the cards and balances given, with the pre-transfer safety check on each. Rules and seats only: no AI guesses. Cabin is business.',
    inputSchema: {
      origin: iata.describe('Departure airport, for example DOH or BOM.'),
      dests: z.array(iata).min(1).max(8),
      month: z.string().regex(/^\d{4}-\d{2}$/).describe('YYYY-MM'),
      travellers: z.number().int().min(1).max(9).default(1),
      mustHaveQsuite: z.boolean().default(false),
      cashFareInr: z.number().min(0).optional().describe('What the same trip costs in cash, in rupees, to compare against.'),
      ...holdings,
    },
    annotations: READ,
  }, a => callRoute(plan, { trip: { origin: a.origin, dests: a.dests, month: a.month, travellers: a.travellers, cabin: 'business', mustProduct: a.mustHaveQsuite ? 'Qsuite' : null, cashFareInr: a.cashFareInr ?? null }, holdings: { cardIds: a.cardIds, balances: a.balances } }, req));

  server.registerTool('explain_plan', {
    title: 'Explain the plans in plain words',
    description: 'Same input as plan_trip. Rebuilds the plans from the rules, then has Gemini explain them in plain English. The AI never changes a number: if it is off or too slow, a rules-written explanation comes back instead and "via" says which.',
    inputSchema: {
      origin: iata, dests: z.array(iata).min(1).max(8), month: z.string().regex(/^\d{4}-\d{2}$/), travellers: z.number().int().min(1).max(9).default(1),
      mustHaveQsuite: z.boolean().default(false), cashFareInr: z.number().min(0).optional(), ...holdings,
    },
    annotations: LIVE,
  }, a => callRoute(explain, { trip: { origin: a.origin, dests: a.dests, month: a.month, travellers: a.travellers, cabin: 'business', mustProduct: a.mustHaveQsuite ? 'Qsuite' : null, cashFareInr: a.cashFareInr ?? null }, holdings: { cardIds: a.cardIds, balances: a.balances } }, req));

  server.registerTool('search_award_seats', {
    title: 'Search award seats from India and beyond',
    description: 'Finds cached award seats between airports (or a whole region) in a date range, cheapest first, and works out which ones the person\'s cards can pay for. Seat data is cached and can be hours old: every row says how old it is. Use a row\'s id with seat_booking_handoff or buy_points_info. Prefer a few named airports: a region is capped to its first 12 airports, and a seat that was not looked up recently can take up to a minute to fetch.',
    inputSchema: {
      origins: z.array(iata).min(1).max(6),
      dests: z.array(z.string().min(2).max(20)).min(1).max(10).describe('Airport codes like LHR, or region ids like "europe" from card_mafia_catalog (kind "regions").'),
      from: day, to: day,
      cabin: z.enum(['economy', 'premium_economy', 'business', 'first']).default('business'),
      travellers: z.number().int().min(1).max(9).default(1),
      reachableOnly: z.boolean().default(false).describe('Only seats the given cards can pay for.'),
      maxPoints: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(25).default(10),
      cardIds: holdings.cardIds, balances: holdings.balances,
    },
    annotations: LIVE,
  }, a => {
    // a cold airport is a live lookup that can take a while, so a region is capped to stay inside a connector's time limit
    const dests = [...new Set(a.dests.flatMap(d => expandDest(/^[A-Za-z]{3}$/.test(d) ? d.toUpperCase() : d)))].slice(0, 12);
    const held = a.cardIds.length ? { cardIds: a.cardIds, balances: a.balances } : undefined;
    return callRoute(search, {
      origins: a.origins, dests, from: a.from, to: a.to, cabin: a.cabin, travellers: a.travellers, holdings: held, limit: a.limit,
      filters: { ...(a.reachableOnly ? { reachableOnly: true } : {}), ...(a.maxPoints ? { maxPoints: a.maxPoints } : {}) },
    }, req);
  });

  server.registerTool('calculate_points', {
    title: 'Points calculator: three modes',
    description: 'forward: how many airline miles do N points on a card become, per programme. reverse: how many card points does a target programme and miles figure cost on each card. pool: a mix of cards\' balances towards one programme and miles figure, with the shortfall.',
    inputSchema: {
      mode: z.enum(['forward', 'reverse', 'pool']),
      cardId: z.string().optional().describe('forward only.'),
      points: z.number().int().min(0).optional().describe('forward only: card points to convert.'),
      target: z.string().optional().describe('reverse and pool: programme id from card_mafia_catalog.'),
      miles: z.number().int().min(0).optional().describe('reverse and pool: miles wanted.'),
      direct: z.boolean().default(false).describe('true = direct transfers only, false = include multi-hop.'),
      rows: z.array(z.object({ cardId: z.string(), balance: z.number().int().min(0) })).max(20).optional().describe('pool only.'),
    },
    annotations: READ,
  }, a => callRoute(calc, a.mode === 'forward' ? { mode: 'forward', cardId: a.cardId, points: a.points, direct: a.direct } : a.mode === 'reverse' ? { mode: 'reverse', target: a.target, miles: a.miles, direct: a.direct } : { mode: 'pool', target: a.target, miles: a.miles, direct: a.direct, rows: a.rows ?? [] }, req));

  server.registerTool('best_earning_card', {
    title: 'Which card earns the most on a month of spending',
    description: 'Ranks the Indian premium cards by points earned on a typical month of spending, using each card\'s researched earn rules, caps and exclusions. Categories: ' + CATS.join(', ') + '.',
    inputSchema: {
      monthlySpendInr: z.partialRecord(z.enum(CATS), z.number().min(0).max(100_000_000)).describe('Rupees per month by category, for example {"dining": 15000, "online": 30000}.'),
      top: z.number().int().min(1).max(15).default(5),
    },
    annotations: READ,
  }, async ({ monthlySpendInr, top }) => {
    const { calc: cards } = await loadEarn();
    const ranked = rankCards(cards, monthlySpendInr as Spend).slice(0, top);
    return text({
      spend: monthlySpendInr,
      ranked: ranked.map(r => ({ cardId: r.card.card_id, card: r.card.name, bank: (r.card as { bank?: string }).bank ?? null, monthlyPoints: r.points, skippedSpendInr: r.skippedSpend, byCategory: r.byCategory, notes: r.notes })),
    });
  });

  server.registerTool('seat_booking_handoff', {
    title: 'Where to book a seat and what to copy',
    description: 'For one seat from search_award_seats: the airline programme\'s own booking page (prefilled with route, date and passengers when it can be), the details to copy, and how old the seat data is. Card Mafia never books anything: this is the hand-off.',
    inputSchema: { seatId, travellers: z.number().int().min(1).max(9).default(1) },
    annotations: LIVE,
  }, ({ seatId: id, travellers }) => callRoute(handoff, { id, n: travellers }, req));

  server.registerTool('buy_points_info', {
    title: 'Where to buy the points a seat is short of',
    description: 'For one seat: whether its programme sells points, the price per 1,000 (converted to rupees when we know it), annual caps and the source of that price. Programmes we have not researched return no price, only a pointer.',
    inputSchema: { seatId },
    annotations: LIVE,
  }, ({ seatId: id }) => callRoute(buyPoints, { id }, req));

  server.registerTool('categorize_merchants', {
    title: 'Sort statement merchants into spend categories',
    description: 'Takes up to 100 merchant names from a card statement and has Gemini place each into an earn category, or null when unsure. Send only merchant text, never amounts, dates or card numbers. Pair with best_earning_card.',
    inputSchema: { merchants: z.array(z.string().min(1).max(60)).min(1).max(100) },
    annotations: LIVE,
  }, ({ merchants }) => callRoute(categorize, { descs: merchants }, req));

  server.registerTool('data_status', {
    title: 'How fresh is the seat data',
    description: 'Today\'s live seat-lookup budget: calls used, the daily cap, and whether live lookups are paused. Check this when seats look stale.',
    inputSchema: {},
    annotations: READ,
  }, () => callRoute(quota, undefined, req));
}
