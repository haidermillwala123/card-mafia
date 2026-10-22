'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SeatView } from '@/lib/app/api';
import { CABIN_LABEL, dateShort, fmt, valuePerPoint } from '@/lib/app/format';
import { DataFoot, Note, SeenStamp, Tag } from '@/components/app/ui';
import {
  cardPoints, flightsText, MissingNote, NotReachable, partyMiles, PathStrip, reachable, Recheck, RulesStamp, seatsText, Skeleton, stopsText, taxesLine,
  timesText, urlFor, ErrorBox,
} from '@/components/app/booking/bits';
import { useSeats } from '@/components/app/booking/useSeats';
import './compare.css';

export default function CompareClient({ ids, travellers: n }: { ids: string[]; travellers: number }) {
  const s = useSeats(ids, n);
  const [fareText, setFareText] = useState('');
  const fare = parseInt(fareText, 10);
  const hasFare = Number.isFinite(fare) && fare > 0;
  const biggest = Math.max(1, ...s.rows.map(r => partyMiles(r, n)));
  const cheapest = s.rows.filter(reachable).sort((a, b) => a.miles - b.miles)[0]?.id;
  const cols = Math.max(1, Math.min(3, s.rows.length || ids.length));

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
              <Skeleton cols={cols} />
            ) : (
              <>
                {s.missing.length > 0 && <MissingNote />}
                <div className="a-g3">
                  {s.rows.map(r => (
                    <Column key={r.id} r={r} n={n} biggest={biggest} best={r.id === cheapest} fare={hasFare ? fare : null} s={s} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <Note kind="info" title="Maths comes from code, not a model.">
          Points, ratios, taxes and value per point are worked out by the engine. With no fare typed, no value is shown.
        </Note>
        <DataFoot />
      </div>
    </div>
  );
}

function Column({ r, n, biggest, best, fare, s }: { r: SeatView; n: number; biggest: number; best: boolean; fare: number | null; s: ReturnType<typeof useSeats> }) {
  const ok = reachable(r);
  const check = s.check(r.id);
  const miles = partyMiles(r, n);
  const pts = cardPoints(r);
  const vpp = fare !== null && r.taxes_known && r.taxes_inr !== null && pts ? valuePerPoint(fare, r.taxes_inr * n, pts) : undefined;
  const canGo = ok && !check.gone;
  const cls = `cm-btn ${best && canGo ? 'cm-btn--primary' : 'cm-btn--secondary'} cm-btn--sm a-pb`;
  return (
    <div className={`a-gl a-checkout-col${best ? ' a-sel' : ''}`}>
      <span className="a-cap">{dateShort(r.date)} · {r.programme_name} · {CABIN_LABEL[r.cabin] ?? r.cabin}</span>
      <div className="a-r a-rw" style={{ gap: 6 }}>
        <Tag kind={r.direct ? 'direct' : 'plain'} plain>{stopsText(r)}</Tag>
        {!ok && <Tag kind="danger" plain>Not reachable with your cards</Tag>}
      </div>
      <span>{flightsText(r)}</span>
      {timesText(r) && <span className="a-mu">{timesText(r)}</span>}

      <div className="a-kv"><span className="a-cap">Points</span><b className={`a-fig${best ? ' a-t' : ''}`}>{fmt(miles)}</b></div>
      <span className="a-mu">{n > 1 ? `${fmt(r.miles)} per person, ${n} travellers` : `${fmt(r.miles)} per person`}</span>
      <div className="a-bar"><i className={best ? 'a-t' : undefined} style={{ width: `${Math.round((miles / biggest) * 100)}%` }} /></div>

      {ok ? <PathStrip r={r} /> : <NotReachable r={r} hasCards={s.wallet.hasCards} />}
      {ok && pts !== null && <div className="a-kv"><span>Card points to move</span><b className="a-mono">{fmt(pts)}</b></div>}
      {ok && r.reach?.others.map(o => (
        <div className="a-kv" key={o.cardId}><span>From {o.cardName}</span><b className="a-mono">{fmt(o.pointsUsed)}{o.enough ? '' : ' (short)'}</b></div>
      ))}

      <div className="a-dsh" />
      <div className="a-kv"><span>Taxes{n > 1 && r.taxes_known ? ' per person' : ''}</span><b>{taxesLine(r)}</b></div>
      {vpp !== undefined && <div className="a-kv"><span>Value per point</span><b>{vpp === null ? 'Fare is not above taxes' : `₹${vpp.toFixed(2)}`}</b></div>}
      <div className="a-kv"><span>Seats</span><b>{seatsText(r)}</b></div>

      <RulesStamp r={r} fallback={s.rulesCheckedOn} />
      <SeenStamp iso={r.updated_at} />
      <Recheck check={check} onClick={() => s.recheck(r.id)} />
      {canGo ? (
        <Link className={cls} href={urlFor('checkout', r.id, n)}>Check out</Link>
      ) : (
        <button type="button" className={cls} disabled>Check out</button>
      )}
    </div>
  );
}
