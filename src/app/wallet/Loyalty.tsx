'use client';

// Airline and hotel loyalty balances saved to the account (point_balances). Bank programmes live on the cards above, so they are left out here.
import { useEffect, useState } from 'react';
import programmesJson from '@/data/programmes.json';
import { fmt } from '@/lib/app/format';
import { useUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const PROGS = programmesJson.programmes as { id: string; name: string; kind: string }[];

export const loyaltyName = (id: string) => PROGS.find(p => p.id === id)?.name ?? id;

export async function saveLoyalty(userId: string, rows: { programmeId: string; balance: number }[]): Promise<boolean> {
  const sb = supabase();
  if (!sb || !rows.length) return false;
  const { error } = await sb.from('point_balances').upsert(
    rows.map(r => ({ user_id: userId, programme_id: r.programmeId, balance: r.balance, source: 'manual', as_of: new Date().toISOString() })),
    { onConflict: 'user_id,programme_id' },
  );
  return !error;
}

export default function Loyalty({ refresh = 0 }: { refresh?: number }) {
  const user = useUser();
  const [rows, setRows] = useState<{ programme_id: string; balance: number }[] | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    let live = true;
    sb.from('point_balances').select('programme_id,balance').eq('user_id', user.id).then(({ data }) => {
      if (live) setRows((data ?? []).filter(r => PROGS.find(p => p.id === r.programme_id)?.kind !== 'bank').sort((a, b) => b.balance - a.balance));
    });
    return () => { live = false; };
  }, [user, refresh]);

  if (!rows || rows.length === 0) return null;
  return (
    <section className="a-c" aria-label="Loyalty programme balances">
      <h2 className="a-sec">Loyalty programmes</h2>
      <div className="a-gl" style={{ gap: 0 }}>
        {rows.map(r => (
          <div className="a-row" key={r.programme_id}>
            <b className="a-g">{loyaltyName(r.programme_id)}</b>
            <b className="a-mono">{fmt(r.balance)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
