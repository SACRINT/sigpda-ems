import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import AppLayout from '@/components/layout/AppLayout';
import HorariosDashboardClient from './HorariosDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Generador de Horarios Escolares IA (Directores) · SIGPDA-EMS',
};

export default async function HorariosDashboardPage({
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
    <AppLayout locale={locale} activeSection="horarios">
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Generador de Horarios Escolar Inteligente</h1>
          <p className="page-subtitle">
            Gestión y construcción de plantillas sin empalmes para Directores · DBEPA Puebla
          </p>
        </div>
      </div>

      <HorariosDashboardClient
        isDirector={isDirector}
        isAdmin={isUserAdmin}
        teacherName={teacher.name || 'Docente'}
        teacherId={teacher.id}
        schoolName={teacher.school_name || 'Mi Plantel'}
        cct={teacher.cct || 'SIN CCT'}
      />
    </AppLayout>
  );
}
