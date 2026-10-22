import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ds/index.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBar from '@/components/app/MobileBar';
import SessionGate from '@/components/SessionGate';
import NextSteps from '@/components/NextSteps';
import RouteLoader from '@/components/RouteLoader';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Card Mafia: know the plan before you move the points', template: '%s | Card Mafia' },
  description: 'Card Mafia turns a trip goal into a verified award-flight plan for Indian premium cardholders: the cheapest points path, checked before you transfer.',
  applicationName: SITE_NAME,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

// Sets the saved theme before first paint. Light is the default.
const THEME = `try{var t=localStorage.getItem('cm-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
        <link rel="preload" href="/fonts/BricolageGrotesque-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/InstrumentSans-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <RouteLoader />
        <main id="main"><SessionGate>{children}</SessionGate><NextSteps /></main>
        <Footer />
        <MobileBar />
      </body>
    </html>
  );
}
