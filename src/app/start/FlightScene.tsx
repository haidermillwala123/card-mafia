'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

// x, y: plane centre as a fraction of the stage. rot: degrees, negative is nose up. alt: feet. rw: runway-dash seconds, 0 is parked.
export const PHASES = [
  { label: 'Takeoff roll', x: 0.26, y: 0.745, rot: 0, alt: 0, rw: 1.2 },
  { label: 'Rotating', x: 0.38, y: 0.745, rot: -7, alt: 0, rw: 0.6 },
  { label: 'Airborne', x: 0.48, y: 0.62, rot: -14, alt: 1500, rw: 0.5 },
  { label: 'Climbing', x: 0.54, y: 0.42, rot: -20, alt: 18000, rw: 0 },
  { label: 'Cruising', x: 0.5, y: 0.22, rot: 0, alt: 36000, rw: 0 },
  { label: 'Descending', x: 0.46, y: 0.36, rot: 8, alt: 20000, rw: 0 },
  { label: 'On final', x: 0.48, y: 0.62, rot: 6, alt: 1200, rw: 0.9 },
  { label: 'Touchdown', x: 0.54, y: 0.745, rot: 0, alt: 0, rw: 1.4 },
  { label: 'At the gate', x: 0.56, y: 0.745, rot: 0, alt: 0, rw: 0 },
];

// Airbus A350: long fuselage, tall swept fin, raked wingtips, one large turbofan under each wing, six-window cockpit mask. No airline livery.
const DOORS = [82, 160, 232];
const WINDOWS = Array.from({ length: 23 }, (_, i) => 72 + i * 8).filter(x => !DOORS.some(d => x >= d - 2 && x <= d + 8));

function A350() {
  return (
    <svg className="pl" viewBox="0 -8 300 100" aria-hidden="true">
      <path className="wfar" d="M226 34 L156 34 L116 10 L110 -4 L122 -1 Q132 8 144 16 L190 25 Z" />
      <path className="stab" d="M72 41 L26 49 L16 49 L44 40 Z" />
      <path className="tail" d="M104 32.5 L50 -6 L20 -6 L38 32.5 Z" />
      <path className="body" d="M296 46 C291 38 272 33 244 32.5 L62 32.5 C42 32.5 22 34 6 39 L6 45 C24 51 46 57 68 58.5 L244 58.5 C272 58 291 54 296 46 Z" />
      <path className="fair" d="M122 58.5 Q178 67 236 58.5 Z" />
      <path className="stripe" d="M10 48 L291 48" />
      <path className="cockpit" d="M269 35.5 C277 36 284 39.5 289 43.5 L271 43.5 Z" />
      {WINDOWS.map(x => <circle key={x} className="win" cx={x} cy={41} r={1.6} />)}
      {DOORS.map(x => <rect key={x} className="door" x={x} y={35.5} width={8} height={15} rx={2} />)}
      <path className="wnear" d="M232 50 L136 58 L100 80 L90 90 L84 72 Q100 70 118 66 L196 56 Z" />
      <path className="pylon" d="M212 54 L228 54 L226 60 L214 60 Z" />
      <rect className="nacelle" x={196} y={58} width={44} height={16} rx={8} />
      <ellipse className="inlet" cx={238} cy={66} rx={3} ry={7.5} />
      <g className="gear"><path d="M170 58V84M262 58V86" /><circle cx={160} cy={88} r={4} /><circle cx={170} cy={88} r={4} /><circle cx={180} cy={88} r={4} /><circle cx={262} cy={88} r={4} /></g>
    </svg>
  );
}

// Skylines are drawn on a 600 x 160 ground line. Buildings are [x, width, height]; landmarks are paths. Dubai fades in for takeoff, New York for landing.
const BLOCKS: Record<'dxb' | 'nyc', [number, number, number][]> = {
  dxb: [[0, 24, 45], [26, 16, 70], [50, 20, 55], [72, 18, 78], [94, 20, 58], [188, 16, 68], [206, 18, 50], [284, 14, 96], [300, 16, 74], [344, 18, 62], [418, 18, 76], [440, 22, 60], [466, 18, 86], [490, 24, 52], [518, 20, 72], [544, 22, 60], [570, 28, 80]],
  nyc: [[0, 22, 70], [24, 18, 95], [44, 26, 60], [72, 16, 108], [90, 22, 78], [114, 14, 98], [132, 22, 66], [196, 18, 88], [216, 16, 68], [290, 16, 98], [308, 18, 74], [384, 18, 84], [404, 16, 106], [424, 22, 70], [450, 18, 94], [472, 22, 60], [498, 16, 88], [518, 24, 72], [546, 20, 96], [570, 28, 64]],
};
const LANDMARKS: Record<'dxb' | 'nyc', string[]> = {
  dxb: [
    'M232 160 V110 H238 V80 H243 V50 H247 V22 H249 L250 2 L251 22 H253 V50 H257 V80 H262 V110 H268 V160 Z', // Burj Khalifa
    'M368 160 L376 80 Q392 52 408 82 L402 160 Z M391 56 L392 34 L393 56 Z', // Burj Al Arab
    'M118 160 V72 L134 40 L150 72 V160 Z M154 160 V98 L168 76 L182 98 V160 Z', // Emirates Towers
    'M320 160 L322 72 L336 66 L338 160 Z', // Cayan Tower
  ],
  nyc: [
    'M236 160 V92 H244 V62 H250 V42 H255 V26 H258 L260 2 L262 26 H265 V42 H270 V62 H276 V92 H284 V160 Z', // Empire State Building
    'M334 160 L339 42 L352 24 L365 42 L370 160 Z M351 24 L352 0 L353 24 Z', // One World Trade Center
    'M168 160 V80 H174 V62 H177 Q180 48 183 62 H186 V80 H192 V160 Z M172 62 Q180 34 188 62 Z M176 42 Q180 16 184 42 Z M179.4 22 L180 4 L180.6 22 Z', // Chrysler Building
  ],
};

function Skyline({ kind }: { kind: 'dxb' | 'nyc' }) {
  const id = `sk-${kind}`;
  return (
    <svg className={`skyline ${kind}`} viewBox="0 0 600 164" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <pattern id={`${id}-w`} width="8" height="11" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="1.6" height="2.4" /></pattern>
      </defs>
      <g id={id}>
        {BLOCKS[kind].map(([x, w, h]) => <rect key={x} x={x} y={160 - h} width={w} height={h} />)}
        {LANDMARKS[kind].map((d, i) => <path key={i} d={d} />)}
      </g>
      <use href={`#${id}`} className="sk-base" />
      <use href={`#${id}`} className="sk-win" fill={`url(#${id}-w)`} />
    </svg>
  );
}

export default function FlightScene({ step, from }: { step: number; from: string }) {
  const ph = PHASES[Math.min(step, PHASES.length - 1)];
  const [alt, setAlt] = useState(0);
  const altRef = useRef(0);

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = altRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / (reduce ? 1 : 1600));
      altRef.current = start + (ph.alt - start) * (1 - Math.pow(1 - k, 3));
      setAlt(altRef.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ph.alt]);

  const style = { '--px': ph.x, '--py': ph.y, '--rot': `${ph.rot}deg`, '--rw': `${ph.rw || 1}s`, '--rwp': ph.rw ? 'running' : 'paused' } as CSSProperties;
  return (
    <div className="stage" aria-hidden="true">
      <div className="flight" data-s={step} style={style}>
        {Array.from({ length: 30 }, (_, i) => <i key={i} className="star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 68}%`, width: i % 5 ? 2 : 3, height: i % 5 ? 2 : 3, opacity: 0.12 + ((i * 7) % 5) * 0.06 }} />)}
        {[[10, 26, 0], [26, 20, -9], [42, 32, -17], [18, 38, -24]].map(([y, d, o], i) => <i key={i} className="cloud" style={{ top: `${y}%`, width: 90 + i * 26, ['--d' as string]: `${d}s`, ['--o' as string]: `${o}s` }} />)}
        <Skyline kind="dxb" />
        <Skyline kind="nyc" />
        <div className="ground"><div className="rw"><i className="dashes" /></div><div className="lights">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div></div>
        <div className="terminal">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
        <div className="bridge" />
        <div className="plane"><A350 /></div>
      </div>
      <div className="stage-top"><span className="wordmark">Card Mafia</span><span className="chip">{step <= 3 ? 'Departing Dubai' : step >= 5 ? 'Arriving New York' : 'En route'}</span></div>
      <dl className="readout">
        <div><dt>Flight phase</dt><dd>{ph.label}</dd></div>
        <div><dt>Altitude</dt><dd className="mono">{(Math.round(alt / 100) * 100).toLocaleString('en-IN')} ft</dd></div>
        <div><dt>Home airport</dt><dd className="mono">{from || '—'}</dd></div>
      </dl>
    </div>
  );
}
