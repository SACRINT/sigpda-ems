import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail, getPlanningsByTeacher } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import CustomKeyCard from '@/components/dashboard/CustomKeyCard';
import SubscriptionBanner from '@/components/dashboard/SubscriptionBanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mis planeaciones — SIGPDA-EMS',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  generated: 'Generada',
  downloaded: 'Descargada',
};

const COMPONENT_LABELS: Record<string, string> = {
  laboral: 'F. Laboral',
  fundamental: 'Fundamental',
  ampliado: 'Ampliado',
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  const [plannings, subStatus] = await Promise.all([
    getPlanningsByTeacher(teacher.id as string),
    getSubscriptionStatus(teacher.id as string, session.user.email)
  ]);

  return (
    <AppLayout locale={locale} activeSection="dashboard">
      <div className="page-header">
        <h1 className="page-title">Mis planeaciones</h1>
        <p className="page-subtitle">Ciclo escolar 2026-2027 · {plannings.length} planeación{plannings.length !== 1 ? 'es' : ''}</p>
        <div className="page-actions">
          <Link href={`/${locale}/nueva-planeacion`} className="btn btn-primary">
            + Nueva planeación
          </Link>
        </div>
      </div>

      {subStatus.hasActiveSubscription && (
        <SubscriptionBanner
          locale={locale}
          planName={subStatus.subscription?.planName || 'Básico'}
          planSubjects={subStatus.subscription?.planSubjects || 1}
          usedSubjectsCount={subStatus.usedSubjectsCount}
          availableSlots={subStatus.availableSlots}
          isAdmin={subStatus.isAdmin}
        />
      )}

      {plannings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h2 className="empty-state-title">Aún no tienes planeaciones</h2>
          <p className="empty-state-text">
            Crea tu primera planeación didáctica subiendo el PDF de tu programa de estudios.
          </p>
          <Link href={`/${locale}/nueva-planeacion`} className="btn btn-primary">
            Crear primera planeación
          </Link>
        </div>
      ) : (
        <div className="planning-grid">
          {plannings.map((p) => (
            <div key={p.id as string} className="planning-card">
              <div className="planning-card-header">
                <h3 className="planning-card-title">
                  <Link href={`/${locale}/planeacion/${p.id as string}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {p.uac_name as string}
                  </Link>
                </h3>
              </div>
              <div className="planning-card-meta">
                <span className="badge badge-semester">{p.semester as number}° Sem</span>
                <span className="badge badge-component">{COMPONENT_LABELS[p.component as string] || p.component as string}</span>
                <span className={`badge badge-${p.status as string}`}>
                  {STATUS_LABELS[p.status as string] || p.status as string}
                </span>
              </div>
              <p className="planning-card-date">
                {new Date(p.created_at as string).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'short', day: 'numeric'
                })}
              </p>
              <div className="planning-card-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {(p.status === 'generated' || p.status === 'downloaded') && (
                  <Link href={`/${locale}/planeacion/${p.id as string}`} className="btn btn-secondary btn-sm">
                    ✏️ Editar
                  </Link>
                )}
                {(p.status === 'generated' || p.status === 'downloaded') && (
                  <a href={`/api/docx/${p.id as string}`} className="btn btn-primary btn-sm">
                     ↓ DOCX
                  </a>
                )}
                <DeletePlanningButton id={p.id as string} locale={locale} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tarjeta de configuración de API Key personal del Docente */}
      <CustomKeyCard locale={locale} />
    </AppLayout>
  );
}
