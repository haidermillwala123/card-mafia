'use client';

// Pieces shared by the top-three cards, the phone list and the table: what a seat costs, who can pay, how old it is.
import Link from 'next/link';
import { Fragment, type ReactNode, useState } from 'react';
import { SeenStamp, Tag } from '@/components/app/ui';
import { cityOf } from '@/lib/airports';
import { cityPhoto } from '@/lib/photos';
import type { SeatView } from '@/lib/app/api';
import { CABIN_LABEL, dateShort, duration, fmt, inr, isStale, timeLabel, valuePerPoint } from '@/lib/app/format';

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
  if (v === null) return <span className="a-mu">Cash fare is not above the taxes: pay cash</span>;
  // Break-even, no guesswork: the seat saves money if a point is worth less to you than what it buys here.
  return <span>₹{v} per point<small className="a-mu"> · points are the better deal if a point is worth less than ₹{v} to you, otherwise pay cash</small></span>;
}

const NP = <span className="a-mu">not published</span>;
const stamp = (iso: string) => <>{iso.slice(0, 16).replace("T", " ")} UTC</>;

// Every field we hold for a seat. Missing is "not published", never blank or 0.
export function SeatDetails({ r }: { r: SeatView }) {
  const rows: [string, ReactNode][] = [
    ["Programme", r.programme_name], ["Cabin", CABIN_LABEL[r.cabin] ?? r.cabin], ["Date", r.date], ["Route", `${r.origin} → ${r.dest}`],
    ["Points", fmt(r.miles)],
    ["Taxes (original)", r.taxes_known && r.taxes_amount !== null ? `${r.taxes_currency} ${fmt(r.taxes_amount)}` : NP],
    ["Taxes (INR)", r.taxes_inr !== null ? inr(r.taxes_inr) : NP],
    ["Seats left", r.seats === null ? NP : r.seats], ["Airline", r.airline ?? NP],
    ["Flight numbers", r.flights.length ? r.flights.join(", ") : NP],
    ["Departs", r.departs_at ? `${r.departs_at.slice(0, 10)} ${timeLabel(r.departs_at)}` : NP],
    ["Arrives", r.arrives_at ? `${r.arrives_at.slice(0, 10)} ${timeLabel(r.arrives_at)}` : NP],
    ["Duration", duration(r.duration_minutes) ?? NP], ["Stops", stopsLabel(r)], ["Aircraft", r.aircraft ?? NP],
    ["Updated by source", stamp(r.updated_at)], ["Fetched by us", stamp(r.fetched_at)], ["Source", r.source || NP],
    ["Availability id", r.availability_id || NP],
  ];
  return (
    <dl className="a-flights-det">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

type PickProps = { picked: boolean; locked: boolean; onPick: (id: string) => void };
export const PickBox = ({ r, picked, locked, onPick }: { r: SeatView } & PickProps) => (
  <label className="cm-check a-flights-pick">
    <input type="checkbox" checked={picked} disabled={locked && !picked} onChange={() => onPick(r.id)} aria-label={`Compare ${dateShort(r.date)} ${r.programme_name}`} />
    <span className="cm-check__text"><span className="cm-check__label">Compare</span></span>
  </label>
);

export const checkoutHref = (id: string, n: number) => `/flights/checkout?id=${encodeURIComponent(id)}&n=${n}`;

export function SeatCard({ r, n, fare, ...pick }: { r: SeatView; n: number; fare: number | null; selected: boolean } & PickProps) {
  const [open, setOpen] = useState(false);
  const photo = cityPhoto(r.dest);
  const full = pick.locked && !pick.picked;
  const day = new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <article className={`sc${pick.picked ? " is-picked" : ""}`}>
      <div className="sc-img">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/cities/${photo}-sm.webp`} alt="" loading="lazy" decoding="async" />
          : <span className="sc-code" aria-hidden="true">{r.dest}</span>}
        <button type="button" className="sc-pick" aria-pressed={pick.picked} disabled={full} onClick={() => pick.onPick(r.id)}
          aria-label={`${pick.picked ? "Remove from compare" : "Add to compare"}: ${dateShort(r.date)} ${r.programme_name}`}>
          <span aria-hidden="true">{pick.picked ? "✓" : "+"}</span>{pick.picked ? "Added" : "Compare"}
        </button>
        {r.direct && <span className="sc-badge">Direct</span>}
      </div>
      <div className="sc-body">
        <span className="sc-loc">{cityOf(r.origin)} to {cityOf(r.dest)}</span>
        <h3 className="sc-title"><Link href={checkoutHref(r.id, n)}>{r.programme_name}, {day}</Link></h3>
        <span className="sc-meta">{[CABIN_LABEL[r.cabin] ?? r.cabin, r.direct ? null : stopsLabel(r), r.seats === null ? null : `${r.seats} ${r.seats === 1 ? "seat" : "seats"} left`, r.airline].filter(Boolean).join(" · ")}</span>
        <span className="sc-pay"><PaidBy r={r} /></span>
        <ShortText r={r} />
        <div className="sc-foot">
          <SeenStamp iso={r.updated_at} />
          <div className="sc-price">
            <small>From</small>
            <b>{fmt(r.miles)} pts</b>
            <small>+ <Taxes r={r} /></small>
            {fare ? <small><Vpp r={r} fare={fare} /></small> : null}
          </div>
        </div>
        <button type="button" className="sc-more" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "Hide details" : "All details"}</button>
        {open && <SeatDetails r={r} />}
      </div>
    </article>
  );
}

export function SeatTable({ rows, n, fare, picks, onPick }: { rows: SeatView[]; n: number; fare: number | null; picks: string[]; onPick: (id: string) => void }): ReactNode {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const cols = 13 + (fare ? 1 : 0) + (all ? 6 : 0);
  return (
    <div className="a-c">
      <label className="cm-check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /><span className="cm-check__text"><span className="cm-check__label">Show all columns</span></span></label>
      <div className="cm-table-wrap a-flights-table">
        <table className="cm-table">
          <thead>
            <tr>
              <th>Compare</th><th>Date</th><th>Programme</th><th>Cabin</th><th className="is-num">Points</th><th className="is-num">Taxes</th>
              {fare ? <th className="is-num">Value per point</th> : null}
              <th>Stops</th><th className="is-num">Seats</th><th>Airline</th>
              {all && <><th>Flights</th><th>Departs</th><th>Arrives</th><th>Duration</th><th>Aircraft</th><th>Source</th></>}
              <th>Age</th><th>Your cards</th><th>Details</th><th><span className="a-flights-vh">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <Fragment key={r.id}>
                <tr className={`${picks.includes(r.id) ? "is-selected" : ""}${dimmed(r) ? " a-flights-dimrow" : ""}`}>
                  <td><PickBox r={r} picked={picks.includes(r.id)} locked={picks.length >= 3} onPick={onPick} /></td>
                  <td className="is-mono">{dateShort(r.date)}</td>
                  <td>{r.programme_name}</td>
                  <td>{CABIN_LABEL[r.cabin] ?? r.cabin}</td>
                  <td className="is-num is-mono">{fmt(r.miles)}</td>
                  <td className="is-num"><Taxes r={r} /></td>
                  {fare ? <td className="is-num is-mono"><Vpp r={r} fare={fare} /></td> : null}
                  <td>{r.direct ? <Tag kind="direct" plain>Direct</Tag> : stopsLabel(r)}</td>
                  <td className="is-num is-mono">{seatsLabel(r)}</td>
                  <td>{r.airline ?? NP}</td>
                  {all && <>
                    <td>{r.flights.length ? r.flights.join(", ") : NP}</td>
                    <td>{r.departs_at ? timeLabel(r.departs_at) : NP}</td>
                    <td>{r.arrives_at ? timeLabel(r.arrives_at) : NP}</td>
                    <td>{duration(r.duration_minutes) ?? NP}</td>
                    <td>{r.aircraft ?? NP}</td>
                    <td>{r.source || NP}</td>
                  </>}
                  <td><SeenStamp iso={r.updated_at} prefix="" /></td>
                  <td>
                    <PaidBy r={r} />
                    {!payable(r) && r.reach && <><br /><ShortText r={r} /></>}
                  </td>
                  <td><button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "Show"}</button></td>
                  <td><Link className="cm-btn cm-btn--primary cm-btn--sm a-pb" href={checkoutHref(r.id, n)}>Check out</Link></td>
                </tr>
                {open === r.id && <tr><td colSpan={cols}><SeatDetails r={r} /></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
