import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import MisEscuelasClient from './MisEscuelasClient';
import type { Metadata } from 'next';
import { getPlatformName } from '@/lib/platform/platform-name';

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return { title: `Mis Escuelas — ${platformName}` };
}

export default async function MisEscuelasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);
  return (
    <AppLayout locale={locale}>
      <MisEscuelasClient />
    </AppLayout>
  );
}
