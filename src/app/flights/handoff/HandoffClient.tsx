'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Ic from '@/components/app/Icons';
import { handoffFor, type HandoffResponse, type Result } from '@/lib/app/api';
import { CARDS, programmeName } from '@/lib/app/catalog';
import { CABIN_LABEL, fmt, inr } from '@/lib/app/format';
import { useProgrammeBalance } from '@/lib/app/loyalty';
import { stepsFor } from '@/lib/app/steps';
import { saveTrip } from '@/lib/app/trips';
import { useDayPass } from '@/lib/day-pass';
import { DataFoot, Note, SeenStamp, VerifiedStamp } from '@/components/app/ui';
import { dateFull, ErrorBox, MissingNote, reachable, Skeleton, urlFor } from '@/components/app/booking/bits';
import { useSeats } from '@/components/app/booking/useSeats';
import './handoff.css';

// Airlines whose award search needs a login and takes no details from a link: Qatar, Singapore (KrisFlyer), Turkish and LifeMiles.
const FRONT_ONLY = new Set(['qatar-privilege-club', 'krisflyer', 'turkish-ms', 'lifemiles']);

type Saved ={ state: 'idle' | 'busy' | 'ok' } | { state: 'error'; error: string; needsSignIn: boolean };

export default function HandoffClient({ id, travellers: n }: { id: string; travellers: number }) {
  const s = useSeats(id ? [id] : [], n);
  const { pass } = useDayPass();
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
  // the ordered steps: bank transfer, wait, any further transfer, wait, book. Skipped when the points are already in the airline programme.
  const held = useProgrammeBalance(r?.programme_id);
  const plan = r ? stepsFor({ r, programme, n, held, nameOf: programmeName, bankOf: id => CARDS.find(c => c.id === id)?.bank }) : null;
  const [done, setDone] = useState<Record<number, boolean>>({});
  const transferSteps = plan && !plan.direct ? plan.steps.length - 1 : 0; // the last step is the booking itself
  const locked = transferSteps > 0 && Array.from({ length: transferSteps }).some((_, i) => !done[i]);
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
                {r && (pass.state === 'active' ? (
                  <div className="a-r a-rw">
                    <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={s.check(r.id).busy} onClick={() => s.recheck(r.id)}>
                      {s.check(r.id).busy ? 'Checking…' : 'Re-check this seat'}
                    </button>
                    <span role="status" className="a-cap">{s.check(r.id).gone ? 'This seat is gone. Do not transfer.' : s.check(r.id).msg ?? ''}</span>
                  </div>
                ) : (
                  <Link className="a-cap" href="/pricing" style={{ textDecoration: 'underline' }}>Re-check this seat before you transfer: day pass, ₹99</Link>
                ))}
              </div>
              <div className="a-gl">
                <span className="a-cap">{plan?.direct ? 'You can book directly' : 'Do these in order'}</span>
                {transferSteps > 0 && (
                  <div className="ho-bar" role="progressbar" aria-valuemin={0} aria-valuemax={transferSteps} aria-valuenow={Array.from({ length: transferSteps }).filter((_, i) => done[i]).length} aria-label="Steps done">
                    <i style={{ width: `${(Array.from({ length: transferSteps }).filter((_, i) => done[i]).length / transferSteps) * 100}%` }} />
                  </div>
                )}
                <ol className="ho-tl">
                  {plan?.steps.map((st, i) => {
                    const last = i === plan.steps.length - 1;
                    const tickable = !last && !plan.direct;
                    return (
                      <li key={i} className={done[i] ? 'is-done' : last ? 'is-book' : undefined}>
                        {tickable ? (
                          <button type="button" className="ho-dot" aria-pressed={Boolean(done[i])} aria-label={`${done[i] ? 'Undo' : 'Done'}: ${st.title}`} onClick={() => setDone(d => ({ ...d, [i]: !d[i] }))}>
                            {done[i] ? '✓' : i + 1}
                          </button>
                        ) : <span className="ho-dot">{i + 1}</span>}
                        <div className="ho-body">
                          <b>{st.title}</b>
                          {st.note && <span className="a-mu">{st.note}</span>}
                          {st.link && <a className="a-ghost" style={{ alignSelf: 'flex-start' }} href={st.link.href} target="_blank" rel="noopener noreferrer">{st.link.label}</a>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {transferSteps > 0 && (
                  <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => setDone(Object.fromEntries(Array.from({ length: transferSteps }, (_, i) => [i, true])))}>I have already done these</button>
                )}
              </div>
            </div>

            <div className="a-r a-rw">
              {h.url && (
                <a className="a-cta" href={locked ? undefined : h.url} target="_blank" rel="noopener noreferrer" aria-disabled={locked}
                  onClick={e => locked && e.preventDefault()} style={locked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                  {h.prefilled ? `Open ${h.programme} with this flight filled in` : `Open ${h.programme} (front page only)`}
                  <span className="a-ar"><Ic name="ext" /></span>
                </a>
              )}
              {!plan?.direct && (
                <button type="button" className="a-ghost" onClick={markTransferring} disabled={!r || saved.state === 'busy' || saved.state === 'ok'}>
                  {saved.state === 'busy' ? 'Saving' : 'Mark as transferring'}
                </button>
              )}
              <Link className="a-ghost" href={urlFor('checkout', id, n)}>Back to checks</Link>
              <span className="a-g" />
              {h.linkCheckedOn ? <VerifiedStamp>Link checked {dateFull(h.linkCheckedOn.slice(0, 10))}</VerifiedStamp> : null}
            </div>
            {locked && <span className="a-cap">Tick each step above as you finish it. The airline opens after the last one.</span>}
            <span className="a-cap">Qatar, Singapore, Turkish and LifeMiles open only the airline&apos;s front page. Every other airline opens with your flight filled in.</span>
            {h.prefilled ? (
              <Note kind="info" title="The airline page opens with your route, date and passengers filled in.">Pick the flight shown above on that page, and check the taxes before you pay. If it shows nothing, the seat may have gone: do not transfer.</Note>
            ) : (
              <Note kind="info" title={`${h.programme} cannot open with your flight filled in.`}>
                {r && FRONT_ONLY.has(r.programme_id)
                  ? 'Its site asks you to log in and runs the search itself, so no link can carry your details. Copy each field from the panel above.'
                  : 'We could not get a filled-in link for this seat just now. Copy each field from the panel above, or press Re-check on the checks page and try again.'}
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
