import type { Metadata } from 'next';
import './globals.css';
import { cookies } from 'next/headers';
import { I18nProvider } from '../lib/i18n';
import { Locale } from '../lib/dictionaries';

export const metadata: Metadata = {
  title: 'Antigravity Mock API Dashboard',
  description: 'Manage fake API endpoints with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const lang = (cookieStore.get('lang')?.value || 'vi') as Locale;

  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <I18nProvider initialLang={lang}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
