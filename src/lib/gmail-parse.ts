// Rules for pulling a points balance out of a bank or loyalty-programme email. Pure functions: no network, no storage.
// Only emails from known sender domains are read, and a balance counts only when the sentence says balance, available or closing.
// What leaves this module is the number, the sender, the subject and the date. Email text is never kept or returned.

export type Sender = { kind: 'bank'; bank: string } | { kind: 'programme'; programmeId: string };

const DOMAINS: [string, Sender][] = [
  ['hdfcbank.net', { kind: 'bank', bank: 'hdfc' }], ['hdfcbank.com', { kind: 'bank', bank: 'hdfc' }],
  ['axisbank.com', { kind: 'bank', bank: 'axis' }],
  ['americanexpress.com', { kind: 'bank', bank: 'amex' }], ['aexp.com', { kind: 'bank', bank: 'amex' }],
  ['hsbc.co.in', { kind: 'bank', bank: 'hsbc' }], ['hsbc.com', { kind: 'bank', bank: 'hsbc' }],
  ['sbicard.com', { kind: 'bank', bank: 'sbi' }],
  ['icicibank.com', { kind: 'bank', bank: 'icici' }],
  ['yesbank.in', { kind: 'bank', bank: 'yes' }],
  ['indusind.com', { kind: 'bank', bank: 'indusind' }],
  ['kotak.com', { kind: 'bank', bank: 'kotak' }],
  ['aubank.in', { kind: 'bank', bank: 'au' }],
  ['rblbank.com', { kind: 'bank', bank: 'rbl' }],
  ['jupiter.money', { kind: 'bank', bank: 'jupiter' }],
  ['qatarairways.com', { kind: 'programme', programmeId: 'qatar-privilege-club' }],
  ['airindia.com', { kind: 'programme', programmeId: 'air-india' }], ['airindia.in', { kind: 'programme', programmeId: 'air-india' }],
  ['singaporeair.com', { kind: 'programme', programmeId: 'krisflyer' }],
  ['emirates.com', { kind: 'programme', programmeId: 'emirates-skywards' }],
  ['etihad.com', { kind: 'programme', programmeId: 'etihad-guest' }],
  ['ba.com', { kind: 'programme', programmeId: 'ba-executive-club' }], ['britishairways.com', { kind: 'programme', programmeId: 'ba-executive-club' }],
  ['flyingblue.com', { kind: 'programme', programmeId: 'flying-blue' }], ['airfrance.com', { kind: 'programme', programmeId: 'flying-blue' }], ['klm.com', { kind: 'programme', programmeId: 'flying-blue' }],
  ['virginatlantic.com', { kind: 'programme', programmeId: 'virgin-flyingclub' }],
  ['cathaypacific.com', { kind: 'programme', programmeId: 'cathay-asiamiles' }],
  ['united.com', { kind: 'programme', programmeId: 'united-mileageplus' }],
  ['aa.com', { kind: 'programme', programmeId: 'aa-rewards' }],
  ['turkishairlines.com', { kind: 'programme', programmeId: 'turkish-ms' }],
  ['miles-and-more.com', { kind: 'programme', programmeId: 'miles-and-more' }], ['lufthansa.com', { kind: 'programme', programmeId: 'miles-and-more' }],
  ['finnair.com', { kind: 'programme', programmeId: 'finnair-plus' }],
  ['aircanada.com', { kind: 'programme', programmeId: 'aeroplan' }],
  ['thaiairways.com', { kind: 'programme', programmeId: 'thai-royalorchid' }],
  ['goindigo.in', { kind: 'programme', programmeId: 'indigo-bluchip' }],
  ['spicejet.com', { kind: 'programme', programmeId: 'spiceclub' }],
  ['qantas.com', { kind: 'programme', programmeId: 'qantas-ff' }],
  ['saudia.com', { kind: 'programme', programmeId: 'saudia-alfursan' }],
  ['ana.co.jp', { kind: 'programme', programmeId: 'ana-mileage-club' }],
  ['jal.com', { kind: 'programme', programmeId: 'jal-mileage-bank' }],
  ['ghadiscovery.com', { kind: 'programme', programmeId: 'gha-discovery' }],
];

export const SENDER_DOMAINS = DOMAINS.map(d => d[0]);

export function senderOf(from: string): Sender | null {
  // only the real address counts: the one in <angle brackets>, or the whole header when it is a bare address. A display name like "x@hdfcbank.net" proves nothing.
  const addr = from.match(/<([^<>]+)>\s*$/)?.[1] ?? from.trim();
  const host = (addr.match(/^[^@\s"<>]+@([a-z0-9.-]+)$/i)?.[1] ?? '').toLowerCase();
  const hit = DOMAINS.filter(([d]) => host === d || host.endsWith(`.${d}`)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}

const NUM = String.raw`(?<![\d,.])([\d]{1,3}(?:,\d{2,3})+|\d{3,9})`;
const UNIT = String.raw`(?:reward |edge |bonus |mr |membership rewards? |avios |skywards |krisflyer |flying blue |privilege club |maharaja )?(?:points?|miles|pts|avios|rps?)`;
// Each pattern needs balance, available or closing next to the number, so "you earned 250 points" never counts.
const PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:closing|available|total|current|reward|points?|miles|avios)\s+balance[^\d\n]{0,30}?${NUM}`, 'i'),
  new RegExp(String.raw`balance(?: of| is| as on [^\d\n]{0,20})?[^\d\n]{0,30}?${NUM}\s*${UNIT}`, 'i'),
  new RegExp(String.raw`${NUM}\s*${UNIT}\s*(?:are |is |remain |remaining )?(?:available|in your account|as your balance|closing balance)`, 'i'),
  new RegExp(String.raw`(?:you have|your account has|you currently have)\s*${NUM}\s*${UNIT}`, 'i'),
  // "Balance as on 01/02/2026 is 5,000 points": the date sits between the word and the number
  new RegExp(String.raw`balance as (?:on|of) \d{1,2}[/\-. ][A-Za-z0-9]{1,9}[/\-. ]\d{2,4},? (?:is |was |: ?)?${NUM}`, 'i'),
  // small balances ("balance: 12 points") that the three-digit rule above skips; the unit is required
  new RegExp(String.raw`balance[^\d\n]{0,30}?(?<![\d,.])(\d{1,2})\s*${UNIT}\b`, 'i'),
  // GHA DISCOVERY writes balances as "D$ 45.50": small and with cents, which the whole-number patterns above miss
  /(?:balance|available)[^\d\n]{0,30}?D\$\s*(\d[\d,]*)(?:\.\d+)?/i,
  /D\$\s*(\d[\d,]*)(?:\.\d+)?\s*(?:available|balance|in your account)/i,
];

export function extractBalance(text: string): number | null {
  const flat = text.slice(0, 20000).replace(/\s+/g, ' '); // a balance sits near the top of an email; the cap keeps hostile text from stalling the regexes
  for (const re of PATTERNS) {
    const m = flat.match(re);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 0 && n < 1_000_000_000) return n;
  }
  return null;
}

export type CatalogCard = { id: string; bank: string; name: string };
export type EmailIn = { from: string; subject: string; date: string; text: string };
export type Finding = {
  key: string; // one per bank or programme: the newest email wins
  kind: 'bank' | 'programme';
  bank: string | null; // for bank emails: which bank
  programmeId: string | null; // for loyalty emails: the programme
  cardId: string | null; // a card named in the email, when one is
  balance: number; date: string; subject: string; from: string;
};

export function parseEmail(mail: EmailIn, cards: CatalogCard[]): Finding | null {
  const sender = senderOf(mail.from);
  if (!sender) return null;
  const balance = extractBalance(`${mail.subject}. ${mail.text}`);
  if (balance === null) return null;
  let cardId: string | null = null;
  if (sender.kind === 'bank') {
    const text = ` ${`${mail.subject} ${mail.text}`.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
    const named = cards.filter(c => c.bank === sender.bank && text.includes(` ${c.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')} `));
    // the longest name wins, so "Magnus Burgundy" beats "Magnus"
    cardId = named.sort((a, b) => b.name.length - a.name.length)[0]?.id ?? null;
  }
  return {
    key: sender.kind === 'bank' ? `bank:${sender.bank}:${cardId ?? ''}` : `programme:${sender.programmeId}`,
    kind: sender.kind, bank: sender.kind === 'bank' ? sender.bank : null, programmeId: sender.kind === 'programme' ? sender.programmeId : null,
    cardId, balance, date: mail.date, subject: mail.subject.slice(0, 120), from: mail.from.replace(/^.*</, '').replace(/>.*$/, '').slice(0, 80),
  };
}

// Newest email per key.
export function newestPerKey(list: Finding[]): Finding[] {
  const best = new Map<string, Finding>();
  for (const f of list) {
    const cur = best.get(f.key);
    if (!cur || f.date > cur.date) best.set(f.key, f);
  }
  return [...best.values()];
}

// Gmail API message part -> plain text. HTML is stripped; only text/plain and text/html parts are read.
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
const decode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
export function messageText(part: Part | undefined): string {
  if (!part) return '';
  const own = part.body?.data && (part.mimeType === 'text/plain' || part.mimeType === 'text/html') ? decode(part.body.data) : '';
  const text = part.mimeType === 'text/html' ? own.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') : own;
  return `${text} ${(part.parts ?? []).map(messageText).join(' ')}`;
}
