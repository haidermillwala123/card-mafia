'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/auth';
import Ic from './app/Icons';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/flights', label: 'Search' },
  { href: '/plan', label: 'Plan' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/transfers', label: 'Transfers' },
  { href: '/earn', label: 'Earn' },
  { href: '/trips', label: 'Trips' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/learn', label: 'Learn' },
];

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
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} className={`a-l${on(l.href) ? ' a-on' : ''}`} aria-current={on(l.href) ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
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
