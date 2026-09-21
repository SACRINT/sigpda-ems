import { setRequestLocale } from 'next-intl/server';
import { BibliotecaPersonalClient } from './BibliotecaPersonalClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function generateMetadata() {
  return {
    title: 'Biblioteca Personal | SIGPDA-EMS',
  };
}

export default async function BibliotecaPersonalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/${locale}/login`);
  }

  return <BibliotecaPersonalClient />;
}
