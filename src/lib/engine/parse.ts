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
  notes: string[];
};

const ALIASES: [RegExp, string][] = [
  [/\binfinia\b/, 'hdfc-infinia'],
  [/\b(diners|dcb)\b/, 'hdfc-diners'],
  [/\bregalia\b/, 'hdfc-regalia'],
  [/\batlas\b/, 'axis-atlas'],
  [/\bhorizon\b/, 'axis-horizon'],
  [/\bmagnus\b/, 'axis-magnus'],
  [/\baxis reserve\b|\breserve\b/, 'axis-reserve'],
  [/\bamex\b|\bamerican express\b|\bplatinum travel\b/, 'amex-plat-travel'],
  [/\btravel one\b/, 'hsbc-travel-one'],
  [/\bhsbc premier\b|\bpremier\b/, 'hsbc-premier'],
  [/\bsbi miles\b/, 'sbi-miles'],
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
  const used = new Set<number>();
  for (const h of hits) {
    const near = nums
      .map((n, i) => ({ n, i, d: Math.min(Math.abs(n.end - h.at), Math.abs(n.at - (h.at + 8))) }))
      .filter(x => !used.has(x.i) && x.d <= 22)
      .sort((a, b) => a.d - b.d)[0];
    if (!near) continue;
    used.add(near.i);
    balances[h.id] = near.n.value;
    if (near.n.unit && /^l/i.test(near.n.unit) && near.n.value >= 1000000) notes.push(`We read “${near.n.raw}” as ${near.n.value.toLocaleString('en-IN')} points. If you meant ${(near.n.value / 10).toLocaleString('en-IN')}, change it below.`);
  }
  for (const id of cardIds) if (!(id in balances)) notes.push(`We could not read a balance for ${cards.find(c => c.id === id)!.name}. Add it below.`);
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
  if (!dests.length) notes.push('We can plan Doha to the US for now. Tell us a US city.');

  const originName = Object.keys(CITIES).find(c => t.includes(c));
  const origin = originName ? CITIES[originName] : null;
  if (!origin) notes.push(`We used ${homeAirport} as your starting airport. The India to Doha leg stays flexible.`);

  const tm = /(\d+|one|two|three|four|five|six)\s*(?:people|persons|pax|travell?ers|adults|passengers|of us)/.exec(t) ?? /\bfor\s+(\d+|two|three|four)\b/.exec(t);
  const travellers = tm ? Math.min(9, WORDS[tm[1]] ?? +tm[1]) : 1;

  const cabin = 'business';
  if (/\b(first class|economy)\b/.test(t)) notes.push('The MVP plans business class only. We used business.');

  const fare = /(?:fare|cash|costs?|price)\D{0,14}?(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|l|k)?/i.exec(text);
  return {
    origin: origin ?? homeAirport, dests, month, travellers, cabin, mustProduct: /qsuite/.test(t) ? 'Qsuite' : null,
    cardIds, balances, cashFareInr: fare ? amountOf(fare[1], fare[2]) : null, notes,
  };
}
