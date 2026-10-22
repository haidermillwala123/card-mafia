'use client';

// The signed-in person's cards and balances, with the device copy as a fallback. Search works with or without them.
import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pullProfile, pushProfile, useUser } from '@/lib/auth';
import { EMPTY_PROFILE, loadProfile, type Profile, saveProfile } from '@/lib/profile';
import { PROGRAMME_OF_CARD } from './catalog';
import type { Holdings } from './api';

export type Wallet = {
  ready: boolean; // false until the saved setup has been read
  user: User | null;
  profile: Profile;
  holdings: Holdings;
  hasCards: boolean;
  // change the setup on this device now; call save() to keep it on the account
  update: (p: Profile) => void;
  save: (p?: Profile) => Promise<boolean>;
};

export function useWallet(): Wallet {
  const user = useUser();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const local = loadProfile();
    if (local) setProfile(local);
    if (user === undefined) return;
    if (!user) {
      setReady(true);
      return;
    }
    let live = true;
    pullProfile().then(p => {
      if (!live) return;
      if (p) {
        const merged = { ...EMPTY_PROFILE, ...(local ?? {}), ...p };
        saveProfile(merged);
        setProfile(merged);
      }
      setReady(true);
    });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      live = false;
    };
  }, [user]);

  const update = useCallback((p: Profile) => {
    setProfile(p);
    saveProfile(p);
  }, []);

  const save = useCallback(
    async (p?: Profile) => {
      const next = p ?? profile;
      update(next);
      return user ? pushProfile(next, PROGRAMME_OF_CARD) : false;
    },
    [profile, update, user],
  );

  const holdings = useMemo<Holdings>(() => ({ cardIds: profile.cardIds, balances: profile.balances }), [profile.cardIds, profile.balances]);
  return { ready, user: user ?? null, profile, holdings, hasCards: profile.cardIds.length > 0, update, save };
}
