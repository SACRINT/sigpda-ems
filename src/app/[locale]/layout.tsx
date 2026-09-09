import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';
import ChunkErrorListener from '@/components/common/ChunkErrorListener';
import '../globals.css';

export const metadata: Metadata = {
  title: 'SIGPDA-EMS — Sistema Integral de Gestión de Planeación Didáctica Automatizada',
  description: 'Sistema Integral de Gestión de Planeación Didáctica Automatizada y Horarios Escolares para Educación Media Superior.',
  keywords: 'planeación didáctica, SIGPDA, SIGPDA-EMS, NEM, MCCEMS, secuencia didáctica, horarios escolares, IA',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'es' | 'en')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <ChunkErrorListener />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
