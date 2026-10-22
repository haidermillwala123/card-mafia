// Rule-based trip parser. It is the fallback when Claude is not configured or fails, and it checks nothing Claude says:
// the person always confirms the parsed cards and balances before any plan is built.
import type { Card } from './engine';

export type ParsedTrip = {
  origin: string | null;
  dests: string[];
  month: string | null;
  travellers: number;
  cabin: string;
  mustProduct: 'Qsuite' | null;
  cardIds: string[];
  balances: Record<string, number>; // points per card id
  cashFareInr: number | null;
  // a balance like "12L" that could mean two amounts: the person must pick, we never guess
  ambiguous: { cardId: string; raw: string; options: number[] }[];
  notes: string[];
};

const ALIASES: [RegExp, string][] = [
  [/\binfinia\b/, 'hdfc-infinia'],
  [/\b(diners|dcb)\b/, 'hdfc-diners'],
  [/\bregalia gold\b/, 'hdfc-regalia-gold'],
  [/\bregalia\b/, 'hdfc-regalia'],
  [/\batlas\b/, 'axis-atlas'],
  [/\bhorizon\b/, 'axis-horizon'],
  [/\bmagnus\b/, 'axis-magnus'],
  [/\baxis reserve\b|(?<!sapphire )\breserve\b/, 'axis-reserve'],
  [/\b(?:amex|american express)\b(?!\s+(?:gold|green|blue|everyday|membership))|\bplatinum travel\b/, 'amex-plat-travel'],
  [/\btravel one\b/, 'hsbc-travel-one'],
  [/\bhsbc premier\b|\bpremier\b/, 'hsbc-premier'],
  [/\bsbi miles\b/, 'sbi-miles'],
  [/\bemeralde private\b/, 'icici-emeralde-private-metal'],
  [/\bemeralde\b/, 'icici-emeralde'],
];
const CITIES: Record<string, string> = { delhi: 'DEL', mumbai: 'BOM', bengaluru: 'BLR', bangalore: 'BLR', hyderabad: 'HYD', chennai: 'MAA', kolkata: 'CCU', pune: 'PNQ', ahmedabad: 'AMD' };
const US_AIRPORTS: [RegExp, string][] = [[/new york|nyc|\bjfk\b/, 'JFK'], [/chicago|\bord\b/, 'ORD'], [/los angeles|\blax\b/, 'LAX'], [/miami|\bmia\b/, 'MIA']];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const NUM = /(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|l|k|m)?(?![a-z])/gi;

export function amountOf(num: string, unit?: string): number {
  const n = parseFloat(num.replace(/,/g, ''));
  const u = (unit ?? '').toLowerCase();
  const mult = u === 'k' ? 1e3 : u === 'm' ? 1e6 : u ? 1e5 : 1;
  return Math.round(n * mult);
}

const PLACES = /\b(tokyo|japan|osaka|paris|france|london|singapore|bangkok|thailand|bali|dubai|seattle|sfo|san francisco|boston|toronto|sydney|europe|asia|italy|rome|germany|frankfurt)\b/;
const OTHER_CARDS = /\b(chase|sapphire|capital one|citi(?:bank)?|amex (?:gold|green|blue|everyday)|american express (?:gold|green|blue))\b/;

// Things we cannot plan yet. They only add notes: the trip is never changed behind the person's back.
export function unsupportedNotes(text: string, month: string | null, now: Date): string[] {
  const t = text.toLowerCase();
  const notes: string[] = [];
  const place = PLACES.exec(t)?.[1];
  if (place) notes.push(`We cannot plan ${place[0].toUpperCase()}${place.slice(1)} yet. Today we plan flights from India to Doha to the US. Pick a US city below.`);
  const other = OTHER_CARDS.exec(t)?.[1];
  if (other) notes.push(`We do not cover “${other}”. We map Indian cards only, so pick yours below.`);
  if (month && Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1) <= now.getTime()) notes.push(`${month} has already started. Pick a later month below.`);
  return notes;
}

export function parseTrip(text: string, now: Date, cards: Card[], homeAirport = 'DEL'): ParsedTrip {
  const t = text.toLowerCase();
  const notes: string[] = [];

  const cardIds: string[] = [];
  const hits: { id: string; at: number }[] = [];
  for (const [re, id] of ALIASES) {
    const m = re.exec(t);
    if (m && cards.some(c => c.id === id) && !cardIds.includes(id)) {
      cardIds.push(id);
      hits.push({ id, at: m.index });
    }
  }

  // numbers that belong to a card, not to a date, a party size or a fare
  const nums = [...text.matchAll(NUM)]
    .map(m => ({ raw: m[0].trim(), value: amountOf(m[1], m[2]), unit: m[2], at: m.index!, end: m.index! + m[0].length }))
    .filter(n => !/^\s*(people|persons|pax|travell?ers|adults|passengers|of us|st|nd|rd|th)/i.test(text.slice(n.end, n.end + 14)))
    .filter(n => !(n.value >= 2000 && n.value <= 2100 && !n.unit) && (n.value >= 1000 || n.unit));
  const balances: Record<string, number> = {};
  const ambiguous: ParsedTrip['ambiguous'] = [];
  const used = new Set<number>();
  for (const h of hits) {
    const near = nums
      .map((n, i) => ({ n, i, d: Math.min(Math.abs(n.end - h.at), Math.abs(n.at - (h.at + 8))) }))
      .filter(x => !used.has(x.i) && x.d <= 22)
      .sort((a, b) => a.d - b.d)[0];
    if (!near) continue;
    used.add(near.i);
    // a bare "L" with 10+ ahead of it ("12L") could be 1.2 lakh or 12 lakh: leave the balance empty and ask
    if (near.n.unit?.toLowerCase() === 'l' && near.n.value >= 1000000) {
      ambiguous.push({ cardId: h.id, raw: near.n.raw, options: [near.n.value / 10, near.n.value] });
      continue;
    }
    balances[h.id] = near.n.value;
  }
  for (const id of cardIds) if (!(id in balances) && !ambiguous.some(a => a.cardId === id)) notes.push(`We could not read a balance for ${cards.find(c => c.id === id)!.name}. Add it below.`);
  if (!cardIds.length) notes.push('We found no cards in that sentence. Pick your cards below.');

  const mi = MONTHS.findIndex(m => new RegExp(`\\b${m}[a-z]*\\b`).test(t));
  let month: string | null = null;
  if (mi >= 0) {
    const explicit = /\b(20\d\d)\b/.exec(t);
    let year = explicit ? +explicit[1] : now.getUTCFullYear();
    // a month that has already started is read as next year, so "October" on 21 Oct 2026 means October 2027
    if (!explicit && Date.UTC(year, mi, 1) <= now.getTime()) year += 1;
    month = `${year}-${String(mi + 1).padStart(2, '0')}`;
  } else notes.push('We could not read a month. Pick one below.');

  const cities = US_AIRPORTS.filter(([re]) => re.test(t)).map(([, code]) => code);
  const us = /\b(usa|u\.s\.|united states|america)\b|\b(?:the|to|in|from) us\b/.test(t);
  const dests = cities.length ? cities : us ? US_AIRPORTS.map(([, c]) => c) : [];
  const extra = unsupportedNotes(text, month, now);
  if (!dests.length && !extra.some(n => n.startsWith('We cannot plan'))) notes.push('We can plan Doha to the US for now. Tell us a US city.');
  notes.push(...extra);

  const originName = Object.keys(CITIES).find(c => t.includes(c));
  const origin = originName ? CITIES[originName] : null;
  if (!origin) notes.push(`We used ${homeAirport} as your starting airport. The India to Doha leg stays flexible.`);

  const tm = /(\d+|one|two|three|four|five|six)\s*(?:people|persons|pax|travell?ers|adults|passengers|of us)/.exec(t) ?? /\bfor\s+(\d+|two|three|four)\b/.exec(t);
  const family = /\bfamily of (\d+|two|three|four|five|six)\b/.exec(t);
  const travellers = tm ? Math.min(9, WORDS[tm[1]] ?? +tm[1]) : family ? Math.min(9, WORDS[family[1]] ?? +family[1]) : /\b(husband|wife|spouse|partner)\b/.test(t) ? 2 : 1;

  const cabin = 'business';
  if (/\b(first class|economy)\b/.test(t)) notes.push('The MVP plans business class only. We used business.');

  const fare = /(?:fare|cash|costs?|price)\D{0,14}?(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|l|k)?/i.exec(text);
  return {
    origin: origin ?? homeAirport, dests, month, travellers, cabin, mustProduct: /qsuite/.test(t) ? 'Qsuite' : null,
    cardIds, balances, cashFareInr: fare ? amountOf(fare[1], fare[2]) : null, ambiguous, notes,
  };
}
