import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import AuthCard from '@/components/auth/AuthCard';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Acceso a la Plataforma — SIGPDA-EMS',
    description: 'Accede o crea tu cuenta en SIGPDA-EMS para generar planeaciones, horarios y proyectos oficiales.',
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (session?.user) {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations('auth');

  return (
    <main className="login-page">
      <div className="login-container" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">📚</span>
            <h1 className="logo-text">SIGPDA-EMS</h1>
          </div>
          <div className="mccems-badge">Educación Media Superior · MCCEMS</div>
        </div>

        {/* Card */}
        <div className="login-card" style={{ padding: '32px' }}>
          <h2 className="login-title" style={{ fontSize: '22px', marginBottom: '8px' }}>Portal Docente y Directivo</h2>
          <p className="login-subtitle" style={{ fontSize: '13px', marginBottom: '20px' }}>
            Generación inteligente de planeaciones, horarios, PMC, PAEC y Cartografía
          </p>

          <AuthCard locale={locale} />

          <p className="login-terms" style={{ marginTop: '20px' }}>{t('termsNotice')}</p>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>Secretaría de Educación Pública del Estado de Puebla</p>
          <p>Dirección de Bachilleratos Estatales y Preparatoria Abierta</p>
        </div>
      </div>

      {/* Background decorative elements */}
      <div className="login-bg">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>
    </main>
  );
}
