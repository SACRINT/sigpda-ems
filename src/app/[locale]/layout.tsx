import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';
import ChunkErrorListener from '@/components/common/ChunkErrorListener';
import SessionProviderWrapper from '@/components/auth/SessionProviderWrapper';
import {
  AssistantProvider,
  UniversalPedagogicalAssistant,
} from '@/components/assistant';
import { getPlatformName } from '@/lib/platform/platform-name';
import '../globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return {
    title: `${platformName} — Sistema Integral de Gestión de Planeación Didáctica Automatizada`,
    description: 'Sistema Integral de Gestión de Planeación Didáctica Automatizada y Horarios Escolares para Educación Media Superior.',
    keywords: `planeación didáctica, SIGPDA, ${platformName}, NEM, MCCEMS, secuencia didáctica, horarios escolares, IA`,
  };
}

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
        <SessionProviderWrapper>
          <NextIntlClientProvider messages={messages}>
            <AssistantProvider>
              {children}
              <UniversalPedagogicalAssistant />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--c-bg-elevated)',
                    color: 'var(--c-text)',
                    border: '1px solid var(--c-border-2)',
                  },
                }}
              />
            </AssistantProvider>
          </NextIntlClientProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
