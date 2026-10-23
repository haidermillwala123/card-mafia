// The rest of Card Mafia as MCP tools: every feature that does not need a personal login. Wallet, saved trips, alerts and Gmail import
// belong to a signed-in account, so they are not here; the wallet's maths is (wallet_overview), with the person's cards typed in.
// Same rule as tools.ts: read-only, rules for numbers, Gemini only for language.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { POST as detail } from '@/app/api/search/detail/route';
import { POST as rowsRoute } from '@/app/api/search/rows/route';
import { POST as search } from '@/app/api/search/route';
import { POST as pdf } from '@/app/api/statement/pdf/route';
import { POST as categorizeRoute } from '@/app/api/statement/categorize/route';
import { loadEarn } from '@/app/earn/data';
import indirectFile from '@/data/indirect_routes.json';
import limitsFile from '@/data/transfer_limits.json';
import { CARDS, programmeName } from '@/lib/app/catalog';
import { addDaysIso, todayIso } from '@/lib/app/format';
import { stepsFor } from '@/lib/app/steps';
import { expandDest, GROUPS } from '@/lib/airports';
import { CATS, rankCards, type Cat, type Spend } from '@/lib/earn';
import { BANKS } from '@/lib/engine/data';
import { type Hop, reachable } from '@/lib/engine/engine';
import { getData } from '@/lib/engine/load';
import { TERMS } from '@/lib/glossary';
import { PRICES } from '@/lib/prices';
import { recommend } from '@/lib/recommend';
import { detectCard, monthlySpend, monthsCovered, parseStatementText, type Txn } from '@/lib/statement';
import { callRoute, forwardHeaders, text, type ToolOut } from './call';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const LIVE = { ...READ, openWorldHint: true } as const;

const iata = z.string().regex(/^[A-Za-z]{3}$/).transform(s => s.toUpperCase());
const seatId = z.string().describe('A seat id from search_award_seats (the "id" of a row).');
const spendShape = z.partialRecord(z.enum(CATS), z.number().min(0).max(100_000_000)).describe('Rupees per month by category, for example {"dining": 15000, "online": 30000}.');
const holdings = {
  cardIds: z.array(z.string()).max(12).default([]).describe('Card ids the person holds, from card_mafia_catalog (kind "cards").'),
  balances: z.record(z.string(), z.number().int().min(0)).default({}).describe('Points balance per card id, for example {"axis-atlas": 120000}.'),
};

type Seat = { id: string; origin: string; dest: string; date: string; miles: number; programme_id?: string; programme_name?: string; updated_at?: string; reach?: { best?: { pointsUsed: number; cardName?: string } | null } | null };
const json = (out: ToolOut): unknown => {
  try {
    return JSON.parse(out.content[0].text);
  } catch {
    return null;
  }
};

type Lim = { last_verified: string; limits: Record<string, string | null>; min_transfer: string | null; multiple_of: string | null; transfer_fee: string | null; per_partner: string | null; notes: string | null; conflicts: string[]; confidence: string | null; sources: { url: string; type: string; date: string }[] };
type Indirect = { via: string; to: string; leg1: string; leg2: string; effective: string; cost: number; time: string; caps: string[]; notes: string[]; direct: string | null; beats_direct: boolean | null };
const LIM = limitsFile as unknown as { cards: Record<string, Lim> };
const IND = indirectFile as unknown as { last_verified: string; source_url: string; cards: Record<string, Indirect[]> };

export function registerMoreTools(server: McpServer, req: Request) {
  server.registerTool('transfer_rules', {
    title: 'Transfer explorer and rules browser',
    description: 'No arguments: every card with how many airline programmes it reaches and its best rate. With cardId: every partner with ratio, chain, cap and transfer time, hotel partners, the card\'s daily/monthly/annual limits and fees, indirect routes that can beat a direct transfer, and when each was last checked. With programmeId: which cards reach that programme, best rate first.',
    inputSchema: { cardId: z.string().optional(), programmeId: z.string().optional() },
    annotations: READ,
  }, async ({ cardId, programmeId }) => {
    const { data } = await getData();
    const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
    const bankOf = (id: string) => BANKS.find(b => b.id === id)?.name ?? id;
    const chain = (h: Hop[]) => ({ nodes: [h[0].from, ...h.map(x => x.to)].map(name), ratios: h.map(x => `${x.ratio_in}:${x.ratio_out}`) });
    const time = (h: Hop[]) => data.rules.find(r => r.id === h[0].ruleId)?.transfer_time ?? null;

    if (programmeId) {
      const rows = data.cards.flatMap(c => {
        const r = reachable(data, c.id, 10_000_000).find(x => x.programme === programmeId);
        return r ? [{ cardId: c.id, card: `${bankOf(c.bank)} ${c.name}`, pointsPerMile: r.pointsPerMile, chain: chain(r.hops), cap: r.cap, transferTime: time(r.hops), confirmed: r.hops.every(h => h.routeConfirmedOn) }] : [];
      }).sort((a, b) => a.pointsPerMile - b.pointsPerMile);
      return text({ programme: name(programmeId), cardsReaching: rows.length, rows, rulesCheckedOn: data.rulesCheckedOn });
    }
    if (!cardId) {
      const rows = data.cards.map(c => {
        const air = reachable(data, c.id, 10_000_000);
        const best = [...air].sort((a, b) => a.pointsPerMile - b.pointsPerMile)[0];
        return { cardId: c.id, card: c.name, bank: bankOf(c.bank), programmesReached: air.length, best: best ? { programme: name(best.programme), pointsPerMile: best.pointsPerMile } : null };
      });
      return text({ cards: rows.length, rows, rulesCheckedOn: data.rulesCheckedOn });
    }
    const card = data.cards.find(c => c.id === cardId);
    if (!card) return text({ error: 'Unknown card. Use card_mafia_catalog with kind "cards".' }, true);
    const air = reachable(data, card.id, 10_000_000).map(r => ({ programme: r.programme, name: name(r.programme), pointsPerMile: r.pointsPerMile, chain: chain(r.hops), cap: r.cap, transferTime: time(r.hops), confirmed: r.hops.every(h => h.routeConfirmedOn) }));
    const hotels = data.rules.filter(r => r.from === card.programme && data.programmes.find(p => p.id === r.to)?.kind === 'hotel').map(r => ({ programme: name(r.to), ratio: `${r.ratio_in}:${r.ratio_out}` }));
    const indirect = (IND.cards[card.id] ?? []).filter(r => r.beats_direct !== false).sort((a, b) => Number(b.beats_direct === true) - Number(a.beats_direct === true) || a.cost - b.cost).slice(0, 12);
    return text({
      card: `${bankOf(card.bank)} ${card.name}`, airlinePartners: air, hotelPartners: hotels, limits: LIM.cards[card.id] ?? null, indirectRoutes: indirect, indirectRoutesCheckedOn: IND.last_verified,
      sameBank: data.cards.filter(c => c.bank === card.bank && c.id !== card.id).map(c => ({ cardId: c.id, name: c.name })), rulesCheckedOn: data.rulesCheckedOn,
    });
  });

  server.registerTool('card_earn_rules', {
    title: 'How to earn points on each card',
    description: 'The earn browser. Without cardId: cards with annual fee, base rate and best way to earn (filter by bank or a word in the name). With cardId: the full rules: base rate, accelerated categories with caps, milestones, exclusions, welcome benefit and redemption value.',
    inputSchema: { cardId: z.string().optional(), bank: z.string().max(40).optional().describe('Part of a bank name, for example "hdfc".'), search: z.string().max(40).optional() },
    annotations: READ,
  }, async ({ cardId, bank, search: q }) => {
    const { browse } = await loadEarn();
    if (cardId) {
      const c = browse.find(x => x.id === cardId);
      return c ? text(c) : text({ error: 'No earn rules for that card. Use card_mafia_catalog with kind "cards".' }, true);
    }
    const hit = (s: string, needle?: string) => !needle || s.toLowerCase().includes(needle.toLowerCase());
    const rows = browse.filter(c => hit(c.bank, bank) && hit(c.name, q)).map(c => ({ cardId: c.id, name: c.name, bank: c.bank, currency: c.currency, annualFeeInr: c.annualFee, basePer100Inr: c.basePer100, best: c.best, welcome: c.welcome }));
    return text({ count: rows.length, rows: rows.slice(0, 60), ...(rows.length > 60 ? { note: 'Showing 60. Narrow with bank or search.' } : {}) });
  });

  server.registerTool('recommend_card', {
    title: 'Which card should I add?',
    description: 'Looks at a month of spending and the cards already held, and recommends up to four cards that earn the most airline miles, plus a companion card for what the first is weak at and a stretch card the fee limit left out. Value is measured in comparable long-haul miles. Optionally aim at chosen airline programmes and cap the annual fee.',
    inputSchema: {
      monthlySpendInr: spendShape,
      heldCardIds: z.array(z.string()).max(12).default([]),
      airlineProgrammeIds: z.array(z.string()).max(10).default([]).describe('Programme ids from card_mafia_catalog; empty means the default long-haul basket.'),
      annualFeeCapInr: z.number().min(0).optional().describe('Leave out cards whose annual fee is above this.'),
    },
    annotations: READ,
  }, async ({ monthlySpendInr, heldCardIds, airlineProgrammeIds, annualFeeCapInr }) => {
    const { calc, miles, browse, programmes } = await loadEarn();
    const fees = Object.fromEntries(browse.map(c => [c.id, c.annualFee]));
    const result = recommend({ cards: calc, miles, spend: monthlySpendInr as Spend, targets: airlineProgrammeIds, held: heldCardIds, fees, feeCap: annualFeeCapInr ?? Infinity });
    const pname = (id: string | null) => (id ? programmes.find(p => p.id === id)?.name ?? id : null);
    const slim = (p: (typeof result.picks)[number]) => ({ cardId: p.card.card_id, card: p.card.name, alreadyHeld: p.held, milesPerMonth: p.miles, extraMilesPerMonth: p.gain, extraMilesPerYear: p.annualMiles, bestProgramme: pname(p.programme), milesPerCardPoint: p.perPoint, programmesReached: p.breadth, wins: p.wins, feePer1000ExtraMiles: p.costPer1k, voucherOrPortalRoutes: p.routes });
    return text({ baselineMilesPerMonth: result.baseline, picks: result.picks.slice(0, 4).map(slim), companion: result.companion ? slim(result.companion) : null, stretch: result.stretch ? slim(result.stretch) : null });
  });

  server.registerTool('trip_ideas', {
    title: 'Trips your points can pay for',
    description: 'From a home airport, finds the cheapest business seat the given cards can pay for in each region (Europe, Middle East, Southeast Asia, East Asia, North America, Oceania) over the next five months, one person. Regions are looked up in parallel and each is capped to its first 8 airports, so this can take up to a minute.',
    inputSchema: { homeAirport: iata.default('BOM'), regions: z.array(z.enum(['europe', 'middle-east', 'southeast-asia', 'east-asia', 'north-america', 'oceania'])).min(1).max(6).default(['europe', 'middle-east', 'southeast-asia', 'east-asia', 'north-america', 'oceania']), ...holdings },
    annotations: LIVE,
  }, async ({ homeAirport, regions, cardIds, balances }) => {
    if (!cardIds.length) return text({ error: 'Give the cards you hold (cardIds) and their balances, so seats can be matched to what you can pay for.' }, true);
    const from = addDaysIso(14, todayIso());
    const to = addDaysIso(150, todayIso());
    const found = await Promise.all(regions.map(async region => {
      const out = await callRoute(search, { origins: [homeAirport], dests: expandDest(region).slice(0, 8), from, to, cabin: 'business', travellers: 1, holdings: { cardIds, balances }, filters: { reachableOnly: true }, limit: 20 }, req);
      const body = json(out) as { rows?: Seat[]; error?: string } | null;
      const best = body?.rows?.filter(s => s.reach?.best).sort((a, b) => (a.reach?.best?.pointsUsed ?? 0) - (b.reach?.best?.pointsUsed ?? 0))[0];
      return best ? { region, seatId: best.id, route: `${best.origin} to ${best.dest}`, date: best.date, programme: best.programme_name ?? best.programme_id, airlineMiles: best.miles, cardPointsNeeded: best.reach?.best?.pointsUsed ?? 0, paidWith: best.reach?.best?.cardName ?? null, seenAt: best.updated_at } : { region, note: body?.error ?? 'No seat your cards can pay for.' };
    }));
    const ideas = found.filter((f): f is Extract<typeof f, { seatId: string }> => 'seatId' in f).sort((a, b) => a.cardPointsNeeded - b.cardPointsNeeded);
    return text({ homeAirport, window: { from, to }, ideas, none: found.filter(f => !('seatId' in f)) });
  });

  server.registerTool('compare_seats', {
    title: 'Compare two or three seats side by side',
    description: 'Full detail for 2 or 3 seats from search_award_seats: points, taxes, flights, aircraft, seat age, and which of the given cards can pay and how.',
    inputSchema: { seatIds: z.array(seatId).min(2).max(3), travellers: z.number().int().min(1).max(9).default(1), cardIds: holdings.cardIds, balances: holdings.balances },
    annotations: READ,
  }, a => callRoute(rowsRoute, { ids: a.seatIds, travellers: a.travellers, holdings: a.cardIds.length ? { cardIds: a.cardIds, balances: a.balances } : undefined }, req));

  server.registerTool('recheck_seat', {
    title: 'Re-check one seat live',
    description: 'Asks the seat source for a fresh look at one seat right before you transfer. Says whether it was refreshed, or whether the seat is gone. Spends one of the day\'s live lookups, so use it for a seat you are about to act on.',
    inputSchema: { seatId },
    annotations: LIVE,
  }, ({ seatId: id }) => callRoute(detail, { id }, req));

  server.registerTool('booking_steps', {
    title: 'The ordered steps to book a seat',
    description: 'For one seat: the steps in order (bank transfer, wait, any further transfer, wait, then book), skipped when the points are already in the airline programme. Pass the balance already in that airline programme if you have one. Pair with seat_booking_handoff for the booking page.',
    inputSchema: { seatId, travellers: z.number().int().min(1).max(9).default(1), airlineProgrammeBalance: z.number().int().min(0).optional().describe('Points already sitting in the airline programme.'), cardIds: holdings.cardIds, balances: holdings.balances },
    annotations: READ,
  }, async a => {
    const out = await callRoute(rowsRoute, { ids: [a.seatId], travellers: a.travellers, holdings: a.cardIds.length ? { cardIds: a.cardIds, balances: a.balances } : undefined }, req);
    if (out.isError) return out;
    const r = (json(out) as { rows?: Seat[] } | null)?.rows?.[0];
    if (!r) return text({ error: 'We no longer have that seat. Search again.' }, true);
    const plan = stepsFor({ r: r as never, programme: r.programme_name ?? 'the airline', n: a.travellers, held: a.airlineProgrammeBalance ?? null, nameOf: programmeName, bankOf: id => CARDS.find(c => c.id === id)?.bank });
    return text({ seat: { route: `${r.origin} to ${r.dest}`, date: r.date, programme: r.programme_name, seenAt: r.updated_at }, directBooking: plan.direct, steps: plan.steps });
  });

  server.registerTool('analyze_statement', {
    title: 'Read a card statement and find the best card',
    description: 'Reads a statement and works out the typical month of spending by category, then ranks the cards that would earn the most on it. Send pasted transactions as "text", or a PDF as base64 in "pdfBase64" (up to 4 MB, with "pdfPassword" if it is protected). Merchants the keyword rules cannot place are sorted by Gemini, sending merchant names only. Nothing is stored. The result feeds recommend_card and best_earning_card.',
    inputSchema: { text: z.string().max(200_000).optional().describe('Pasted statement lines: date, merchant, amount.'), pdfBase64: z.string().max(5_600_000).optional(), pdfPassword: z.string().max(100).optional() },
    annotations: LIVE,
  }, async ({ text: pasted, pdfBase64, pdfPassword }) => {
    const { data } = await getData();
    let txns: Txn[] = [];
    let meta: { skipped: number; from: string | null; to: string | null } = { skipped: 0, from: null, to: null };
    let detected: { cardId: string | null; bank: string | null } = { cardId: null, bank: null };
    let pages: number | null = null;
    if (pdfBase64) {
      const form = new FormData();
      form.set('file', new File([Buffer.from(pdfBase64, 'base64')], 'statement.pdf', { type: 'application/pdf' }));
      if (pdfPassword) form.set('password', pdfPassword);
      const res = await pdf(new Request('http://card-mafia.internal/api', { method: 'POST', headers: forwardHeaders(req), body: form }));
      const body = (await res.json().catch(() => null)) as { txns?: Txn[]; skipped?: number; from?: string | null; to?: string | null; cardId?: string | null; bank?: string | null; pages?: number; error?: string } | null;
      if (!res.ok || !body?.txns) return text({ error: body?.error ?? 'We could not read that PDF. Paste the transactions instead.' }, true);
      txns = body.txns;
      meta = { skipped: body.skipped ?? 0, from: body.from ?? null, to: body.to ?? null };
      detected = { cardId: body.cardId ?? null, bank: body.bank ?? null };
      pages = body.pages ?? null;
    } else if (pasted) {
      const parsed = parseStatementText(pasted);
      txns = parsed.txns;
      meta = { skipped: parsed.skipped, from: parsed.from, to: parsed.to };
      detected = detectCard(pasted, data.cards.map(c => ({ id: c.id, bank: BANKS.find(b => b.id === c.bank)?.name ?? c.bank, name: c.name })));
    } else return text({ error: 'Send the statement as "text" (pasted lines) or "pdfBase64".' }, true);
    if (!txns.length) return text({ error: 'We read it but found no transactions. Paste the lines as date, merchant, amount.' }, true);

    // the keyword rules leave unknown merchants as "general"; Gemini places them, from merchant text only
    const unknown = [...new Set(txns.filter(t => t.cat === 'general').map(t => t.desc.slice(0, 60)))].slice(0, 200);
    const placed = new Map<string, Cat>();
    for (let i = 0; i < unknown.length; i += 100) {
      const chunk = unknown.slice(i, i + 100);
      const cats = (json(await callRoute(categorizeRoute, { descs: chunk }, req)) as { cats?: (Cat | null)[] } | null)?.cats ?? [];
      cats.forEach((c, k) => { if (c && c !== 'general') placed.set(chunk[k], c); });
    }
    txns = txns.map(t => (t.cat === 'general' && placed.has(t.desc.slice(0, 60)) ? { ...t, cat: placed.get(t.desc.slice(0, 60)) as Cat } : t));

    const months = monthsCovered(meta.from, meta.to);
    const spend = monthlySpend(txns, months);
    const { calc } = await loadEarn();
    const ranked = rankCards(calc, spend as Spend).slice(0, 3).map(r => ({ cardId: r.card.card_id, card: r.card.name, monthlyPoints: r.points, skippedSpendInr: r.skippedSpend, notes: r.notes }));
    const detectedCard = detected.cardId ? { cardId: detected.cardId, card: data.cards.find(c => c.id === detected.cardId)?.name ?? null, bank: detected.bank } : detected.bank ? { bank: detected.bank } : null;
    return text({ period: { from: meta.from, to: meta.to, months }, transactions: txns.length, skippedLines: meta.skipped, ...(pages ? { pages } : {}), detectedCard, monthlySpendInr: spend, bestCards: ranked, merchantsSortedByAi: placed.size });
  });

  server.registerTool('wallet_overview', {
    title: 'What the points in my cards can buy',
    description: 'The wallet\'s maths, with the cards typed in (Card Mafia\'s saved wallet needs an account): for each card, the balance and the best airline programmes it reaches with the miles they become, the cap and the transfer time. Follow with trip_ideas for seats.',
    inputSchema: { ...holdings, top: z.number().int().min(1).max(8).default(3) },
    annotations: READ,
  }, async ({ cardIds, balances, top }) => {
    const { data } = await getData();
    const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
    const cards = cardIds.flatMap(id => {
      const card = data.cards.find(c => c.id === id);
      const points = balances[id] ?? 0;
      if (!card) return [];
      const reach = reachable(data, id, points).sort((a, b) => b.miles - a.miles).slice(0, top).map(r => ({ programme: name(r.programme), miles: r.miles, cardPointsUsed: r.pointsUsed, pointsPerMile: r.pointsPerMile, cap: r.cap, hops: r.hops.length }));
      return [{ cardId: id, card: card.name, bank: BANKS.find(b => b.id === card.bank)?.name ?? card.bank, points, bestProgrammes: reach }];
    });
    const unknown = cardIds.filter(id => !data.cards.some(c => c.id === id));
    return text({ totalCardPoints: cards.reduce((s, c) => s + c.points, 0), cards, ...(unknown.length ? { unknownCardIds: unknown } : {}), rulesCheckedOn: data.rulesCheckedOn });
  });

  server.registerTool('pricing_plans', {
    title: 'Free, day pass and Pro',
    description: 'What Card Mafia costs: Free has every feature, the Rs 99 day pass adds the Pro extras for 24 hours, and Pro is planned. States what is real today and what is not.',
    inputSchema: {},
    annotations: READ,
  }, async () => text({
    plans: [
      { name: 'Free', priceInr: 0, includes: ['Trip plans with the pre-transfer safety check', 'The points calculator, all four modes', 'The transfer explorer and every rule with its source', 'Your setup saved on a device or to an account'] },
      { name: 'Day pass', priceInr: PRICES.dayPass, period: '24 hours, once per account', includes: ['A seat re-check right before you transfer', 'Alerts when a rule on your path changes', 'Saved plans and trip history on every device'], note: 'Checkout is a demo for now: no money moves.' },
      { name: 'Pro', priceInrPerYear: PRICES.yearly, priceInrPerMonth: PRICES.monthly, status: 'Opens soon. Planned prices, not final.' },
    ],
    page: 'https://card-mafia.vercel.app/pricing',
  }));

  server.registerTool('learn_glossary', {
    title: 'Points, in plain English',
    description: 'The glossary from Card Mafia\'s Learn page: ratio, transfer block, monthly cap, multi-hop, value per point, taxes and fees, Qsuite, data age. Give a term to get one, or none to get all.',
    inputSchema: { term: z.string().max(40).optional() },
    annotations: READ,
  }, async ({ term }) => {
    const hit = TERMS.filter(([t]) => !term || t.toLowerCase().includes(term.toLowerCase()));
    return text(hit.length ? { terms: hit.map(([t, meaning]) => ({ term: t, meaning })) } : { error: `No term matches "${term}".`, available: TERMS.map(([t]) => t) }, !hit.length);
  });

  server.registerTool('about_card_mafia', {
    title: 'What Card Mafia does, and does not do',
    description: 'What the product does, where its rules and seats come from and how old they are, how it treats your data, and which features need a Card Mafia account (saved wallet, trips, alerts, Gmail import) and so are on the website, not in this connector.',
    inputSchema: {},
    annotations: READ,
  }, async () => {
    const { data, source } = await getData();
    return text({
      does: 'Turns a trip goal into a checked award-flight plan for Indian premium cardholders: which card, which transfer path, which seat.',
      doesNot: 'It never books a seat, transfers points, or asks for a bank or airline login or an OTP. Numbers come from fixed rules; an AI model only reads your sentence and rewrites finished results.',
      rules: { checkedOn: data.rulesCheckedOn, source, cards: data.cards.length, note: 'Compiled from public sources, not matched to bank portals. Verify before you transfer.' },
      seats: 'Cached award seats. Every result carries its age and seats can disappear before you transfer.',
      yourData: 'This connector stores nothing: cards and balances you mention are used for that request only.',
      onTheWebsiteOnly: ['Saved wallet and balances', 'Saved trips', 'Route and custom alerts', 'Gmail import of balances', 'Account and sign-in'],
      regions: GROUPS.map(g => g.id),
      website: 'https://card-mafia.vercel.app',
    });
  });
}
