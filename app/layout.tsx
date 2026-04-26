import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Iceberg — Anonymous Whistleblower Platform',
  description: 'Submit tips anonymously. Verified human. Untrackable.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-title" content="Iceberg" />
      </head>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
