'use client';

// Shown when the person cannot yet pay for a seat. Instead of a dead end it works out how many airline points are missing, says what buying them
// costs where the programme's price is known, and opens the programme's own page to buy. Prices are estimates and the panel says so.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type SeatView, buyInfoFor } from '@/lib/app/api';
import { fmt } from '@/lib/app/format';
import { buyCost, type BuyInfo, pointsShort } from '@/lib/buy-points';

const MONEY: Record<string, string> = { USD: 'US$', CAD: 'CA$', AUD: 'A$', GBP: '£', EUR: '€' };

export default function BuyPoints({ r, n, held }: { r: SeatView; n: number; held: number | null }) {
  const [info, setInfo] = useState<BuyInfo | null | 'none'>(null);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    let live = true;
    buyInfoFor(r.id).then(x => live && setInfo(x.ok ? x.data : 'none'));
    return () => { live = false; };
  }, [r.id]);

  const best = r.reach?.best ?? null;
  const cardShortBy = r.reach?.status === 'short' && best ? best.shortBy : null;
  const short = pointsShort({ need: r.miles * n, held, cardShortBy, cardPointsPerPoint: best ? Number(best.ratio.split(':')[0]) || null : null });
  if (short <= 0 || info === 'none') return null;

  const cost = info ? buyCost(info, short) : null;
  const money = (v: number, c: string | null) => `${MONEY[c ?? ''] ?? `${c ?? ''} `}${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="a-c" style={{ gap: 10 }}>
      <span className="a-cap">Short on points? You can still get this seat</span>
      <span>You need about <b>{fmt(short)}</b> more {r.programme_name} points.{held ? ` You already have ${fmt(held)} there.` : ''}</span>
      {!info ? <span className="a-mu" role="status">Checking what it costs to buy them</span> : !info.sells ? (
        <span className="a-mu">{info.note ?? 'This programme does not sell points.'} Top up your bank points instead, or pick another seat.</span>
      ) : (
        <>
          {cost ? (
            <span>
              {info.priceKind === 'guide' ? 'As a rough guide, buying them would cost about ' : 'Buying them costs about '}
              <b>{cost.inr !== null ? `₹${fmt(cost.inr)}` : cost.native !== null ? money(cost.native, info.currency) : ''}</b>
              {cost.inr !== null && cost.native !== null && info.currency ? ` (${money(cost.native, info.currency)})` : ''}
              {info.priceKind === 'guide'
                ? '. This comes from a published guide or a related programme, not from the programme itself, so the real price can be quite different. Check it before you pay.'
                : ' at the standard listed price. Promotions and your account’s country change it, so check the final price before you pay.'}
            </span>
          ) : <span className="a-mu">{info.programme} sells points, but we have no price we can stand behind: open your account to see it.</span>}
          {info.note && <span className="a-mu">{info.note}</span>}
          {info.annualCap && short > info.annualCap && <span className="a-mu">You can buy at most {fmt(info.annualCap)} points a year, so this may not be possible in one go.</span>}
          {info.sourceDate && <span className="a-cap">Price read {info.sourceDate}{info.source ? `, ${info.source}` : ''}.</span>}
          {info.url && (
            <a className="a-cta" style={{ alignSelf: 'flex-start' }} href={info.url} target="_blank" rel="noopener noreferrer" onClick={() => setClicked(true)}>
              Buy points and continue
            </a>
          )}
          {clicked && (
            <span className="a-mu" role="status">
              Once you have bought them, check the balance in your {info.programme} account, then add it in <Link href="/wallet" style={{ textDecoration: 'underline' }}>Wallet</Link>.
              This page will then say you can book directly.
            </span>
          )}
        </>
      )}
    </div>
  );
}
