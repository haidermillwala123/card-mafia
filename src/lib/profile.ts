// The setup answers live on this device. Nothing here is sent anywhere until the person chooses to save it.
export type Profile = {
  first: string;
  last: string;
  dob: string;
  airport: string;
  cabin: string;
  bankIds: string[];
  cardIds: string[];
  balances: Record<string, number>; // points per card id
  plan: 'free' | 'pro';
  period: 'monthly' | 'yearly';
};

export const EMPTY_PROFILE: Profile = { first: '', last: '', dob: '', airport: '', cabin: 'business', bankIds: [], cardIds: [], balances: {}, plan: 'free', period: 'yearly' };

const KEY = 'cm-profile';

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the setup lasts for this visit only */
  }
}
