'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Planning } from '@/types/planning';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface PlanningDetailHeroProps {
  locale: string;
  planning: Planning;
  isLaboral: boolean;
  weeklyHours: number;
  totalSessions: number;
  totalBlocks?: number;
  hasContent: boolean;
  publishingClassroom: boolean;
  onPublishClassroom: () => void;
  onOpenChecklistModal: () => void;
}

const COMPONENT_LABELS: Record<string, string> = {
  laboral: 'Formación Laboral',
  fundamental: 'Currículum Fundamental',
  ampliado: 'Currículum Ampliado',
  ext_obligatorio: 'Extracurricular Obligatorio',
  ext_optativo: 'Extracurricular Optativo',
  ffeo: 'Formación Fundamental Extendida (FFEO)',
  ffe_optativa: 'Formación Fundamental Optativa',
};

export default function PlanningDetailHero({
  locale,
  planning,
  isLaboral,
  weeklyHours,
  totalSessions,
  totalBlocks = 3,
  hasContent,
  publishingClassroom,
  onPublishClassroom,
  onOpenChecklistModal,
}: PlanningDetailHeroProps) {
  const [titleExpanded, setTitleExpanded] = useState(false);

  const isLongTitle = (planning?.uacName?.length || 0) > 95;

  return (
    <header className="detail-hero" data-testid="planning-detail-hero">
      {/* Top navigation bar */}
      <div className="detail-hero-top">
        <Link href={`/${locale}/dashboard`} className="back-pill">
          <ArrowLeft size={15} />
          <span>Volver al Dashboard</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onOpenChecklistModal}
            title="Ver Jerarquía Normativa y Lista de Cotejo de Supervisión MCCEMS 2026-2027"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle2 size={13} />
            <span>Cumplimiento MCCEMS 2026-2027</span>
          </button>
        </div>
      </div>

      {/* Main UAC Title + Badges & Actions */}
      <div className="detail-hero-body">
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <h1
              className={`detail-hero-title${titleExpanded ? ' is-expanded' : ''}`}
              title={planning.uacName}
            >
              {planning.uacName}
            </h1>
            {isLongTitle && (
              <button
                type="button"
                onClick={() => setTitleExpanded((prev) => !prev)}
                aria-expanded={titleExpanded}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--c-bg-elevated)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: '3px',
                }}
                title={titleExpanded ? 'Contraer título' : 'Mostrar nombre completo de la UAC'}
              >
                {titleExpanded ? (
                  <>
                    Menos <ChevronUp size={12} />
                  </>
                ) : (
                  <>
                    Completo <ChevronDown size={12} />
                  </>
                )}
              </button>
            )}
          </div>

          <div className="detail-hero-badges">
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'var(--c-bg-elevated)',
                border: '1px solid var(--c-border-2)',
                color: 'var(--c-text)',
              }}
            >
              {planning.semester}° Semestre
            </span>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(59, 130, 246, 0.14)',
                border: '1px solid rgba(59, 130, 246, 0.32)',
                color: '#93c5fd',
              }}
            >
              Componente {planning.component && COMPONENT_LABELS[planning.component] ? COMPONENT_LABELS[planning.component] : (isLaboral ? 'Formación Laboral' : 'Fundamental / Ampliado')}
            </span>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(245, 158, 11, 0.14)',
                border: '1px solid rgba(245, 158, 11, 0.32)',
                color: '#fcd34d',
              }}
            >
              {weeklyHours} hrs/sem · {totalSessions} sesiones totales{totalBlocks ? ` (${totalBlocks} bloques)` : ''}
            </span>

            {planning.metodologiaActiva && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  background: 'rgba(124, 58, 237, 0.16)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  color: '#c4b5fd',
                }}
              >
                🎯 {planning.metodologiaActiva}
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="detail-hero-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasContent && (
            <button
              type="button"
              onClick={onPublishClassroom}
              disabled={publishingClassroom}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                fontSize: '13px',
                fontWeight: 600,
                background: 'rgba(21, 128, 61, 0.22)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                color: '#86efac',
                borderRadius: '8px',
                cursor: publishingClassroom ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={14} />
              {publishingClassroom ? 'Publicando…' : 'Classroom'}
            </button>
          )}

          <DeletePlanningButton
            id={planning.id}
            locale={locale}
            redirectAfterDelete={true}
          />
        </div>
      </div>
    </header>
  );
}

