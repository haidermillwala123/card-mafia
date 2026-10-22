'use client';

// Earn rules by card. Layout follows the toolbar pattern in Mercury, Square and Whop (via Mobbin): one search box,
// small filter menus, removable chips for what is on, then a plain table. Details open on demand.
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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
const BASES: [string, string][] = [['0', 'Any base rate'], ['2', '2+ points per ₹100'], ['3', '3+ points per ₹100'], ['4', '4+ points per ₹100'], ['5', '5+ points per ₹100']];
const SORTS = [['name', 'Name'], ['fee', 'Annual fee, lowest'], ['base', 'Base rate, highest'], ['top', 'Best category, highest']] as const;
type SortKey = (typeof SORTS)[number][0];

const inr = (n: number | null) => (n === null ? 'not found' : n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}`);
const short = (s: string | null, n = 150) => (!s ? null : s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n))}…`);
const r2 = (n: number) => Number(n.toFixed(2));
const top = (c: BrowseCard) => Math.max(0, ...c.accelerated.map(a => a.per100 ?? 0));
const catLabel = (k: string) => { const t = k.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const flip = (l: string[], v: string) => (l.includes(v) ? l.filter(x => x !== v) : [...l, v]);

// A small menu button: closes on outside click or Escape.
function Menu({ label, active, children }: { label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="ef-menu" ref={ref}>
      <button type="button" className={`ef-pill${active ? ' is-on' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>{label}<i aria-hidden="true">▾</i></button>
      {open && <div className="ef-pop">{children}</div>}
    </div>
  );
}

export default function EarnBrowser({ cards }: { cards: BrowseCard[] }) {
  const [q, setQ] = useState('');
  const [banks, setBanks] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [fee, setFee] = useState('any');
  const [minBase, setMinBase] = useState('0');
  const [sort, setSort] = useState<SortKey>('name');
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

  const chips: { key: string; label: string; off: () => void }[] = [
    ...banks.map(b => ({ key: `b${b}`, label: bankList.find(x => x[0] === b)?.[1] ?? b, off: () => setBanks(l => l.filter(x => x !== b)) })),
    ...cats.map(k => ({ key: `c${k}`, label: `Extra on ${catLabel(k).toLowerCase()}`, off: () => setCats(l => l.filter(x => x !== k)) })),
    ...(fee !== 'any' ? [{ key: 'fee', label: FEES.find(f => f[0] === fee)![1], off: () => setFee('any') }] : []),
    ...(Number(minBase) ? [{ key: 'base', label: BASES.find(b => b[0] === minBase)![1], off: () => setMinBase('0') }] : []),
  ];
  const clear = () => { setQ(''); setBanks([]); setCats([]); setFee('any'); setMinBase('0'); };

  return (
    <div className="ef">
      <div className="ef-bar">
        <label className="ef-search">
          <span className="ef-vh">Search cards</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a card or bank" />
        </label>
        <Menu label={banks.length ? `Bank · ${banks.length}` : 'Bank'} active={banks.length > 0}>
          {bankList.map(([id, name]) => <label key={id} className="ef-opt"><input type="checkbox" checked={banks.includes(id)} onChange={() => setBanks(flip(banks, id))} />{name}</label>)}
        </Menu>
        <Menu label={cats.length ? `Extra on · ${cats.length}` : 'Extra on'} active={cats.length > 0}>
          {catList.map(([k, n]) => <label key={k} className="ef-opt"><input type="checkbox" checked={cats.includes(k)} onChange={() => setCats(flip(cats, k))} />{catLabel(k)}<small>{n}</small></label>)}
        </Menu>
        <Menu label={fee === 'any' ? 'Annual fee' : FEES.find(f => f[0] === fee)![1]} active={fee !== 'any'}>
          {FEES.map(f => <label key={f[0]} className="ef-opt"><input type="radio" name="ef-fee" checked={fee === f[0]} onChange={() => setFee(f[0])} />{f[1]}</label>)}
        </Menu>
        <Menu label={Number(minBase) ? BASES.find(b => b[0] === minBase)![1] : 'Base rate'} active={!!Number(minBase)}>
          {BASES.map(b => <label key={b[0]} className="ef-opt"><input type="radio" name="ef-base" checked={minBase === b[0]} onChange={() => setMinBase(b[0])} />{b[1]}</label>)}
        </Menu>
        <Menu label={`Sort: ${SORTS.find(s => s[0] === sort)![1]}`} active={false}>
          {SORTS.map(s => <label key={s[0]} className="ef-opt"><input type="radio" name="ef-sort" checked={sort === s[0]} onChange={() => setSort(s[0])} />{s[1]}</label>)}
        </Menu>
      </div>

      <div className="ef-status" aria-live="polite">
        <span><b>{rows.length}</b> of {cards.length} cards</span>
        {chips.map(c => <button key={c.key} type="button" className="ef-tag" onClick={c.off} aria-label={`Remove filter ${c.label}`}>{c.label}<i aria-hidden="true">×</i></button>)}
        {(chips.length > 0 || q) && <button type="button" className="ef-clear" onClick={clear}>Clear all</button>}
      </div>

      {rows.length === 0 ? <p className="ef-empty">No card matches. Remove a filter.</p> : (
        <div className="ef-table" role="table" aria-label="Cards">
          <div className="ef-th" role="row"><span role="columnheader">Card</span><span role="columnheader">Base rate</span><span role="columnheader">Best category</span><span role="columnheader">Annual fee</span><span /></div>
          {rows.map(c => {
            const isOpen = open === c.id;
            const t = top(c);
            return (
              <div key={c.id} id={c.id} role="rowgroup" className={`ef-row${isOpen ? ' is-open' : ''}`}>
                <button type="button" className="ef-head" role="row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)}>
                  <span className="ef-name"><b>{c.name}</b><small>{c.bank}</small></span>
                  <span data-l="Base rate">{c.basePer100 === null ? <em>not found</em> : `${r2(c.basePer100)} / ₹100`}</span>
                  <span data-l="Best category">{t ? `${r2(t)} / ₹100` : <em>none found</em>}</span>
                  <span data-l="Annual fee">{inr(c.annualFee)}</span>
                  <span className="ef-caret" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="ef-body">
                    {c.best && <p className="ef-best">{short(c.best, 200)}</p>}
                    <dl className="ef-facts">
                      <div><dt>Reward currency</dt><dd>{c.currency}</dd></div>
                      <div><dt>Joining fee</dt><dd>{inr(c.joiningFee)}</dd></div>
                      <div><dt>Redemption</dt><dd>{short(c.redemption, 90) ?? 'not found'}</dd></div>
                    </dl>
                    {c.accelerated.length > 0 && (
                      <div className="ef-acc">
                        <h4>Bonus categories</h4>
                        <ul>{c.accelerated.map((a, i) => <li key={i}><span>{short(a.category, 70)}</span><b>{a.per100 === null ? short(a.rate, 40) : `${r2(a.per100)} / ₹100`}</b><em>{a.cap === null ? '' : `cap ${a.cap.toLocaleString('en-IN')} a month`}</em></li>)}</ul>
                      </div>
                    )}
                    {c.milestones.length > 0 && <div className="ef-acc"><h4>Milestones</h4><ul>{c.milestones.map((m, i) => <li key={i}><span>{m.spend === null ? 'Spend not found' : `₹${m.spend.toLocaleString('en-IN')}`}</span><b>{short(m.benefit, 80)}</b></li>)}</ul></div>}
                    {c.exclusions.length > 0 && <p className="ef-ex"><b>No points on:</b> {c.exclusions.join(', ')}</p>}
                    <Link className="ef-link" href={`/transfers/${c.id}`}>Where these points transfer →</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
