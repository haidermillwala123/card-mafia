'use client';

// Client-side filters and sort over the rows already loaded. Counts come from the loaded rows, nothing is guessed.
// The bar follows GetYourGuide's results page: a row of filter pills, then the filters that are on as removable chips.
import { useMemo } from 'react';
import DatePicker from '@/components/DatePicker';
import FilterMenu from '@/components/FilterMenu';
import type { SeatView } from '@/lib/app/api';
import { fmt } from '@/lib/app/format';

export type Sort = 'best' | 'points' | 'date' | 'taxes' | 'duration' | 'seats';
export type Filters = {
  stops: string[]; airlines: string[]; programmes: string[]; from: string; to: string;
  minSeats: string; maxTaxes: string; maxPoints: string; tod: string[]; sort: Sort;
};
export const EMPTY: Filters = { stops: [], airlines: [], programmes: [], from: '', to: '', minSeats: '', maxTaxes: '', maxPoints: '', tod: [], sort: 'best' };

const STOP_KEYS = ['0', '1', '2+', '?'];
const stopKey = (r: SeatView) => (r.direct ? '0' : r.stops === 1 ? '1' : r.stops >= 2 ? '2+' : '?');
const STOP_LABEL: Record<string, string> = { '0': 'Direct', '1': '1 stop', '2+': '2+ stops', '?': 'Stops unknown' };
const TODS: [string, string][] = [['am', 'Morning, 5 to 12'], ['pm', 'Afternoon, 12 to 5'], ['eve', 'Evening, 5 to 10'], ['night', 'Night, 10 to 5'], ['na', 'Time not published']];
const SORTS: [Sort, string][] = [['best', 'Best for my cards'], ['points', 'Points, lowest'], ['date', 'Date, earliest'], ['taxes', 'Taxes, lowest'], ['duration', 'Duration, shortest'], ['seats', 'Seats, most']];
const todKey = (r: SeatView) => {
  if (!r.departs_at) return 'na';
  const h = Number(r.departs_at.slice(11, 13));
  return h >= 5 && h < 12 ? 'am' : h >= 12 && h < 17 ? 'pm' : h >= 17 && h < 22 ? 'eve' : 'night';
};
const num = (s: string) => Number(s.replace(/,/g, '')) || 0;

export const isActive = (f: Filters) => JSON.stringify({ ...f, sort: 'best' }) !== JSON.stringify(EMPTY);

export function applyFilters(rows: SeatView[], f: Filters): SeatView[] {
  const maxP = num(f.maxPoints), maxT = num(f.maxTaxes), minS = num(f.minSeats);
  const out = rows.filter(r =>
    (!f.stops.length || f.stops.includes(stopKey(r))) &&
    (!f.airlines.length || f.airlines.includes(r.airline ?? '')) &&
    (!f.programmes.length || f.programmes.includes(r.programme_name)) &&
    (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) &&
    (!minS || (r.seats !== null && r.seats >= minS)) &&
    (!maxT || (r.taxes_inr !== null && r.taxes_inr <= maxT)) &&
    (!maxP || r.miles <= maxP) &&
    (!f.tod.length || f.tod.includes(todKey(r))));
  const by: Record<Sort, ((a: SeatView, b: SeatView) => number) | null> = {
    best: null,
    points: (a, b) => a.miles - b.miles,
    date: (a, b) => a.date.localeCompare(b.date) || a.miles - b.miles,
    taxes: (a, b) => (a.taxes_inr ?? Infinity) - (b.taxes_inr ?? Infinity),
    duration: (a, b) => (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity),
    seats: (a, b) => (b.seats ?? -1) - (a.seats ?? -1),
  };
  const cmp = by[f.sort];
  return cmp ? [...out].sort(cmp) : out;
}

const count = (rows: SeatView[], key: (r: SeatView) => string) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
};
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

function Checks({ options, picked, onToggle }: { options: [string, string, number][]; picked: string[]; onToggle: (v: string) => void }) {
  return <>{options.map(([v, label, n]) => <label key={v} className="fm-opt"><input type="checkbox" checked={picked.includes(v)} onChange={() => onToggle(v)} />{label}<small>{fmt(n)}</small></label>)}</>;
}

export default function SeatFilters({ rows, f, setF, shown }: { rows: SeatView[]; f: Filters; setF: (f: Filters) => void; shown: number }) {
  const stops = useMemo(() => count(rows, stopKey), [rows]);
  const airlines = useMemo(() => count(rows, r => r.airline ?? ''), [rows]);
  const progs = useMemo(() => count(rows, r => r.programme_name), [rows]);
  const tods = useMemo(() => count(rows, todKey), [rows]);
  const set = (p: Partial<Filters>) => setF({ ...f, ...p });
  const digits = (v: string) => v.replace(/[^\d,]/g, '');

  const chips: { key: string; label: string; off: () => void }[] = [
    ...f.stops.map(v => ({ key: `s${v}`, label: STOP_LABEL[v], off: () => set({ stops: f.stops.filter(x => x !== v) }) })),
    ...f.programmes.map(v => ({ key: `p${v}`, label: v, off: () => set({ programmes: f.programmes.filter(x => x !== v) }) })),
    ...f.airlines.map(v => ({ key: `a${v}`, label: v || 'Airline not published', off: () => set({ airlines: f.airlines.filter(x => x !== v) }) })),
    ...f.tod.map(v => ({ key: `t${v}`, label: TODS.find(t => t[0] === v)![1], off: () => set({ tod: f.tod.filter(x => x !== v) }) })),
    ...(f.from || f.to ? [{ key: 'd', label: `${f.from || 'Any'} to ${f.to || 'any'}`, off: () => set({ from: '', to: '' }) }] : []),
    ...(f.minSeats ? [{ key: 'ms', label: `${f.minSeats}+ seats`, off: () => set({ minSeats: '' }) }] : []),
    ...(f.maxTaxes ? [{ key: 'mt', label: `Taxes up to ₹${f.maxTaxes}`, off: () => set({ maxTaxes: '' }) }] : []),
    ...(f.maxPoints ? [{ key: 'mp', label: `Up to ${f.maxPoints} pts`, off: () => set({ maxPoints: '' }) }] : []),
  ];

  return (
    <section className="fb" aria-label="Filter and sort results">
      <div className="fb-row">
        <FilterMenu label={`Sort: ${SORTS.find(s => s[0] === f.sort)![1]}`} active={f.sort !== 'best'}>
          {SORTS.map(([v, l]) => <label key={v} className="fm-opt"><input type="radio" name="fb-sort" checked={f.sort === v} onChange={() => set({ sort: v })} />{l}</label>)}
        </FilterMenu>
        <FilterMenu label={f.stops.length ? `Stops · ${f.stops.length}` : 'Stops'} active={f.stops.length > 0}>
          <Checks options={STOP_KEYS.filter(k => stops.get(k)).map(k => [k, STOP_LABEL[k], stops.get(k)!])} picked={f.stops} onToggle={v => set({ stops: toggle(f.stops, v) })} />
        </FilterMenu>
        <FilterMenu label={f.programmes.length ? `Programme · ${f.programmes.length}` : 'Programme'} active={f.programmes.length > 0}>
          <Checks options={[...progs.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k, n])} picked={f.programmes} onToggle={v => set({ programmes: toggle(f.programmes, v) })} />
        </FilterMenu>
        <FilterMenu label={f.airlines.length ? `Airline · ${f.airlines.length}` : 'Airline'} active={f.airlines.length > 0}>
          <Checks options={[...airlines.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k || 'Airline not published', n])} picked={f.airlines} onToggle={v => set({ airlines: toggle(f.airlines, v) })} />
        </FilterMenu>
        <FilterMenu label={f.tod.length ? `Departure · ${f.tod.length}` : 'Departure'} active={f.tod.length > 0}>
          <Checks options={TODS.filter(t => tods.get(t[0])).map(t => [t[0], t[1], tods.get(t[0])!])} picked={f.tod} onToggle={v => set({ tod: toggle(f.tod, v) })} />
        </FilterMenu>
        <FilterMenu label={f.from || f.to ? 'Dates · on' : 'Dates'} active={!!(f.from || f.to)} wide>
          <div className="fm-form">
            <span className="fm-l">Flying from</span><div className="fm-ctl"><DatePicker ariaLabel="Flying from" value={f.from} max={f.to || undefined} onChange={v => set({ from: v })} /></div>
            <span className="fm-l">Flying to</span><div className="fm-ctl"><DatePicker ariaLabel="Flying to" value={f.to} min={f.from || undefined} onChange={v => set({ to: v })} /></div>
          </div>
        </FilterMenu>
        <FilterMenu label="Price and seats" active={!!(f.minSeats || f.maxTaxes || f.maxPoints)}>
          <div className="fm-form">
            <label className="fm-l" htmlFor="fb-mp">Max points</label><input id="fb-mp" className="fm-in" inputMode="numeric" placeholder="Any" value={f.maxPoints} onChange={e => set({ maxPoints: digits(e.target.value) })} />
            <label className="fm-l" htmlFor="fb-mt">Max taxes (₹)</label><input id="fb-mt" className="fm-in" inputMode="numeric" placeholder="Any" value={f.maxTaxes} onChange={e => set({ maxTaxes: digits(e.target.value) })} />
            <label className="fm-l" htmlFor="fb-ms">Min seats</label><input id="fb-ms" className="fm-in" inputMode="numeric" placeholder="Any" value={f.minSeats} onChange={e => set({ minSeats: digits(e.target.value) })} />
            {(f.minSeats || f.maxTaxes) && <small className="fm-n">Seats or taxes not published are hidden while these are on.</small>}
          </div>
        </FilterMenu>
      </div>
      <div className="fb-status" aria-live="polite">
        <b>{fmt(shown)}</b> of {fmt(rows.length)} seats
        {chips.map(c => <button key={c.key} type="button" className="fb-chip" onClick={c.off} aria-label={`Remove filter ${c.label}`}>{c.label}<i aria-hidden="true">×</i></button>)}
        {isActive(f) && <button type="button" className="fb-reset" onClick={() => setF({ ...EMPTY, sort: f.sort })}>Reset all</button>}
      </div>
    </section>
  );
}
