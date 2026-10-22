// Merges the researched earn files into src/data/earn_rules.json. Numbers are copied verbatim; only tags and flags are added.
// Run: node scripts/build-earn.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const SRC = new URL('../../awardscope/research/earn/', import.meta.url);
const OUT = new URL('../src/data/earn_rules.json', import.meta.url);
const known = new Set(JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8')).cards.map(c => c.id));

// first match wins per tag, a row may carry several tags; nothing matched -> other
const CAT_RULES = [
  ['general', /^\s*(all|general|every)\b/i],
  ['travel_portal', /travel|portal|smartbuy|flight|hotel|airline|air india|\bedge\b|ishop|unbox|nova|lumiere|train|railway/i],
  ['international', /international|overseas|forex|foreign/i],
  ['dining', /dining|restaurant|food|swiggy|zomato/i],
  ['groceries', /grocer|supermarket|departmental|department store|retail shopping/i],
  ['online', /online|e-?com|shopping|amazon|flipkart|myntra|nykaa/i],
  ['utilities', /utilit|telecom|\bbills?\b|cable|pay-tv|streaming|bbps/i],
  ['insurance', /insur/i],
  ['fuel', /fuel|petrol/i],
  ['rent', /\brent|real estate|rental/i],
  ['education', /educat|school|college/i],
];
const tag = text => {
  const t = CAT_RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
  return t.length ? t : ['other'];
};

// An exclusion only zeroes a category when it really means "no points". Capped, reduced or conditional rows stay informational.
const SOFT = /capped|reduced|lower rate|\bonly\b|third-party|no accelerated|surcharge|\bfirst\b|per statement cycle|common exclusions/i;
const SECONDARY_HOSTS = /cardadvisor|cardinsider|paisabazaar|bankbazaar|aurumcreditcard|finanjo/i;
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const cards = {};
let checked_on = '';
for (const f of readdirSync(SRC).filter(f => f.endsWith('.json')).sort()) {
  const j = JSON.parse(readFileSync(new URL(f, SRC), 'utf8'));
  if (j.checked_on > checked_on) checked_on = j.checked_on;
  for (const c of j.cards) {
    if (!known.has(c.card_id)) throw new Error(`unknown card id ${c.card_id}`);
    const rawBase = c.base_earn.points_per_100_inr;
    const base_earn = { ...c.base_earn, points_per_100_inr: num(rawBase), raw: rawBase ?? null };
    const accelerated = c.accelerated.map(a => {
      const row = { ...a, cat: tag(a.category), points_per_100_inr: num(a.points_per_100_inr), monthly_cap_points: num(a.monthly_cap_points) };
      if (num(a.points_per_100_inr) === null && a.points_per_100_inr != null) row.raw_points_per_100_inr = a.points_per_100_inr;
      if (num(a.monthly_cap_points) === null && a.monthly_cap_points != null) row.raw_monthly_cap_points = a.monthly_cap_points;
      return row;
    });
    const exclusions = c.exclusions.map(e => {
      const zero = !SOFT.test(`${e.category} ${e.note}`);
      return { ...e, cat: tag(e.category).filter(x => x !== 'other'), zero };
    });
    const baseSecondary = SECONDARY_HOSTS.test(base_earn.source_url ?? '');
    const accOfficial = accelerated.filter(a => a.source_kind === 'official').length;
    const accSecondary = accelerated.length - accOfficial;
    const source_quality =
      !baseSecondary && !accSecondary ? 'official' : baseSecondary && !accOfficial ? 'secondary' : 'mixed';
    const text = `${c.notes ?? ''}`;
    const flags = [
      /conflict|disagree|discrepan|contradict/i.test(text) && 'conflict_in_notes',
      /derived/i.test(JSON.stringify([c.accelerated, c.base_earn, c.notes])) && 'derived_points',
      c.confidence === 'low' && 'low_confidence',
      base_earn.points_per_100_inr === null && 'base_rate_not_found',
      accelerated.length === 0 && 'no_accelerated_rows',
      accSecondary > 0 && 'secondary_accelerated',
      accelerated.some(a => a.points_per_100_inr === null) && 'accelerated_rate_not_found',
    ].filter(Boolean);
    cards[c.card_id] = { ...c, base_earn, accelerated, exclusions, source_quality, flags };
  }
}

writeFileSync(OUT, JSON.stringify({ checked_on, cards }, null, 1) + '\n');

// coverage stats
const all = Object.values(cards);
const rows = all.flatMap(c => c.accelerated);
const count = (xs, f) => xs.filter(f).length;
const by = k => all.reduce((m, c) => ((m[c[k]] = (m[c[k]] ?? 0) + 1), m), {});
console.log(`cards ${all.length}/${known.size}, checked_on ${checked_on}`);
console.log('confidence', by('confidence'), 'source_quality', by('source_quality'));
console.log(`base rate present ${count(all, c => c.base_earn.points_per_100_inr !== null)}/${all.length}`);
console.log(`accelerated rows ${rows.length}: rate present ${count(rows, a => a.points_per_100_inr !== null)}, cap present ${count(rows, a => a.monthly_cap_points !== null)}, secondary ${count(rows, a => a.source_kind !== 'official')}, tagged other-only ${count(rows, a => a.cat.length === 1 && a.cat[0] === 'other')}`);
console.log('complete (base + >=1 accelerated, all rates present):', count(all, c => c.base_earn.points_per_100_inr !== null && c.accelerated.length && c.accelerated.every(a => a.points_per_100_inr !== null)));
console.log('low confidence:', all.filter(c => c.confidence === 'low').map(c => c.card_id).join(', '));
console.log('secondary-only:', all.filter(c => c.source_quality === 'secondary').map(c => c.card_id).join(', '));
console.log('flags', all.flatMap(c => c.flags).reduce((m, f) => ((m[f] = (m[f] ?? 0) + 1), m), {}));
console.log('cat counts', rows.flatMap(a => a.cat).reduce((m, f) => ((m[f] = (m[f] ?? 0) + 1), m), {}));
