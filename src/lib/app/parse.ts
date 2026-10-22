// Reads one trip sentence ("BOM to London, December, 2 people") with plain rules. No AI call.
// It never guesses silently: a missing or unclear piece comes back as ONE question with buttons.
import { AIRPORTS, GROUPS, INDIAN } from '@/lib/airports';
import { addDaysIso, monthLabel, todayIso } from '@/lib/app/format';
import type { Cabin } from '@/lib/app/api';
import { MAX_DAYS_OUT } from '@/lib/seats/sources';

export type Parsed = { o: string; d: string | null; ym: string | null; n: number; cabin: Cabin };
export type Question = { text: string; options: { label: string; patch: Partial<Parsed>; go?: boolean }[] };
export type ParseOut = { trip: Parsed; question: Question | null };

const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const REGION_WORDS: Record<string, string> = {
  europe: 'europe', 'middle east': 'middle-east', gulf: 'middle-east', 'north america': 'north-america', america: 'north-america', usa: 'north-america',
  'east asia': 'east-asia', 'southeast asia': 'southeast-asia', 'south east asia': 'southeast-asia', 'south asia': 'south-asia', oceania: 'oceania',
  australia: 'oceania', africa: 'africa', 'south america': 'south-america', japan: 'east-asia', thailand: 'southeast-asia',
};
const PLACE_ALIAS: Record<string, string> = { uk: 'LHR', uae: 'DXB', bombay: 'BOM', bangalore: 'BLR', madras: 'MAA', calcutta: 'CCU' };
const CABIN_WORDS: [RegExp, Cabin][] = [
  [/\bpremium economy\b/, 'premium_economy'], [/\bfirst( class)?\b/, 'first'], [/\bbusiness\b/, 'business'], [/\beconomy\b/, 'economy'],
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Hit = { at: number; value: string }; // value: IATA code or region id

// Every place named in the text, with its position. IATA codes must be typed in capitals.
function places(text: string): Hit[] {
  const low = norm(text);
  const hits: Hit[] = [];
  for (const m of text.matchAll(/\b[A-Z]{3}\b/g)) if (AIRPORTS.some(a => a.i === m[0])) hits.push({ at: m.index ?? 0, value: m[0] });
  for (const [w, id] of Object.entries(REGION_WORDS)) {
    const m = new RegExp(`\\b${esc(w)}\\b`).exec(low);
    if (m) hits.push({ at: m.index, value: id });
  }
  for (const [w, i] of Object.entries(PLACE_ALIAS)) {
    const m = new RegExp(`\\b${esc(w)}\\b`).exec(low);
    if (m) hits.push({ at: m.index, value: i });
  }
  for (const a of AIRPORTS) {
    const full = norm(a.c);
    const head = full.split(' ')[0];
    // "Tokyo Haneda" is also found by plain "Tokyo"
    const m = new RegExp(`\\b${esc(full)}\\b`).exec(low) ?? (head !== full && head.length >= 5 ? new RegExp(`\\b${esc(head)}\\b`).exec(low) : null);
    // "Tokyo" should pick the first Tokyo airport, so skip a longer name when a shorter one already hit at the same place
    if (m && !hits.some(h => h.at === m.index)) hits.push({ at: m.index, value: a.i });
  }
  return hits.sort((a, b) => a.at - b.at);
}

// The next time this month comes round, as YYYY-MM. The current month counts while it is still running.
const nextMonth = (monthIdx: number, today = todayIso()) => {
  let y = Number(today.slice(0, 4));
  if (monthIdx < Number(today.slice(5, 7)) - 1) y += 1;
  return `${y}-${String(monthIdx + 1).padStart(2, '0')}`;
};

export const upcomingMonths = (count = 3, today = todayIso()) => {
  const out: string[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

export function parseTrip(text: string, home = 'BOM', today = todayIso()): ParseOut {
  const low = norm(text);
  const trip: Parsed = { o: INDIAN.includes(home) ? home : 'BOM', d: null, ym: null, n: 1, cabin: 'business' };

  for (const [re, c] of CABIN_WORDS) {
    if (re.test(low)) {
      trip.cabin = c;
      break;
    }
  }
  const people = /(\d{1,2})\s*(people|persons?|travell?ers?|pax|adults?|of us)\b/.exec(low) ?? /\bfor\s+(\d{1,2})\b/.exec(low);
  if (people) trip.n = Math.min(9, Math.max(1, Number(people[1])));
  else if (/\b(couple|two of us)\b/.test(low)) trip.n = 2;

  // places: split on " to " when there is one, else first Indian airport is the origin
  const all = places(text);
  const split = /\s(to|->|→)\s/.exec(low);
  const left = split ? all.filter(h => h.at < split.index) : [];
  const right = split ? all.filter(h => h.at > split.index) : [];
  const originHit = split ? left.find(h => INDIAN.includes(h.value)) ?? left[0] : all.find(h => INDIAN.includes(h.value));
  if (originHit && !GROUPS.some(g => g.id === originHit.value)) trip.o = originHit.value;
  const destHit = split ? right[0] : all.find(h => h !== originHit && h.value !== trip.o && !INDIAN.includes(h.value)) ?? all.find(h => h !== originHit && h.value !== trip.o);
  if (destHit && destHit.value !== trip.o) trip.d = destHit.value;

  // month: a name, or "next month"
  const words = low.match(/[a-z]+/g) ?? [];
  const mi = words.map(w => FULL_MONTHS.findIndex((f, i) => f === w || MONTH_WORDS[i] === w || (i === 8 && w === 'sept'))).find(i => i >= 0);
  if (mi !== undefined) trip.ym = nextMonth(mi, today);
  else if (/\bnext month\b/.test(low)) trip.ym = upcomingMonths(2, today)[1];

  return { trip, question: askNext(trip, today) };
}

// The one thing still missing, or null when the trip is ready to plan.
export function askNext(trip: Parsed, today = todayIso(), farOk = false): Question | null {
  if (!trip.d) {
    const regions = ['europe', 'middle-east', 'north-america', 'southeast-asia', 'east-asia'];
    return { text: 'Where do you want to go?', options: regions.map(id => ({ label: GROUPS.find(g => g.id === id)?.label ?? id, patch: { d: id } })) };
  }
  if (!trip.ym) return { text: 'Which month?', options: upcomingMonths(3, today).map(ym => ({ label: monthLabel(ym), patch: { ym } })) };
  // Seats are only searched MAX_DAYS_OUT days out. A month past that gets a question, never a silent empty page.
  if (!farOk && trip.ym > addDaysIso(MAX_DAYS_OUT, today).slice(0, 7)) {
    return {
      text: `We only see seats about ${MAX_DAYS_OUT} days ahead, so ${monthLabel(trip.ym)} may show nothing. Which do you want?`,
      options: [{ label: `Search ${monthLabel(trip.ym)} anyway`, patch: { ym: trip.ym }, go: true }, ...upcomingMonths(3, today).map(ym => ({ label: monthLabel(ym), patch: { ym } }))],
    };
  }
  return null;
}
