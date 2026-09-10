import { redirect } from 'next/navigation';

export default async function DashboardPlanningRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect(`/${locale}/planeacion/${id}`);
}
