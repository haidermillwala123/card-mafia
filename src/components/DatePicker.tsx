'use client';

// On-brand calendar popover that replaces the browser's <input type="date">. Value in and out is ISO "YYYY-MM-DD".
import { useEffect, useId, useRef, useState } from 'react';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const today = () => new Date().toISOString().slice(0, 10);
const label = (v: string) => (v ? `${Number(v.slice(8, 10))} ${MONTHS[Number(v.slice(5, 7)) - 1].slice(0, 3)} ${v.slice(0, 4)}` : 'Pick a date');

export default function DatePicker({ value, onChange, min, max, ariaLabel }: { value: string; onChange: (v: string) => void; min?: string; max?: string; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const [right, setRight] = useState(false); // open leftwards when there is no room on the right
  const seed = value || today();
  const [view, setView] = useState({ y: Number(seed.slice(0, 4)), m: Number(seed.slice(5, 7)) - 1 });
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const shift = (d: number) => setView(v => { const t = new Date(Date.UTC(v.y, v.m + d, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; });
  const off = (v: string) => (!!min && v < min) || (!!max && v > max);
  const prevOff = !!min && iso(view.y, view.m, 1) <= min;
  const nextOff = !!max && iso(view.y, view.m, count) >= max;
  const t = today();

  return (
    <div className="dp" ref={ref}>
      <button type="button" className="dp-btn" aria-label={`${ariaLabel}: ${label(value)}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => { if (!open) { const s = value || today(); setView({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1 }); setRight((ref.current?.getBoundingClientRect().left ?? 0) + 316 > window.innerWidth); } setOpen(o => !o); }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span>{label(value)}</span>
      </button>
      {open && (
        <div className={`dp-pop${right ? ' dp-right' : ''}`} id={id} role="dialog" aria-label={`Choose ${ariaLabel}`}>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => shift(-1)} disabled={prevOff} aria-label="Previous month">‹</button>
            <b>{MONTHS[view.m]} {view.y}</b>
            <button type="button" className="dp-nav" onClick={() => shift(1)} disabled={nextOff} aria-label="Next month">›</button>
          </div>
          <div className="dp-grid" role="grid">
            {DAYS.map((d, i) => <span key={i} className="dp-dow" aria-hidden="true">{d}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const v = iso(view.y, view.m, d);
              return (
                <button key={v} type="button" className={`dp-day${v === value ? ' is-sel' : ''}${v === t ? ' is-today' : ''}`} disabled={off(v)} aria-pressed={v === value} aria-label={label(v)} onClick={() => { onChange(v); setOpen(false); }}>{d}</button>
              );
            })}
          </div>
          <div className="dp-foot">
            <button type="button" className="dp-link" disabled={off(t)} onClick={() => { onChange(t); setOpen(false); }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
