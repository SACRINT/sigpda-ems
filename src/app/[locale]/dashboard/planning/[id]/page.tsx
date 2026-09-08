import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import AppLayout from '@/components/layout/AppLayout';
import { PlanningEditorWrapper } from './PlanningEditorWrapper';
import { BundleGeneratorWrapper } from './BundleGeneratorWrapper';
import Link from 'next/link';
import { ArrowLeft, FileDown, Calendar } from 'lucide-react';

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
  if (!planning) notFound();

  return (
    <AppLayout locale={locale} activeSection="dashboard">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard`}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[var(--c-text)]">{planning.uacName}</h1>
              <p className="text-sm text-[var(--c-text-muted)] flex items-center gap-2">
                <Calendar size={14} />
                Semestre {planning.semester} · {planning.component} · {planning.status === 'generated' ? 'Generada' : planning.status === 'downloaded' ? 'Descargada' : 'Borrador'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/docx/${planning.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--c-text)] bg-[var(--c-bg-surface)] border border-[var(--c-border-2)] rounded-lg hover:bg-[var(--c-bg-elevated)] transition-colors"
            >
              <FileDown size={16} />
              Descargar DOCX
            </a>
          </div>
        </div>

        {/* Editor */}
        {planning.contentJson ? (
          <PlanningEditorWrapper
            planningId={planning.id}
            content={planning.contentJson as any}
          />
        ) : (
          <div className="text-center py-16 bg-[var(--c-bg-surface)] rounded-xl border border-[var(--c-border)]">
            <p className="text-[var(--c-text-muted)]">Esta planeación aún no tiene contenido generado.</p>
            <Link
              href={`/${locale}/nueva-planeacion`}
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
            >
              Generar planeación
            </Link>
          </div>
        )}

        {/* Bundles Didácticos */}
        {planning.contentJson && (
          <div className="mt-6">
            <BundleGeneratorWrapper
              planningId={planning.id}
              uacName={planning.uacName}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
