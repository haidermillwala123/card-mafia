'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import Ic from '@/components/app/Icons';
import { programmeName } from '@/lib/app/catalog';
import { CABIN_LABEL, dateShort, fmt } from '@/lib/app/format';
import { useProgrammeBalance } from '@/lib/app/loyalty';
import { DataFoot, Note, SeenStamp, Tag } from '@/components/app/ui';
import {
  cardPoints, ErrorBox, flightsText, MissingNote, NotReachable, partyMiles, PathStrip, reachable, Recheck, routeText, RulesStamp, seatsText, Skeleton, stopsText,
  taxesLine, timesText, urlFor,
} from '@/components/app/booking/bits';
import BuyPoints from '@/components/app/booking/BuyPoints';
import { useSeats } from '@/components/app/booking/useSeats';
import './checkout.css';

export default function CheckoutClient({ id, travellers: n }: { id: string; travellers: number }) {
  const s = useSeats(id ? [id] : [], n);
  const [ticked, setTicked] = useState(false);
  const r = s.rows[0];
  const check = s.check(id);
  // points already saved in the airline's own programme (Wallet) cover the seat: no transfer needed, book directly
  const held = useProgrammeBalance(r?.programme_id);
  const direct = Boolean(r && held !== null && held >= partyMiles(r, n));
  const ok = r ? (reachable(r) || direct) && !check.gone : false;
  const go = ok && (ticked || direct);
  const best = r?.reach?.best ?? null;
  const pts = r ? cardPoints(r) : null;
  const balances = s.wallet.holdings.balances;

  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Step 3 · Safety check</span>
        <h1 className="a-hd a-sm">
          Check every ratio<br />
          <em>before you move a point.</em>
        </h1>

        {!id ? (
          <Note kind="info" title="Pick a seat first.">
            <Link href="/flights" style={{ textDecoration: 'underline' }}>Go to search.</Link>
          </Note>
        ) : s.error ? (
          <ErrorBox error={s.error} onRetry={s.retry} />
        ) : s.loading ? (
          <Skeleton cols={2} />
        ) : !r ? (
          <MissingNote />
        ) : (
          <div className="a-split">
            <div className="a-main a-c" style={{ gap: 16 }}>
              <div className="a-gl">
                <span className="a-cap">Seat</span>
                <b style={{ font: '650 20px var(--font-display)' }}>{dateShort(r.date)} · {r.origin} → {r.dest} · {r.programme_name} · {CABIN_LABEL[r.cabin] ?? r.cabin}</b>
                <span className="a-mu">{routeText(r)}</span>
                <div className="a-r a-rw">
                  <Tag kind="premium">{CABIN_LABEL[r.cabin] ?? r.cabin}</Tag>
                  <Tag kind={r.direct ? 'direct' : 'plain'} plain>{stopsText(r)}</Tag>
                  <span className="a-g" />
                  <SeenStamp iso={r.updated_at} />
                </div>
                <span>{flightsText(r)}{timesText(r) ? ` · ${timesText(r)}` : ''}</span>
                <span className="a-mu">{seatsText(r)}. This checkout is for {n} traveller{n === 1 ? '' : 's'}.</span>
              </div>

              <div className="a-gl">
                <span className="a-cap">{direct ? 'Your points' : reachable(r) ? 'Move points' : 'Not enough points yet'}</span>
                {direct && (
                  <Note kind="success" title={`You already have ${fmt(held ?? 0)} points in ${r.programme_name}.`}>
                    That covers the {fmt(partyMiles(r, n))} this seat needs, from the balance saved in your Wallet. You can book directly: no transfer needed.
                  </Note>
                )}
                {reachable(r) ? (
                  <>
                    <div className="a-r a-rw">
                      <div className="a-g"><PathStrip r={r} /></div>
                      {pts !== null && <b className="a-fig">{fmt(pts)}</b>}
                    </div>
                    {best && r.reach?.status === 'ok' && (
                      <div className="a-c" style={{ gap: 4 }}>
                        {best.hops.map((h, i) => (
                          <div className="a-kv" key={i}>
                            <span>{i === 0 ? best.cardName : programmeName(h.from)} to {programmeName(h.to)} at {h.ratio}</span>
                            <b className="a-mono">{fmt(h.pointsIn)} to {fmt(h.pointsOut)}</b>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="a-kv"><span>Total card points</span><b className="a-mono">{pts !== null ? fmt(pts) : ''}</b></div>
                    <div className="a-kv"><span>Points in {r.programme_name}</span><b className="a-mono">{fmt(partyMiles(r, n))}</b></div>
                    <div className="a-dsh" />
                    {best && r.reach?.status === 'ok' && <Cap best={best} />}
                    <span className="a-mu">
                      Check the transfer time and minimum block on your bank&apos;s portal. See the{' '}
                      <Link href="/rules" style={{ textDecoration: 'underline' }}>programme rules</Link>.
                    </span>
                    <RulesStamp r={r} fallback={s.rulesCheckedOn} />
                  </>
                ) : direct ? null : (
                  <>
                    <NotReachable r={r} hasCards={s.wallet.hasCards} />
                    <BuyPoints r={r} n={n} held={held} />
                  </>
                )}
              </div>

              <Note kind="danger" title="Transfers cannot be undone.">Seats can disappear before you transfer.</Note>

              <Recheck check={check} onClick={() => s.recheck(r.id)} />

            </div>

            <div className="a-side a-gl a-sel a-sticky-sum">
              <span className="a-cap">Summary</span>
              <div className="a-big">{pts !== null ? fmt(pts) : fmt(partyMiles(r, n))} <small>{pts !== null ? 'card pts' : 'pts'}</small></div>
              <span className="a-mu">+ {r.taxes_known ? <>{taxesLine(r)} taxes at the airline</> : 'Taxes: see airline'}</span>
              <div className="a-dsh" />
              {best && r.reach?.status === 'ok' && <div className="a-kv"><span>Pay with</span><b>{best.cardName} {best.ratio}</b></div>}
              {best && r.reach?.status === 'ok' && typeof balances[best.cardId] === 'number' && (
                <div className="a-kv"><span>You keep</span><b>{fmt(Math.max(0, balances[best.cardId] - best.pointsUsed))} pts</b></div>
              )}
              {r.reach?.status === 'pooled' && r.reach.pooled?.transfers.map(t => (
                <Fragment key={t.cardId}>
                  <div className="a-kv"><span>Pay with</span><b>{t.cardName}</b></div>
                  {typeof balances[t.cardId] === 'number' && <div className="a-kv"><span>You keep</span><b>{fmt(Math.max(0, balances[t.cardId] - t.sourcePoints))} pts</b></div>}
                </Fragment>
              ))}
              {ok && !direct && (
                <label className="cm-check a-checkout-ack">
                <input type="checkbox" checked={ticked} onChange={e => setTicked(e.target.checked)} />
                <span className="cm-check__text">
                  <span className="cm-check__label">I have read the checks on the left</span>
                  <span className="cm-check__desc">Ratio, cap, transfer time and name format.</span>
                </span>
              </label>
              )}
              <Link
                href={urlFor('handoff', r.id, n)}
                className="a-cta a-full a-checkout-go"
                aria-disabled={!go}
                tabIndex={go ? undefined : -1}
                onClick={e => !go && e.preventDefault()}
              >
                {direct ? 'Book directly' : 'Start the transfer steps'}
                <span className="a-ar"><Ic name="arrow" /></span>
              </Link>
              <span className="a-cap a-checkout-hint">
                {!ok ? 'Short on points? Your options are in the box on the left.' : go ? (direct ? 'Ready. Next: the booking step.' : "Next: your bank's rewards site, then each step in order.") : 'Tick the box above to continue'}
              </span>
              <span className="a-cap">Qatar, Singapore, Turkish and LifeMiles open only the airline&apos;s front page. Every other airline opens with your flight filled in.</span>
            </div>
          </div>
        )}

        <DataFoot extra={<span className="a-cap">No payment happens here.</span>} />
      </div>
    </div>
  );
}

function Cap({ best }: { best: NonNullable<NonNullable<ReturnType<typeof useSeats>['rows'][number]['reach']>['best']> }) {
  if (!best.capLimit) return <span className="a-mu">No transfer cap in our rules for this path.</span>;
  const period = best.capPeriod === 'year' ? 'year' : 'month';
  return (
    <>
      <div className="a-kv"><span>Cap</span><b className="a-mono">{fmt(best.capLimit)} pts a {period}</b></div>
      {(!best.capOk || best.monthsNeeded > 1) && (
        <Note kind="warning" title="This transfer is over the cap.">
          It would take about {best.monthsNeeded} {period === 'year' ? 'years' : 'months'} of transfers, so the points may not all arrive in one go.
        </Note>
      )}
    </>
  );
}
