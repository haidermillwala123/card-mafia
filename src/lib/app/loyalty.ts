// The balance a person has saved in one airline or hotel programme (Wallet, point_balances, readable only by its owner).
// null while loading, when signed out, or when nothing is saved for that programme.
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export function useProgrammeBalance(programmeId: string | undefined): number | null {
  const user = useUser();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const sb = supabase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user || !sb || !programmeId) { setBalance(null); return; }
    sb.from('point_balances').select('balance').eq('programme_id', programmeId).maybeSingle().then(({ data }) => {
      if (live) setBalance(data ? Number(data.balance) : null);
    });
    return () => { live = false; };
  }, [user, programmeId]);
  return balance;
}
