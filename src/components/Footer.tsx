import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="site-foot">
      <div className="container cols">
        <div className="stack" style={{ ['--stack' as string]: '12px' }}>
          <Logo />
          <p className="t-sm measure">Card Mafia turns a trip goal into a checked award-flight plan for Indian premium cardholders. No loose ends.</p>
          <p className="t-sm measure">Not financial advice. Verify with your bank. We never ask for OTPs or logins. Bank and airline names are plain text and imply no partnership.</p>
        </div>
        <nav aria-label="Product">
          <p className="t-label" style={{ marginBottom: 12 }}>Product</p>
          <ul>
            <li><Link href="/plan">Build a plan</Link></li>
            <li><Link href="/rules">Transfer rules</Link></li>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
          </ul>
        </nav>
        <div>
          <p className="t-label" style={{ marginBottom: 12 }}>Data</p>
          <p className="t-sm">Rules compiled from public sources on 21 Oct 2026. Seat data is cached, and every plan shows its age.</p>
        </div>
      </div>
    </footer>
  );
}
