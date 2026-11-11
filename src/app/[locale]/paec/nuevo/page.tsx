import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import AppLayout from '@/components/layout/AppLayout';
import PaecWizardClient from './PaecWizardClient';
import type { Metadata } from 'next';
import { getPlatformName } from '@/lib/platform/platform-name';

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return { title: `Asistente PAEC-PEC — ${platformName}` };
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function NuevoPaecPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  const isUserAdmin = await isAdmin(session.user.email, teacher.role);

  const isDirector = isUserAdmin || teacher.role === 'director';
  if (!isDirector) {
    redirect(`/${locale}/dashboard`);
  }

  const { id } = await searchParams;

  return (
    <AppLayout locale={locale} activeSection="paec">
      <PaecWizardClient locale={locale} initialId={id || null} />
    </AppLayout>
  );
}
