import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import SignIn from './SignIn';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Card Mafia with an email code to bring your saved cards and balances onto this device. No password, and an account is optional.',
  alternates: { canonical: '/signin' },
};

export default function SignInPage() {
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Sign in', href: '/signin' }]} />
      <SignIn />
    </>
  );
}
