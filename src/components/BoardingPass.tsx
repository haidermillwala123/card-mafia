// A trip as a boarding-pass card: big airport codes, a plane along the route, a torn edge, then the facts we really have.
// No gate, seat or barcode: this is a plan, not a ticket, so it only shows what the person chose.
import Link from 'next/link';
import type { ReactNode } from 'react';

export type PassField = { label: string; value: ReactNode };

export default function BoardingPass({ from, to, fromCity, toCity, fields, badge, href }: {
  from: string; to: string; fromCity: string; toCity: string; fields: PassField[]; badge?: ReactNode; href?: string;
}) {
  const body = (
    <>
      <div className="bp-top">
        <div><b className="bp-code">{from}</b><small>{fromCity}</small></div>
        <div className="bp-mid" aria-hidden="true">
          <span className="bp-line" />
          <svg viewBox="0 0 32 32" width="26" height="26" fill="currentColor"><path d="M30 16 3 7l4 9-4 9 27-9Zm-17 0 8-1.6L11 12l2 4Z" /></svg>
        </div>
        <div className="bp-r"><b className="bp-code">{to}</b><small>{toCity}</small></div>
        {badge && <span className="bp-badge">{badge}</span>}
      </div>
      <div className="bp-tear" aria-hidden="true"><i /><span /><i /></div>
      <dl className="bp-bot">
        {fields.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
      </dl>
    </>
  );
  return href ? <Link className="bp" href={href} aria-label={`${fromCity} to ${toCity}`}>{body}</Link> : <article className="bp" aria-label={`${fromCity} to ${toCity}`}>{body}</article>;
}
