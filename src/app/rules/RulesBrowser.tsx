'use client';

import { useMemo, useState } from 'react';
import { useWallet } from '@/lib/app/wallet';

export type RuleRow = { id: string; to: string; cards: string | null; ratio: string; limit: string | null; multiple: string | null };
export type RuleGroup = { id: string; name: string; rows: RuleRow[] };

// 45 currencies in one alphabetical list is a wall. Search narrows it, and "My cards" starts from what the person holds.
export default function RulesBrowser({ groups, cardProgramme }: { groups: RuleGroup[]; cardProgramme: Record<string, string> }) {
  const w = useWallet();
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const [openAll, setOpenAll] = useState(false);

  const myProgrammes = useMemo(() => new Set(w.profile.cardIds.map(id => cardProgramme[id]).filter(Boolean)), [w.profile.cardIds, cardProgramme]);
  const canFilterMine = w.ready && w.hasCards && myProgrammes.size > 0;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups
      .filter(g => !mine || myProgrammes.has(g.id))
      .map(g => {
        if (!term) return g;
        if (g.name.toLowerCase().includes(term)) return g;
        const rows = g.rows.filter(r => r.to.toLowerCase().includes(term));
        return rows.length ? { ...g, rows } : null;
      })
      .filter((g): g is RuleGroup => g !== null);
  }, [groups, q, mine, myProgrammes]);

  const total = groups.length;
  const filtering = q.trim() !== '' || mine;

  return (
    <div className="stack" style={{ ['--stack' as string]: '16px' }}>
      <div className="rules-tools">
        <label className="rules-search">
          <span className="t-sm muted">Find a card currency or an airline</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. Infinia, KrisFlyer, Marriott" autoComplete="off" />
        </label>
        <div className="rules-chips" role="group" aria-label="Filters">
          <button type="button" className="rules-chip" aria-pressed={mine} disabled={!canFilterMine} onClick={() => setMine(m => !m)}>
            My cards only
          </button>
          <button type="button" className="rules-chip" aria-pressed={openAll} onClick={() => setOpenAll(o => !o)}>
            {openAll ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>
      {!canFilterMine && w.ready && <p className="t-sm muted">Add your cards in Wallet and this list can start from the cards you hold.</p>}
      <p className="t-sm muted" role="status" aria-live="polite">
        {filtering ? `Showing ${shown.length} of ${total} points currencies` : `${total} points currencies`}
      </p>

      {shown.length === 0 && (
        <div className="note"><span>Nothing matches “{q}”. Try a shorter name, such as “hdfc” or “singapore”.</span></div>
      )}

      {shown.map(g => (
        <details key={`${g.id}-${openAll || filtering ? 'o' : 'c'}`} className="rules-group" open={openAll || (filtering && shown.length <= 3)}>
          <summary><b>{g.name}</b> <span className="muted">· {g.rows.length} {g.rows.length === 1 ? 'partner' : 'partners'}</span></summary>
          <div className="table-wrap">
            <table className="data" aria-label={`Transfers from ${g.name}`}>
              <thead><tr><th scope="col">Moves to</th><th scope="col" className="n">Ratio</th><th scope="col">Limit</th></tr></thead>
              <tbody>
                {g.rows.map(r => (
                  <tr key={r.id}>
                    <td>{r.to}{r.cards && <div className="t-sm muted">{r.cards}</div>}</td>
                    <td className="n">{r.ratio}</td>
                    <td>{r.limit ?? <span className="muted">No limit found</span>}{r.multiple ? <div className="t-sm muted">{r.multiple}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
