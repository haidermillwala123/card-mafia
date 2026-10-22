import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="container stack" style={{ ['--stack' as string]: '16px', paddingBlock: 'var(--space-3xl)' }}>
      <h1 className="t-h1">We could not find that page.</h1>
      <p className="t-lg muted measure">The link may be old, or mistyped. Start from a plan, or read the rules we use.</p>
      <div className="btn-row">
        <Link className="btn btn-primary" href="/plan">Build my plan</Link>
        <Link className="btn btn-secondary" href="/rules">Read the rules</Link>
      </div>
    </div>
  );
}
