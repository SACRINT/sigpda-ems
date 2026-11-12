'use client';

import React, { useMemo } from 'react';
import type { Planning } from '@/types/planning';
import {
  evaluateDBEPA,
  type DBEPACriterion,
  type DBEPASemaforo,
} from '@/lib/planning/dbepa-quality-gate';
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

export interface PlanningTabDBEPAProps {
  planning: Planning;
}

const SEMAFORO_CONFIG: Record<
  DBEPASemaforo,
  { emoji: string; label: string; color: string; bg: string; border: string }
> = {
  verde: {
    emoji: '🟢',
    label: 'Verde — Aprobada',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  amarillo: {
    emoji: '🟡',
    label: 'Amarillo — Con observaciones',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  rojo: {
    emoji: '🔴',
    label: 'Rojo — Requiere corrección',
    color: '#fb7185',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.35)',
  },
};

function CriterionRow({ criterion }: { criterion: DBEPACriterion }) {
  const isOk = criterion.status === 'cumple';
  const isPartial = criterion.status === 'parcial';
  const color = isOk ? '#34d399' : isPartial ? '#fbbf24' : '#fb7185';
  const Icon = isOk ? CheckCircle2 : isPartial ? AlertTriangle : XCircle;

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: '10px',
        border: `1px solid ${color}33`,
        background: `${color}0d`,
      }}
    >
      <Icon size={18} style={{ color, flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>
            {criterion.numero}. {criterion.label}
          </span>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              color,
              background: `${color}18`,
              border: `1px solid ${color}33`,
              borderRadius: '10px',
              padding: '2px 8px',
              textTransform: 'uppercase',
            }}
          >
            {criterion.status.replace('_', ' ')}
          </span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
          {criterion.detalle}
        </p>
        {!isOk && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
            <strong>Acción sugerida:</strong> {criterion.recomendacion}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PlanningTabDBEPA({ planning }: PlanningTabDBEPAProps) {
  const audit = useMemo(() => evaluateDBEPA(planning.contentJson, {
    uacName: planning.uacName,
    semester: planning.semester,
  }), [planning]);

  const config = SEMAFORO_CONFIG[audit.semaforo];
  const hasDUA = Boolean(planning.contentJson?.ajustesDUA?.ajustes?.length);

  return (
    <div data-testid="dbepa-quality-gate" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          gap: '18px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '20px 22px',
          borderRadius: '14px',
          background: config.bg,
          border: `1.5px solid ${config.border}`,
        }}
      >
        <div
          style={{
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--c-bg-surface)',
            border: `2px solid ${config.color}55`,
            fontSize: '32px',
            flexShrink: 0,
          }}
          aria-label={`Semáforo DBEPA ${audit.semaforo}`}
        >
          {config.emoji}
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <ShieldCheck size={18} style={{ color: config.color }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--c-text)' }}>
              Quality Gate DBEPA
            </h2>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: config.color,
                background: `${config.color}18`,
                border: `1px solid ${config.border}`,
                borderRadius: '999px',
                padding: '3px 10px',
              }}
            >
              {config.label}
            </span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
            {audit.resumen}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--c-text-muted)' }}>
            {audit.passed}/{audit.total} criterios cumplidos · {audit.score}/100 puntos
            {hasDUA ? ' · Ajustes DUA integrados' : ' · Sin ajustes DUA'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
        {audit.criteria.map((criterion) => (
          <CriterionRow key={criterion.id} criterion={criterion} />
        ))}
      </div>
    </div>
  );
}
