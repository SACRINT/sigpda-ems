'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Planning } from '@/types/planning';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import {
  ArrowLeft,
  Download,
  FileDown,
  Printer,
  Send,
  MoreHorizontal,
  CheckCircle2,
  ClipboardCheck,
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
  downloadingPdf: boolean;
  publishingClassroom: boolean;
  onDownloadPdf: () => void;
  onOpenA4Modal: () => void;
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
  downloadingPdf,
  publishingClassroom,
  onDownloadPdf,
  onOpenA4Modal,
  onPublishClassroom,
  onOpenChecklistModal,
}: PlanningDetailHeroProps) {
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isLongTitle = (planning?.uacName?.length || 0) > 95;

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

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
        <div className="detail-hero-actions">
          {hasContent && (
            <>
              <button
                type="button"
                onClick={onDownloadPdf}
                disabled={downloadingPdf}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: '#dc2626',
                  border: '1px solid #ef4444',
                  color: '#ffffff',
                  borderRadius: '8px',
                  cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                }}
              >
                <Download size={15} />
                {downloadingPdf ? 'Generando PDF…' : 'Descargar PDF'}
              </button>

              <a
                href={`/api/docx/${planning.id}`}
                className="btn btn-amber"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                <FileDown size={15} /> Word (DOCX)
              </a>

              <button
                type="button"
                onClick={onOpenA4Modal}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 13px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} /> Vista Carta
              </button>

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
            </>
          )}

          {/* Overflow Menu (Más opciones) */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Más acciones y opciones de supervisión"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '8px 11px',
                borderRadius: '8px',
                background: 'var(--c-bg-elevated)',
                border: '1px solid var(--c-border-2)',
                color: 'var(--c-text-2)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  minWidth: '250px',
                  background: 'var(--c-bg-elevated)',
                  border: '1px solid var(--c-border-2)',
                  borderRadius: '10px',
                  padding: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenChecklistModal();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--c-text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <ClipboardCheck size={15} style={{ color: '#34d399' }} />
                  Checklist de Supervisión MCCEMS
                </button>

                <div
                  style={{
                    height: '1px',
                    background: 'var(--c-border)',
                    margin: '2px 0',
                  }}
                />

                <div style={{ padding: '4px 6px' }}>
                  <DeletePlanningButton
                    id={planning.id}
                    locale={locale}
                    redirectAfterDelete={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

