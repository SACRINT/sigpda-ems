import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail, getTeacherSchoolZone } from '@/lib/db';
import ConfigurarPerfilClient from './ConfigurarPerfilClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Configura tu perfil — SIGPDA-EMS',
};

export default async function ConfigurarPerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  // El perfil es editable en cualquier momento (multiplantel): solo se marca si
  // ya fue completado para mostrar el flujo de edición en vez del onboarding.
  const schoolZone = await getTeacherSchoolZone(teacher.id);

  return (
    <ConfigurarPerfilClient
      locale={locale}
      teacherName={session.user.name || session.user.email}
      teacherEmail={session.user.email}
      editMode={Boolean(teacher.profile_completed)}
      currentData={{
        schoolName: (teacher.school_name as string) || '',
        municipality: (teacher.municipality as string) || '',
        city: (teacher.city as string) || '',
        cct: (teacher.cct as string) || '',
        subsystem: (teacher.subsystem as string) || '',
        schoolZone: schoolZone || '',
      }}
    />
  );
}
