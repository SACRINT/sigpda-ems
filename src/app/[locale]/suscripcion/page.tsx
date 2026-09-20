import { sql } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import SuscripcionClient from './SuscripcionClient';

export default async function SuscripcionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/${locale}/login`);
  }

  const db = sql();
  const existing = await db`
    SELECT id, role, profile_completed, email, name
    FROM teachers
    WHERE email = ${session.user.email}
    LIMIT 1
  `;

  if (!existing.length || !existing[0].profile_completed) {
    redirect(`/${locale}/configurar-perfil`);
  }

  const teacher = existing[0];

  // Checar si tiene suscripción activa o stripe_customer_id
  const subRows = await db`
    SELECT id, plan_name, plan_subjects, status, current_period_end, stripe_customer_id
    FROM subscriptions
    WHERE teacher_id = ${teacher.id}::uuid
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const activeSub = subRows.length > 0 && subRows[0].status === 'active' ? subRows[0] : null;
  const hasStripeCustomer = subRows.length > 0 && !!subRows[0].stripe_customer_id;

  // Si es administrador
  if (teacher.role === 'administrador') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
        padding: 24
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '40px',
          borderRadius: '24px',
          border: '1px solid rgba(99,102,241,0.3)',
          backdropFilter: 'blur(10px)',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>👑</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Acceso Administrativo</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '32px', lineHeight: '1.6' }}>
            Tu cuenta tiene rol de administrador del sistema SIGPDA-EMS. Tienes acceso completo e ilimitado a todas las herramientas sin costo.
          </p>
          <Link href={`/${locale}/dashboard`} style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
          }}>
            Ir al Panel Principal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SuscripcionClient
      locale={locale}
      userRole={teacher.role || 'docente'}
      activePlanName={activeSub?.plan_name || null}
      activePlanSubjects={activeSub?.plan_subjects || null}
      hasStripeCustomer={hasStripeCustomer}
    />
  );
}
