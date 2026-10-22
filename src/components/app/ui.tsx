'use client';

import type { ReactNode } from 'react';
import { ageLabel, isStale } from '@/lib/app/format';
import Ic from './Icons';

// "Seen 3 h ago". Past a day it turns to the stale colour, so an old seat never looks fresh.
export function SeenStamp({ iso, prefix = 'Seen' }: { iso: string; prefix?: string }) {
  return (
    <span className={`cm-stamp${isStale(iso) ? ' cm-stamp--stale' : ''}`} suppressHydrationWarning>
      <Ic name="clock" small />
      {prefix} {ageLabel(iso)} ago
    </span>
  );
}

export function VerifiedStamp({ children }: { children: ReactNode }) {
  return (
    <span className="cm-stamp cm-stamp--verified">
      <Ic name="badge" small />
      {children}
    </span>
  );
}

export type TagKind = 'plain' | 'best' | 'premium' | 'direct' | 'verified' | 'warning' | 'danger' | 'outline';
export function Tag({ kind = 'plain', children, plain = false, style }: { kind?: TagKind; children: ReactNode; plain?: boolean; style?: React.CSSProperties }) {
  const k = kind === 'plain' ? '' : ` cm-tag--${kind}`;
  return (
    <span className={`cm-tag${k}${plain ? ' a-tn' : ''}`} style={style}>
      {children}
    </span>
  );
}

// seats.aero asks for visible attribution with a link wherever its data is shown.
export function SeatsCredit() {
  return (
    <span className="a-cap">
      Seat data from{' '}
      <a href="https://seats.aero" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
        seats.aero
      </a>
    </span>
  );
}

export function Note({ kind, title, children }: { kind: 'info' | 'success' | 'warning' | 'danger'; title: string; children?: ReactNode }) {
  return (
    <div className={`cm-note cm-note--${kind}`} role={kind === 'danger' || kind === 'warning' ? 'alert' : undefined}>
      <Ic name={kind === 'danger' ? 'alert' : kind === 'info' ? 'shield' : 'clock'} />
      <span>
        <span className="cm-note__title">{title}</span>
        {children}
      </span>
    </div>
  );
}

// The line under every data screen.
export function DataFoot({ extra }: { extra?: ReactNode }) {
  return (
    <div className="a-foot">
      <SeatsCredit />
      {extra}
      <span className="a-g" />
      <span className="a-cap">Seats can disappear before you transfer.</span>
    </div>
  );
}
