'use client';

import React from 'react';
import Link from 'next/link';

interface SubscriptionBannerProps {
  locale: string;
  planName: string;
  planSubjects: number;
  usedSubjectsCount: number;
  availableSlots: number;
  isAdmin: boolean;
  isWelcomePlan: boolean;
}

export default function SubscriptionBanner({
  locale,
  planName,
  planSubjects,
  usedSubjectsCount,
  availableSlots,
  isAdmin,
  isWelcomePlan,
}: SubscriptionBannerProps) {
  if (isAdmin) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '12px', padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#818cf8' }}>👑</span> Cuenta de Administrador
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>
            Tienes acceso ilimitado a todas las funciones.
          </p>
        </div>
      </div>
    );
  }

  const isFull = availableSlots === 0;

  if (isWelcomePlan) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: '12px', padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>🎁</span> Plan de Bienvenida Activo
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>
            Incluye 1 planeación de cortesía sin tarjeta.
            {isFull ? (
              <span style={{ color: '#fbbf24', marginLeft: '4px' }}>Ya usaste tu planeación de cortesía.</span>
            ) : (
              <span style={{ color: '#10b981', marginLeft: '4px' }}>Tu cortesía está disponible.</span>
            )}
          </p>
        </div>
        <Link
          href={`/${locale}/suscripcion`}
          style={{
            padding: '8px 16px', borderRadius: '8px',
            background: '#f0f4ff', color: '#020408',
            fontSize: '13px', fontWeight: 600, textDecoration: 'none'
          }}
        >
          Elegir un plan
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
      border: `1px solid rgba(16,185,129,0.2)`,
      borderRadius: '12px', padding: '16px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '24px', flexWrap: 'wrap', gap: '16px'
    }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981' }}>✓</span> Plan {planName.charAt(0).toUpperCase() + planName.slice(1)} Activo
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>
          Materias registradas: {usedSubjectsCount} de {planSubjects}. 
          {availableSlots > 0 ? (
            <span style={{ color: '#10b981', marginLeft: '4px' }}>Tienes {availableSlots} disponible(s).</span>
          ) : (
            <span style={{ color: '#fbbf24', marginLeft: '4px' }}>No tienes espacios disponibles.</span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {isFull && (
          <Link
            href={`/${locale}/suscripcion`}
            style={{
              padding: '8px 16px', borderRadius: '8px',
              background: '#f0f4ff', color: '#020408',
              fontSize: '13px', fontWeight: 600, textDecoration: 'none'
            }}
          >
            Agregar materia ($79 MXN)
          </Link>
        )}
        <form action="/api/stripe/portal" method="POST">
          <input type="hidden" name="returnUrl" value={`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/dashboard`} />
          <button
            type="submit"
            style={{
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(240,244,255,0.05)', color: '#f0f4ff',
              border: '1px solid rgba(240,244,255,0.1)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Gestionar suscripción
          </button>
        </form>
      </div>
    </div>
  );
}
