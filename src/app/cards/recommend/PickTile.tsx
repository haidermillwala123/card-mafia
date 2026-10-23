// A recommended card drawn as a card: bank-coloured face, one big number, three facts you can read at a glance.
// The colours are ours (bank-style.ts), not bank logos. Every figure comes from the pick the recommender already made.
import Link from 'next/link';
import { bankName } from '@/lib/app/catalog';
import { bankGradient } from '@/lib/bank-style';
import { CAT_LABEL } from '@/lib/earn';
import { feeTier } from '@/lib/fees';
import type { Pick } from '@/lib/recommend';
import './pick.css';

const inr = (n: number) => n.toLocaleString('en-IN');
const short = (name: string, bank: string) => name.replace(bankName(bank), '').trim() || name;

type Props = {
  pick: Pick;
  bank: string;
  fee: number | null | undefined;
  label: string;
  programmeName: string | null;
  unit: string; // "airline miles" or "Emirates miles"
  chosen: boolean; // the person picked airlines, so the rate is for that airline
  extra?: string; // one line under the facts, for the companion card
};

export default function PickTile({ pick, bank, fee, label, programmeName, unit, chosen, extra }: Props) {
  const tier = feeTier(fee);
  const best = pick.wins.slice(0, 3);
  return (
    <article className="bc">
      <div className="bc-face" style={{ background: bankGradient(bank) }}>
        <div className="bc-top"><span className="bc-badge">{label}</span><span className="bc-chip" aria-hidden="true" /></div>
        <div className="bc-name"><small>{bankName(bank)}</small><h3>{short(pick.card.name, bank)}</h3></div>
        <div className="bc-gain"><b>+{inr(Math.round(pick.gain))}</b><span>{unit} a month</span></div>
      </div>
      <dl className="bc-facts">
        <div>
          <dt>Earns most on</dt>
          <dd>{best.length ? best.map(w => <span className="bc-pill" key={w.cat}>{CAT_LABEL[w.cat]}</span>) : <span className="bc-mu">Even across categories</span>}</dd>
        </div>
        <div>
          <dt>Annual fee</dt>
          <dd><b>{fee === 0 ? 'Free' : fee ? `₹${inr(fee)}` : 'Not found'}</b><span className="bc-mu">{tier.short}</span></dd>
        </div>
        <div>
          <dt>{chosen && programmeName ? `Points to ${programmeName}` : 'Points reach'}</dt>
          <dd>{chosen && programmeName ? <><b>{Number(pick.perPoint.toFixed(2))}</b><span className="bc-mu">miles per point</span></> : <><b>{pick.breadth}</b><span className="bc-mu">airline programmes</span></>}</dd>
        </div>
      </dl>
      {extra && <p className="bc-extra">{extra}</p>}
      <div className="bc-links"><Link href={`/earn#${pick.card.card_id}`}>How it earns</Link><Link href={`/transfers/${pick.card.card_id}`}>Where points go</Link></div>
    </article>
  );
}

// The smaller card for "also worth a look": face only, with the gain and the fee.
export function MiniTile({ pick, bank, fee }: { pick: Pick; bank: string; fee: number | null | undefined }) {
  return (
    <Link className="bm" href={`/earn#${pick.card.card_id}`}>
      <span className="bm-face" style={{ background: bankGradient(bank) }} aria-hidden="true"><i /></span>
      <span className="bm-t"><b>{short(pick.card.name, bank)}</b><small>{bankName(bank)} · {feeTier(fee).short}</small></span>
      <span className="bm-g"><b>+{inr(Math.round(pick.gain))}</b><small>miles a month</small></span>
    </Link>
  );
}
