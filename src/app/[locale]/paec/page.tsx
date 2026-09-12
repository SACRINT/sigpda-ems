import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import type { Metadata } from 'next';
import { neon } from '@neondatabase/serverless';
import DeletePaecButton from './DeletePaecButton';

export const metadata: Metadata = {
  title: 'Proyectos PAEC-PEC — SIGPDA-EMS',
};

const CYCLE_LABELS: Record<string, string> = {
  A: 'Semestre A (1°, 3° y 5°)',
  B: 'Semestre B (2°, 4° y 6°)',
  annual: 'Ciclo Anual (1° al 6°)',
};

export default async function PaecDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  const isAdmin =
    teacher.role === 'administrador' ||
    session.user.email === process.env.ADMIN_EMAIL;

  const isDirector = isAdmin || teacher.role === 'director';
  if (!isDirector) {
    redirect(`/${locale}/dashboard`);
  }

  // Direct fetch from DB for Server Component
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const sql = neon(process.env.DATABASE_URL);
  const projects = await sql`
    SELECT id, project_name, problem_statement, cycle_type, current_step, status, created_at
    FROM paec_projects
    WHERE teacher_id = ${teacher.id}::uuid
    ORDER BY created_at DESC
  `;

  return (
    <AppLayout locale={locale} activeSection="paec">
      <div className="page-header">
        <h1 className="page-title">Proyectos PAEC-PEC</h1>
        <p className="page-subtitle">
          Programa Aula, Escuela y Comunidad & Proyecto Escolar Comunitario · {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
        </p>
        <div className="page-actions">
          <Link href={`/${locale}/paec/nuevo`} className="btn btn-primary">
            + Nuevo Proyecto PAEC
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏫</div>
          <h2 className="empty-state-title">Aún no tienes proyectos PAEC</h2>
          <p className="empty-state-text">
            Crea tu primer Proyecto Escolar Comunitario (PEC) transversalizando las asignaturas de tu plantel en base al ciclo de relevos.
          </p>
          <Link href={`/${locale}/paec/nuevo`} className="btn btn-primary">
            Crear primer proyecto
          </Link>
        </div>
      ) : (
        <div className="planning-grid">
          {projects.map((p) => (
            <div key={p.id as string} className="planning-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="planning-card-header">
                  <h3 className="planning-card-title">{p.project_name as string}</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '38px' }}>
                  <strong>Problema:</strong> {p.problem_statement as string}
                </p>
                <div className="planning-card-meta" style={{ marginBottom: '16px' }}>
                  <span className="badge badge-component" style={{ backgroundColor: 'var(--c-blue-mid)', color: '#fff' }}>
                    {CYCLE_LABELS[p.cycle_type as string] || p.cycle_type as string}
                  </span>
                  <span className={`badge ${p.status === 'completed' ? 'badge-generated' : 'badge-draft'}`} style={{
                    backgroundColor: p.status === 'completed' ? '#28a745' : '#ffc107',
                    color: p.status === 'completed' ? '#fff' : '#212529'
                  }}>
                    {p.status === 'completed' ? 'Completado' : `Paso ${p.current_step} de 7`}
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
                  <Link href={`/${locale}/paec/nuevo?id=${p.id as string}`} className="btn btn-secondary btn-sm">
                    {p.status === 'completed' ? 'Ver' : 'Continuar'}
                  </Link>
                  {p.status === 'completed' && (
                    <a href={`/api/docx/paec/${p.id as string}`} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--c-amber)', borderColor: 'var(--c-amber)', color: '#fff' }}>
                      ↓ Word
                    </a>
                  )}
                  <DeletePaecButton id={p.id as string} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
