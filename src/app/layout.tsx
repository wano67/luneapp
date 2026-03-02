import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Barlow_Condensed, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { getThemePrefFromCookieHeader, type ThemePref } from '@/lib/theme';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['300', '600'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pivot • Votre OS pro & perso',
  description: "Pivot réunit vos finances perso et votre activité pro en un seul espace.",
  icons: {
    icon: '/pivot/favicon.svg',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const pref: ThemePref = getThemePrefFromCookieHeader(cookieStore.get('pref_theme')?.value);
  const initialDataTheme = pref === 'dark' || pref === 'light' ? pref : undefined;

  return (
    <html lang="fr" suppressHydrationWarning data-theme={initialDataTheme} className="overflow-x-hidden">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} ${barlowCondensed.variable} ${robotoMono.variable} antialiased overflow-x-hidden`}
      >
        <ThemeProvider initialPref={pref}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
