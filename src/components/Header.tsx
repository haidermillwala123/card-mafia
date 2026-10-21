'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { href: '/plan', label: 'Build a plan' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/transfers', label: 'Transfers', optional: true },
  { href: '/rules', label: 'Rules', optional: true },
  { href: '/start', label: 'Set up', optional: true },
];

export default function Header() {
  const path = usePathname();
  return (
    <header className="site-head">
      <div className="container bar">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={l.optional ? 'opt' : undefined} aria-current={path === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
