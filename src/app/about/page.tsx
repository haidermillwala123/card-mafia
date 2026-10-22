import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'About Card Mafia',
  description: 'What Card Mafia does, what it does not do, where its rules come from, and how it is paid for today.',
  alternates: { canonical: '/about' },
};

export default function About() {
  return (
    <>
      <Breadcrumbs trail={[{ name: 'About', href: '/about' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '24px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">About Card Mafia</h1>
        <p className="t-lg muted measure">Card Mafia turns an Indian premium credit card balance into an award-flight plan. You describe a trip and the cards you hold, and it shows which transfers could pay for a seat, with the checks to run before you move any points.</p>

        <section className="stack" aria-labelledby="does-h">
          <h2 id="does-h" className="t-h2">What it does and does not do</h2>
          <ul className="stack t-body measure" style={{ ['--stack' as string]: '8px' }}>
            <li>It plans. It never transfers points, books a seat, or asks for a bank or airline login or an OTP.</li>
            <li>The numbers come from fixed rules written in code: ratios, caps, which aircraft carry Qsuite, and which seats are open. An AI model only reads your sentence and rewrites the finished numbers as plain text. It does no maths, and a sentence containing a number the rules did not produce is dropped.</li>
            <li>Seats in the demo are a labelled sample for Doha to New York, Chicago, Los Angeles and Miami in October 2027, plus India to Doha. They are not live availability, and every plan shows how old its seat data is.</li>
          </ul>
        </section>

        <section className="stack" aria-labelledby="data-h">
          <h2 id="data-h" className="t-h2">Where the rules come from</h2>
          <p className="measure">Transfer ratios and caps were compiled from public sources, mainly points.casa, on 21 Oct 2026. They are not matched to the bank portals, so a plan marks them as sample ratios. Banks change rules without notice, so match every step on the bank portal before you transfer. See <Link href="/rules">the transfer rules</Link>.</p>
        </section>

        <section className="stack" aria-labelledby="money-h">
          <h2 id="money-h" className="t-h2">How it is paid for</h2>
          <p className="measure">Today it is not. There are no affiliate links, no ads, and no payment is taken anywhere. Card Mafia is a prototype and is not affiliated with any bank or airline. Bank and airline names are plain text.</p>
        </section>

        <p className="t-sm muted measure">Not financial advice. See how we handle your data on the <Link href="/privacy">privacy page</Link>.</p>
      </div>
    </>
  );
}
