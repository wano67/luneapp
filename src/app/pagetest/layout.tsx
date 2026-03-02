import { Barlow_Condensed, Roboto_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import FigmaShell from './FigmaShell';

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['300', '600'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
});

export default function PageTestLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${barlowCondensed.variable} ${robotoMono.variable}`}>
      <FigmaShell>{children}</FigmaShell>
    </div>
  );
}
