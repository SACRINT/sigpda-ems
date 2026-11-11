// src/app/[locale]/mi-progreso/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MiProgresoClient from './MiProgresoClient';
import { getPlatformName } from '@/lib/platform/platform-name';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata() {
  const platformName = await getPlatformName();
  return {
    title: `Mi Progreso Pedagógico — ${platformName}`,
    description: 'Estadísticas personales de calidad educativa y uso de IA en tus planeaciones.',
  };
}

export default async function MiProgresoPage({ params }: Props) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return <MiProgresoClient locale={locale} />;
}
