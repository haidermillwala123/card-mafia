import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Privacy: what Card Mafia stores',
  description: 'What Card Mafia keeps on your device, what it saves if you sign in, and what is sent to the AI model that reads your trip sentence.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Privacy', href: '/privacy' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '24px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Privacy: what Card Mafia stores</h1>
        <p className="t-lg muted measure">Card Mafia never links to your bank. Every balance is a number you type. This page says where those numbers go.</p>

        <section className="stack" aria-labelledby="device-h">
          <h2 id="device-h" className="t-h2">On your device</h2>
          <p className="measure">If you use the setup, your name, home airport, preferred cabin, cards and balances are kept in your browser storage on this device. Clear your browser data and they are gone. Nothing needs an account.</p>
        </section>

        <section className="stack" aria-labelledby="gmail-h">
          <h2 id="gmail-h" className="t-h2">If you import from Gmail</h2>
          <p className="measure">Importing is optional. It asks Google for read-only access to your mail, once. We look only at mail from banks and airlines we recognise, from the last two years, and read the points balance from it with fixed rules. We keep the number, the sender, the subject and the date, and only what you tick. We do not store email text, we do not ask for ongoing access, and the Google token is revoked when the scan ends. You can also remove the app at myaccount.google.com/permissions.</p>
        </section>

        <section className="stack" aria-labelledby="account-h">
          <h2 id="account-h" className="t-h2">If you sign in</h2>
          <p className="measure">Sign-in uses a six-character code sent to your email, with no password. Your email is used only to sign you in and, if you ask, to tell you when Pro opens. With an account, the same setup is saved so it follows you across devices: your name, date of birth if you gave it, home airport, cabin, cards, banks and balances. Each account can read and change only its own rows. Sign out from your account page.</p>
        </section>

        <section className="stack" aria-labelledby="ai-h">
          <h2 id="ai-h" className="t-h2">The AI model</h2>
          <p className="measure">When you build a plan, the sentence you typed (up to 700 characters) is sent to an AI model, Google Gemini through OpenRouter, to be read into a trip. The finished plan figures are sent again to write the plain-language text. Do not type a card number, a login or an OTP into that sentence. If the AI does not answer in time, fixed rules do the same job from the text on our own server.</p>
        </section>

        <section className="stack" aria-labelledby="not-h">
          <h2 id="not-h" className="t-h2">What it does not do</h2>
          <ul className="stack t-body measure" style={{ ['--stack' as string]: '8px' }}>
            <li>No analytics or advertising trackers are installed.</li>
            <li>No affiliate links, and no payment is taken today.</li>
          </ul>
        </section>

        <p className="t-sm muted measure">This is a prototype. <Link href="/about">About Card Mafia</Link>.</p>
      </div>
    </>
  );
}
