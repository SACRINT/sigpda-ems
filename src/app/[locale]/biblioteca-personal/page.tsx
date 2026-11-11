import { setRequestLocale } from 'next-intl/server';
import { BibliotecaPersonalClient } from './BibliotecaPersonalClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPlatformName } from '@/lib/platform/platform-name';


export async function generateMetadata() {
  const platformName = await getPlatformName();
  return {
    title: `Biblioteca Personal | ${platformName}`,
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

  const platformName = await getPlatformName();
  return <BibliotecaPersonalClient platformName={platformName} />;
}
