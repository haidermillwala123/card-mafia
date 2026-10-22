'use client';

// An expanding image gallery: every place is a slim photo strip, and the one you hover, focus or tap opens up.
// Used on the home screen (links to seats) and on trip search (picks the destination). CSS lives in app/ds/unity.css (.xg).
import Link from 'next/link';
import { DESTINATIONS, type Destination } from '@/lib/destinations';

type Props = { hrefFor?: (d: Destination) => string; onPick?: (d: Destination) => void };

export default function DestinationGallery({ hrefFor, onPick }: Props) {
  return (
    <ul className="xg" aria-label="Places you can fly to">
      {DESTINATIONS.map((c, i) => {
        const inner = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/cities/${c.photo}-sm.webp`} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
            <span className="xg-name" aria-hidden="true">{c.name}</span>
            <span className="xg-more"><b>{c.name}</b><small>{c.country} · {c.sub}</small><em>See seats</em></span>
          </>
        );
        return (
          <li key={c.id} className={`xg-card${i === 0 ? ' on' : ''}`}>
            {hrefFor
              ? <Link href={hrefFor(c)} className="xg-a" aria-label={`${c.name}, ${c.country}. See seats.`}>{inner}</Link>
              : <button type="button" className="xg-a" onClick={() => onPick?.(c)} aria-label={`${c.name}, ${c.country}. Search seats.`}>{inner}</button>}
          </li>
        );
      })}
    </ul>
  );
}
