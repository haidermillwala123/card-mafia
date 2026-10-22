'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

// Hackathon demo: one main screen. Account, pricing, calculator and transfer pages still exist but are not linked.
const LINKS = [
  { href: '/plan', label: 'Build a plan' },
];

export default function Header() {
  const path = usePathname();
  return (
    <header className="site-head">
      <div className="container bar">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
