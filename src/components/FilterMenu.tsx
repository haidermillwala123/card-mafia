'use client';

// A filter pill that opens a small menu (GetYourGuide's "Filters" row). Closes on outside click or Escape.
import { type ReactNode, useEffect, useRef, useState } from 'react';

export default function FilterMenu({ label, active, wide = false, children }: { label: string; active: boolean; wide?: boolean; children: ReactNode }) {
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
    <div className="fm" ref={ref}>
      <button type="button" className={`fm-pill${active ? ' is-on' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>{label}<i aria-hidden="true">▾</i></button>
      {open && <div className={`fm-pop${wide ? ' wide' : ''}`}>{children}</div>}
    </div>
  );
}
