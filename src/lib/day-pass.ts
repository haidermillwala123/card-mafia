import { useCallback, useEffect, useState } from 'react';
import { useUser } from './auth';
import { supabase } from './supabase';

export type Pass = { state: 'loading' | 'signed-out' | 'none' | 'expired' } | { state: 'active'; until: string };

// The signed-in person's Day pass. The row is written by the server only (see migrations/20261023000400_day_pass_demo.sql); this reads it.
export function useDayPass() {
  const user = useUser();
  const [row, setRow] = useState<{ end: string | null } | undefined>(undefined);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    let live = true;
    sb.from('subscriptions').select('current_period_end').eq('tier', 'day').maybeSingle().then(({ data }) => {
      if (live) setRow({ end: data?.current_period_end ?? null });
    });
    return () => {
      live = false;
    };
  }, [user, again]);

  const pass: Pass =
    user === undefined || (user && row === undefined) ? { state: 'loading' }
    : user === null ? { state: 'signed-out' }
    : !row?.end ? { state: 'none' }
    : new Date(row.end) > new Date() ? { state: 'active', until: row.end }
    : { state: 'expired' };

  // Demo checkout: no money moves. 'used' means this account already had its Day pass or has another active plan.
  const buy = useCallback(async (): Promise<'ok' | 'used' | 'error'> => {
    const sb = supabase();
    if (!sb) return 'error';
    const { error } = await sb.rpc('buy_day_pass_demo');
    if (error) return error.code === '23505' ? 'used' : 'error';
    setAgain(n => n + 1);
    return 'ok';
  }, []);

  return { pass, buy };
}
