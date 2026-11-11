// src/app/[locale]/pips/nuevo/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import PipsWizard from './PipsWizard';
import { getPlatformName } from '@/lib/platform/platform-name';

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return { title: `Nueva Cartografía de Zona Escolar — Supervisión · ${platformName}` };
}

export default async function NuevoPipsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  return (
    <AppLayout locale={locale} activeSection="pips">
      <div className="page-header">
        <h1 className="page-title">🗺️ Cartografía de Zona Escolar</h1>
        <p className="page-subtitle">
          Completa el asistente territorial paso a paso. La IA estructurará el diagnóstico, objetivos estratégicos y cronograma de supervisión oficial.
        </p>
      </div>
      <Suspense fallback={<div style={{ color: 'var(--c-text-muted)', padding: 40, textAlign: 'center' }}>Cargando asistente…</div>}>
        <PipsWizard locale={locale} />
      </Suspense>
    </AppLayout>
  );
}
