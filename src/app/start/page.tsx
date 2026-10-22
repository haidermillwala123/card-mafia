import { redirect } from 'next/navigation';

// Setup moved into the Wallet and Home screens. Onboarding.tsx stays on disk, unused.
export default function StartPage() {
  redirect('/home');
}
