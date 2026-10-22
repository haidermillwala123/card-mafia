'use client';

// "What can I move?" for the balances typed in the wallet. All figures are arithmetic on the transfer rules: no guesses.
import Link from 'next/link';
import { useState } from 'react';
import { cardName, programmeName } from '@/lib/app/catalog';
import { fmt } from '@/lib/app/format';
import earnJson from '@/data/earn_rules.json';
import programmesJson from '@/data/programmes.json';
import rulesJson from '@/data/transfer_rules.json';

type Rule = { from: string; to: string; ratio_in: number; ratio_out: number; monthly_cap: number | null; annual_cap: number | null; transfer_time: string | null; min_multiple: number | null };
const RULES = (rulesJson as unknown as { rules: Rule[] }).rules;
const EARN = earnJson.cards as unknown as Record<string, { redemption_value?: { best_known?: string } | null }>;
const KIND = new Map((programmesJson.programmes as { id: string; kind: string }[]).map(p => [p.id, p.kind]));
const airline = (id: string) => (KIND.get(id) === 'airline' ? 1 : 0);
const SHOW = 6;
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n))}…`);

export type Held = { programme: string; cardId: string; balance: number };

export default function WalletTransfers({ held }: { held: Held[] }) {
  const [all, setAll] = useState<Record<string, boolean>>({});
  const funded = held.filter(h => h.balance > 0);

  return (
    <section className="a-c" aria-label="Transfers you can make">
      <h2 className="a-sec">Transfers you can make</h2>
      {funded.length === 0 && <div className="a-gl a-dashed"><span className="a-mu">Type a balance above and the partners you can move it to show up here.</span></div>}
      {funded.map(h => {
        const rules = RULES.filter(r => r.from === h.programme)
          .map(r => {
            const cap = r.monthly_cap ?? r.annual_cap;
            const movable = cap === null ? h.balance : Math.min(h.balance, cap);
            const step = r.min_multiple ?? 1;
            const usable = Math.floor(movable / step) * step;
            return { r, perPoint: r.ratio_out / r.ratio_in, get: Math.floor((usable * r.ratio_out) / r.ratio_in), capped: cap !== null && cap < h.balance };
          })
          .sort((a, b) => airline(b.r.to) - airline(a.r.to) || b.perPoint - a.perPoint); // airlines first: this app is for flights
        const worth = EARN[h.cardId]?.redemption_value?.best_known;
        const list = all[h.programme] ? rules : rules.slice(0, SHOW);
        return (
          <div className="a-gl" key={h.programme}>
            <div className="a-r a-rw">
              <b className="a-g">{cardName(h.cardId)}</b>
              <span className="a-cap">{fmt(h.balance)} {programmeName(h.programme)}</span>
            </div>
            {rules.length === 0 ? <span className="a-mu">We found no transfer partners for this card.</span> : (
              <div className="cm-table-wrap">
                <table className="cm-table">
                  <thead><tr><th>Move to</th><th className="is-num">Ratio</th><th className="is-num">1 point becomes</th><th className="is-num">You would get</th><th>Limit</th></tr></thead>
                  <tbody>
                    {list.map(({ r, perPoint, get, capped }) => (
                      <tr key={r.to}>
                        <td>{programmeName(r.to)}</td>
                        <td className="is-num is-mono">{r.ratio_in}:{r.ratio_out}</td>
                        <td className="is-num is-mono">{Number(perPoint.toFixed(2))} pts</td>
                        <td className="is-num is-mono">{fmt(get)}</td>
                        <td>{capped ? `Capped at ${fmt(r.monthly_cap ?? r.annual_cap ?? 0)} ${r.monthly_cap ? 'a month' : 'a year'}` : r.transfer_time ?? <span className="a-mu">not found</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="a-r a-rw">
              {rules.length > SHOW && <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setAll(a => ({ ...a, [h.programme]: !a[h.programme] }))}>{all[h.programme] ? 'Show fewer' : `Show all ${rules.length}`}</button>}
              <Link className="cm-btn cm-btn--ghost cm-btn--sm" href={`/transfers/${h.cardId}`}>Indirect routes</Link>
              <Link className="cm-btn cm-btn--ghost cm-btn--sm" href="/flights">Find seats for these</Link>
            </div>
            {worth && <span className="a-cap">Cash redemption: {clip(worth, 130)}</span>}
          </div>
        );
      })}
    </section>
  );
}
