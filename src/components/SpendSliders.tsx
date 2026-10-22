'use client';

// The spend rows used by the points calculator and "Best card for you": an icon tile, a label, a slider and a tap-to-type amount.
// One component so both pages feel identical. Styles live in app/earn/calc.css.
import { CAT_LABEL, type Cat } from '@/lib/earn';

const inr = (n: number) => n.toLocaleString('en-IN');

export const SPEND_GROUPS: { title: string; hint: string; cats: Cat[] }[] = [
  { title: 'Everyday', hint: 'What you swipe for most weeks.', cats: ['general', 'dining', 'groceries', 'online'] },
  { title: 'Travel and abroad', hint: 'Flights, hotels, forex and fuel.', cats: ['travel_portal', 'international', 'fuel'] },
  { title: 'Bills and big payments', hint: 'These often earn less, but they add up.', cats: ['utilities', 'insurance', 'rent', 'education', 'other'] },
];
export const SPEND_CATS: Cat[] = SPEND_GROUPS.flatMap(g => g.cats);

// top of each slider; typing a bigger number still works
const MAX: Record<Cat, number> = { general: 150000, dining: 50000, groceries: 50000, online: 60000, travel_portal: 100000, international: 150000, fuel: 20000, utilities: 30000, insurance: 100000, rent: 150000, education: 100000, other: 100000 };
const ICON: Record<Cat, string> = {
  general: 'M6 8h12l-1 12H7L6 8ZM9 8a3 3 0 0 1 6 0',
  dining: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 4-3 7 0 1 1 2 3 2v9',
  groceries: 'M4 10h16l-2 9H6l-2-9ZM8 10l3-5M16 10l-3-5',
  online: 'M3 5h18v11H3zM8 20h8M12 16v4',
  travel_portal: 'M21 3 3 11l7 3 3 7 8-18Z',
  international: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  fuel: 'M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11Z',
  utilities: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  insurance: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z',
  rent: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  education: 'M2 9l10-5 10 5-10 5-10-5ZM6 11v5c3 2 9 2 12 0v-5',
  other: 'M5 12h.01M12 12h.01M19 12h.01',
};

export default function SpendSliders({ raw, set, groups = SPEND_GROUPS }: { raw: Partial<Record<Cat, string>>; set: (c: Cat, v: string) => void; groups?: typeof SPEND_GROUPS }) {
  return (
    <>
      {groups.map(g => (
        <section key={g.title} className="cx-group" aria-label={g.title}>
          <h2>{g.title}</h2>
          <p>{g.hint}</p>
          <ul className="cx-list">
            {g.cats.map(c => {
              const v = Number(raw[c]) || 0;
              const pct = Math.min(100, (v / MAX[c]) * 100);
              return (
                <li key={c} className="cx-row">
                  <i className="cx-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={ICON[c]} /></svg></i>
                  <label htmlFor={`sp-${c}`}>{CAT_LABEL[c]}</label>
                  <div className="cx-amt">
                    <span aria-hidden="true">₹</span>
                    <input id={`sp-${c}`} inputMode="numeric" autoComplete="off" placeholder="0" value={v ? inr(v) : ''} onChange={e => set(c, e.target.value)} aria-label={`${CAT_LABEL[c]}, rupees a month`} />
                  </div>
                  <div className="cx-range-wrap">
                    <input
                      type="range" className="cx-range" min={0} max={MAX[c]} step={500} value={Math.min(v, MAX[c])}
                      style={{ ['--pct' as string]: `${pct}%` }}
                      onChange={e => set(c, e.target.value)}
                      aria-label={`${CAT_LABEL[c]} slider`} aria-valuetext={`₹${inr(v)} a month`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
