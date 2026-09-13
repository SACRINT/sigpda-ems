// src/app/[locale]/pips/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import type { Metadata } from 'next';
import { neon } from '@neondatabase/serverless';
import DeletePipsButton from './DeletePipsButton';

export const metadata: Metadata = {
  title: 'Cartografía de Zona Escolar — Supervisión de Zona · SIGPDA-EMS',
};

export default async function PipsDashboardPage({
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

  const isSupervisor = isAdmin || teacher.role === 'supervisor';
  if (!isSupervisor) {
    redirect(`/${locale}/dashboard`);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const projects = await sql`
    SELECT id, zona_nombre, zona_clave, supervisor_name,
           ciclo_escolar, num_planteles, current_step, status, created_at, updated_at
    FROM pips_projects
    WHERE teacher_id = ${teacher.id}::uuid
    ORDER BY updated_at DESC
  `;

  return (
    <AppLayout locale={locale} activeSection="pips">
      <div className="page-header">
        <div>
          <h1 className="page-title">🗺️ Cartografía de Zona Escolar</h1>
          <p className="page-subtitle">
            Diagnóstico territorial, prioridades de intervención y planeación estratégica de la supervisión
            {projects.length > 0 ? ` · ${projects.length} cartografía${projects.length !== 1 ? 's' : ''} registrada${projects.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="page-actions">
          <Link href={`/${locale}/pips/nuevo`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>+</span> Nueva Cartografía de Zona
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗺️</div>
          <h2 className="empty-state-title">Aún no tienes Cartografías registradas</h2>
          <p className="empty-state-text">
            Elabora la Cartografía de Supervisión de tu Zona Escolar de forma estructurada e inteligente.
            La IA analizará el territorio, planteles y problemáticas de tu zona para generar objetivos, metas y cronograma con apego normativo SEP.
          </p>
          <Link href={`/${locale}/pips/nuevo`} className="btn btn-primary">
            Generar primera Cartografía
          </Link>
        </div>
      ) : (
        <div className="planning-grid">
          {projects.map((proj) => (
            <div
              key={proj.id as string}
              className="planning-card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div className="planning-card-header">
                  <h3 className="planning-card-title">{proj.zona_nombre as string}</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '10px' }}>
                  <strong>Clave:</strong> {proj.zona_clave as string || '—'}
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <strong>Supervisor:</strong> {proj.supervisor_name as string || '—'}
                </p>
                <div className="planning-card-meta" style={{ marginBottom: '16px' }}>
                  <span
                    className="badge badge-component"
                    style={{ backgroundColor: 'var(--c-blue-mid)', color: '#fff' }}
                  >
                    Ciclo {proj.ciclo_escolar as string}
                  </span>
                  <span
                    className={`badge ${proj.status === 'completed' ? 'badge-generated' : 'badge-draft'}`}
                    style={{
                      backgroundColor: proj.status === 'completed' ? '#28a745' : '#ffc107',
                      color: proj.status === 'completed' ? '#fff' : '#212529',
                    }}
                  >
                    {proj.status === 'completed'
                      ? '✅ Completado'
                      : `Paso ${proj.current_step} de 6`}
                  </span>
                  <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                    {proj.num_planteles as number} planteles
                  </span>
                </div>
              </div>
              <div>
                <p className="planning-card-date">
                  Actualizado:{' '}
                  {new Date(proj.updated_at as string).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <div
                  className="planning-card-actions"
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <Link
                    href={`/${locale}/pips/nuevo?id=${proj.id as string}`}
                    className="btn btn-secondary btn-sm"
                  >
                    {proj.status === 'completed' ? 'Ver / Editar' : 'Continuar'}
                  </Link>
                  {proj.status === 'completed' && (
                    <>
                      <a
                        href={`/api/pdf/pips/${proj.id as string}`}
                        className="btn btn-sm"
                        style={{ backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff', fontWeight: 600 }}
                      >
                        ↓ PIPS Oficial PDF
                      </a>
                      <a
                        href={`/api/docx/pips/${proj.id as string}`}
                        className="btn btn-primary btn-sm"
                        style={{ backgroundColor: 'var(--c-amber)', borderColor: 'var(--c-amber)', color: '#fff' }}
                      >
                        ↓ Descargar Word
                      </a>
                    </>
                  )}
                  <DeletePipsButton id={proj.id as string} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
