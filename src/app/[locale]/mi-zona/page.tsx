import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import AppLayout from '@/components/layout/AppLayout';
import MiZonaClient from './MiZonaClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mi Zona de Supervisión · SIGPDA-EMS',
  description: 'Gestión de los planteles de tu zona de supervisión.',
};

export default async function MiZonaPage({
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

  const isSupervisor = isUserAdmin || teacher.role === 'supervisor';

  if (!isSupervisor) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <AppLayout locale={locale} activeSection="mi-zona">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔍 Mi Zona de Supervisión</h1>
          <p className="page-subtitle">
            Registro y seguimiento de los planteles bajo tu supervisión
            {teacher.school_name ? ` · ${teacher.school_name}` : ''}
          </p>
        </div>
      </div>

      <MiZonaClient
        supervisorName={teacher.name || 'Supervisor'}
        zoneName={teacher.school_name || 'Mi Zona'}
        isAdmin={isUserAdmin}
      />
    </AppLayout>
  );
}
