'use client';

// Pieces shared by the top-three cards, the phone list and the table: what a seat costs, who can pay, how old it is.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SeenStamp, Tag } from '@/components/app/ui';
import type { SeatView } from '@/lib/app/api';
import { CABIN_LABEL, dateShort, fmt, inr, isStale, valuePerPoint } from '@/lib/app/format';

export const payable = (r: SeatView) => r.reach?.status === 'ok' || r.reach?.status === 'pooled';
// dimmed when the person cannot pay for it, or when the data is over a day old
export const dimmed = (r: SeatView) => (r.reach !== null && !payable(r)) || isStale(r.updated_at);

export const stopsLabel = (r: SeatView) => (r.direct ? 'Direct' : r.stops === 1 ? '1 stop' : r.stops > 1 ? `${r.stops} stops` : 'Stops unknown');
export const seatsLabel = (r: SeatView) => (r.seats === null ? 'Seats unknown' : String(r.seats));

// Rupees from taxes_inr, original amount small beside it. Unknown stays unknown.
export function Taxes({ r }: { r: SeatView }) {
  if (!r.taxes_known) return <span className="a-mu">Taxes: see airline</span>;
  const original = r.taxes_amount !== null && r.taxes_currency !== 'INR' ? `${r.taxes_currency} ${fmt(r.taxes_amount)}` : null;
  if (r.taxes_inr === null) return <span>{original ?? 'Taxes: see airline'}</span>;
  return (
    <span>
      {inr(r.taxes_inr)}
      {original && <small className="a-flights-orig"> {original}</small>}
    </span>
  );
}

export function PaidBy({ r }: { r: SeatView }) {
  const re = r.reach;
  if (!re) return <span className="a-mu">Add cards to see this</span>;
  if (re.status === 'ok' && re.best) return <span>{re.best.cardName} {re.best.ratio}</span>;
  if (re.status === 'pooled') return <span>Pool of your cards</span>;
  return <span>Not reachable with your cards</span>;
}

// "You are N points short. <card> closes the gap." only from reach.best / reach.fix, never made up.
export function ShortText({ r }: { r: SeatView }) {
  const re = r.reach;
  if (!re || payable(r)) return null;
  const short = re.best && re.best.shortBy > 0 ? `You are ${fmt(re.best.shortBy)} points short.` : null;
  const fix = re.fix ? (short ? ` ${re.fix.cardName} closes the gap.` : `${re.fix.cardName} would need ${fmt(re.fix.pointsNeeded)} points for this seat.`) : '';
  return short || fix ? <span className="a-flights-short">{short}{fix}</span> : null;
}

export function Vpp({ r, fare }: { r: SeatView; fare: number | null }) {
  if (!fare || r.taxes_inr === null) return null;
  const v = valuePerPoint(fare, r.taxes_inr, r.miles);
  return v === null ? null : <span>₹{v} per point</span>;
}

type PickProps = { picked: boolean; locked: boolean; onPick: (id: string) => void };
export const PickBox = ({ r, picked, locked, onPick }: { r: SeatView } & PickProps) => (
  <label className="cm-check a-flights-pick">
    <input type="checkbox" checked={picked} disabled={locked && !picked} onChange={() => onPick(r.id)} aria-label={`Compare ${dateShort(r.date)} ${r.programme_name}`} />
    <span className="cm-check__text"><span className="cm-check__label">Compare</span></span>
  </label>
);

export const checkoutHref = (id: string, n: number) => `/flights/checkout?id=${encodeURIComponent(id)}&n=${n}`;

export function SeatCard({ r, n, fare, selected, ...pick }: { r: SeatView; n: number; fare: number | null; selected: boolean } & PickProps) {
  return (
    <article className={`a-gl a-flights-card${selected ? ' a-sel' : ''}${dimmed(r) ? ' a-u' : ''}`}>
      <div className="a-r">
        <span className="a-cap a-g">{dateShort(r.date)} · {r.programme_name}</span>
        <Tag kind="premium">{CABIN_LABEL[r.cabin] ?? r.cabin}</Tag>
      </div>
      <div className="a-big">
        {fmt(r.miles)} <small>pts + <Taxes r={r} /></small>
      </div>
      <div className="a-dsh" />
      <div className="a-kv"><span>Pay with</span><b><PaidBy r={r} /></b></div>
      <ShortText r={r} />
      <div className="a-kv"><span>Seats</span><b>{seatsLabel(r)}</b></div>
      <div className="a-kv"><span>Stops</span><b>{stopsLabel(r)}</b></div>
      {r.airline && <div className="a-kv"><span>Airline</span><b>{r.airline}</b></div>}
      {fare ? <div className="a-kv"><span>Value</span><b><Vpp r={r} fare={fare} /></b></div> : null}
      <SeenStamp iso={r.updated_at} />
      <div className="a-r a-rw">
        <PickBox r={r} {...pick} />
        <span className="a-g" />
        <Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href={checkoutHref(r.id, n)}>Check out</Link>
      </div>
    </article>
  );
}

export function SeatTable({ rows, n, fare, picks, onPick }: { rows: SeatView[]; n: number; fare: number | null; picks: string[]; onPick: (id: string) => void }): ReactNode {
  return (
    <div className="cm-table-wrap a-flights-table">
      <table className="cm-table">
        <thead>
          <tr>
            <th>Compare</th><th>Date</th><th>Programme</th><th>Cabin</th><th className="is-num">Points</th><th className="is-num">Taxes</th>
            {fare ? <th className="is-num">Value per point</th> : null}
            <th>Stops</th><th className="is-num">Seats</th><th>Airline</th><th>Age</th><th>Your cards</th><th><span className="a-flights-vh">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={`${picks.includes(r.id) ? 'is-selected' : ''}${dimmed(r) ? ' a-u' : ''}`}>
              <td><PickBox r={r} picked={picks.includes(r.id)} locked={picks.length >= 3} onPick={onPick} /></td>
              <td className="is-mono">{dateShort(r.date)}</td>
              <td>{r.programme_name}</td>
              <td>{CABIN_LABEL[r.cabin] ?? r.cabin}</td>
              <td className="is-num is-mono">{fmt(r.miles)}</td>
              <td className="is-num"><Taxes r={r} /></td>
              {fare ? <td className="is-num is-mono"><Vpp r={r} fare={fare} /></td> : null}
              <td>{r.direct ? <Tag kind="direct" plain>Direct</Tag> : stopsLabel(r)}</td>
              <td className="is-num is-mono">{seatsLabel(r)}</td>
              <td>{r.airline ?? ''}</td>
              <td><SeenStamp iso={r.updated_at} prefix="" /></td>
              <td>
                <PaidBy r={r} />
                {!payable(r) && r.reach && <><br /><ShortText r={r} /></>}
              </td>
              <td><Link className="cm-btn cm-btn--secondary cm-btn--sm a-pb" href={checkoutHref(r.id, n)}>Check out</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
