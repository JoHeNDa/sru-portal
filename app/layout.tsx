import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import GoogleOneTap from '@/components/GoogleOneTap';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import PublicMotionScope from '@/components/PublicMotionScope';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Society of Radiography of Uganda',
  description: 'Advancing radiography practice in Uganda through professional development, standards, and a stronger professional community.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <PublicMotionScope />
        <GoogleOneTap />
        <TopBar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
