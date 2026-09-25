import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { sql } from '@/lib/db/client';
import { isAdmin } from '@/lib/admin-unified';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import type { Metadata } from 'next';
import DeletePmcButton from './DeletePmcButton';

export const metadata: Metadata = {
  title: 'Plan de Mejora Continua — SIGPDA-EMS',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'En elaboración', color: '#ffc107' },
  completed: { label: 'Completado', color: '#28a745' },
};

export default async function PmcDashboardPage({
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

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const db = sql();
  const projects = await db`
    SELECT id, school_name, school_cct, municipality, director_name,
           ciclo_escolar, subsystem, current_step, status, created_at
    FROM pmc_projects
    WHERE teacher_id = ${teacher.id}::uuid
    ORDER BY created_at DESC
  `;

  return (
    <AppLayout locale={locale} activeSection="pmc">
      <div className="page-header">
        <h1 className="page-title">Plan de Mejora Continua (PMC)</h1>
        <p className="page-subtitle">
          Planeación de la Mejora Continua MCCEMS · {projects.length} plan{projects.length !== 1 ? 'es' : ''}
        </p>
        <div className="page-actions">
          <Link href={`/${locale}/pmc/nuevo`} className="btn btn-primary">
            + Nuevo PMC
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <h2 className="empty-state-title">Aún no tienes planes de mejora</h2>
          <p className="empty-state-text">
            Crea tu primer Plan de Mejora Continua (PMC) para el ciclo escolar 2025-2026.
            La plataforma te guiará paso a paso para elaborar un PMC alineado a los
            lineamientos oficiales del MCCEMS con apoyo de inteligencia artificial.
          </p>
          <Link href={`/${locale}/pmc/nuevo`} className="btn btn-primary">
            Crear primer PMC
          </Link>
        </div>
      ) : (
        <div className="planning-grid">
          {projects.map((p) => {
            const st = STATUS_LABELS[p.status as string] || STATUS_LABELS.draft;
            const stepLabel = p.status === 'completed' ? 'Completado' : `Paso ${p.current_step} de 5`;
            return (
              <div key={p.id as string} className="planning-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="planning-card-header">
                    <h3 className="planning-card-title">{p.school_name as string || 'Sin nombre'}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '8px' }}>
                    <strong>CCT:</strong> {p.school_cct as string || '—'} &nbsp;|&nbsp; {p.municipality as string || '—'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '12px' }}>
                    <strong>Director(a):</strong> {p.director_name as string || '—'}
                  </p>
                  <div className="planning-card-meta" style={{ marginBottom: '16px' }}>
                    <span className="badge badge-component" style={{ backgroundColor: 'var(--c-blue-mid)', color: '#fff' }}>
                      {p.ciclo_escolar as string}
                    </span>
                    <span className="badge badge-component" style={{ backgroundColor: '#6c757d', color: '#fff' }}>
                      {p.subsystem as string}
                    </span>
                    <span className="badge" style={{ backgroundColor: st.color, color: p.status === 'draft' ? '#212529' : '#fff' }}>
                      {stepLabel}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="planning-card-date">
                    Creado: {new Date(p.created_at as string).toLocaleDateString('es-MX', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </p>
                  <div className="planning-card-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Link href={`/${locale}/pmc/nuevo?id=${p.id as string}`} className="btn btn-secondary btn-sm">
                      {p.status === 'completed' ? 'Ver' : 'Continuar'}
                    </Link>
                    {p.status === 'completed' && (
                      <>
                        <a href={`/api/pdf/pmc/${p.id as string}`} className="btn btn-sm" style={{ backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff', fontWeight: 600 }}>
                          ↓ PMC Oficial PDF
                        </a>
                        <a href={`/api/docx/pmc/${p.id as string}`} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)', color: '#fff' }}>
                          ↓ PMC Word
                        </a>
                        <a href={`/api/excel/metas/${p.id as string}`} className="btn btn-sm" style={{ backgroundColor: '#059669', borderColor: '#059669', color: '#fff' }}>
                          ↓ Metas Excel
                        </a>
                        <a href={`/api/docx/pmc/${p.id as string}/informe-parcial`} className="btn btn-sm" style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8', color: '#fff' }}>
                          ↓ Informe Parcial
                        </a>
                        <a href={`/api/docx/pmc/${p.id as string}/informe-final`} className="btn btn-sm" style={{ backgroundColor: '#28a745', borderColor: '#28a745', color: '#fff' }}>
                          ↓ Informe Final
                        </a>
                      </>
                    )}
                    <DeletePmcButton id={p.id as string} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
