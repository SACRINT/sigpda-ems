import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { sql } from '@/lib/db/client';
import PmcWizardClient from './PmcWizardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nuevo PMC — SIGPDA-EMS',
};

export default async function PmcNuevoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { locale } = await params;
  const { id } = await searchParams;

  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  let project = null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && uuidRegex.test(id)) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
    const db = sql();
    const rows = await db`
      SELECT * FROM pmc_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      LIMIT 1
    `;
    project = rows[0] || null;
  }

  return (
    <PmcWizardClient
      locale={locale}
      teacherId={teacher.id as string}
      teacherName={teacher.name as string}
      teacherSchool={teacher.school_name as string}
      teacherMunicipality={teacher.municipality as string}
      existingProject={project}
    />
  );
}
