import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mindalike - Meet Verified Humans',
  description: 'An Omegle-style random chat matching app for World App. Connect with real, verified humans instantly.',
  keywords: ['World App', 'Chat', 'Match', 'Verified Humans', 'World ID'],
  authors: [{ name: 'Mindalike Team' }],
  openGraph: {
    title: 'Mindalike - Meet Verified Humans',
    description: 'Connect with real, verified humans instantly through World App.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1E90FF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="font-body">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-bg-1 text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
