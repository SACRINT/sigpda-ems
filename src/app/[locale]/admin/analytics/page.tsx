import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import AppLayout from '@/components/layout/AppLayout';
import SupervisorDashboard from '@/components/admin/SupervisorDashboard';

export const metadata: Metadata = {
  title: 'Analítica Avanzada y Supervisión Zonal — SIGPDA-EMS',
  description: 'Centro de mando, semaforización de planteles y alertas pedagógicas DBEPA Puebla MCCEMS.',
};

export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.email) {
    redirect(`/${locale}/login`);
  }

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) {
    redirect(`/${locale}/dashboard`);
  }

  const isUserAdmin = await isAdmin(session.user.email);
  const isSupervisorOrDirector = teacher.role === 'supervisor' || teacher.role === 'director';

  if (!isUserAdmin && !isSupervisorOrDirector) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <AppLayout locale={locale}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
        <SupervisorDashboard
          initialZoneId={teacher.zone_id || 'zona-01'}
          userRole={teacher.role || 'supervisor'}
          userName={teacher.name || session.user.name || 'Supervisor Escolar'}
        />
      </div>
    </AppLayout>
  );
}
