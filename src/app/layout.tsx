import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'Lune • OS perso & pro',
  description: "Landing publique et accès à l'app interne Lune.",
  icons: {
    icon: '/icon.svg',
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
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased overflow-x-hidden`}
      >
        <ThemeProvider initialPref={pref}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
