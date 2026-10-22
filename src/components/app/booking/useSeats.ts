'use client';

// Loads 1..3 seats with reach worked out against the person's cards, and re-checks one seat on demand.
import { useCallback, useEffect, useState } from 'react';
import { fetchRows, recheckSeat, type Result, type RowsResponse, type SeatView } from '@/lib/app/api';
import { useWallet } from '@/lib/app/wallet';

export type Check = { busy: boolean; msg: string | null; gone: boolean };
const NONE: Check = { busy: false, msg: null, gone: false };

export function useSeats(ids: string[], n: number) {
  const wallet = useWallet();
  const { ready, holdings } = wallet;
  const idsKey = ids.join(',');
  const [tick, setTick] = useState(0);
  const key = `${idsKey}|${n}|${JSON.stringify(holdings)}|${tick}`;
  const [res, setRes] = useState<{ key: string; r: Result<RowsResponse> } | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  useEffect(() => {
    if (!ready || !idsKey) return;
    let live = true;
    fetchRows(idsKey.split(','), n, holdings).then(r => live && setRes({ key, r }));
    return () => {
      live = false;
    };
  }, [ready, idsKey, n, holdings, key]);

  const recheck = useCallback(async (id: string) => {
    setChecks(c => ({ ...c, [id]: { busy: true, msg: null, gone: false } }));
    const r = await recheckSeat(id);
    if (!r.ok) return setChecks(c => ({ ...c, [id]: { busy: false, msg: r.error, gone: false } }));
    const gone = Boolean(r.data.gone);
    setChecks(c => ({ ...c, [id]: { busy: false, gone, msg: gone ? null : r.data.refreshed ? 'Refreshed' : 'Live checks paused' } }));
    if (r.data.refreshed) setTick(t => t + 1); // reload so reach follows any new points figure
  }, []);

  const retry = useCallback(() => {
    setRes(null);
    setTick(t => t + 1);
  }, []);

  const data = res?.r.ok ? res.r.data : null;
  const rows: SeatView[] = data ? ids.map(id => data.rows.find(r => r.id === id)).filter((r): r is SeatView => Boolean(r)) : [];
  return {
    wallet,
    loading: !res && Boolean(idsKey),
    error: res && !res.r.ok ? res.r.error : null,
    rows,
    missing: data?.missing ?? [],
    rulesCheckedOn: data?.rulesCheckedOn ?? null,
    check: (id: string): Check => checks[id] ?? NONE,
    recheck,
    retry,
  };
}
