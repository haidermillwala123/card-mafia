'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useUser } from '@/lib/auth';

const LINKS = [
  { href: '/plan', label: 'Build a plan' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/transfers', label: 'Transfers', optional: true },
  { href: '/rules', label: 'Rules', optional: true },
  { href: '/pricing', label: 'Free and Pro', optional: true },
  { href: '/start', label: 'Set up', optional: true },
];

export default function Header() {
  const path = usePathname();
  const user = useUser();
  const account = user ? { href: '/account', label: 'Account' } : { href: '/signin', label: 'Sign in' };
  return (
    <header className="site-head">
      <div className="container bar">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          {[...LINKS, account].map(l => (
            <Link key={l.href} href={l.href} className={'optional' in l && l.optional ? 'opt' : undefined} aria-current={path === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
