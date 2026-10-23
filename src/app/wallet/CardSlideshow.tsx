'use client';

// Wallet cards as an automatic slideshow: one card at a time, advancing on a timer. Hover or focus pauses it; dots jump to a card.
import { Children, type ReactNode, useEffect, useState } from 'react';

const EVERY_MS = 3500;

export default function CardSlideshow({ children, label }: { children: ReactNode; label: string }) {
  const slides = Children.toArray(children);
  const n = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const at = Math.min(i, n - 1);

  useEffect(() => {
    if (n < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI(x => (x + 1) % n), EVERY_MS);
    return () => clearInterval(t);
  }, [n, paused]);

  return (
    <div className="ws" role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="ws-track" style={{ transform: `translateX(-${at * 100}%)` }}>
        {slides.map((s, k) => (
          <div className="ws-slide" key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} aria-hidden={k !== at}>{s}</div>
        ))}
      </div>
      {n > 1 && (
        <div className="ws-dots">
          {slides.map((_, k) => (
            <button type="button" key={k} className={k === at ? 'on' : ''} aria-label={`Show card ${k + 1}`} aria-current={k === at} onClick={() => setI(k)} />
          ))}
        </div>
      )}
    </div>
  );
}
