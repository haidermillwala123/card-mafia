'use client';

// Earn rules by card: a filter bar and compact rows. Details open on demand, so nothing is a wall of text.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Select from '@/components/Select';

export type BrowseCard = {
  id: string; name: string; bankId: string; bank: string; currency: string;
  annualFee: number | null; joiningFee: number | null; basePer100: number | null; baseText: string | null;
  best: string | null; redemption: string | null; welcome: string | null;
  accelerated: { category: string; rate: string; per100: number | null; cap: number | null; cat: string[] }[];
  milestones: { spend: number | null; benefit: string }[];
  exclusions: string[];
};

const FEES: [string, string, (f: number | null) => boolean][] = [
  ['any', 'Any fee', () => true],
  ['free', 'No annual fee', f => f === 0],
  ['u5', 'Up to ₹5,000', f => f !== null && f > 0 && f <= 5000],
  ['u15', '₹5,001 to ₹15,000', f => f !== null && f > 5000 && f <= 15000],
  ['o15', 'Above ₹15,000', f => f !== null && f > 15000],
];
const SORTS = [['name', 'Name'], ['fee', 'Annual fee, lowest'], ['base', 'Base rate, highest'], ['top', 'Best category rate, highest']] as const;
const inr = (n: number | null) => (n === null ? 'not found' : n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}`);
const short = (s: string | null, n = 150) => (!s ? null : s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n))}…`);
const top = (c: BrowseCard) => Math.max(0, ...c.accelerated.map(a => a.per100 ?? 0));
const catLabel = (k: string) => { const t = k.replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
const r2 = (n: number) => Number(n.toFixed(2));

export default function EarnBrowser({ cards }: { cards: BrowseCard[] }) {
  const [q, setQ] = useState('');
  const [banks, setBanks] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [fee, setFee] = useState('any');
  const [minBase, setMinBase] = useState('0');
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('name');
  const [open, setOpen] = useState<string | null>(null);

  const bankList = useMemo(() => [...new Map(cards.map(c => [c.bankId, c.bank])).entries()], [cards]);
  const catList = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) for (const k of new Set(c.accelerated.flatMap(a => a.cat))) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const feeOk = FEES.find(f => f[0] === fee)![2];
  const rows = useMemo(() => {
    const out = cards.filter(c =>
      (!q || `${c.bank} ${c.name} ${c.currency}`.toLowerCase().includes(q.toLowerCase())) &&
      (!banks.length || banks.includes(c.bankId)) &&
      (!cats.length || cats.some(k => c.accelerated.some(a => a.cat.includes(k)))) &&
      feeOk(c.annualFee) &&
      (!Number(minBase) || (c.basePer100 ?? 0) >= Number(minBase)));
    const by = {
      name: (a: BrowseCard, b: BrowseCard) => a.name.localeCompare(b.name),
      fee: (a: BrowseCard, b: BrowseCard) => (a.annualFee ?? Infinity) - (b.annualFee ?? Infinity),
      base: (a: BrowseCard, b: BrowseCard) => (b.basePer100 ?? -1) - (a.basePer100 ?? -1),
      top: (a: BrowseCard, b: BrowseCard) => top(b) - top(a),
    }[sort];
    return [...out].sort(by);
  }, [cards, q, banks, cats, feeOk, minBase, sort]);

  const active = !!(q || banks.length || cats.length || fee !== 'any' || Number(minBase));
  const clear = () => { setQ(''); setBanks([]); setCats([]); setFee('any'); setMinBase('0'); };
  const flip = (l: string[], v: string) => (l.includes(v) ? l.filter(x => x !== v) : [...l, v]);

  return (
    <div className="ef">
      <div className="ef-bar">
        <label className="ef-search">
          <span className="ef-vh">Search cards</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a card or bank" />
        </label>
        <label className="ef-sel"><span>Annual fee</span><Select value={fee} onChange={e => setFee(e.target.value)}>{FEES.map(f => <option key={f[0]} value={f[0]}>{f[1]}</option>)}</Select></label>
        <label className="ef-sel"><span>Base rate</span>
          <Select value={minBase} onChange={e => setMinBase(e.target.value)}>
            <option value="0">Any</option><option value="2">2+ points per ₹100</option><option value="3">3+ points per ₹100</option><option value="4">4+ points per ₹100</option><option value="5">5+ points per ₹100</option>
          </Select>
        </label>
        <label className="ef-sel"><span>Sort by</span><Select value={sort} onChange={e => setSort(e.target.value as typeof sort)}>{SORTS.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</Select></label>
      </div>

      <div className="ef-chiprow" role="group" aria-label="Banks">
        {bankList.map(([id, name]) => <button key={id} type="button" className="ef-chip" aria-pressed={banks.includes(id)} onClick={() => setBanks(flip(banks, id))}>{name}</button>)}
      </div>
      <div className="ef-chiprow" role="group" aria-label="Bonus categories">
        <span className="ef-lbl">Earns extra on</span>
        {catList.map(([k, n]) => <button key={k} type="button" className="ef-chip" aria-pressed={cats.includes(k)} onClick={() => setCats(flip(cats, k))}>{catLabel(k)} ({n})</button>)}
      </div>

      <div className="ef-count" aria-live="polite">
        <b>{rows.length}</b> of {cards.length} cards
        {active && <button type="button" className="ef-clear" onClick={clear}>Clear filters</button>}
      </div>

      {rows.length === 0 && <p className="ef-empty">No card matches. Loosen a filter or clear them.</p>}

      <ul className="ef-list">
        {rows.map(c => {
          const isOpen = open === c.id;
          const t = top(c);
          return (
            <li key={c.id} id={c.id} className={`ef-row${isOpen ? ' is-open' : ''}`}>
              <button type="button" className="ef-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)}>
                <span className="ef-name"><small>{c.bank}</small><b>{c.name}</b></span>
                <span className="ef-stat"><small>Base</small><b>{c.basePer100 === null ? 'not found' : `${r2(c.basePer100)} per ₹100`}</b></span>
                <span className="ef-stat"><small>Best category</small><b>{t ? `${r2(t)} per ₹100` : 'none found'}</b></span>
                <span className="ef-stat"><small>Annual fee</small><b>{inr(c.annualFee)}</b></span>
                <span className="ef-caret" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="ef-body">
                  {c.best && <p className="ef-best">{short(c.best, 220)}</p>}
                  <dl className="ef-facts">
                    <div><dt>Reward currency</dt><dd>{c.currency}</dd></div>
                    <div><dt>Joining fee</dt><dd>{inr(c.joiningFee)}</dd></div>
                    <div><dt>Base rate</dt><dd>{short(c.baseText, 90) ?? 'not found'}</dd></div>
                    <div><dt>Redemption</dt><dd>{short(c.redemption, 90) ?? 'not found'}</dd></div>
                  </dl>
                  {c.accelerated.length > 0 && (
                    <div className="ef-acc">
                      <h4>Bonus categories</h4>
                      <ul>{c.accelerated.map((a, i) => <li key={i}><span>{short(a.category, 70)}</span><b>{a.per100 === null ? short(a.rate, 40) : `${r2(a.per100)} per ₹100`}</b><em>{a.cap === null ? '' : `cap ${a.cap.toLocaleString('en-IN')} a month`}</em></li>)}</ul>
                    </div>
                  )}
                  {c.milestones.length > 0 && <div className="ef-acc"><h4>Milestones</h4><ul>{c.milestones.map((m, i) => <li key={i}><span>{m.spend === null ? 'Spend not found' : `₹${m.spend.toLocaleString('en-IN')}`}</span><b>{short(m.benefit, 80)}</b></li>)}</ul></div>}
                  {c.exclusions.length > 0 && <p className="ef-ex"><b>No points on:</b> {c.exclusions.join(', ')}</p>}
                  <Link className="ef-link" href={`/transfers/${c.id}`}>Where these points transfer →</Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
