'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/lib/auth';
import Ic from './app/Icons';
import ThemeToggle from './ThemeToggle';

// Two things: your cards and your trips. Settings and the rest sit under More.
const MAIN = [{ href: '/home', label: 'Home' }];
const GROUPS = [
  { label: 'Cards', items: [
    { href: '/cards/recommend', label: 'Best card for you', hint: 'From what you spend' },
    { href: '/earn', label: 'Best way to earn', hint: 'Filter 58 cards' },
    { href: '/wallet', label: 'Wallet', hint: 'Your cards and balances' },
    { href: '/transfers', label: 'Transfers', hint: 'Ratios, caps and routes' },
    { href: '/earn/calculator', label: 'Points calculator', hint: 'What your spend earns' },
  ] },
  { label: 'Trips', items: [
    { href: '/flights', label: 'Search for trips', hint: 'Every seat from India' },
    { href: '/trips/ideas', label: 'Trips you can take', hint: 'With the points you have' },
    { href: '/trips', label: 'Upcoming trips', hint: 'Your saved plans' },
    { href: '/plan', label: 'Plan a trip', hint: 'Top 3 plans' },
  ] },
  { label: 'More', items: [
    { href: '/account', label: 'Profile settings', hint: 'Your details and data' },
    { href: '/alerts', label: 'Alerts', hint: 'Routes we watch for you' },
    { href: '/learn', label: 'Glossary and guides', hint: 'Terms and tools' },
    { href: '/home?tour=1', label: 'Take the tour', hint: 'Where everything is' },
  ] },
];

function Group({ label, items, path }: { label: string; items: { href: string; label: string; hint: string }[]; path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const here = items.some(i => path === i.href || path.startsWith(`${i.href}/`));
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="a-grp" ref={ref}>
      <button type="button" className={`a-l${here ? ' a-on' : ''}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>
        {label}<i aria-hidden="true">▾</i>
      </button>
      {open && (
        <div className="a-drop" role="menu">
          {items.map(i => (
            <Link key={i.href} href={i.href} role="menuitem" aria-current={path === i.href ? 'page' : undefined} onClick={() => setOpen(false)}>
              <b>{i.label}</b><small>{i.hint}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// The floating pill navigation from the v2 design. On a phone the links move to the bottom bar (MobileBar).
export default function Header() {
  const path = usePathname();
  const user = useUser();
  const on = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <header>
      <nav className="a-nav" aria-label="Main">
        <Link href="/home" className="a-lg" aria-label="Card Mafia home">
          <span className="a-mk" aria-hidden="true" />
          Card Mafia
        </Link>
        {MAIN.map(l => (
          <Link key={l.href} href={l.href} className={`a-l${on(l.href) ? ' a-on' : ''}`} aria-current={on(l.href) ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
        {GROUPS.map(g => <Group key={g.label} label={g.label} items={g.items} path={path} />)}
        <ThemeToggle />
        <Link href={user ? '/account' : '/signin'} className="a-av" aria-label={user ? 'Account' : 'Sign in'}>
          <Ic name="user" />
        </Link>
        <Link href="/home" className="cm-btn cm-btn--primary cm-btn--sm a-np">
          New plan
        </Link>
      </nav>
    </header>
  );
}
