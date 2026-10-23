// Links below are public booking links seats.aero returned for a sample route; no personal data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carriesRoute, finalLink, sourceOf } from './deeplink.ts';

const base = { origin: 'BOM', dest: 'DXB', date: '2026-12-02', cabin: 'business' as const, n: 3 };
const EMIRATES = 'https://www.emirates.com/booking/search-results/?searchRequest=eyJqb3VybmV5VHlwZSI6Ik9ORVdBWSIsImJvb2tpbmdUeXBlIjoiUkVERU1QVElPTiIsInBhc3NlbmdlcnMiOlt7InR5cGUiOiJBRFQiLCJjb3VudCI6MX1dLCJzZWdtZW50cyI6W3siZGVwYXJ0dXJlIjoiQk9NIiwiYXJyaXZhbCI6IkRYQiIsInRyYXZlbERhdGUiOiIyMDI2LTEyLTAyIiwiY2FiaW5DbGFzcyI6IlkifV0sInJlZmVycmVyIjoiL2Jvb2tpbmcvc2VhcmNoLXJlc3VsdHMiLCJzb3VyY2UiOiJ0cmlwLXN1bW1hcnkifQ==';

test('a link that carries the route is recognised, a front page is not', () => {
  assert.equal(carriesRoute('https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=BOM&dest0=DXB&departureDate0=2026-12-02', 'BOM', 'DXB'), true);
  assert.equal(carriesRoute(EMIRATES, 'BOM', 'DXB'), true);
  assert.equal(carriesRoute('https://www.qatarairways.com/en/homepage.html', 'BOM', 'DOH'), false);
});

test('passengers and cabin are set on links the source filled in', () => {
  const em = finalLink({ ...base, source: 'emirates', url: EMIRATES });
  assert.equal(em.prefilled, true);
  const req = JSON.parse(Buffer.from(new URL(em.url).searchParams.get('searchRequest')!, 'base64').toString('utf8'));
  assert.equal(req.passengers[0].count, 3);
  assert.equal(req.segments[0].cabinClass, 'J');
  const ba = new URL(finalLink({ ...base, source: 'british', url: 'https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?departurePoint=BOM&destinationPoint=DXB&NumberOfAdults=1&CabinCode=M' }).url);
  assert.equal(ba.searchParams.get('NumberOfAdults'), '3');
  assert.equal(ba.searchParams.get('CabinCode'), 'C');
  const ac = new URL(finalLink({ ...base, source: 'aeroplan', url: 'https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=BOM&dest0=DXB&ADT=1' }).url);
  assert.equal(ac.searchParams.get('ADT'), '3');
});

test('a front page stays a front page and says it is not filled in', () => {
  const q = finalLink({ ...base, dest: 'DOH', source: 'qatar', url: 'https://www.qatarairways.com/en/homepage.html' });
  assert.equal(q.prefilled, false);
  assert.equal(q.url, 'https://www.qatarairways.com/en/homepage.html');
});

test('a partner link is matched to its programme by address', () => {
  assert.equal(sourceOf('https://www.united.com/en/us/fsr/choose-flights?f=BOM'), 'united');
  assert.equal(sourceOf('https://www.aircanada.com/aeroplan/redeem/'), 'aeroplan');
  assert.equal(sourceOf('https://evil-united.com/x'), null);
});
