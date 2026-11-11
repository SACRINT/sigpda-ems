import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import AdminClient from './AdminClient';
import { isAdmin } from '@/lib/admin-unified';
import type { Metadata } from 'next';
import { getPlatformName } from '@/lib/platform/platform-name';

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return { title: `Panel de Administrador — ${platformName}` };
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const adminOk = await isAdmin(session.user.email);
  if (!adminOk) redirect(`/${locale}/dashboard`);

  return (
    <AppLayout locale={locale}>
      <AdminClient locale={locale} adminEmail={session.user.email} />
    </AppLayout>
  );
}
