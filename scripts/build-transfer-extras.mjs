// Builds src/data/transfer_limits.json and src/data/indirect_routes.json from awardscope/research (read-only).
// Run: node scripts/build-transfer-extras.mjs
// Rules: no number is invented or altered. null = not found, never "no limit". A research card joins an app card only at >=90% name match.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const RES = new URL('../../awardscope/research/', import.meta.url);
const OUT = new URL('../src/data/', import.meta.url);
const readJson = u => JSON.parse(readFileSync(u, 'utf8'));
const appCards = readJson(new URL('cards.json', OUT)).cards;

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
function sim(a, b) {
  if (a === b) return 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

// ---- research cards
const files = readdirSync(new URL('cards/', RES)).filter(f => f.endsWith('.json')).sort();
const research = files.flatMap(f => {
  const g = readJson(new URL(`cards/${f}`, RES));
  return g.cards.map(c => ({ ...c, _file: f, _verified: g.lastVerified, _groupNotes: g.groupNotes ?? null }));
});

// ---- match: best app card per research card, each app card used once
const nameToId = new Map();
const matched = new Map();
const unmatchedResearch = [];
for (const r of research) {
  const key = norm(r.card);
  const scored = appCards.map(c => ({ c, s: sim(key, norm(c.bank + c.name)) })).sort((x, y) => y.s - x.s);
  const top = scored[0];
  const tie = scored[1] && scored[1].s === top.s;
  if (top.s < 0.9 || tie || matched.has(top.c.id)) { unmatchedResearch.push(`${r.card} (best ${top.c.id} ${(top.s * 100).toFixed(0)}%${tie ? ', tie' : ''}${matched.has(top.c.id) ? ', already taken' : ''})`); continue; }
  matched.set(top.c.id, { r, score: top.s });
  nameToId.set(r.card, top.c.id);
}

const limits = {};
for (const [id, { r, score }] of matched) {
  const t = r.transferLimits;
  limits[id] = {
    research_name: r.card,
    match_pct: Math.round(score * 100),
    currency: r.currency ?? null,
    last_verified: r._verified,
    confidence: r.confidence ?? null,
    fees: { joining: r.fees?.joining ?? null, annual: r.fees?.annual ?? null, source: r.fees?.source ?? null },
    limits: { daily: t.daily, weekly: t.weekly, monthly: t.monthly, annual: t.annual },
    min_transfer: t.minTransfer, multiple_of: t.multipleOf, transfer_fee: t.fee, per_partner: t.perPartner,
    notes: t.notes ?? null,
    conflicts: r.conflicts ?? [],
    group_notes: r._groupNotes,
    sources: t.sources ?? [],
  };
}
const noResearch = appCards.filter(c => !matched.has(c.id)).map(c => c.id);

// ---- indirect routes (bestPerCardDestination has one row per card+destination)
const ind = readJson(new URL('indirect-routes.json', RES));
const routes = {};
const unmatchedIndirect = new Set();
for (const x of ind.bestPerCardDestination) {
  const id = nameToId.get(x.card);
  if (!id) { unmatchedIndirect.add(x.card); continue; }
  (routes[id] ??= []).push({ via: x.via, to: x.to, leg1: x.leg1, leg2: x.leg2, effective: x.effective, cost: x.cost, time: x.time, caps: x.caps, notes: [...new Set(x.notes)], direct: x.direct, beats_direct: x.beatsDirect });
}
for (const id of Object.keys(routes)) routes[id].sort((a, b) => a.cost - b.cost);

writeFileSync(new URL('transfer_limits.json', OUT), JSON.stringify({
  note: 'From the awardscope research run. null means NOT FOUND, never "no limit". Each item keeps its source and confidence.',
  last_verified: research.map(r => r._verified).sort().at(-1),
  cards: limits,
}, null, 1) + '\n');
writeFileSync(new URL('indirect_routes.json', OUT), JSON.stringify({
  note: 'Two-leg chains composed from points.casa pair ratios. beats_direct is null when the card has no direct route to that programme. Confidence is not stated by the research for routes.',
  last_verified: ind.lastVerified,
  source_url: 'https://points.casa/tools/transfer-calculator/',
  cards: routes,
}, null, 1) + '\n');

console.log(`research cards: ${research.length}, matched: ${matched.size}, unmatched research: ${unmatchedResearch.length}`);
unmatchedResearch.forEach(s => console.log('  UNMATCHED research card:', s));
console.log(`app cards: ${appCards.length}, with research: ${matched.size}, without: ${noResearch.length}`);
noResearch.forEach(s => console.log('  NO RESEARCH for app card:', s));
console.log(`indirect: ${Object.values(routes).reduce((n, a) => n + a.length, 0)} routes over ${Object.keys(routes).length} cards; unmatched indirect card names: ${[...unmatchedIndirect].join(', ') || 'none'}`);
console.log(`beatsDirect true: ${Object.values(routes).flat().filter(r => r.beats_direct === true).length}; no direct: ${Object.values(routes).flat().filter(r => r.beats_direct === null).length}`);
