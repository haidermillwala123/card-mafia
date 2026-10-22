import type { Metadata } from 'next';
import credits from '@/data/photo_credits.json';

export const metadata: Metadata = {
  title: 'Photo credits',
  description: 'Who took the city photos used in Card Mafia, and under which licence.',
  alternates: { canonical: '/credits' },
};

const NAMES: Record<string, string> = { dubai: 'Dubai', newyork: 'New York', london: 'London', lisbon: 'Lisbon', japan: 'Japan' };
type Credit = { title: string; artist: string; license: string; licenseUrl: string | null; page: string };

export default function CreditsPage() {
  return (
    <div className="container stack" style={{ ['--stack' as string]: '16px', paddingBottom: 'var(--space-2xl)' }}>
      <h1 className="t-h1">Photo credits</h1>
      <p className="muted measure">City photos come from Wikimedia Commons. Each is used under its own licence, shown below. Photos are resized and compressed; nothing else is changed.</p>
      <ul className="stack" style={{ ['--stack' as string]: '12px', listStyle: 'none', padding: 0 }}>
        {Object.entries(credits as Record<string, Credit>).map(([k, c]) => (
          <li key={k} className="measure">
            <b>{NAMES[k] ?? k}</b>: <a href={c.page} target="_blank" rel="noopener noreferrer">{c.title.replace(/\.[a-z]+$/i, '')}</a> by {c.artist || 'unknown'}, {c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">{c.license}</a> : c.license}.
          </li>
        ))}
      </ul>
    </div>
  );
}
