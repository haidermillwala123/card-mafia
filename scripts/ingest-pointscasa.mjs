// Rebuilds src/data/{programmes,cards,transfer_rules}.json from the research output in awardscope/data/transfers/pointscasa.json
// (87 currencies, 814 transfer pairs, 21 Oct 2026) and writes the same data as SQL for the database.
// Run: node scripts/ingest-pointscasa.mjs <out-dir-for-sql>
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('../../awardscope/data/transfers/pointscasa.json', import.meta.url);
const OUT = new URL('../src/data/', import.meta.url);
const sqlDir = process.argv[2] ?? '.';
const src = JSON.parse(readFileSync(SRC, 'utf8'));
const CHECKED = src.lastVerified;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const NODE = { qatar_avios: 'qatar-privilege-club', ba_avios: 'ba-executive-club', finnair_plus: 'finnair-plus' };
const NAME = {
  'qatar-privilege-club': 'Qatar Airways Privilege Club', 'ba-executive-club': 'British Airways Executive Club', 'finnair-plus': 'Finnair Plus',
  aerclub: 'AerClub', iberia_club: 'Iberia Club', vueling_club: 'Vueling Club', smiles_gol: 'Smiles (GOL)', tap_miles_go: 'TAP Miles&Go', juneyao_air: 'Juneyao Club',
  latam_pass: 'LATAM Pass', skypass: 'SkyPass', phoenix_miles: 'Phoenix Miles', delta_skymiles: 'Delta SkyMiles', miles_bonus: 'Miles & Bonus',
  aeromexico_rewards: 'Aeromexico Rewards', velocity: 'Velocity', falconflyer: 'FalconFlyer', suma: 'Suma', eastern_miles: 'Eastern Miles',
  ana_mileage_club: 'ANA Mileage Club', enrich: 'Enrich', trueblue: 'TrueBlue', sky_pearl_club: 'Sky Pearl Club', voyager: 'Voyager',
  american_airlines_aadvantage: 'AAdvantage', atmos_rewards: 'Atmos Rewards', asiana_club: 'Asiana Club', connectmiles: 'ConnectMiles',
  flipkart_supercoins: 'Flipkart SuperCoins', frontier_miles: 'Frontier Miles', rapid_rewards: 'Rapid Rewards', sas_eurobonus: 'SAS EuroBonus', rove_miles: 'Rove Miles',
};
const NON_AIRLINE = new Set(['rove_miles', 'flipkart_supercoins', 'suma']); // unlisted in the source: loyalty schemes, not airlines
const listed = new Map(src.programmes.map(p => [p.id, p]));
const nodeId = id => NODE[id] ?? id.replace(/_/g, '-');

// Cards the product already knows by id keep that id.
const CARD_ID = {
  'HDFC Infinia': 'hdfc-infinia', 'HDFC Diners Club Black': 'hdfc-diners', 'HDFC Regalia Gold': 'hdfc-regalia-gold', 'Axis Atlas': 'axis-atlas', 'Axis Magnus': 'axis-magnus',
  'Axis Reserve': 'axis-reserve', 'Axis Horizon': 'axis-horizon', 'Amex Platinum Travel': 'amex-plat-travel', 'Amex Gold': 'amex-gold', 'Amex Platinum': 'amex-plat',
  'HSBC Premier': 'hsbc-premier', 'HSBC TravelOne': 'hsbc-travel-one', 'HSBC VisaPlatinum': 'hsbc-visa-platinum', 'SBI Miles': 'sbi-miles', 'SBI Miles Prime': 'sbi-miles-prime',
  'SBI Miles Elite': 'sbi-miles-elite', 'SBI Aurum': 'sbi-aurum', 'ICICI Emeralde Private Metal': 'icici-emeralde-private-metal',
};
const BANKS = [
  ['hdfc', 'HDFC Bank', /^HDFC/], ['axis', 'Axis Bank', /^Axis/], ['amex', 'American Express', /^Amex/], ['hsbc', 'HSBC', /^HSBC/], ['sbi', 'SBI Card', /^SBI/],
  ['icici', 'ICICI Bank', /^ICICI/], ['yes', 'Yes Bank', /^Yes/], ['indusind', 'IndusInd Bank', /^IndusInd/], ['kotak', 'Kotak', /^Kotak/], ['au', 'AU Small Finance Bank', /^AU /],
  ['rbl', 'RBL Bank', /^RBL/], ['jupiter', 'Jupiter', /^Jupiter/],
];
const bankOf = name => BANKS.find(b => b[2].test(name))?.[0] ?? 'other';

const programmes = [];
const cards = [];
const seen = new Set();
const add = p => { if (!seen.has(p.id)) { seen.add(p.id); programmes.push(p); } };

for (const c of src.currencies.filter(x => x.type === 'bank')) {
  const bank = bankOf(c.cards[0]);
  add({ id: slug(c.id), name: c.name, kind: 'bank', bank });
  for (const name of c.cards) cards.push({ id: CARD_ID[name] ?? slug(name), bank, name: name.replace(/^(HDFC|Axis|Amex|HSBC|SBI|ICICI|Yes|IndusInd|Kotak|AU|RBL|Jupiter) /, ''), programme: slug(c.id), annual_fee_inr: null });
}
const partnerIds = new Set(src.currencies.filter(c => c.type !== 'bank').map(c => c.id));
for (const c of src.currencies) c.partners.forEach(p => partnerIds.add(p.programme));
for (const id of partnerIds) {
  const l = listed.get(id);
  const kind = l ? (l.type === 'hotel' ? 'hotel' : 'airline') : NON_AIRLINE.has(id) ? 'hotel' : 'airline';
  add({ id: nodeId(id), name: NAME[nodeId(id)] ?? NAME[id] ?? l?.name ?? id, kind });
}

if (new Set(cards.map(c => c.id)).size !== cards.length) throw new Error('duplicate card id: ' + cards.map(c => c.id).filter((id, i, a) => a.indexOf(id) !== i));
const CONFIRMED =new Set(['hdfc_infinia_pts>finnair_plus', 'finnair_plus>ba_avios', 'ba_avios>qatar_avios', 'amex_platinum_travel_pts>qatar_avios']);
// HDFC's official terms cap partner transfers per card per month, in multiples of 1,000 (awardscope transfers.json, cardadvisor.in).
const HDFC = { hdfc_infinia_pts: 150000, hdfc_diners_club_black_pts: 75000 };
const rules = [];
for (const c of src.currencies) {
  const from = c.type === 'bank' ? slug(c.id) : nodeId(c.id);
  for (const p of c.partners) {
    const [a, b] = p.ratio.split(':').map(Number);
    const hdfcCap = HDFC[c.id];
    // caps arrive as a number or as { period, max_source_points }; a quarterly cap has no column, so it goes in the note
    const cap = x => (x && typeof x === 'object' ? { n: x.max_source_points ?? null, period: x.period } : { n: x ?? null, period: null });
    const mo = cap(p.monthlyCap), an = cap(p.annualCap);
    const quarterly = [mo, an].find(c => c.period === 'calendar_quarter');
    const note = [p.group ? `Group ${p.group}.` : '', p.fee ? `Fee ${p.fee}.` : '', p.feeNote ?? '', quarterly ? `Capped at ${quarterly.n.toLocaleString('en-IN')} source points a quarter.` : ''].filter(Boolean).join(' ');
    rules.push({
      id: `${from}>${nodeId(p.programme)}`, from, to: nodeId(p.programme), ratio_in: a, ratio_out: b,
      monthly_cap: hdfcCap ?? (mo.period === 'calendar_quarter' ? null : mo.n), annual_cap: an.period === 'calendar_quarter' ? null : an.n, min_multiple: hdfcCap ? 1000 : p.multipleOf ?? null,
      route_confirmed_on: CONFIRMED.has(`${c.id}>${p.programme}`) ? CHECKED : null, transfer_time: p.transferTime ?? null,
      source_url: c.sources?.[0]?.url ?? 'https://points.casa/tools/transfer-calculator/', source_note: note || 'points.casa transfer calculator, checked 21 Oct 2026.',
    });
  }
}

const write = (f, o) => writeFileSync(new URL(f, OUT), JSON.stringify(o, null, 1));
write('programmes.json', { banks: BANKS.map(([id, name]) => ({ id, name })).filter(b => cards.some(c => c.bank === b.id)), programmes });
write('cards.json', { note: 'Fees, earn rates and eligibility are not in the catalogue yet. They are null on purpose: nothing here is a verified bank figure.', cards });
write('transfer_rules.json', { note: 'From points.casa via the awardscope research run, 21 Oct 2026. ratio_in:ratio_out means ratio_in source points become ratio_out partner points. Unverified until matched on the bank portal; route_confirmed_on marks a route seen working.', checked_on: CHECKED, rules });

// ---- SQL for the database (programmes and cards inline; rules as compact rows that index into the programme list) ----
const q = s => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const bankRows = BANKS.filter(b => cards.some(c => c.bank === b[0])).map(b => `(${q(b[0])},${q(b[1])})`).join(',');
const progRows = programmes.map(p => `(${q(p.id)},${q(p.name)},'${p.kind}'::public.programme_kind,${q(p.bank)})`).join(',');
const cardRows = cards.map(c => `(${q(c.id)},${q(c.bank)},${q(c.name)},${q(c.programme)})`).join(',');
writeFileSync(`${sqlDir}/seed1.sql`, `insert into public.banks (id,name) values ${bankRows} on conflict (id) do update set name=excluded.name;\ninsert into public.programmes (id,name,kind,bank_id) values ${progRows};\ninsert into public.cards (id,bank_id,name,programme_id) values ${cardRows};`);
const idx = new Map(programmes.map((p, i) => [p.id, i]));
const times = [...new Set(rules.map(r => r.transfer_time))];
const DEFAULT_NOTE = 'points.casa transfer calculator, checked 21 Oct 2026.';
const trim = a => { while (a.length && (a.at(-1) === null || a.at(-1) === 0)) a.pop(); return a; };
const row = r => JSON.stringify(trim([idx.get(r.from), idx.get(r.to), r.ratio_in, r.ratio_out, r.monthly_cap, r.annual_cap, r.min_multiple, times.indexOf(r.transfer_time), r.route_confirmed_on ? 1 : 0, r.source_note === DEFAULT_NOTE ? null : r.source_note]));
writeFileSync(`${sqlDir}/seed2.sql`, `with p(ids) as (select array[${programmes.map(x => q(x.id)).join(',')}]::text[]), t(x) as (select array[${times.map(q).join(',')}]::text[]),
r as (select e from jsonb_array_elements($j$[${rules.map(row).join(',')}]$j$::jsonb) e)
insert into public.transfer_rules (from_programme_id,to_programme_id,ratio_in,ratio_out,monthly_cap_points,annual_cap_points,min_multiple,transfer_time_text,route_confirmed_on,source_url,source_note,status)
select p.ids[(e->>0)::int+1], p.ids[(e->>1)::int+1], (e->>2)::numeric, (e->>3)::numeric, (e->>4)::bigint, (e->>5)::bigint, (e->>6)::int,
 case when e->>7 is null or e->>7='null' then null else t.x[(e->>7)::int+1] end, case when e->>8='1' then date '${CHECKED}' end,
 'https://points.casa/tools/transfer-calculator/', coalesce(e->>9, '${DEFAULT_NOTE}'), 'unverified'
from r, p, t;`);
console.log({ banks: BANKS.filter(b => cards.some(c => c.bank === b[0])).length, programmes: programmes.length, cards: cards.length, rules: rules.length, other: cards.filter(c => c.bank === 'other').length });
