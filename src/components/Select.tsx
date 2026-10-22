'use client';

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactElement, type ReactNode, type Ref } from 'react';

type Opt = { value: string; label: string };
type Group = { label: string; opts: Opt[] };
type OptEl = ReactElement<{ value?: string | number; children?: ReactNode }>;

type Props = {
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  id?: string;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

const text = (n: ReactNode): string => Children.toArray(n).map(c => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');

// Drop-in for a native <select>: same <option>/<optgroup> children and the same e.target.value, but a styled listbox.
function parse(children: ReactNode): Group[] {
  const groups: Group[] = [];
  const loose: Opt[] = [];
  const opt = (el: OptEl): Opt => {
    const label = text(el.props.children);
    return { value: el.props.value === undefined ? label : String(el.props.value), label };
  };
  Children.toArray(children).forEach(c => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ label?: string; value?: string | number; children?: ReactNode }>;
    if (el.type === 'optgroup') {
      groups.push({ label: el.props.label ?? '', opts: Children.toArray(el.props.children).filter(isValidElement).map(o => opt(o as OptEl)) });
    } else if (el.type === 'option') loose.push(opt(el));
  });
  return loose.length ? [{ label: '', opts: loose }, ...groups] : groups;
}

export default function Select({ value, onChange, children, id, disabled, ref }: Props) {
  const groups = useMemo(() => parse(children), [children]);
  const flat = useMemo(() => groups.flatMap(g => g.opts), [groups]);
  const cur = String(value);
  const selected = flat.find(o => o.value === cur);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector('[data-hi="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, hi]);

  const show = () => {
    if (disabled) return;
    const r = root.current?.getBoundingClientRect();
    setUp(!!r && window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom);
    setHi(Math.max(0, flat.findIndex(o => o.value === cur)));
    setOpen(true);
  };
  const pick = (o: Opt) => {
    setOpen(false);
    if (o.value !== cur) onChange({ target: { value: o.value }, currentTarget: { value: o.value } } as unknown as ChangeEvent<HTMLSelectElement>);
  };

  const key = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(flat.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (flat[hi]) pick(flat[hi]); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const j = flat.findIndex((o, i) => i > hi && o.label.toLowerCase().startsWith(k));
      const f = j >= 0 ? j : flat.findIndex(o => o.label.toLowerCase().startsWith(k));
      if (f >= 0) setHi(f);
    }
  };

  let idx = -1;
  return (
    <div className="sel" ref={root} onClick={e => e.preventDefault()}>
      <button type="button" id={id} ref={ref} className={'sel-btn' + (selected && selected.value !== '' ? '' : ' is-empty')} disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={uid}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={key}>
        <span>{selected?.label || '—'}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className={'sel-menu' + (up ? ' is-up' : '')} id={uid} role="listbox" ref={list}>
          {groups.map((g, gi) => (
            <div key={gi} role="group" aria-label={g.label || undefined}>
              {g.label && <div className="sel-group">{g.label}</div>}
              {g.opts.map(o => {
                idx += 1;
                const i = idx;
                return (
                  <div key={o.value + i} role="option" aria-selected={o.value === cur} data-hi={i === hi} className={'sel-opt' + (i === hi ? ' is-hi' : '') + (o.value === cur ? ' is-on' : '')}
                    onMouseEnter={() => setHi(i)} onClick={e => { e.preventDefault(); e.stopPropagation(); pick(o); }}>
                    <span>{o.label}</span>
                    {o.value === cur && <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
