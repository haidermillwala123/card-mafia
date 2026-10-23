'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Ic from '@/components/app/Icons';
import { handoffFor, type HandoffResponse, type Result, type SeatView } from '@/lib/app/api';
import { programmeName } from '@/lib/app/catalog';
import { CABIN_LABEL, fmt, inr } from '@/lib/app/format';
import { saveTrip } from '@/lib/app/trips';
import { DataFoot, Note, SeenStamp, VerifiedStamp } from '@/components/app/ui';
import { dateFull, ErrorBox, MissingNote, reachable, Skeleton, urlFor } from '@/components/app/booking/bits';
import { useSeats } from '@/components/app/booking/useSeats';
import './handoff.css';

type Saved = { state: 'idle' | 'busy' | 'ok' } | { state: 'error'; error: string; needsSignIn: boolean };

function stepsFor(r: SeatView | undefined, programme: string): string[] {
  const x = r?.reach;
  let first = `Transfer points from your bank to ${programme}. Work out how many from your cards in Wallet.`;
  if (x?.status === 'ok' && x.best) {
    const via = x.best.hops.slice(0, -1).map(h => programmeName(h.to));
    first = `Transfer ${fmt(x.best.pointsUsed)} points from ${x.best.cardName} to ${programme}${via.length ? ` (via ${via.join(', ')})` : ''}`;
  } else if (x?.status === 'pooled' && x.pooled) {
    first = `Transfer ${x.pooled.transfers.map(t => `${fmt(t.sourcePoints)} points from ${t.cardName}`).join(' and ')} to ${programme}`;
  }
  return [first, "Wait for the credit. Check the transfer time on your bank's portal", 'Search the same date on the airline site', 'Book, and confirm the taxes before you pay'];
}

export default function HandoffClient({ id, travellers: n }: { id: string; travellers: number }) {
  const s = useSeats(id ? [id] : [], n);
  const [tick, setTick] = useState(0);
  const [hres, setHres] = useState<{ tick: number; r: Result<HandoffResponse> } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved>({ state: 'idle' });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    handoffFor(id, n).then(r => live && setHres({ tick, r }));
    return () => {
      live = false;
    };
  }, [id, tick]);

  const r = s.rows[0];
  const h = hres?.r.ok ? hres.r.data : null;
  const herr = hres && !hres.r.ok ? hres.r.error : null;
  const programme = r?.programme_name ?? h?.programme ?? 'the airline';
  const taxes = h ? (h.copy.taxes ? (inr(h.copy.taxes.inr) ?? `${fmt(h.copy.taxes.amount)} ${h.copy.taxes.currency}`) : 'Taxes: see airline') : '';
  const rows: [string, string][] = h
    ? [
        ['Route', h.copy.route],
        ['Date, cabin', `${dateFull(h.copy.date)} · ${h.copy.cabin}`],
        ['Flight', h.copy.flights ?? 'Flight numbers not listed'],
        ['Points', n > 1 ? `${fmt(h.copy.points * n)} for ${n} (${fmt(h.copy.points)} each)` : fmt(h.copy.points)],
        ['Taxes', taxes],
      ]
    : [];

  async function copyAll() {
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied');
    } catch {
      const el = panel.current;
      if (el) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopied('Text selected. Press Ctrl or Cmd + C to copy');
    }
  }

  async function copyOne(k: string, v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(`${k} copied`);
    } catch {
      setCopied('Select the text and press Ctrl or Cmd + C');
    }
  }

  async function markTransferring() {
    if (!r) return;
    setSaved({ state: 'busy' });
    const best = r.reach?.best;
    const res = await saveTrip({
      title: `${r.origin} to ${r.dest}, ${CABIN_LABEL[r.cabin] ?? r.cabin}`,
      origin: r.origin, destination: r.dest, from: r.date, to: r.date, cabin: r.cabin, travellers: n, status: 'transferring',
      seat: {
        id: r.id, programme: r.programme_id, programmeName: r.programme_name, date: r.date, points: r.miles * n, taxesInr: r.taxes_known ? r.taxes_inr : null,
        flights: r.flights, cardName: reachable(r) && best ? best.cardName : null, seenAt: r.updated_at,
      },
    });
    setSaved(res.ok ? { state: 'ok' } : { state: 'error', error: res.error, needsSignIn: Boolean(res.needsSignIn) });
  }

  const loading = Boolean(id) && (!hres || s.loading);
  const error = herr ?? s.error;

  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Step 4 · Airline</span>
        <h1 className="a-hd a-sm">
          Book on {programme}.<br />
          <em>We stop here.</em>
        </h1>

        {!id ? (
          <Note kind="info" title="Pick a seat first.">
            <Link href="/flights" style={{ textDecoration: 'underline' }}>Go to search.</Link>
          </Note>
        ) : error ? (
          <ErrorBox error={error} onRetry={() => { s.retry(); setHres(null); setTick(t => t + 1); }} />
        ) : loading ? (
          <Skeleton cols={2} />
        ) : !h ? null : (
          <>
            {!r && <MissingNote />}
            {r && !reachable(r) && (
              <Note kind="warning" title="This seat is not reachable with your cards.">
                The steps below are general. Check your points in <Link href="/wallet" style={{ textDecoration: 'underline' }}>Wallet</Link> before you transfer.
              </Note>
            )}
            <div className="a-g2">
              <div className="a-gl">
                <span className="a-cap">Copy for the airline site</span>
                <div className="a-checkout-copy" ref={panel}>
                  {rows.map(([k, v]) => (
                    <div className="a-kv" key={k}>
                      <span>{k}</span><b className="a-mono">{v}</b>
                      <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" aria-label={`Copy ${k}`} onClick={() => copyOne(k, v)}>Copy</button>
                    </div>
                  ))}
                </div>
                <div className="a-r a-rw">
                  <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" onClick={copyAll}><Ic name="copy" small />Copy all</button>
                  <span role="status" className="a-cap">{copied ?? ''}</span>
                </div>
                <SeenStamp iso={h.copy.seatSeenAt} prefix="Seat seen" />
              </div>
              <div className="a-gl">
                <span className="a-cap">In this order</span>
                {stepsFor(r, programme).map((t, i) => (
                  <div className="a-step" key={i}><span className="a-n">{i + 1}</span><span>{t}</span></div>
                ))}
              </div>
            </div>

            <div className="a-r a-rw">
              {h.url && (
                <a className="a-cta" href={h.url} target="_blank" rel="noopener noreferrer">
                  {h.prefilled ? `Open ${h.programme} with this flight filled in` : `Open ${h.programme}`}
                  <span className="a-ar"><Ic name="ext" /></span>
                </a>
              )}
              <button type="button" className="a-ghost" onClick={markTransferring} disabled={!r || saved.state === 'busy' || saved.state === 'ok'}>
                {saved.state === 'busy' ? 'Saving' : 'Mark as transferring'}
              </button>
              <Link className="a-ghost" href={urlFor('checkout', id, n)}>Back to checks</Link>
              <span className="a-g" />
              {h.linkCheckedOn ? <VerifiedStamp>Link checked {dateFull(h.linkCheckedOn.slice(0, 10))}</VerifiedStamp> : null}
            </div>
            {h.prefilled ? (
              <Note kind="info" title="The airline page opens with your route, date and passengers filled in.">Pick the flight shown above on that page, and check the taxes before you pay. If it shows nothing, the seat may have gone: do not transfer.</Note>
            ) : (
              <Note kind="info" title={`${h.programme} cannot open with your flight filled in.`}>
                Its site asks you to log in and runs the search itself, so no link can carry your details. Copy each field from the panel above.
                {h.links && h.links.some(l => !l.primary) ? ' The partner links below open with your flight filled in, but their points price can differ, so check it before you transfer.' : ''}
              </Note>
            )}
            {h.links && h.links.filter(l => !l.primary).length > 0 && (
              <div className="a-r a-rw">
                <span className="a-cap">Also bookable through (points price can differ)</span>
                {h.links.filter(l => !l.primary).map(l => (
                  <a key={l.url} className="a-ghost" href={l.url} target="_blank" rel="noopener noreferrer">{l.label.replace(/^Book via /, '')}</a>
                ))}
              </div>
            )}
            {saved.state === 'ok' && (
              <span className="a-checkout-saved" role="status">Saved. See it in <Link href="/trips" style={{ textDecoration: 'underline' }}>Trips</Link>.</span>
            )}
            {saved.state === 'error' && (
              <span className="a-checkout-saved" role="alert">
                {saved.error}{' '}
                {saved.needsSignIn && <Link href="/signin" style={{ textDecoration: 'underline' }}>Sign in</Link>}
              </span>
            )}

            <Note kind="warning" title="Seats can disappear before you transfer.">
              Check the seat on the airline site first if it lets you. If it has gone, do not transfer.
            </Note>
          </>
        )}

        <DataFoot extra={<span className="a-cap">We never ask for bank logins.</span>} />
      </div>
    </div>
  );
}
