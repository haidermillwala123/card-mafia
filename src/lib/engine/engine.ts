// Card Mafia planning engine. Pure rules, no AI and no network: the same input always gives the same plans.
// Claude only parses the trip before this and explains the result after it.

export type Rule = {
  id: string;
  from: string;
  to: string;
  cards?: string[];
  ratio_in: number;
  ratio_out: number;
  monthly_cap?: number | null;
  annual_cap?: number | null;
  min_multiple?: number | null;
  route_confirmed_on?: string | null;
  transfer_time?: string | null;
  source_url: string;
  source_note: string;
};
export type Card = { id: string; bank: string; name: string; programme: string; annual_fee_inr: number | null };
export type Programme = { id: string; name: string; kind: string };
export type Seat = {
  programme: string;
  origin: string;
  dest: string;
  date: string;
  cabin: string;
  miles: number;
  taxes_inr: number;
  seats: number;
  airline: string;
  aircraft: string;
  flights: string[];
  direct: boolean;
};
export type Data = {
  rules: Rule[];
  rulesCheckedOn: string;
  cards: Card[];
  programmes: Programme[];
  qsuite: { types: { type: string; fit: 'all' | 'some' }[]; status: string; verified_at: string | null };
  seats: { sample: boolean; fetched_at: string; rows: Seat[] };
};
export type Trip = {
  origin: string;
  dests: string[];
  month: string;
  travellers: number;
  cabin: string;
  mustProduct: 'Qsuite' | null;
  cashFareInr: number | null;
};
// balances are points per card id, typed by the person
export type Holdings = { cardIds: string[]; balances: Record<string, number> };

export type Hop = {
  ruleId: string;
  from: string;
  to: string;
  ratio_in: number;
  ratio_out: number;
  points_in: number;
  points_out: number;
  routeConfirmedOn: string | null;
  sourceUrl: string;
  sourceNote: string;
};
export type Transfer = {
  cardId: string;
  cardName: string;
  fromProgramme: string;
  hops: Hop[];
  sourcePoints: number;
  targetMiles: number;
  cap: { limit: number | null; period: 'month' | 'year' | null; ok: boolean; monthsNeeded: number };
};
export type NewCard = {
  cardId: string;
  cardName: string;
  fromProgramme: string;
  hops: Hop[];
  sourcePointsForShortfall: number;
  ratioText: string;
};
export type Safety = {
  rules: { state: 'route-confirmed' | 'unverified'; checkedOn: string };
  cap: { ok: boolean; limit: number | null; period: 'month' | 'year' | null; needed: number; monthsNeeded: number };
  seatAgeMinutes: number;
  aircraft: { type: string; fit: 'all' | 'some' | null; listVerified: boolean };
  nameCheck: string;
  confirmOnAirline: string;
};
export type Plan = {
  rank: number;
  kind: 'best_path' | 'direct' | 'get_card';
  headline: string;
  seat: Seat;
  qsuiteFit: 'all' | 'some' | null;
  transfers: Transfer[];
  milesNeeded: number;
  milesCovered: number;
  shortfallMiles: number;
  sourcePointsTotal: number;
  taxesInr: number;
  valuePerPoint: number | null;
  positioning: { seat: Seat | null; milesNeeded: number | null };
  newCard: NewCard | null;
  risks: string[];
  safety: Safety;
};
export type PlanResult = {
  plans: Plan[];
  considered: { seats: number; droppedNotQsuite: number; droppedTooFewSeats: number };
  empty: string | null;
};

const EPS = 1e-9;
const cost = (rules: Rule[]) => rules.reduce((c, r) => c * (r.ratio_in / r.ratio_out), 1);
const fmt = (n: number) => n.toLocaleString('en-IN');

// The cheapest chain of rules from one card's programme to every programme it can reach (up to 4 hops).
export function bestPaths(data: Data, cardId: string, directOnly = false): Map<string, Rule[]> {
  const card = data.cards.find(c => c.id === cardId);
  const best = new Map<string, { rules: Rule[]; cost: number }>();
  if (!card) return new Map();
  const walk = (prog: string, rules: Rule[], seen: Set<string>) => {
    if (rules.length) {
      const c = cost(rules);
      const b = best.get(prog);
      if (!b || c < b.cost - EPS || (Math.abs(c - b.cost) < EPS && rules.length < b.rules.length)) best.set(prog, { rules, cost: c });
    }
    if (rules.length >= (directOnly ? 1 : 4)) return;
    for (const r of data.rules) {
      if (r.from !== prog || seen.has(r.to)) continue;
      if (!rules.length && r.cards && !r.cards.includes(card.id)) continue;
      walk(r.to, [...rules, r], new Set([...seen, r.to]));
    }
  };
  walk(card.programme, [], new Set([card.programme]));
  return new Map([...best].map(([k, v]) => [k, v.rules]));
}

// Points needed at every hop to land `miles` at the end of the chain. Works back from the target so each hop rounds up.
export function hopsFor(rules: Rule[], miles: number): Hop[] {
  const hops: Hop[] = [];
  let out = miles;
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i];
    let inn = Math.ceil((out * r.ratio_in) / r.ratio_out - EPS);
    if (i === 0 && r.min_multiple) inn = Math.ceil(inn / r.min_multiple) * r.min_multiple;
    hops.unshift({
      ruleId: r.id, from: r.from, to: r.to, ratio_in: r.ratio_in, ratio_out: r.ratio_out, points_in: inn, points_out: out,
      routeConfirmedOn: r.route_confirmed_on ?? null, sourceUrl: r.source_url, sourceNote: r.source_note,
    });
    out = inn;
  }
  return hops;
}

// Most miles a chain can deliver from `limit` source points.
function maxMiles(rules: Rule[], limit: number): number {
  let m = Math.floor(limit / cost(rules));
  while (m > 0 && hopsFor(rules, m)[0].points_in > limit) m -= 1;
  return Math.max(0, m);
}

const capOf = (r: Rule): { limit: number | null; period: 'month' | 'year' | null } =>
  r.monthly_cap ? { limit: r.monthly_cap, period: 'month' } : r.annual_cap ? { limit: r.annual_cap, period: 'year' } : { limit: null, period: null };

const fitOf = (data: Data, aircraft: string) => data.qsuite.types.find(t => t.type === aircraft)?.fit ?? null;
export const ageMinutes = (now: Date, iso: string) => Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
export const ageText = (min: number) => (min < 90 ? `${min} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const addDays = (iso: string, d: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + d * 86400000).toISOString().slice(0, 10);

type Source = { cardId: string; cardName: string; programme: string; rules: Rule[]; balance: number };

function sourcesFor(data: Data, holdings: Holdings, target: string, directOnly: boolean): Source[] {
  const out: Source[] = [];
  for (const id of holdings.cardIds) {
    const card = data.cards.find(c => c.id === id);
    const rules = card && bestPaths(data, id, directOnly).get(target);
    const balance = holdings.balances[id] ?? 0; // points sit on each card's own account, so they are not pooled
    if (card && rules && balance > 0) out.push({ cardId: card.id, cardName: card.name, programme: card.programme, rules, balance });
  }
  return out.sort((a, b) => cost(a.rules) - cost(b.rules));
}

// Spread the miles across held cards, cheapest chain first, never past a balance or an annual cap.
// A monthly cap is not a hard limit: the transfer can run over several months, so the plan flags how many.
export function allocate(sources: Source[], miles: number): { transfers: Transfer[]; shortfall: number } {
  let remaining = miles;
  const transfers: Transfer[] = [];
  for (const s of sources) {
    if (remaining <= 0) break;
    const cap = capOf(s.rules[0]);
    const limit = Math.min(s.balance, cap.period === 'year' ? cap.limit! : Infinity);
    const take = Math.min(remaining, maxMiles(s.rules, limit));
    if (take <= 0) continue;
    const hops = hopsFor(s.rules, take);
    const sourcePoints = hops[0].points_in;
    transfers.push({
      cardId: s.cardId, cardName: s.cardName, fromProgramme: s.programme, hops, sourcePoints, targetMiles: take,
      cap: { limit: cap.limit, period: cap.period, ok: !cap.limit || sourcePoints <= cap.limit, monthsNeeded: cap.limit ? Math.ceil(sourcePoints / cap.limit) : 1 },
    });
    remaining -= take;
  }
  return { transfers, shortfall: Math.max(0, remaining) };
}

function newCardFor(data: Data, holdings: Holdings, target: string, shortfall: number): NewCard | null {
  let pick: NewCard | null = null;
  let pickCost = Infinity;
  for (const card of data.cards) {
    if (holdings.cardIds.includes(card.id)) continue;
    const rules = bestPaths(data, card.id).get(target);
    if (!rules) continue;
    const c = cost(rules);
    if (c < pickCost - EPS || (Math.abs(c - pickCost) < EPS && pick && rules.length < pick.hops.length)) {
      const hops = hopsFor(rules, shortfall);
      pickCost = c;
      pick = { cardId: card.id, cardName: card.name, fromProgramme: card.programme, hops, sourcePointsForShortfall: hops[0].points_in, ratioText: `${Number(c.toFixed(2))}:1` };
    }
  }
  return pick;
}

function safetyFor(data: Data, seat: Seat, transfers: Transfer[], now: Date, fit: 'all' | 'some' | null): Safety {
  const hops = transfers.flatMap(t => t.hops);
  const unverified = hops.length === 0 || hops.some(h => !h.routeConfirmedOn);
  const worst = transfers.reduce(
    (w, t) => (!t.cap.ok || t.cap.monthsNeeded > w.monthsNeeded ? { limit: t.cap.limit, period: t.cap.period, monthsNeeded: t.cap.monthsNeeded, needed: t.sourcePoints } : w),
    { limit: null as number | null, period: null as 'month' | 'year' | null, monthsNeeded: 1, needed: 0 },
  );
  return {
    rules: { state: unverified ? 'unverified' : 'route-confirmed', checkedOn: data.rulesCheckedOn },
    cap: { ok: transfers.every(t => t.cap.ok), ...worst },
    seatAgeMinutes: ageMinutes(now, data.seats.fetched_at),
    aircraft: { type: seat.aircraft, fit, listVerified: data.qsuite.status === 'verified' },
    nameCheck: 'Your name must match your passport on both the bank and the airline account.',
    confirmOnAirline: 'Confirm the seat and the aircraft on the airline site before you transfer.',
  };
}

function risksFor(data: Data, seat: Seat, transfers: Transfer[], safety: Safety, fit: 'all' | 'some' | null, shortfall: number, travellers: number): string[] {
  const r: string[] = [];
  const hops = transfers.flatMap(t => t.hops);
  if (data.seats.sample) r.push('These seats are a sample, not live availability.');
  if (safety.seatAgeMinutes > 60) r.push(`Seat data is ${ageText(safety.seatAgeMinutes)} old, so the seat may already be gone.`);
  if (hops.some(h => !h.routeConfirmedOn)) r.push('Some ratios come from public sources and are not yet matched to the bank portal.');
  else if (hops.length) r.push('Ratios were reported by cardholders. Check each hop on the bank portal before you start.');
  if (transfers.some(t => t.hops.slice(1).some(h => h.to === 'ba-executive-club' || h.from === 'ba-executive-club'))) r.push('British Airways can block Indian users at its ID check. If it does, make that transfer in the Qatar app.');
  for (const t of transfers) {
    if (t.cap.period === 'month' && t.cap.limit && t.cap.monthsNeeded > 1) r.push(`${t.cardName} caps transfers at ${fmt(t.cap.limit)} points a month. This needs ${plural(t.cap.monthsNeeded, 'month')}.`);
    if (t.cap.period === 'year' && t.cap.limit) r.push(`${t.cardName} caps this route at ${fmt(t.cap.limit)} points a year.`);
  }
  if (fit === 'some') r.push(`Only part of the ${seat.aircraft} fleet has Qsuite. Qsuite is not guaranteed until you see the aircraft on the airline site.`);
  else if (fit === 'all') r.push('Airlines can swap the aircraft after booking, so Qsuite is not guaranteed.');
  if (!data.qsuite.verified_at) r.push('The Qsuite aircraft list is not yet verified.');
  if (seat.seats <= travellers) r.push(`Only ${plural(seat.seats, 'seat')} left at this price.`);
  if (shortfall > 0) r.push(`You are ${fmt(shortfall)} miles short of this seat.`);
  return r;
}

export function buildPlans(data: Data, trip: Trip, holdings: Holdings, now = new Date()): PlanResult {
  const legB = data.seats.rows.filter(s => s.origin === 'DOH' && trip.dests.includes(s.dest) && s.cabin === trip.cabin && s.date.startsWith(trip.month));
  const qsuiteOnly = trip.mustProduct === 'Qsuite';
  const afterProduct = qsuiteOnly ? legB.filter(s => s.airline === 'QR' && fitOf(data, s.aircraft)) : legB;
  const seats = afterProduct.filter(s => s.seats >= trip.travellers);
  const considered = { seats: legB.length, droppedNotQsuite: legB.length - afterProduct.length, droppedTooFewSeats: afterProduct.length - seats.length };
  if (!seats.length) {
    return { plans: [], considered, empty: legB.length ? 'No Qsuite seats are left for your party in the cached data.' : `No cached seats for ${trip.dests.join(', ')} in ${trip.month}. Cached routes: Doha to JFK, ORD, LAX and MIA, October 2027.` };
  }

  type Opt = { seat: Seat; transfers: Transfer[]; shortfall: number; total: number };
  const optionsFor = (directOnly: boolean): Opt[] =>
    seats
      .map(seat => {
        const { transfers, shortfall } = allocate(sourcesFor(data, holdings, seat.programme, directOnly), seat.miles * trip.travellers);
        return { seat, transfers, shortfall, total: transfers.reduce((n, t) => n + t.sourcePoints, 0) };
      })
      .sort((a, b) => a.shortfall - b.shortfall || a.total - b.total || a.seat.date.localeCompare(b.seat.date));

  const multi = optionsFor(false);
  const direct = optionsFor(true);
  const best = multi[0];

  const positioning = (seat: Seat) => {
    const lo = addDays(seat.date, -3);
    const hi = addDays(seat.date, -1);
    const a = data.seats.rows
      .filter(s => s.origin === trip.origin && s.dest === 'DOH' && s.programme === seat.programme && s.cabin === trip.cabin && s.date >= lo && s.date <= hi && s.seats >= trip.travellers)
      .sort((x, y) => x.miles - y.miles || y.date.localeCompare(x.date))[0] ?? null;
    return { seat: a, milesNeeded: a ? a.miles * trip.travellers : null };
  };

  const make = (o: Opt, rank: number, kind: Plan['kind'], withNewCard: boolean): Plan => {
    const miles = o.seat.miles * trip.travellers;
    const fit = fitOf(data, o.seat.aircraft);
    const safety = safetyFor(data, o.seat, o.transfers, now, fit);
    const taxesInr = o.seat.taxes_inr * trip.travellers;
    const newCard = withNewCard && o.shortfall > 0 ? newCardFor(data, holdings, o.seat.programme, o.shortfall) : null;
    const d = new Date(`${o.seat.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return {
      rank, kind, headline: kind === 'get_card' && newCard ? `Add ${newCard.cardName} to close the gap` : `Doha to ${o.seat.dest}, ${d}`,
      seat: o.seat, qsuiteFit: fit, transfers: o.transfers, milesNeeded: miles, milesCovered: miles - o.shortfall, shortfallMiles: o.shortfall,
      sourcePointsTotal: o.total, taxesInr,
      valuePerPoint: trip.cashFareInr && o.total ? valuePerPoint(trip.cashFareInr, taxesInr, o.total) : null,
      positioning: positioning(o.seat), newCard, risks: risksFor(data, o.seat, o.transfers, safety, fit, o.shortfall, trip.travellers), safety,
    };
  };

  const plans: Plan[] = [make(best, 1, 'best_path', false)];
  const sameSeat = direct.find(o => o.seat === best.seat);
  const key = (o: Opt) => JSON.stringify(o.transfers.map(t => [t.cardId, t.sourcePoints]));
  if (sameSeat && key(sameSeat) !== key(best)) plans.push(make(sameSeat, 2, 'direct', false));
  if (best.shortfall > 0) {
    const gap = make(best, plans.length + 1, 'get_card', true);
    if (gap.newCard) plans.push(gap);
  } else {
    const alt = multi.find(o => o.shortfall === 0 && o.seat.date !== best.seat.date);
    if (alt) plans.push(make(alt, plans.length + 1, 'best_path', false));
  }
  return { plans: plans.slice(0, 3).map((p, i) => ({ ...p, rank: i + 1 })), considered, empty: null };
}

// ---------- calculator: what a card's points are worth in every programme it reaches ----------
export type Reach = {
  programme: string;
  hops: Hop[];
  miles: number; // delivered at the end of the chain
  pointsUsed: number; // spent from the card
  pointsPerMile: number;
  cap: Transfer['cap'];
};

// Everything one card can reach with `points`, cheapest chain per programme, best first.
export function reachable(data: Data, cardId: string, points: number, directOnly = false): Reach[] {
  const out: Reach[] = [];
  for (const [programme, rules] of bestPaths(data, cardId, directOnly)) {
    if (data.programmes.find(p => p.id === programme)?.kind !== 'airline') continue;
    const cap = capOf(rules[0]);
    const miles = maxMiles(rules, Math.min(points, cap.period === 'year' ? cap.limit! : Infinity));
    if (miles <= 0) continue;
    const hops = hopsFor(rules, miles);
    const used = hops[0].points_in;
    out.push({
      programme, hops, miles, pointsUsed: used, pointsPerMile: Math.round(cost(rules) * 100) / 100,
      cap: { limit: cap.limit, period: cap.period, ok: !cap.limit || used <= cap.limit, monthsNeeded: cap.limit ? Math.ceil(used / cap.limit) : 1 },
    });
  }
  return out.sort((a, b) => b.miles - a.miles || a.hops.length - b.hops.length);
}

// The reverse question: how many card points buy `miles` in one programme.
export function pointsFor(data: Data, cardId: string, programme: string, miles: number, directOnly = false): Reach | null {
  const rules = bestPaths(data, cardId, directOnly).get(programme);
  if (!rules || miles <= 0) return null;
  const cap = capOf(rules[0]);
  const hops = hopsFor(rules, miles);
  const used = hops[0].points_in;
  return {
    programme, hops, miles, pointsUsed: used, pointsPerMile: Math.round(cost(rules) * 100) / 100,
    cap: { limit: cap.limit, period: cap.period, ok: !cap.limit || used <= cap.limit, monthsNeeded: cap.limit ? Math.ceil(used / cap.limit) : 1 },
  };
}

// Several cards into one programme: cheapest chain first, until the miles are covered or the balances run out.
export const combine = (data: Data, holdings: Holdings, target: string, miles: number, directOnly = false) =>
  allocate(sourcesFor(data, holdings, target, directOnly), miles);

// Value per point = (cash fare the user types in - cash taxes) / points needed. The MVP has no fare feed.
export const valuePerPoint = (fare: number, taxes: number, points: number) => (points > 0 ? Math.round(((fare - taxes) / points) * 100) / 100 : null);
export { fmt as formatIndian };
