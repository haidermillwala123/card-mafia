// Turns the text of a credit card statement (pasted, or pulled from a PDF) into monthly spend by category.
// Pure functions: no network, no storage. Categories come from merchant keywords, so they are a best guess the person can correct.
import type { Cat } from './earn.ts';

export type Txn = { date: string; desc: string; amount: number; cat: Cat; foreign: boolean };
export type Parsed = { txns: Txn[]; skipped: number; from: string | null; to: string | null };

// Merchant keywords, first match wins, so the specific rules (grocery apps) sit above the broad ones (food).
const RULES: [Cat, RegExp][] = [
  ['fuel', /\b(indian ?oil|iocl|hpcl|hp ?petrol|bpcl|bharat petroleum|shell|nayara|reliance ?petro|petrol|fuel|essar oil)\b/i],
  ['groceries', /(bigbasket|blinkit|zepto|instamart|dmart|avenue supermarts|reliance (fresh|smart|retail)|more retail|spencer|nature'?s basket|jiomart|grofers|supermarket|grocer|licious|country delight|milkbasket|star bazaar|nilgiri)/i],
  ['dining', /(swiggy|zomato|dineout|eazydiner|restaurant|cafe|coffee|starbucks|mcdonald|kfc|domino|pizza|burger|barbeque|biryani|bakery|dunkin|haldiram|chaayos|subway|dhaba|kitchen|food)/i],
  ['travel_portal', /(makemytrip|goibibo|cleartrip|yatra|ixigo|easemytrip|irctc|indigo|interglobe|air india|vistara|akasa|spicejet|airasia|emirates|qatar airways|singapore air|lufthansa|british airways|booking\.com|agoda|airbnb|oyo|taj hotels|marriott|hyatt|ihg|hilton|thomas ?cook)/i],
  ['insurance', /(insurance|lic of india|lic premium|hdfc life|icici pru|sbi life|max life|star health|care health|niva bupa|bajaj allianz|policybazaar|acko|tata aig)/i],
  ['rent', /(\brent\b|nobroker|nestaway|cred rent|paytm rent|rentpay|rentomojo)/i],
  ['education', /(school|college|university|tuition|byju|unacademy|coursera|udemy|vedantu|upgrad|institute|academy)/i],
  ['utilities', /(electricity|bescom|msedcl|tata power|adani electricity|bses|torrent power|mahanagar gas|indane|piped gas|water bill|airtel|jio|vodafone|\bvi\b|bsnl|act fibernet|hathway|broadband|\bdth\b|tata play|recharge|billdesk|bbps|postpaid)/i],
  ['online', /(amazon|flipkart|myntra|ajio|nykaa|meesho|tata ?cliq|snapdeal|lenskart|bookmyshow|netflix|spotify|apple\.com|google|youtube|decathlon|ikea|croma)/i],
];
const CURRENCY = /\b(USD|EUR|GBP|AED|SGD|THB|JPY|AUD|CAD|CHF|HKD|MYR|IDR|NZD|SAR|QAR|ZAR)\b/;
// Lines that are not spending: payments and credits, fees and interest.
const NOT_SPEND = /(payment (received|thank)|thank you|refund|reversal|cashback|cash back|auto ?debit|\bemi\b|interest|finance charge|late (payment )?(fee|charge)|annual fee|joining fee|renewal fee|\bgst\b|\bigst\b|\bcgst\b|\bsgst\b|processing fee|card fee|surcharge|fuel surcharge waiver)/i;

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
const pad = (n: string | number) => String(n).padStart(2, '0');
const year = (y: string) => (y.length === 2 ? `20${y}` : y);

const DATE_NUM = /^\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
const DATE_TXT = /^\s*(\d{1,2})[ \-]([A-Za-z]{3})[a-z]*[ \-,]+(\d{2,4})\b/;
const AMOUNT = /(?:(?:₹|Rs\.?|INR|C)\s*)?(-?\d{1,3}(?:,\d{2,3})*\.\d{2}|-?\d+\.\d{2}|-?\d{1,3}(?:,\d{2,3})+)(?:\s*(Cr|CR|cr|Dr|DR|dr))?\s*$/;

export function categorize(desc: string): { cat: Cat; foreign: boolean } {
  const foreign = CURRENCY.test(desc);
  if (foreign) return { cat: 'international', foreign: true };
  for (const [cat, re] of RULES) if (re.test(desc)) return { cat, foreign: false };
  return { cat: 'general', foreign: false };
}

function isoDate(line: string): { iso: string; rest: string } | null {
  let m = line.match(DATE_NUM);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), year(m[3])];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return { iso: `${y}-${pad(mo)}-${pad(d)}`, rest: line.slice(m[0].length) };
  }
  m = line.match(DATE_TXT);
  if (m && MONTHS[m[2].toLowerCase()]) return { iso: `${year(m[3])}-${MONTHS[m[2].toLowerCase()]}-${pad(m[1])}`, rest: line.slice(m[0].length) };
  return null;
}

export function parseStatementText(text: string): Parsed {
  const txns: Txn[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const d = isoDate(line);
    if (!d) continue;
    const a = d.rest.match(AMOUNT);
    if (!a) continue;
    const amount = Number(a[1].replace(/,/g, ''));
    const desc = d.rest.slice(0, a.index).replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/[|]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !desc) continue;
    if (/^cr$/i.test(a[2] ?? '') || NOT_SPEND.test(desc)) { skipped++; continue; }
    txns.push({ date: d.iso, desc: desc.slice(0, 80), amount, ...categorize(desc) });
  }
  const dates = txns.map(t => t.date).sort();
  return { txns, skipped, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}

// Months the statement covers, at least one: a one-month statement is a month, not 28 days.
export function monthsCovered(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  return Math.max(1, Math.round((days / 30.44) * 10) / 10);
}

// Average monthly spend per category over the statement, for the transactions that are switched on.
export function monthlySpend(txns: Txn[], months: number): Partial<Record<Cat, number>> {
  const out: Partial<Record<Cat, number>> = {};
  for (const t of txns) out[t.cat] = (out[t.cat] ?? 0) + t.amount;
  for (const k of Object.keys(out) as Cat[]) out[k] = Math.round((out[k] ?? 0) / months);
  return out;
}
