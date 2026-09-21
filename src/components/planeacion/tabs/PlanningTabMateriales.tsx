'use client';

import React from 'react';
import type { GeneratedPlanningContent, Planning, PlanningExtra } from '@/types/planning';
import type { ActiveWorkTextbook, GenerationProgressState } from '@/types/work-textbook';
import GenerationFeedback from '@/components/feedback/GenerationFeedback';
import {
  Zap, RefreshCw, CheckCircle
} from 'lucide-react';


const BUNDLE_TYPES: { type: 'guia'|'instrumento'|'diapositivas'|'quiz'; label: string; icon: string; color: string }[] = [
  { type: 'guia',         label: 'Guía del Alumno',              icon: '📖', color: '#1d4ed8' },
  { type: 'instrumento',  label: 'Instrumento Coevaluación',     icon: '📋', color: '#059669' },
  { type: 'diapositivas', label: 'Guión de Diapositivas',        icon: '🎨', color: '#7c3aed' },
  { type: 'quiz',         label: 'Quiz / Evaluación Diagnóstica',icon: '🧩', color: '#b45309' },
];

export interface BlockWorkbookItem {
  blockIndex: number;
  blockName: string;
  hours: number;
  hasExistingWorkbook: boolean;
  existingWorkbook: ActiveWorkTextbook | null;
  workbook?: unknown;
  isGenerating: boolean;
  error: string | null;
  downloadUrl: string | null;
}

export interface MaterialBlockWorkbookItem {
  loaded: boolean;
  generating: boolean;
  workbook: ActiveWorkTextbook | null;
  version?: number;
  progress: GenerationProgressState | null;
  error: string | null;
}

export interface PlanningTabMaterialesProps {
  planning: Planning;
  activeSubTab?: 'extras' | 'practiceGuides' | 'bundle';
  extras: PlanningExtra[];
  generatingKey: string | null;
  syncingSuite: number | null;
  blockWorkbooks: Record<number, MaterialBlockWorkbookItem>;
  bundleResults: Record<string, string | null>;
  bundleLoading: Record<string, boolean>;
  bundleErrors: Record<string, string | null>;
  bundleExpanded: string | null;
  handleGenerateExtra: (
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide',
    title: string,
    keyIndex: number | null,
    extraData: {
      activityName?: string;
      evidence?: string;
      sessionNum?: number;
      totalSessions?: number;
      practiceNumber?: number;
      practiceTitle?: string;
      sessionTopic?: string;
      sessionFocus?: string;
      teachingActivity?: string;
      learningActivity?: string;
      evaluation?: string;
      phase?: string;
    }
  ) => Promise<void>;
  handleDeleteExtra: (extraId: string) => Promise<void>;
  setActiveTab: (tab: 'planning' | 'extras' | 'lessonPlans' | 'practiceGuides' | 'a4print' | 'audit' | 'bundle' | 'evaluador' | 'analytics') => void;
  handlePreviewExtra: (extra: PlanningExtra) => void;
  handleSyncSuite: (blockIdx: number) => Promise<void>;
  handleGenerateWorkbook: (blockIndex: number) => Promise<void>;
  handleGenerateBundleItem: (type: 'guia' | 'instrumento' | 'diapositivas' | 'quiz') => Promise<void>;
  handleGenerateFullBundle: () => Promise<void>;
  setBundleExpanded: React.Dispatch<React.SetStateAction<string | null>>;
  findExtra: (type: string, keyIndex: number | null, title?: string, sessionNum?: number) => PlanningExtra | undefined;
  setPreviewExtra: (extra: PlanningExtra | null) => void;
}

export default function PlanningTabMateriales({
  planning,
  activeSubTab = 'extras',
  extras,
  generatingKey,
  syncingSuite,
  blockWorkbooks,
  bundleResults,
  bundleLoading,
  bundleErrors,
  bundleExpanded,
    handleGenerateExtra,
  handlePreviewExtra: _handlePreviewExtra,
  handleSyncSuite,
  handleGenerateWorkbook: _handleGenerateWorkbook,
  handleGenerateBundleItem,
  handleGenerateFullBundle,
  handleDeleteExtra,
  setActiveTab,
  setBundleExpanded,
  findExtra,
  setPreviewExtra,
}: PlanningTabMaterialesProps) {
  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;

  if (activeSubTab === 'practiceGuides') {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📚 Guías de Práctica para el Estudiante</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.12)', borderLeft: '3px solid #7c3aed', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
                <p style={{ color: '#c4b5fd', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es la Guía de Práctica para el Estudiante?</p>
                <p style={{ color: 'var(--c-text)', marginBottom: '6px' }}>
                  Documento que el estudiante recibe directamente (impreso o digital) para guiar su aprendizaje autónomo,
                  diseñado bajo los lineamientos pedagógicos del Marco Curricular Común (MCCEMS),
                  incluyendo propósito, competencias, materiales, procedimiento por fases de la metodología activa,
                  preguntas de análisis (taxonomía Bloom), tabla de datos y autoevaluación formativa.
                </p>
                {planning.metodologiaActiva && (
                  <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '13px' }}>
                    🎯 Metodología activa seleccionada: <strong>{planning.metodologiaActiva}</strong> — las guías incluirán sus fases específicas.
                  </p>
                )}
              </div>

              {/* One card per key activity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {content?.sectionIV?.activities?.map((act, actIdx) => {
                  const practiceNum = actIdx + 1;
                  const practiceTitle = `${act.name.substring(0, 60)}`;
                  const generatedGuide = findExtra('practice_guide', actIdx);
                  const loadingKey = `practice_guide-${actIdx}--`;
                  const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                  return (
                    <div
                      key={actIdx}
                      style={{
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--c-bg-surface)',
                      }}
                    >
                      {/* Activity header */}
                      <div style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.08))',
                        borderBottom: '1px solid rgba(124, 58, 237, 0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#e9d5ff', fontSize: '15px' }}>
                            📋 Práctica {practiceNum}: {practiceTitle}
                          </span>
                          <div style={{ fontSize: '12px', color: '#c4b5fd', marginTop: '2px' }}>
                            {act.hours} hrs · {act.methodology || 'Metodología activa'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {generatedGuide ? (
                            <>
                              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600, background: 'rgba(16,185,129,0.15)', padding: '3px 10px', borderRadius: '12px' }}>
                                ✓ Guía generada
                              </span>
                              <button
                                onClick={() => setPreviewExtra(generatedGuide)}
                                className="btn"
                                style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(124,58,237,0.2)', border: '1px solid #7c3aed', color: '#c4b5fd', borderRadius: '6px' }}
                              >
                                👁️ Ver Guía
                              </button>
                              <a
                                href={`/api/docx/extra/${generatedGuide.id}`}
                                className="btn"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#7c3aed', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ↓ Word
                              </a>
                              <a
                                href={`/api/pdf/extra/${generatedGuide.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#dc2626', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ↓ PDF
                              </a>
                              <button
                                onClick={() => handleDeleteExtra(generatedGuide.id)}
                                className="btn"
                                style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', borderRadius: '6px' }}
                              >
                                🗑️
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                handleGenerateExtra(
                                  'practice_guide',
                                  `Guía de Práctica ${practiceNum}: ${practiceTitle.substring(0, 50)}`,
                                  actIdx,
                                  {
                                    activityName: act.name,
                                    practiceNumber: practiceNum,
                                    practiceTitle: practiceTitle,
                                  }
                                )
                              }
                              disabled={generatingKey !== null}
                              className="btn"
                              style={{
                                padding: '8px 18px',
                                fontSize: '13px',
                                borderRadius: '6px',
                                border: 'none',
                                background: generatingKey !== null ? '#c4b5fd' : '#7c3aed',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: generatingKey !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isCurrentGenerating ? '⏳ Generando guía...' : '📚 Generar Guía del Estudiante'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Preview of learning outcome if available */}
                      {content?.sectionII?.learningOutcomes?.[actIdx] && (
                        <div style={{ padding: '10px 16px', fontSize: '13px', color: '#6d28d9', borderTop: '1px dashed #ddd6fe' }}>
                          <strong>📌 Resultado de aprendizaje:</strong> {content.sectionII.learningOutcomes[actIdx]}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!content?.sectionIV?.activities || content.sectionIV.activities.length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
                    No se encontraron actividades clave en la Sección IV de esta planeación.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback */}
          <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
    );
  }

  if (activeSubTab === 'bundle') {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header card */}
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📦 Bundle Didáctico Complementario</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', borderLeft: '3px solid #b45309', borderRadius: '6px', marginBottom: '20px', fontSize: '13.5px' }}>
                <p style={{ color: '#fbbf24', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es el Bundle Didáctico?</p>
                <p style={{ color: 'var(--c-text)', margin: 0 }}>
                  Conjunto de 4 materiales complementarios generados automáticamente a partir de tu planeación:
                  Guía del Alumno, Instrumento de Coevaluación, Guión de Diapositivas y Quiz Diagnóstico.
                  Genera cada uno individualmente o todos a la vez con <strong>Suite Completa</strong>.
                </p>
              </div>

              {/* Generate All button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <button
                  onClick={handleGenerateFullBundle}
                  disabled={Object.values(bundleLoading).some(Boolean)}
                  style={{
                    padding: '12px 32px',
                    fontSize: '15px',
                    fontWeight: 700,
                    background: Object.values(bundleLoading).some(Boolean) ? '#d97706' : '#b45309',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: Object.values(bundleLoading).some(Boolean) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(180,83,9,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {Object.values(bundleLoading).some(Boolean) ? '⏳ Generando Suite…' : '⚡ Generar Suite Completa (4 materiales)'}
                </button>
              </div>

              {/* 4 material cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {BUNDLE_TYPES.map((bt) => {
                  const result  = bundleResults[bt.type] ?? null;
                  const loading = bundleLoading[bt.type] ?? false;
                  const error   = bundleErrors[bt.type]  ?? null;
                  const isExpanded = bundleExpanded === bt.type;

                  return (
                    <div
                      key={bt.type}
                      style={{
                        border: `1px solid ${bt.color}33`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--c-bg-surface)',
                      }}
                    >
                      {/* Card header */}
                      <div style={{
                        padding: '12px 16px',
                        background: `${bt.color}15`,
                        borderBottom: `2px solid ${bt.color}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{bt.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: bt.color }}>{bt.label}</span>
                        </div>
                        {result && (
                          <span style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>✓ Listo</span>
                        )}
                      </div>

                      {/* Card body */}
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {error && (
                          <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#fb7185' }}>
                            ⚠️ {error}
                          </div>
                        )}

                        {!result ? (
                          <button
                            onClick={() => handleGenerateBundleItem(bt.type)}
                            disabled={loading}
                            style={{
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 600,
                              background: loading ? `${bt.color}80` : bt.color,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              width: '100%',
                            }}
                          >
                            {loading ? `⏳ Generando ${bt.label}…` : `⚡ Generar ${bt.label}`}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setBundleExpanded(isExpanded ? null : bt.type)}
                              style={{
                                flex: 1,
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: isExpanded ? bt.color : `${bt.color}15`,
                                color: isExpanded ? '#fff' : bt.color,
                                border: `1px solid ${bt.color}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              {isExpanded ? '▲ Ocultar' : '👁️ Ver contenido'}
                            </button>
                            <button
                              onClick={() => handleGenerateBundleItem(bt.type)}
                              disabled={loading}
                              style={{
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: 'var(--c-bg-elevated)',
                                color: 'var(--c-text-muted)',
                                border: '1px solid var(--c-border-2)',
                                borderRadius: '6px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {loading ? '⏳' : '🔄 Regenerar'}
                            </button>
                          </div>
                        )}

                        {/* Expanded preview */}
                        {isExpanded && result && (
                          <div style={{
                            background: 'var(--c-bg-base)',
                            border: '1px solid var(--c-border-2)',
                            borderRadius: '6px',
                            padding: '12px',
                            maxHeight: '320px',
                            overflowY: 'auto',
                            fontSize: '12.5px',
                            lineHeight: 1.65,
                            color: 'var(--c-text)',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                          }}>
                            {result}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Header Banner */}
          <div className="section-card" style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '20px 24px',
            borderRadius: '10px',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={20} color="#f59e0b" /> Instrumentos de Evaluación y Materiales Didácticos Oficiales
                </h3>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Estructurados en secciones continuas por Bloque curricular (NEM / DBEPA Puebla 2026-2027).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  NEM Trinomio Evaluativo
                </span>
              </div>
            </div>
          </div>

          {/* Acuerdo Institucional de Acreditación Semestral */}
          {content?.sectionV?.evaluationAgreement && (
            <div className="section-card">
              <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="section-card-title">Acuerdo Institucional de Evaluación / Acreditación</span>
                <span className="text-xs" style={{ color: 'var(--c-navy-light)', fontWeight: 600 }}>Anexo 12 DBEPA</span>
              </div>
              <div className="section-card-body">
                <div style={{ padding: '14px 18px', background: 'var(--c-bg-surface)', borderLeft: '4px solid var(--c-amber)', border: '1px solid var(--c-border)', borderRadius: '6px', fontSize: '13.5px' }}>
                  <p style={{ fontWeight: 700, color: 'var(--c-accent-bright)', marginBottom: '6px' }}>Pacto Pedagógico con el Grupo:</p>
                  <p style={{ color: 'var(--c-text-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{content.sectionV.evaluationAgreement}</p>
                </div>
              </div>
            </div>
          )}

          {/* SECCIONES CONTINUAS POR BLOQUE (En la misma página) */}
          {(content?.sectionIV?.activities || []).map((act, actIdx) => {
            const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][actIdx] || `${actIdx + 1}`;
            const blockNumStr = isLaboral ? `AC ${actIdx + 1}` : `Bloque ${roman}`;
            const blockTitle = act.name || `Bloque ${roman}`;

            // Buscar recursos derivados de este bloque
            const rubricExtra = findExtra('rubric', actIdx);
            const checklistExtra = findExtra('checklist', actIdx);
            const materialExtra = findExtra('material', actIdx);
            const guideExtra = findExtra('practice_guide', actIdx);
            const visualExtras = extras.filter((ex) => {
              if (ex.type !== 'visual') return false;
              return ex.keyIndex === actIdx;
            });

            const hasWorkbook = Boolean(blockWorkbooks[actIdx]?.workbook);
            const hasAnyMaterial = Boolean(rubricExtra || checklistExtra || materialExtra || guideExtra || visualExtras.length > 0);

            return (
              <div key={actIdx} className="section-card" style={{ border: hasAnyMaterial ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--c-border)' }}>
                {/* Header de Bloque */}
                <div
                  className="section-card-header"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    background: hasAnyMaterial
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)'
                      : 'var(--c-bg-elevated)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: hasAnyMaterial
                          ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                          : 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '6px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {blockNumStr}
                    </span>
                    <span className="section-card-title" style={{ fontSize: '15.5px', fontWeight: 700 }}>
                      ─── {blockNumStr}: {blockTitle} ───
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {hasAnyMaterial ? (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#34d399',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle size={12} /> Instrumentos Disponibles
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: 'rgba(148, 163, 184, 0.12)',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          color: '#94a3b8',
                        }}
                      >
                        ⏳ Pendiente
                      </span>
                    )}
                  </div>
                </div>

                {/* Contenido de la sección */}
                <div className="section-card-body">
                  {hasAnyMaterial || hasWorkbook ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Grid de 4 recursos */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                        
                        {/* 1. Rúbrica Analítica Oficial */}
                        <div style={{
                          padding: '16px',
                          background: 'var(--c-bg-surface)',
                          border: '1px solid var(--c-border)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Instrumento Normativo
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>4 Niveles NEM</span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
                              📊 Rúbrica Analítica de Evaluación ({blockNumStr})
                            </h4>
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
                              Descriptores cualitativos por niveles de dominio (Sobresaliente, Notable, Suficiente e Insuficiente) vinculados a los aprendizajes del bloque.
                            </p>
                          </div>

                          <div>
                            {rubricExtra ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setPreviewExtra(rubricExtra)}
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                >
                                  👁️ Ver
                                </button>
                                <a
                                  href={`/api/docx/extra/${rubricExtra.id}`}
                                  className="btn btn-amber"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  ↓ Word
                                </a>
                                <a
                                  href={`/api/pdf/extra/${rubricExtra.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                >
                                  ↓ PDF
                                </a>
                                <button
                                  onClick={() => handleDeleteExtra(rubricExtra.id)}
                                  className="btn"
                                  title="Eliminar rúbrica"
                                  style={{ padding: '5px 8px', fontSize: '11.5px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSyncSuite(actIdx)}
                                disabled={syncingSuite === actIdx}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                {syncingSuite === actIdx ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. Lista de Cotejo Formativa */}
                        <div style={{
                          padding: '16px',
                          background: 'var(--c-bg-surface)',
                          border: '1px solid var(--c-border)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Instrumento Formativo
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>Dicotómico</span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
                              ✅ Lista de Cotejo de Verificación ({blockNumStr})
                            </h4>
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
                              Reactivos observables y verificables para la autoevaluación y coevaluación del producto formativo del bloque.
                            </p>
                          </div>

                          <div>
                            {checklistExtra ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setPreviewExtra(checklistExtra)}
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                >
                                  👁️ Ver
                                </button>
                                <a
                                  href={`/api/docx/extra/${checklistExtra.id}`}
                                  className="btn btn-amber"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  ↓ Word
                                </a>
                                <a
                                  href={`/api/pdf/extra/${checklistExtra.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                >
                                  ↓ PDF
                                </a>
                                <button
                                  onClick={() => handleDeleteExtra(checklistExtra.id)}
                                  className="btn"
                                  title="Eliminar lista de cotejo"
                                  style={{ padding: '5px 8px', fontSize: '11.5px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSyncSuite(actIdx)}
                                disabled={syncingSuite === actIdx}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                {syncingSuite === actIdx ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 3. Materiales Didácticos del Docente */}
                        <div style={{
                          padding: '16px',
                          background: 'var(--c-bg-surface)',
                          border: '1px solid var(--c-border)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Soporte Docente
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>Insumos Técnicos</span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
                              📦 Materiales Didácticos e Insumos ({blockNumStr})
                            </h4>
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
                              Guión técnico, reactivos didácticos, casos análogos, recursos digitales y requerimientos de aula/taller.
                            </p>
                          </div>

                          <div>
                            {materialExtra ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setPreviewExtra(materialExtra)}
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                >
                                  👁️ Ver
                                </button>
                                <a
                                  href={`/api/docx/extra/${materialExtra.id}`}
                                  className="btn btn-amber"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  ↓ Word
                                </a>
                                <a
                                  href={`/api/pdf/extra/${materialExtra.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                >
                                  ↓ PDF
                                </a>
                                <button
                                  onClick={() => handleDeleteExtra(materialExtra.id)}
                                  className="btn"
                                  title="Eliminar material didáctico"
                                  style={{ padding: '5px 8px', fontSize: '11.5px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSyncSuite(actIdx)}
                                disabled={syncingSuite === actIdx}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                {syncingSuite === actIdx ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4. Guía de Trabajo Activo del Estudiante */}
                        <div style={{
                          padding: '16px',
                          background: 'var(--c-bg-surface)',
                          border: '1px solid var(--c-border)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Cuaderno de Práctica
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>Estudiante</span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
                              📘 Guía de Aprendizaje Activo ({blockNumStr})
                            </h4>
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
                              Secuencia de desafíos autónomos, matrices de resolución técnica y espacios de práctica activa para el alumno.
                            </p>
                          </div>

                          <div>
                            {guideExtra ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setPreviewExtra(guideExtra)}
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                >
                                  👁️ Ver
                                </button>
                                <a
                                  href={`/api/docx/extra/${guideExtra.id}`}
                                  className="btn btn-amber"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  ↓ Word
                                </a>
                                <a
                                  href={`/api/pdf/extra/${guideExtra.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                >
                                  ↓ PDF
                                </a>
                                <button
                                  onClick={() => handleDeleteExtra(guideExtra.id)}
                                  className="btn"
                                  title="Eliminar guía"
                                  style={{ padding: '5px 8px', fontSize: '11.5px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSyncSuite(actIdx)}
                                disabled={syncingSuite === actIdx}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                {syncingSuite === actIdx ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 5. Recursos Gráficos y Visuales Vectoriales */}
                        <div style={{
                          padding: '16px',
                          background: 'var(--c-bg-surface)',
                          border: '1px solid var(--c-border)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          gridColumn: '1 / -1'
                        }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Motor Visual Capa 0
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                                {visualExtras.length > 0 ? `${visualExtras.length} Diagramas Generados` : 'Visualización Vectorial'}
                              </span>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
                              🎨 Recursos Gráficos del Bloque ({blockNumStr})
                            </h4>
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
                              Diagramas vectoriales generativos (STEM, Humanidades, Económico-Administrativas) insertados en las misiones del libro de trabajo.
                            </p>
                          </div>

                          <div>
                            {visualExtras.length > 0 ? (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {visualExtras.map((vExtra, vIdx) => (
                                  <div key={vExtra.id || vIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.25)', borderRadius: '6px', padding: '4px 8px' }}>
                                    <button
                                      onClick={() => setPreviewExtra(vExtra)}
                                      className="btn"
                                      style={{ padding: '4px 8px', fontSize: '11.5px', background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      👁️ {vExtra.title || `Gráfico Misión ${vIdx + 1}`}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteExtra(vExtra.id)}
                                      className="btn"
                                      title="Eliminar gráfico"
                                      style={{ padding: '4px 6px', fontSize: '11px', background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSyncSuite(actIdx)}
                                disabled={syncingSuite === actIdx}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                {syncingSuite === actIdx ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                              </button>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Barra de estado del bloque */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                        padding: '10px 14px',
                        background: 'rgba(59, 130, 246, 0.05)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <span style={{ color: 'var(--c-text-muted)' }}>
                          💡 Materiales e instrumentos sincronizados atómicamente a 0 tokens a partir del Libro de Trabajo.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSyncSuite(actIdx)}
                          disabled={syncingSuite === actIdx}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#3b82f6',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RefreshCw size={12} className={syncingSuite === actIdx ? 'animate-spin' : ''} />
                          {syncingSuite === actIdx ? 'Sincronizando…' : 'Volver a sincronizar Suite'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Tarjeta de Bloque Pendiente */
                    <div style={{
                      padding: '24px 20px',
                      background: 'rgba(30, 41, 59, 0.3)',
                      border: '1px dashed rgba(148, 163, 184, 0.25)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ fontSize: '28px' }}>🕒</div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--c-text)' }}>
                          {blockNumStr}: Pendiente de Generación
                        </h4>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--c-text-muted)', maxWidth: '540px', lineHeight: 1.5 }}>
                          Los instrumentos oficiales de evaluación (rúbricas y listas de cotejo), la guía activa del alumno y los insumos didácticos se generarán automáticamente en cascada al crear el <strong>Libro de Trabajo del {blockNumStr}</strong>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('planning');
                          setTimeout(() => {
                            const el = document.getElementById(`workbook-card-${actIdx}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className="btn btn-navy"
                        style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, borderRadius: '6px', marginTop: '4px' }}
                      >
                        ⚡ Ir a Generar Libro del {blockNumStr}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>

        {/* Feedback Widget */}
        <GenerationFeedback entityType="planning" entityId={planning.id} />
        </>
  );
}
