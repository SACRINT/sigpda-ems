import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import AdminClient from './AdminClient';
import { isAdmin } from '@/lib/admin-unified';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel de Administrador — SIGPDA-EMS',
};

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
