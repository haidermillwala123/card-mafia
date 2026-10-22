'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import type { SeatView } from '@/lib/app/api';
import { CABIN_LABEL, dateShort, duration, fmt, valuePerPoint } from '@/lib/app/format';
import { DataFoot, Note, SeenStamp, Tag } from '@/components/app/ui';
import {
  cardPoints, flightsText, MissingNote, NotReachable, PathStrip, reachable, Recheck, RulesStamp, seatsText, Skeleton, stopsText, taxesLine,
  timesText, urlFor, ErrorBox,
} from '@/components/app/booking/bits';
import { useSeats } from '@/components/app/booking/useSeats';
import './compare.css';

type Seats = ReturnType<typeof useSeats>;

// indexes of the best value in a row (ties all count); empty when fewer than two values exist or all are equal
function bestIdx(vals: (number | null)[], lowest: boolean): number[] {
  const known = vals.filter((v): v is number => v !== null);
  if (known.length < 2) return [];
  const t = lowest ? Math.min(...known) : Math.max(...known);
  if (known.every(v => v === t)) return [];
  return vals.flatMap((v, i) => (v === t ? [i] : []));
}

export default function CompareClient({ ids, travellers: n }: { ids: string[]; travellers: number }) {
  const s = useSeats(ids, n);
  const [fareText, setFareText] = useState('');
  const fare = parseInt(fareText, 10);
  const hasFare = Number.isFinite(fare) && fare > 0;

  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Step 2 · The path</span>
        <h1 className="a-hd a-sm">
          Compare seats.<br />
          <em>Same trip, side by side.</em>
        </h1>

        {ids.length === 0 ? (
          <Note kind="info" title="Pick seats to compare first.">
            <Link href="/flights" style={{ textDecoration: 'underline' }}>Go to search.</Link>
          </Note>
        ) : (
          <>
            <div className="a-r a-rw">
              <label className="a-field a-g a-checkout-fare">
                <span className="a-aff">₹</span>
                <input type="text" inputMode="numeric" value={fareText} onChange={e => setFareText(e.target.value.replace(/[^0-9]/g, ''))} placeholder={`Cash fare for ${n} traveller${n === 1 ? '' : 's'}, optional`} aria-label="Cash fare in rupees" />
              </label>
              <span className="a-mu">Type a cash fare to see value per point. Value = (fare − taxes) ÷ points moved.</span>
            </div>

            {s.error ? (
              <ErrorBox error={s.error} onRetry={s.retry} />
            ) : s.loading ? (
              <Skeleton cols={Math.max(1, Math.min(3, ids.length))} />
            ) : (
              <>
                {s.missing.length > 0 && <MissingNote />}
                <Table rows={s.rows} n={n} fare={hasFare ? fare : null} s={s} />
              </>
            )}
          </>
        )}

        <Note kind="info" title="Maths comes from code, not a model.">
          Points, ratios, taxes and value per point are worked out by the engine. With no fare typed, no value is shown. &quot;Best&quot; marks the better value in a row, only when the seats differ.
        </Note>
        <DataFoot />
      </div>
    </div>
  );
}

function Table({ rows, n, fare, s }: { rows: SeatView[]; n: number; fare: number | null; s: Seats }) {
  const pts = rows.map(cardPoints);
  const vpp = rows.map((r, i) => (fare !== null && r.taxes_known && r.taxes_inr !== null && pts[i] ? valuePerPoint(fare, r.taxes_inr * n, pts[i]!) : null));
  const best = {
    points: bestIdx(rows.map((r, i) => (reachable(r) ? pts[i] : null)), true),
    taxes: bestIdx(rows.map(r => (r.taxes_known ? r.taxes_inr : null)), true),
    vpp: bestIdx(vpp, false),
    stops: bestIdx(rows.map(r => r.stops), true),
    time: bestIdx(rows.map(r => r.duration_minutes), true),
    seats: bestIdx(rows.map(r => r.seats), false),
  };
  const na = <span className="a-mu">not published</span>;
  const line = (label: string, cell: (r: SeatView, i: number) => ReactNode, win?: number[]) => (
    <tr>
      <th scope="row">{label}</th>
      {rows.map((r, i) => (
        <td key={r.id} className={win?.includes(i) ? 'is-best' : undefined}>
          {cell(r, i)}
          {win?.includes(i) && <Tag kind="best" plain>Best</Tag>}
        </td>
      ))}
    </tr>
  );
  return (
    <div className="a-cmp-wrap">
      <table className="a-cmp" style={{ ['--cols' as string]: rows.length }}>
        <thead>
          <tr>
            <td />
            {rows.map((r, i) => (
              <th scope="col" key={r.id} className={best.points.includes(i) ? 'is-best' : undefined}>
                <span className="a-cap">{dateShort(r.date)} · {CABIN_LABEL[r.cabin] ?? r.cabin}</span>
                <b className="a-cmp-prog">{r.programme_name}</b>
                <span className="a-mu">{r.origin} → {r.dest}</span>
                <span className="a-cmp-tags">
                  {best.points.includes(i) && <Tag kind="best">Fewest card points</Tag>}
                  {s.wallet.hasCards && !reachable(r) && <Tag kind="danger" plain>Not reachable with your cards</Tag>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {line('Points for everyone', r => <b className="a-fig">{fmt(r.miles * n)}</b>)}
          {line('Card points to move', (r, i) => (reachable(r) && pts[i] !== null ? <b className="a-mono">{fmt(pts[i]!)}</b> : s.wallet.hasCards ? <span className="a-mu">cannot be paid with your cards</span> : <span className="a-mu">add cards to see this</span>), best.points)}
          <tr>
            <th scope="row">Transfer path</th>
            {rows.map(r => <td key={r.id}>{reachable(r) ? <PathStrip r={r} /> : <NotReachable r={r} hasCards={s.wallet.hasCards} />}</td>)}
          </tr>
          {line(`Taxes${n > 1 ? ' per person' : ''}`, r => taxesLine(r), best.taxes)}
          {fare !== null && line('Value per point', (_, i) => (vpp[i] === null ? <span className="a-mu">Fare is not above taxes, or taxes unknown</span> : <b>₹{vpp[i]!.toFixed(2)}</b>), best.vpp)}
          {line('Stops', r => stopsText(r), best.stops)}
          {line('Journey time', r => duration(r.duration_minutes) ?? na, best.time)}
          {line('Departs and arrives', r => timesText(r).split(' · ')[0] || na)}
          {line('Flights', r => flightsText(r))}
          {line('Seats', r => seatsText(r), best.seats)}
          <tr>
            <th scope="row">Checked</th>
            {rows.map(r => (
              <td key={r.id}>
                <RulesStamp r={r} fallback={s.rulesCheckedOn} />
                <SeenStamp iso={r.updated_at} />
                <Recheck check={s.check(r.id)} onClick={() => s.recheck(r.id)} />
              </td>
            ))}
          </tr>
          <tr className="a-cmp-go">
            <th scope="row"><span className="a-flights-vh">Continue</span></th>
            {rows.map((r, i) => {
              const canGo = reachable(r) && !s.check(r.id).gone;
              const cls = `cm-btn ${best.points.includes(i) && canGo ? 'cm-btn--primary' : 'cm-btn--secondary'} a-pb`;
              return (
                <td key={r.id}>
                  {canGo ? <Link className={cls} href={urlFor('checkout', r.id, n)}>Continue to checkout</Link> : <button type="button" className={cls} disabled>Cannot check out</button>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
