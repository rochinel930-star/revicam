import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Révision Probatoire D, Première D Cameroun`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#1A237E',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Header />
        {/* pt-12 : hauteur du header fixe · pb-16 : bottom-nav mobile */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-3 pb-20 pt-16 md:pb-8">
          {children}
        </main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
