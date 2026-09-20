import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import AppLayout from '@/components/layout/AppLayout';
import MiEscuelaClient from './MiEscuelaClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mi Plantel · SIGPDA-EMS',
  description: 'Gestión del personal docente y administrativo de tu plantel.',
};

export default async function MiEscuelaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
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

  return (
    <AppLayout locale={locale} activeSection="mi-escuela">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏫 Mi Plantel</h1>
          <p className="page-subtitle">
            Gestión del personal docente y administrativo · {teacher.school_name || 'Tu plantel'}
          </p>
        </div>
      </div>

      <MiEscuelaClient
        teacherName={teacher.name || 'Director'}
        schoolName={teacher.school_name || 'Mi Plantel'}
        cct={teacher.cct || ''}
        isAdmin={isUserAdmin}
      />
    </AppLayout>
  );
}
