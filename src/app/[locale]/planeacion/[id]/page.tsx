import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail, getPlanningById, getPlanningExtras } from '@/lib/db';
import AppLayout from '@/components/layout/AppLayout';
import { featureFlags } from '@/lib/platform/feature-flags';
import PlanningDetailClient from './PlanningDetailClient';
import type { Metadata } from 'next';
import type {
  Planning,
  PlanningExtra,
  CurriculumComponent,
  ExtractedPdfData,
  GeneratedPlanningContent,
  PlanningStatus,
} from '@/types/planning';

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

  // Inyectar CCT/nombre del plantel del docente en sectionI (los generadores PDF/DOCX
  // leen s1.cct/s1.schoolName; en BD sectionI no siempre los trae).
  const rawContent = planning.content_json as unknown as GeneratedPlanningContent | null;
  const contentJson: GeneratedPlanningContent | null = rawContent
    ? {
        ...rawContent,
        sectionI: {
          ...(rawContent.sectionI ?? ({} as GeneratedPlanningContent['sectionI'])),
          cct: rawContent.sectionI?.cct || teacher.cct || undefined,
          schoolName: rawContent.sectionI?.schoolName || teacher.school_name || undefined,
        },
      }
    : null;

  // Cast raw db rows to standard interfaces
  const planningTyped: Planning = {
    id: planning.id,
    teacherId: planning.teacher_id,
    uacName: planning.uac_name,
    semester: planning.semester,
    component: planning.component as CurriculumComponent,
    curriculumName: planning.curriculum_name || '',
    paecContext: planning.paec_context || '',
    extractedData: planning.extracted_data as unknown as ExtractedPdfData | null,
    contentJson,
    status: planning.status as PlanningStatus,
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
    type: ex.type as PlanningExtra['type'],
    title: ex.title,
    keyIndex: ex.key_index,
    contentText: ex.content_text,
    createdAt: ex.created_at,
  }));

  const editorialEngineEnabled = featureFlags.isEnabled('EDITORIAL_PUBLISHER_ENGINE');

  return (
    <AppLayout locale={locale}>
      <PlanningDetailClient
        locale={locale}
        planning={planningTyped}
        initialExtras={extrasTyped}
        editorialEngineEnabled={editorialEngineEnabled}
      />
    </AppLayout>
  );
}

