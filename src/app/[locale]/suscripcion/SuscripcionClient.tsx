'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface Props {
  locale: string;
  platformName: string;
  userRole: string;
  activePlanName: string | null;
  activePlanSubjects: number | null;
  hasStripeCustomer: boolean;
}

export default function SuscripcionClient({
  locale,
  platformName,
  userRole,
  activePlanName,
  activePlanSubjects,
  hasStripeCustomer,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docente' | 'director' | 'supervisor' | 'institucional'>(
    userRole === 'director' ? 'director' : userRole === 'supervisor' ? 'supervisor' : 'docente'
  );

  const docentePlans = [
    {
      id: 'basico',
      name: 'Plan Docente Básico',
      badge: '1 Asignatura',
      price: 99,
      period: '/mes',
      limit: 1,
      color: '#3b82f6',
      desc: 'Ideal para docentes que inician con 1 materia o grupo experimental.',
      features: [
        '1 Materia oficial (UAC)',
        'Planeación Didáctica Semestral con IA',
        'Secuencias Didácticas (50 min)',
        'Rúbricas y Listas de Cotejo',
        'Exportación a DOCX y PDF',
        'Alineación NEM 2025-2028',
      ],
    },
    {
      id: 'estandar',
      name: 'Plan Docente Estándar',
      badge: 'Más Popular ⭐',
      price: 249,
      period: '/mes',
      limit: 3,
      color: '#8b5cf6',
      desc: 'Para la carga horaria habitual de 3 materias o campos disciplinares.',
      features: [
        '3 Materias oficiales (UACs)',
        'Planeaciones y Secuencias Didácticas ilimitadas',
        'Planes de Clase detallados',
        'Rúbricas e Instrumentos de Evaluación',
        'Vinculación con Proyecto Comunitario (PAEC)',
        'Exportación dual DOCX y PDF',
        'Soporte prioritario',
      ],
    },
    {
      id: 'avanzado',
      name: 'Plan Docente Avanzado',
      badge: '5 Asignaturas',
      price: 399,
      period: '/mes',
      limit: 5,
      color: '#ec4899',
      desc: 'Para docentes de tiempo parcial/completo con hasta 5 materias distintas.',
      features: [
        '5 Materias oficiales (UACs)',
        'Todo lo del Plan Estándar',
        'Auditoría Pedagógica 4D integrada',
        'Instrumentos de evaluación formativa',
        'Exportación ilimitada en alta calidad',
        'Soporte técnico prioritario',
      ],
    },
    {
      id: 'completo',
      name: 'Plan Docente Tiempo Completo',
      badge: '10 Asignaturas',
      price: 699,
      period: '/mes',
      limit: 10,
      color: '#f59e0b',
      desc: 'Cobertura total para docentes de tiempo completo y horas acumuladas.',
      features: [
        '10 Materias oficiales (UACs)',
        'Todo lo del Plan Avanzado',
        'Regeneración instantánea con IA',
        'Acceso preferencial a nuevas funciones',
        'Exportación masiva',
      ],
    },
  ];

  const directorPlans = [
    {
      id: 'director_pro',
      name: 'Plan Dirección Escolar',
      badge: 'Horarios + PMC',
      price: 499,
      period: '/mes',
      limit: 1,
      color: '#10b981',
      desc: 'Herramientas estratégicas para el Director de Plantel.',
      features: [
        'Generador de Horarios con Solver CSP de Alto Rendimiento',
        '0 Empalmes matemáticamente garantizados',
        'Asistente Neuro-Simbólico de Horarios',
        'Cuádruple vista (Maestro, Grupos, Docentes, Aulas)',
        'Exportación a Excel Multi-Hoja (.xlsx)',
        'Generador de PMC (Programa de Mejora Continua)',
        'PAEC Institucional del Plantel',
      ],
    },
  ];

  const supervisorPlans = [
    {
      id: 'supervisor_pro',
      name: 'Plan Supervisión de Zona',
      badge: 'Cartografía Oficial',
      price: 599,
      period: '/mes',
      limit: 1,
      color: '#06b6d4',
      desc: 'Instrumentación territorial integral para Supervisores y ATPs.',
      features: [
        'Cartografía de Zona Escolar completa (6 fases)',
        'Diagnóstico territorial cuantitativo y cualitativo',
        'Objetivos estratégicos y metas de zona con IA',
        'Cronograma y matriz de seguimiento de supervisión',
        'Exportación oficial a Word (.docx) con membrete SEP',
        'Gestión de hasta 30 planteles de la zona',
      ],
    },
  ];

  const institucionalPlans = [
    {
      id: 'escuela_completa',
      name: 'Plan Institucional Plantel Completo',
      badge: 'Suite Completa 🏫',
      price: 999,
      period: '/mes',
      limit: 999,
      color: '#6366f1',
      desc: 'Solución integral para directivos, docentes y personal del plantel.',
      features: [
        'Acceso total para Director y Docentes del plantel',
        'Generador de Horarios Escolar Solver CSP',
        'Generador de PMC y PAEC Institucional',
        'Planeaciones y secuencias didácticas ilimitadas',
        'Auditoría Pedagógica 4D en tiempo real',
        'Exportación dual DOCX + PDF ilimitada',
        'Soporte técnico VIP y capacitación',
      ],
    },
  ];

  const handleSubscribe = async (planId: string, planName: string, price: number) => {
    try {
      setLoading(planId);
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, planName, price }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Error al procesar la suscripción');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el servicio de pagos.');
    } finally {
      setLoading(null);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setLoading('portal');
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (res.redirected) {
        window.location.href = res.url;
      } else {
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else alert(data.error || 'No se pudo abrir el portal de Stripe.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al comunicar con Stripe.');
    } finally {
      setLoading(null);
    }
  };

  const currentPlans =
    activeTab === 'docente'
      ? docentePlans
      : activeTab === 'director'
      ? directorPlans
      : activeTab === 'supervisor'
      ? supervisorPlans
      : institucionalPlans;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '50px 24px',
        background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <style>{`
        .plan-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .plan-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--hover-shadow);
          border-color: var(--hover-border);
        }
        .plan-btn {
          width: 100%;
          padding: 13px;
          border-radius: 10px;
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .plan-card:hover .plan-btn:not(:disabled) {
          background: var(--hover-bg);
          color: #fff;
        }
        .plan-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tab-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 13, marginBottom: 16 }}>
            <span>⚡</span> Plataforma de Generación Pedagógica Oficial SEP-NEM
          </div>
          <h1
            style={{
              fontSize: '38px',
              fontWeight: 800,
              marginBottom: '12px',
              background: 'linear-gradient(to right, #818cf8, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Planes y Suscripciones {platformName}
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.65)', maxWidth: '650px', margin: '0 auto' }}>
            Selecciona el plan diseñado a la medida de tu labor educativa. Cada usuario genera sus propios instrumentos pedagógicos de forma ágil, auténtica y normativa.
          </p>

          {/* Active subscription status */}
          {activePlanName && (
            <div
              style={{
                marginTop: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                borderRadius: 12,
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#22c55e',
                fontSize: 14,
              }}
            >
              <span>✅ <strong>Plan Actual Activo:</strong> {activePlanName} ({activePlanSubjects} asignaturas)</span>
              {hasStripeCustomer && (
                <button
                  onClick={handleOpenPortal}
                  disabled={loading === 'portal'}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '4px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {loading === 'portal' ? 'Abriendo…' : '⚙️ Administrar Pagos'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs por Perfil */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 36, flexWrap: 'wrap' }}>
          {[
            { key: 'docente', label: '👨‍🏫 Docentes', count: '4 Planes' },
            { key: 'director', label: '👔 Directores', count: 'Horarios + PMC' },
            { key: 'supervisor', label: '🗺️ Supervisores', count: 'Cartografía' },
            { key: 'institucional', label: '🏫 Institucional', count: 'Escuela Completa' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className="tab-btn"
              style={{
                background: activeTab === t.key ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.04)',
                color: activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)',
                borderColor: activeTab === t.key ? '#818cf8' : 'rgba(255,255,255,0.08)',
              }}
            >
              {t.label} <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({t.count})</span>
            </button>
          ))}
        </div>

        {/* Grid de Planes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          {currentPlans.map((plan) => (
            <div
              key={plan.id}
              className="plan-card"
              style={
                {
                  '--hover-shadow': `0 20px 40px ${plan.color}30`,
                  '--hover-border': `${plan.color}60`,
                } as any
              }
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: plan.color,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: plan.color,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: `${plan.color}15`,
                  }}
                >
                  {plan.badge}
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
                {plan.name}
              </h3>

              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '12px' }}>
                <span style={{ fontSize: '38px', fontWeight: 800, color: plan.color }}>${plan.price}</span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>
                  {plan.period}
                </span>
              </div>

              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', marginBottom: '20px', minHeight: 40 }}>
                {plan.desc}
              </p>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 20 }} />

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', flexGrow: 1 }}>
                {plan.features.map((feat, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.85)',
                      lineHeight: '1.4',
                    }}
                  >
                    <span style={{ color: plan.color, marginRight: '8px', fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                className="plan-btn"
                style={{ '--hover-bg': plan.color } as any}
                onClick={() => handleSubscribe(plan.id, plan.name, plan.price)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? '⏳ Procesando...' : `Suscribirme por $${plan.price}/mes`}
              </button>
            </div>
          ))}
        </div>

        {/* Footer info & back link */}
        <div style={{ textAlign: 'center', marginTop: '50px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
            🔒 Pagos cifrados y seguros mediante Stripe. Facturación mensual automatizada. Cancela en cualquier momento sin penalizaciones.
          </p>
          <Link
            href={`/${locale}/dashboard`}
            style={{ color: '#818cf8', fontSize: '14px', textDecoration: 'none', fontWeight: 600 }}
          >
            ← Volver al Panel de Control
          </Link>
        </div>
      </div>
    </div>
  );
}
