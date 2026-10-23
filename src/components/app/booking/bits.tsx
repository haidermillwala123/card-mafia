'use client';

// Small pieces shared by Compare, Checkout and Hand-off. Presentation and wording only; the money maths stays on the server.
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { SeatView } from '@/lib/app/api';
import { programmeName } from '@/lib/app/catalog';
import { dateShort, duration, fmt, inr, timeLabel } from '@/lib/app/format';
import { cityOf } from '@/lib/airports';
import { Note, Tag, VerifiedStamp } from '@/components/app/ui';
import type { Check } from './useSeats';

export const dateFull = (iso: string) => `${dateShort(iso)} ${iso.slice(0, 4)}`;
export const routeText = (r: SeatView) => `${cityOf(r.origin)} to ${cityOf(r.dest)}`;
export const reachable = (r: SeatView) => r.reach?.status === 'ok' || r.reach?.status === 'pooled';
export const stopsText = (r: SeatView) => (r.direct || r.stops === 0 ? 'Direct' : `${r.stops} stop${r.stops === 1 ? '' : 's'}`);
export const seatsText = (r: SeatView) => (r.seats === null ? 'Seats unknown' : `${r.seats} seat${r.seats === 1 ? '' : 's'} left`);
export const flightsText = (r: SeatView) => [r.airline, r.flights.join(', ')].filter(Boolean).join(' ') || 'Flight numbers not listed';
export const timesText = (r: SeatView) => [timeLabel(r.departs_at) && `${timeLabel(r.departs_at)} to ${timeLabel(r.arrives_at) ?? '?'}`, duration(r.duration_minutes)].filter(Boolean).join(' · ');
export const partyMiles = (r: SeatView, n: number) => r.miles * n;
export const urlFor = (path: string, id: string, n: number) => `/flights/${path}?id=${encodeURIComponent(id)}&n=${n}`;

// Taxes in rupees for one traveller; the original amount stays small beside it.
export function taxesLine(r: SeatView): ReactNode {
  if (!r.taxes_known || r.taxes_amount === null) return 'Taxes: see airline';
  const orig = r.taxes_currency !== 'INR' ? ` (${fmt(r.taxes_amount)} ${r.taxes_currency})` : '';
  return (
    <>
      {inr(r.taxes_inr) ?? `${fmt(r.taxes_amount)} ${r.taxes_currency}`}
      {orig && <small className="a-mu">{orig}</small>}
    </>
  );
}
export const taxesPlain = (r: SeatView) => (r.taxes_known && r.taxes_inr !== null ? inr(r.taxes_inr) : 'Taxes: see airline');

// Card points that leave the wallet for this seat: the best card, or the sum when two cards are pooled.
export function cardPoints(r: SeatView): number | null {
  const x = r.reach;
  if (!x) return null;
  if (x.status === 'ok' && x.best) return x.best.pointsUsed;
  if (x.status === 'pooled' && x.pooled) return x.pooled.transfers.reduce((s, t) => s + t.sourcePoints, 0);
  return null;
}

export function verifiedOn(r: SeatView, fallback: string | null): string | null {
  const d = r.reach?.best?.hops.map(h => h.verifiedOn).find(Boolean) ?? fallback;
  return d ? d.slice(0, 10) : null;
}
export const RulesStamp = ({ r, fallback }: { r: SeatView; fallback: string | null }) => {
  const d = verifiedOn(r, fallback);
  return d ? <VerifiedStamp>Rules verified {dateFull(d)}</VerifiedStamp> : null;
};

// card -> programme chain, each hop with its ratio. Pooled seats list the cards that share the cost.
export function PathStrip({ r }: { r: SeatView }) {
  const x = r.reach;
  if (x?.status === 'ok' && x.best) {
    return (
      <div className="a-hop">
        <Tag kind="outline">{x.best.cardName}</Tag>
        {x.best.hops.map((h, i) => (
          <Fragment key={i}>
            <span className="a-mono a-mu">{h.ratio}</span>
            <Tag kind={i === x.best!.hops.length - 1 ? 'best' : 'outline'}>{programmeName(h.to)}</Tag>
          </Fragment>
        ))}
      </div>
    );
  }
  if (x?.status === 'pooled' && x.pooled) {
    return (
      <div className="a-c">
        <Tag kind="warning" plain style={{ alignSelf: 'flex-start' }}>Needs more than one card</Tag>
        {x.pooled.transfers.map(t => (
          <div className="a-kv" key={t.cardId}>
            <span>From {t.cardName}</span>
            <b className="a-mono">{fmt(t.sourcePoints)} pts</b>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// Shown in place of the path when the seat cannot be paid for with the saved cards.
export function NotReachable({ r, hasCards }: { r: SeatView; hasCards: boolean }) {
  if (reachable(r)) return null;
  if (!hasCards)
    return (
      <span className="a-mu">
        Add your cards in <Link href="/wallet" style={{ textDecoration: 'underline' }}>Wallet</Link> to see how to pay
      </span>
    );
  const fix = r.reach?.fix;
  const short = r.reach?.best?.shortBy;
  return (
    <div className="a-c" style={{ gap: 6 }}>
      <Tag kind="outline" style={{ alignSelf: 'flex-start' }}>Not enough points on your cards yet</Tag>
      {r.reach?.status === 'short' && short ? <span className="a-mu">You are {fmt(short)} points short on {r.reach.best?.cardName}.</span> : null}
      {r.reach?.status === 'unmapped' ? <span className="a-mu">We have no transfer rule for {r.programme_name}.</span> : null}
      {fix ? <span className="a-mu">{fix.cardName} would cover it with {fmt(fix.pointsNeeded)} points.</span> : null}
    </div>
  );
}

// "Re-check this seat" button with its result line. A seat that is gone gets the danger note instead.
export function Recheck({ check, onClick }: { check: Check; onClick: () => void }) {
  return (
    <div className="a-c" style={{ gap: 8 }}>
      <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" style={{ alignSelf: 'flex-start' }} onClick={onClick} disabled={check.busy}>
        {check.busy ? 'Checking' : 'Re-check this seat'}
      </button>
      <span role="status" className="a-cap">{check.msg ?? ''}</span>
      {check.gone && <Note kind="danger" title="That flight is no longer listed.">Do not transfer for it.</Note>}
    </div>
  );
}

export function Skeleton({ cols = 1 }: { cols?: number }) {
  return (
    <div className={cols === 3 ? 'a-g3' : cols === 2 ? 'a-g2' : undefined} aria-busy="true" aria-label="Loading">
      {Array.from({ length: cols }, (_, i) => (
        <div className="a-gl" key={i}>
          <div className="a-sk" style={{ width: '40%' }} />
          <div className="a-sk" style={{ width: '80%', height: 28 }} />
          <div className="a-sk" />
          <div className="a-sk" style={{ width: '60%' }} />
          <div className="a-sk" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="a-c" style={{ gap: 12 }}>
      <Note kind="danger" title="We could not load this.">{error}</Note>
      <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" style={{ alignSelf: 'flex-start' }} onClick={onRetry}>Retry</button>
    </div>
  );
}

export const MissingNote = () => (
  <Note kind="warning" title="We no longer have that seat.">
    <Link href="/flights" style={{ textDecoration: 'underline' }}>Search again.</Link>
  </Note>
);
