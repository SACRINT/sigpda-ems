import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';
import { signOutAction, signOutPlain } from '@/lib/server-actions';
import SignOutButton from './SignOutButton';
import HeartbeatSender from './HeartbeatSender';
import PedagogicalChatWidget from '../PedagogicalChatWidget';
import NotificationBell from '../notifications/NotificationBell';

type Props = {
  children: React.ReactNode;
  locale: string;
  activeSection?: string;
};

async function getUserRole(email: string): Promise<{ isAdmin: boolean; role: string }> {
  if (process.env.ADMIN_EMAIL === email) return { isAdmin: true, role: 'administrador' };
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const adminRows = await sql`SELECT email FROM admins WHERE email = ${email} LIMIT 1`;
      if (adminRows.length > 0) return { isAdmin: true, role: 'administrador' };
      
      const teacherRows = await sql`SELECT role FROM teachers WHERE email = ${email} LIMIT 1`;
      if (teacherRows.length > 0) return { isAdmin: false, role: teacherRows[0].role };
      return { isAdmin: false, role: 'docente' };
    } catch (err) {
      if (attempt === 1) {
        logger.warn(`[AppLayout] Error fetching user role for ${email}, retrying...`, { attempt, error: err });
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        logger.error(`[AppLayout] Failed to fetch user role after retry for ${email}, defaulting to 'docente'`, { error: err });
      }
    }
  }
  return { isAdmin: false, role: 'docente' };
}

async function getMaintenanceStatus(): Promise<{ active: boolean; message: string }> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT key, value FROM platform_config
      WHERE key IN ('maintenance_mode', 'maintenance_message')
    `;
    const cfg: Record<string, string> = {};
    for (const r of rows) cfg[r.key] = r.value;
    return {
      active: cfg.maintenance_mode === 'true',
      message: cfg.maintenance_message || 'La plataforma está en mantenimiento. Por favor regresa más tarde.',
    };
  } catch (err) {
    logger.warn('[AppLayout] Error checking maintenance status, defaulting to inactive', { error: err });
    return { active: false, message: '' };
  }
}

export default async function AppLayout({ children, locale, activeSection }: Props) {
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const user = session.user;
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user.email?.[0].toUpperCase() || '?';

  const [{ isAdmin, role }, maintenance] = await Promise.all([
    user.email ? getUserRole(user.email) : Promise.resolve({ isAdmin: false, role: 'docente' }),
    getMaintenanceStatus(),
  ]);

  // ── Maintenance gate — admins bypass it ────────────────────────────────────────────
  if (maintenance.active && !isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)',
        backgroundAttachment: 'fixed',
        padding: '24px', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          maxWidth: 480, textAlign: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '48px 40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🔧</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f0f4ff', marginBottom: 12, letterSpacing: '-0.5px' }}>
            Plataforma en Mantenimiento
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(240,244,255,0.55)', lineHeight: 1.7, marginBottom: 32 }}>
            {maintenance.message}
          </p>
          <div style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 10, padding: '12px 20px',
            fontSize: 13, color: '#818cf8',
          }}>
            📚 SIGPDA-EMS · Educación Media Superior
          </div>
          <form action={signOutPlain} style={{ marginTop: 24 }}>
            <button type="submit" style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.35)',
              borderRadius: 8, padding: '8px 20px',
              fontSize: 12, cursor: 'pointer',
            }}>Cerrar sesión</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <span className="header-logo-icon">📚</span>
          <div>
            <div className="header-logo-text">SIGPDA-EMS</div>
            <div className="header-logo-sub">Planeación & Horarios MCCEMS</div>
          </div>
        </div>
        <div className="header-right">
          <NotificationBell />
          <div className="header-user">
            <div className="header-avatar">
              {user.image
                ? <img src={user.image} alt={user.name || ''} />
                : initials
              }
            </div>
            <span style={{ fontWeight: 500 }}>{user.name?.split(' ')[0] || user.email}</span>
          </div>
          <SignOutButton locale={locale} signOutAction={signOutAction} />
        </div>
      </header>

      {/* Sidebar */}
      <aside className="app-sidebar">
        {/* Maintenance banner for admins */}
        {maintenance.active && isAdmin && (
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 8,
            padding: '8px 12px',
            margin: '0 12px 8px',
            fontSize: 11,
            color: '#fcd34d',
            textAlign: 'center',
          }}>
            ⚠️ Modo mantenimiento activo<br/>
            <span style={{ opacity: 0.7 }}>Solo tú puedes ver la plataforma</span>
          </div>
        )}

        <Link href={`/${locale}/nueva-planeacion`} className="sidebar-new-btn">
          + Nueva planeación
        </Link>

        {/* ── SECCIÓN DOCENTE (todos) ── */}
        <div className="sidebar-section-label">Planeación Docente</div>
        <Link href={`/${locale}/dashboard`} className={`sidebar-link ${activeSection === 'dashboard' ? 'active' : ''}`}>
          <span className="sidebar-link-icon">📝</span>Mis planeaciones
        </Link>
        <Link href={`/${locale}/mis-documentos`} className={`sidebar-link ${activeSection === 'mis-documentos' ? 'active' : ''}`}>
          <span className="sidebar-link-icon">📁</span>Mis Documentos
        </Link>
        <Link href={`/${locale}/mis-escuelas`} className={`sidebar-link ${activeSection === 'mis-escuelas' ? 'active' : ''}`}>
          <span className="sidebar-link-icon">🏫</span>Mis Escuelas
        </Link>

        {/* ── SECCIÓN DIRECTOR ── */}
        {(role === 'director' || isAdmin) && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: 14 }}>Gestión del Plantel</div>
            <Link href={`/${locale}/mi-escuela`} className={`sidebar-link ${activeSection === 'mi-escuela' ? 'active' : ''}`}>
              <span className="sidebar-link-icon">👥</span>Mi Personal
            </Link>
            <Link href={`/${locale}/paec`} className={`sidebar-link ${activeSection === 'paec' ? 'active' : ''}`}>
              <span className="sidebar-link-icon">🏫</span>Proyectos PAEC-PEC
            </Link>
            <Link href={`/${locale}/pmc`} className={`sidebar-link ${activeSection === 'pmc' ? 'active' : ''}`}>
              <span className="sidebar-link-icon">📈</span>Plan de Mejora (PMC)
            </Link>
            <Link href={`/${locale}/horarios`} className={`sidebar-link ${activeSection === 'horarios' ? 'active' : ''}`}>
              <span className="sidebar-link-icon">📅</span>Horarios IA (Directores)
            </Link>
          </>
        )}

        {/* ── SECCIÓN SUPERVISOR ── */}
        {(role === 'supervisor' || isAdmin) && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: 14 }}>Supervisión de Zona</div>
            <Link href={`/${locale}/mi-zona`} className={`sidebar-link ${activeSection === 'mi-zona' ? 'active' : ''}`}>
              <span className="sidebar-link-icon">🗺️</span>Mi Zona
            </Link>
            <Link href={`/${locale}/pips`} className={`sidebar-link ${activeSection === 'pips' ? 'active' : ''}`}>
              <span className="sidebar-link-icon">📋</span>Cartografía de Zona Escolar
            </Link>
          </>
        )}

        {/* Admin section — visible only for admins */}
        {isAdmin && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: 16 }}>Administrador</div>
            <Link
              href={`/${locale}/admin`}
              className={`sidebar-link ${activeSection === 'admin' ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">⚙️</span>Panel de Admin
            </Link>
          </>
        )}
      </aside>

      {/* Main */}
      <main className="app-main">
        <HeartbeatSender />
        <PedagogicalChatWidget />
        {children}
      </main>
    </div>
  );
}
