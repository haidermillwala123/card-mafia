// Writes src/data/seats_cache.json: a SAMPLE of cached award seats for the demo routes.
// These are not real seats.aero results. Replace by running the live client (SEATS_AERO_API_KEY) once a key exists.
import { writeFileSync } from 'node:fs';

const FETCHED_AT = '2026-10-21T10:00:00Z';
const DAYS = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
const US = ['JFK', 'ORD', 'LAX', 'MIA'];
const IN = ['DEL', 'BOM', 'BLR', 'HYD'];
const AIRCRAFT = ['A350-1000', '777-300ER', '787-8', 'A350-900', '777-300ER', '787-9'];
const PEAK = new Set([15, 18, 21]);
const iso = d => `2027-10-${String(d).padStart(2, '0')}`;
const rows = [];
let k = 0;
for (const day of DAYS) {
  for (const dest of US) {
    k += 1;
    rows.push({
      programme: 'qatar-privilege-club', origin: 'DOH', dest, date: iso(day), cabin: 'business',
      miles: PEAK.has(day) ? 160000 : 140000, taxes_inr: 38000 + (k % 4) * 1500, seats: 1 + (k % 4),
      airline: 'QR', aircraft: AIRCRAFT[k % AIRCRAFT.length], flights: [`QR${700 + (k % 9)}`], direct: true,
    });
  }
  for (const origin of IN) {
    k += 1;
    rows.push({
      programme: 'qatar-privilege-club', origin, dest: 'DOH', date: iso(day - 1), cabin: 'business',
      miles: 45000, taxes_inr: 9000 + (k % 3) * 500, seats: 2 + (k % 3),
      airline: 'QR', aircraft: 'A350-900', flights: [`QR${500 + (k % 9)}`], direct: true,
    });
  }
}
writeFileSync('src/data/seats_cache.json', JSON.stringify({ sample: true, source: 'sample', fetched_at: FETCHED_AT, rows }, null, 1));
console.log(rows.length, 'rows');
