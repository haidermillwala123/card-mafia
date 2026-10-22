'use client';

// Shows the flight animation whenever the person clicks through to another page: a plane along the top edge at once,
// and the full loader if the next page is slow. Hides when the new path arrives.
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import FlightLoader from './FlightLoader';

export default function RouteLoader() {
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const from = useRef(path);
  const started = useRef(0);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname === location.pathname) return;
      from.current = location.pathname;
      started.current = Date.now();
      setBusy(true);
    };
    // capture phase: Next's Link handles the click (and marks it handled) before a bubbling listener would run
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);

  // arrived: keep the plane up for a moment so a fast page change still reads as a flight
  useEffect(() => {
    if (!busy || path === from.current) return;
    const left = Math.max(0, 450 - (Date.now() - started.current));
    const t = setTimeout(() => { setBusy(false); setSlow(false); }, left);
    return () => clearTimeout(t);
  }, [path, busy]);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), 700);
    const cap = setTimeout(() => { setBusy(false); setSlow(false); }, 15000); // never get stuck
    return () => { clearTimeout(t); clearTimeout(cap); };
  }, [busy]);

  if (!busy) return null;
  return (
    <>
      <div className="rl-bar" aria-hidden="true">
        <span className="rl-plane"><svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor"><path d="M30 16 3 7l4 9-4 9 27-9Zm-17 0 8-1.6L11 12l2 4Z" /></svg></span>
      </div>
      {slow && <div className="rl-veil"><FlightLoader label="Taking off" /></div>}
    </>
  );
}
