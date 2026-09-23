import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTeacherByEmail } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '¡Suscripción activada! — SIGPDA-EMS',
};

export default async function SuscripcionExitoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/login`);

  const teacher = await getTeacherByEmail(session.user.email);
  if (!teacher) redirect(`/${locale}/login`);

  const subscriptionStatus = await getSubscriptionStatus(
    teacher.id as string,
    session.user.email
  );

  const planName = subscriptionStatus.subscription?.planName || 'nuevo';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)',
      backgroundAttachment: 'fixed',
      padding: '24px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ maxWidth: 540, textAlign: 'center' }}>
        {/* Success animation */}
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
          border: '2px solid rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, margin: '0 auto 32px',
          boxShadow: '0 0 60px rgba(16,185,129,0.2)',
        }}>
          🎉
        </div>

        <h1 style={{
          fontSize: 34, fontWeight: 800, color: '#f0f4ff',
          letterSpacing: '-0.5px', marginBottom: 12,
        }}>
          ¡Suscripción activada!
        </h1>

        <p style={{
          fontSize: 16, color: 'rgba(240,244,255,0.6)',
          lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px',
        }}>
          Tu plan <strong style={{ color: '#10b981' }}>{planName.charAt(0).toUpperCase() + planName.slice(1)}</strong> ya
          está activo. Puedes comenzar a crear tus planeaciones didácticas ahora mismo.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px',
        }}>
          {[
            { icon: '✅', text: 'Planeaciones ilimitadas' },
            { icon: '📄', text: 'Exportación a DOCX' },
            { icon: '🔄', text: 'Revisiones sin límite' },
            { icon: '🎯', text: 'Material del docente' },
          ].map((item) => (
            <div key={item.text} style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', gap: 8, alignItems: 'center',
              fontSize: 13, color: 'rgba(240,244,255,0.7)',
            }}>
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <Link
          href={`/${locale}/dashboard`}
          style={{
            display: 'inline-block',
            padding: '16px 40px',
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            borderRadius: 14, color: '#fff',
            fontSize: 16, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 30px rgba(99,102,241,0.45)',
            transition: 'transform 0.2s',
          }}
        >
          🚀 Ir a mis planeaciones
        </Link>

        <p style={{
          marginTop: 24, fontSize: 12,
          color: 'rgba(240,244,255,0.2)',
        }}>
          DidácticaIA · MCCEMS Puebla 2026-2027
        </p>
      </div>
    </div>
  );
}
