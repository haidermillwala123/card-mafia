// Turns a booking link into one that opens the airline's award search already filled in: route, date, passengers and cabin.
// seats.aero's own links are filled in for most programmes, but they leave passengers at 1, often leave the cabin at economy, and for a few
// programmes (Qatar, Singapore, Turkish, LifeMiles and others) are only the airline's front page. This module checks each link, sets the
// passengers and cabin where the format is known, and swaps in our own link where the supplied one is not filled in.
import type { Cabin } from './sources';

export type LinkInput = { source: string; url: string; origin: string; dest: string; date: string; cabin: Cabin; n: number };

const has = (text: string, o: string, d: string) => {
  const t = text.toUpperCase();
  return t.includes(o) && t.includes(d);
};

// True when the link already carries this route, in plain text or inside the base64 request some sites (Emirates) use.
export function carriesRoute(url: string, origin: string, dest: string): boolean {
  let plain = url;
  try { plain = decodeURIComponent(url); } catch { /* keep the raw text */ }
  if (has(plain, origin, dest)) return true;
  try {
    const packed = new URL(url).searchParams.get('searchRequest');
    return Boolean(packed && has(Buffer.from(packed, 'base64').toString('utf8'), origin, dest));
  } catch {
    return false;
  }
}

const mmddyyyy = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const dateFormats = { iso: (d: string) => d, mmddyyyy, ddmmyyyy, compact: (d: string) => d.replaceAll('-', '') };

// Set passengers (and cabin where the format is known) on a link the source already filled in.
const PATCH: Record<string, (u: URL, i: LinkInput) => void> = {
  alaska: (u, i) => u.searchParams.set('A', String(i.n)),
  american: (u, i) => { u.searchParams.set('pax', String(i.n)); u.searchParams.set('adult', String(i.n)); },
  united: (u, i) => u.searchParams.set('px', String(i.n)),
  qantas: (u, i) => u.searchParams.set('adults', String(i.n)),
  aeroplan: (u, i) => u.searchParams.set('ADT', String(i.n)),
  virginatlantic: (u, i) => u.searchParams.set('passengers', `a${i.n}t0c0i0`),
  british: (u, i) => {
    u.searchParams.set('NumberOfAdults', String(i.n));
    u.searchParams.set('CabinCode', { economy: 'M', premium_economy: 'W', business: 'C', first: 'F' }[i.cabin]);
  },
  delta: (u, i) => u.searchParams.set('passengerInfo', `ADT:${i.n}`),
  flyingblue: (u, i) => {
    u.searchParams.set('pax', `${i.n}:0:0:0:0:0:0:0`);
    u.searchParams.set('cabinClass', { economy: 'ECONOMY', premium_economy: 'PREMIUM', business: 'BUSINESS', first: 'FIRST' }[i.cabin]);
  },
  lufthansa: (u, i) => u.searchParams.set('adults', String(i.n)),
  smiles: (u, i) => u.searchParams.set('adults', String(i.n)),
  emirates: (u, i) => {
    const packed = u.searchParams.get('searchRequest');
    if (!packed) return;
    const req = JSON.parse(Buffer.from(packed, 'base64').toString('utf8')) as { passengers?: { type: string; count: number }[]; segments?: { cabinClass?: string }[] };
    if (req.passengers?.[0]) req.passengers[0].count = i.n;
    if (req.segments?.[0]) req.segments[0].cabinClass = { economy: 'Y', premium_economy: 'W', business: 'J', first: 'F' }[i.cabin];
    u.searchParams.set('searchRequest', Buffer.from(JSON.stringify(req)).toString('base64'));
  },
};

// Our own filled-in links, for programmes where the supplied link is only a front page. Each returns null when it cannot build one.
// Filled in from checked examples; a programme not listed here keeps the supplied link and the page says it opens a general page.
const BUILD: Record<string, (i: LinkInput) => string | null> = {};

// Which programme a partner link belongs to, from its address, so the passengers and cabin can be set on it too.
const HOSTS: [string, string][] = [
  ['aircanada.com', 'aeroplan'], ['united.com', 'united'], ['aa.com', 'american'], ['delta.com', 'delta'], ['alaskaair.com', 'alaska'],
  ['qantas.com', 'qantas'], ['virginatlantic.com', 'virginatlantic'], ['britishairways.com', 'british'], ['emirates.com', 'emirates'],
  ['airfrance.us', 'flyingblue'], ['airfrance.com', 'flyingblue'], ['miles-and-more.com', 'lufthansa'], ['smiles.com.br', 'smiles'], ['virginaustralia.com', 'velocity'],
];
export function sourceOf(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return HOSTS.find(([h]) => host === h || host.endsWith(`.${h}`))?.[1] ?? null;
  } catch {
    return null;
  }
}

export type FinalLink = { url: string; prefilled: boolean };

export function finalLink(i: LinkInput): FinalLink {
  const filled = carriesRoute(i.url, i.origin, i.dest);
  if (!filled) {
    const own = BUILD[i.source]?.(i) ?? null;
    return own ? { url: own, prefilled: true } : { url: i.url, prefilled: false };
  }
  try {
    const patch = PATCH[i.source];
    if (!patch) return { url: i.url, prefilled: true };
    // a few sites keep their search in the part after "#", which the URL parser does not treat as parameters: set passengers there by hand
    if (i.source === 'velocity') return { url: i.url.replace(/ADT=\d+/, `ADT=${i.n}`), prefilled: true };
    const u = new URL(i.url);
    patch(u, i);
    return { url: u.toString(), prefilled: true };
  } catch {
    return { url: i.url, prefilled: true };
  }
}
