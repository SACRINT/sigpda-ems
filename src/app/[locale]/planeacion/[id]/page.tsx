import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail, getPlanningById, getPlanningExtras } from '@/lib/db';
import AppLayout from '@/components/layout/AppLayout';
import PlanningDetailClient from './PlanningDetailClient';
import type { Metadata } from 'next';
import type { Planning, PlanningExtra } from '@/types/planning';

export const metadata: Metadata = {
  title: 'Ver UAC y Recursos — SIGPDA-EMS',
};

export default async function PlanningDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  const planning = await getPlanningById(id, teacher.id);
  if (!planning) redirect(`/${locale}/dashboard`);

  // Fetch initial generated extras (rubrics, materials, lesson plans)
  const extras = await getPlanningExtras(id, teacher.id);

  // Cast raw db rows to standard interfaces
  const planningTyped: Planning = {
    id: planning.id,
    teacherId: planning.teacher_id,
    uacName: planning.uac_name,
    semester: planning.semester,
    component: planning.component as any,
    curriculumName: planning.curriculum_name || '',
    paecContext: planning.paec_context || '',
    extractedData: planning.extracted_data as any,
    contentJson: planning.content_json as any,
    status: planning.status as any,
    createdAt: planning.created_at,
    updatedAt: planning.updated_at,
    metodologiaActiva: planning.metodologia_activa || undefined,
    evaluationJson: planning.evaluation_json || null,
    sequenceJson: planning.sequence_json || null,
    workbooksJson: planning.workbooks_json || null,
  };

  const extrasTyped: PlanningExtra[] = extras.map((ex) => ({
    id: ex.id,
    planningId: ex.planning_id,
    type: ex.type as any,
    title: ex.title,
    keyIndex: ex.key_index,
    contentText: ex.content_text,
    createdAt: ex.created_at,
  }));

  return (
    <AppLayout locale={locale}>
      <PlanningDetailClient
        locale={locale}
        planning={planningTyped}
        initialExtras={extrasTyped}
      />
    </AppLayout>
  );
}

