'use client';

// A mosaic of places: rounded photo tiles in mixed sizes. Home links each one to seats; trip search uses it to pick the destination.
// CSS lives in app/ds/unity.css (.xg).
import Link from 'next/link';
import { useState } from 'react';
import { DESTINATIONS, type Destination } from '@/lib/destinations';

type Props = { hrefFor?: (d: Destination) => string; onPick?: (d: Destination) => void };
const FIRST = 12;

export default function DestinationGallery({ hrefFor, onPick }: Props) {
  const [all, setAll] = useState(false);
  const list = all ? DESTINATIONS : DESTINATIONS.slice(0, FIRST);
  return (
    <>
    <ul className="xg" aria-label="Places you can fly to">
      {list.map((c, i) => {
        const inner = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/cities/${c.photo}${c.shape === 'big' || c.shape === 'wide' ? '' : '-sm'}.webp`} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
            <span className="xg-more"><b>{c.name}</b><small>{c.country}</small><em>See seats</em></span>
          </>
        );
        return (
          <li key={c.id} className={`xg-card${c.shape ? ` xg-${c.shape}` : ''}`}>
            {hrefFor
              ? <Link href={hrefFor(c)} className="xg-a" aria-label={`${c.name}, ${c.country}. See seats.`}>{inner}</Link>
              : <button type="button" className="xg-a" onClick={() => onPick?.(c)} aria-label={`${c.name}, ${c.country}. Search seats.`}>{inner}</button>}
          </li>
        );
      })}
    </ul>
    {DESTINATIONS.length > FIRST && (
      <button type="button" className="xg-all" aria-expanded={all} onClick={() => setAll(v => !v)}>
        {all ? 'Show fewer places' : `Show all ${DESTINATIONS.length} places`}
      </button>
    )}
    </>
  );
}
