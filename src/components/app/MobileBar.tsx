'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Phone only (CSS hides it above 760px): the app-style bottom tab bar. Five tabs, icon over label, the active one filled.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONS: Record<string, ReactNode> = {
  home: <svg viewBox="0 0 24 24" width="24" height="24" {...P}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>,
  search: <svg viewBox="0 0 24 24" width="24" height="24" {...P}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>,
  trips: <svg viewBox="0 0 24 24" width="24" height="24" {...P}><path d="M21 15.5 13.5 12V5.5a1.5 1.5 0 0 0-3 0V12L3 15.5v1.8l7.5-1.8v3.2L8.5 20.5V22l3.5-1 3.5 1v-1.5l-2-1.8v-3.2l7.5 1.8z" /></svg>,
  wallet: <svg viewBox="0 0 24 24" width="24" height="24" {...P}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><path d="M16 15h2" /></svg>,
  menu: <svg viewBox="0 0 24 24" width="24" height="24" {...P}><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></svg>,
};

export default function MobileBar() {
  const path = usePathname();
  const starts = (...p: string[]) => p.some(x => path === x || path.startsWith(`${x}/`));
  const items = [
    { href: '/home', label: 'Home', icon: 'home', on: path === '/home' },
    { href: '/flights', label: 'Search', icon: 'search', on: starts('/flights') },
    { href: '/trips', label: 'Trips', icon: 'trips', on: starts('/trips', '/plan', '/alerts') },
    { href: '/wallet', label: 'Wallet', icon: 'wallet', on: starts('/wallet', '/cards', '/earn', '/transfers', '/calculator') },
    { href: '/more', label: 'Menu', icon: 'menu', on: starts('/more', '/account', '/learn') },
  ];
  return (
    <nav className="cm-bottombar a-mobilebar" aria-label="Main">
      {items.map(i => (
        <Link key={i.href} href={i.href} className="cm-bottombar__item" aria-current={i.on ? 'page' : undefined}>
          <span className="tab-ic">{ICONS[i.icon]}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
