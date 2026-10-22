'use client';

// Client-side filters and sort over the rows already loaded. Counts come from the loaded rows, nothing is guessed.
import { useMemo } from 'react';
import Select from '@/components/Select';
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
const TODS: [string, string][] = [['am', 'Morning (5-12)'], ['pm', 'Afternoon (12-17)'], ['eve', 'Evening (17-22)'], ['night', 'Night (22-5)'], ['na', 'Time not published']];
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

function Chips({ title, options, picked, onToggle }: { title: string; options: [string, string, number][]; picked: string[]; onToggle: (v: string) => void }) {
  if (!options.length) return null;
  return (
    <div className="a-c">
      <span className="a-cap">{title}</span>
      <div className="a-chips">
        {options.map(([v, label, n]) => (
          <button key={v} type="button" className="a-chip" aria-pressed={picked.includes(v)} onClick={() => onToggle(v)}>{label} ({fmt(n)})</button>
        ))}
      </div>
    </div>
  );
}

export default function SeatFilters({ rows, f, setF, shown }: { rows: SeatView[]; f: Filters; setF: (f: Filters) => void; shown: number }) {
  const stops = useMemo(() => count(rows, stopKey), [rows]);
  const airlines = useMemo(() => count(rows, r => r.airline ?? ''), [rows]);
  const progs = useMemo(() => count(rows, r => r.programme_name), [rows]);
  const tods = useMemo(() => count(rows, todKey), [rows]);
  const set = (p: Partial<Filters>) => setF({ ...f, ...p });
  const field = (label: string, key: 'from' | 'to' | 'minSeats' | 'maxTaxes' | 'maxPoints', props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="cm-field">
      <span className="cm-field__label">{label}</span>
      <span className="cm-control">
        <input value={f[key]} onChange={e => set({ [key]: props.type === 'date' ? e.target.value : e.target.value.replace(/[^\d,]/g, '') })} {...props} />
      </span>
    </label>
  );
  return (
    <section className="a-gl a-filters" aria-label="Filter and sort results">
      <div className="a-r a-rw">
        <h2 className="a-sec a-g">Filters</h2>
        <span className="a-cap" aria-live="polite">Showing {fmt(shown)} of {fmt(rows.length)}</span>
        {isActive(f) && <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setF({ ...EMPTY, sort: f.sort })}>Clear filters</button>}
      </div>
      <Chips title="Stops" options={STOP_KEYS.filter(k => stops.get(k)).map(k => [k, STOP_LABEL[k], stops.get(k)!])} picked={f.stops} onToggle={v => set({ stops: toggle(f.stops, v) })} />
      <Chips title="Programme" options={[...progs.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k, n])} picked={f.programmes} onToggle={v => set({ programmes: toggle(f.programmes, v) })} />
      <Chips title="Airline" options={[...airlines.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k || 'Airline not published', n])} picked={f.airlines} onToggle={v => set({ airlines: toggle(f.airlines, v) })} />
      <Chips title="Departure time" options={TODS.filter(t => tods.get(t[0])).map(t => [t[0], t[1], tods.get(t[0])!])} picked={f.tod} onToggle={v => set({ tod: toggle(f.tod, v) })} />
      <div className="a-filters-grid">
        {field('Flying from', 'from', { type: 'date' })}
        {field('Flying to', 'to', { type: 'date' })}
        {field('Min seats', 'minSeats', { inputMode: 'numeric', placeholder: 'Any' })}
        {field('Max taxes (₹)', 'maxTaxes', { inputMode: 'numeric', placeholder: 'Any' })}
        {field('Max points', 'maxPoints', { inputMode: 'numeric', placeholder: 'Any' })}
        <label className="cm-field">
          <span className="cm-field__label">Sort by</span>
          <span className="cm-control">
            <Select value={f.sort} onChange={e => set({ sort: e.target.value as Sort })}>
              <option value="best">Best for my cards</option>
              <option value="points">Points, lowest</option>
              <option value="date">Date, earliest</option>
              <option value="taxes">Taxes, lowest</option>
              <option value="duration">Duration, shortest</option>
              <option value="seats">Seats, most</option>
            </Select>
          </span>
        </label>
      </div>
      {(f.minSeats || f.maxTaxes) && <span className="a-cap">Rows where seats or taxes are not published are hidden while those filters are on.</span>}
    </section>
  );
}
