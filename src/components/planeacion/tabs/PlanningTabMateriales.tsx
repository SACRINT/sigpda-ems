'use client';

import React from 'react';
import type { GeneratedPlanningContent, Planning, PlanningExtra, SecuenciaBloque } from '@/types/planning';
import type { ActiveWorkTextbook, GenerationProgressState } from '@/types/work-textbook';
import GenerationFeedback from '@/components/feedback/GenerationFeedback';
import BlockPresentationActions from '@/components/planeacion/slides/BlockPresentationActions';
import {
  Zap, RefreshCw, CheckCircle
} from 'lucide-react';
import { parseMaterialTokensWithFallback, isStructuredVisualPayload } from '@/lib/materials/material-tokens';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { useBlockMaterialReviews } from '@/hooks/useBlockMaterialReviews';

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
  activeSubTab?: 'extras' | 'teacherGuides' | 'practiceGuides';
  onSubTabChange?: (subTab: 'extras' | 'teacherGuides' | 'practiceGuides') => void;
  sequenceData?: Record<number, SecuenciaBloque>;
  extras: PlanningExtra[];
  generatingKey: string | null;
  syncingSuite: number | null;
  blockWorkbooks: Record<number, MaterialBlockWorkbookItem>;
  handleGenerateExtra: (
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide' | 'teacher_guide',
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
  setActiveTab?: (tab: string) => void;
  handlePreviewExtra: (extra: PlanningExtra) => void;
  handleSyncSuite: (blockIdx: number) => Promise<void>;
  handleGenerateWorkbook: (blockIndex: number) => Promise<void>;
  findExtra: (type: string, keyIndex: number | null, title?: string, sessionNum?: number) => PlanningExtra | undefined;
  setPreviewExtra: (extra: PlanningExtra | null) => void;
}

export default function PlanningTabMateriales({
  planning,
  activeSubTab = 'extras',
  onSubTabChange,
  sequenceData,
  extras,
  generatingKey,
  syncingSuite,
  blockWorkbooks,
  handleGenerateExtra,
  handleSyncSuite,
  handleDeleteExtra,
  findExtra,
  setPreviewExtra,
  setActiveTab = () => {},
}: PlanningTabMaterialesProps) {
  const [internalSubTab, setInternalSubTab] = React.useState<'extras' | 'teacherGuides' | 'practiceGuides'>('extras');
  const [confirmDeleteExtraId, setConfirmDeleteExtraId] = React.useState<string | null>(null);
  const currentSubTab = onSubTabChange ? (activeSubTab || 'extras') : internalSubTab;

  const handleSubTabSwitch = (subTab: 'extras' | 'teacherGuides' | 'practiceGuides') => {
    if (onSubTabChange) {
      onSubTabChange(subTab);
    } else {
      setInternalSubTab(subTab);
    }
  };

  const renderDeleteControl = (
    extraId: string,
    label: string = 'Eliminar',
    variant: 'normal' | 'small' | 'mini' = 'normal'
  ) => {
    if (confirmDeleteExtraId === extraId) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: variant === 'mini' ? '10px' : '11px',
          }}
        >
          <span style={{ color: '#fca5a5', fontWeight: 600 }}>¿Borrar?</span>
          <button
            type="button"
            onClick={async () => {
              setConfirmDeleteExtraId(null);
              await handleDeleteExtra(extraId);
            }}
            className="btn"
            style={{
              padding: variant === 'mini' ? '2px 4px' : '2px 6px',
              fontSize: variant === 'mini' ? '10px' : '11px',
              background: '#dc2626',
              color: '#fff',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteExtraId(null)}
            className="btn"
            style={{
              padding: variant === 'mini' ? '2px 4px' : '2px 6px',
              fontSize: variant === 'mini' ? '10px' : '11px',
              background: 'rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            No
          </button>
        </span>
      );
    }

    if (variant === 'mini') {
      return (
        <button
          type="button"
          onClick={() => setConfirmDeleteExtraId(extraId)}
          className="btn"
          title={label}
          style={{
            padding: '2px 4px',
            fontSize: '10px',
            background: 'transparent',
            border: 'none',
            color: '#fb7185',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      );
    }

    if (variant === 'small') {
      return (
        <button
          type="button"
          onClick={() => setConfirmDeleteExtraId(extraId)}
          className="btn"
          title={label}
          style={{
            padding: '4px 6px',
            fontSize: '11px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗑️
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setConfirmDeleteExtraId(extraId)}
        className="btn"
        title={label}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          background: 'rgba(244,63,94,0.15)',
          border: '1px solid rgba(244,63,94,0.3)',
          color: '#fb7185',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        🗑️
      </button>
    );
  };

  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;
  const curricularBlocks = React.useMemo(() => resolveCurricularBlocks(content), [content]);

  // Revisión determinista R1 en memoria por bloque (<15ms, 0 tokens) vía hook compartido
  const blockReviews = useBlockMaterialReviews(planning, blockWorkbooks, sequenceData, extras);

  const renderSubTabsBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
      <div className="detail-subtabs" role="tablist" aria-label="Subsecciones de materiales e instrumentos">
        <button
          id="subtab-extras"
          aria-controls="subtabpanel-extras"
          type="button"
          role="tab"
          aria-selected={currentSubTab === 'extras'}
          onClick={() => handleSubTabSwitch('extras')}
          aria-current={currentSubTab === 'extras' ? 'page' : undefined}
          className={`detail-subtab${currentSubTab === 'extras' ? ' is-active' : ''}`}
        >
          📋 Instrumentos de Evaluación y Recursos
        </button>
        <button
          id="subtab-practiceGuides"
          aria-controls="subtabpanel-practiceGuides"
          type="button"
          role="tab"
          aria-selected={currentSubTab === 'practiceGuides'}
          onClick={() => handleSubTabSwitch('practiceGuides')}
          aria-current={currentSubTab === 'practiceGuides' ? 'page' : undefined}
          className={`detail-subtab${currentSubTab === 'practiceGuides' ? ' is-active' : ''}`}
        >
          🔬 Guías de Práctica
        </button>
        <button
          id="subtab-teacherGuides"
          aria-controls="subtabpanel-teacherGuides"
          type="button"
          role="tab"
          aria-selected={currentSubTab === 'teacherGuides'}
          onClick={() => handleSubTabSwitch('teacherGuides')}
          aria-current={currentSubTab === 'teacherGuides' ? 'page' : undefined}
          className={`detail-subtab${currentSubTab === 'teacherGuides' ? ' is-active' : ''}`}
        >
          🔒 Solucionario Docente y Guías
        </button>
      </div>
    </div>
  );

  if (currentSubTab === 'practiceGuides') {
    const practiceGuidesCount = extras.filter(
      (ex) => ex.type === 'practice_guide' && !isStructuredVisualPayload(ex.contentText)
    ).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {renderSubTabsBar()}
        <div
          id="subtabpanel-practiceGuides"
          role="tabpanel"
          aria-labelledby="subtab-practiceGuides"
          tabIndex={0}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div className="section-card">
          <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-card-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔬 Guías de Práctica, Taller y Laboratorio
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {practiceGuidesCount} de {curricularBlocks.length} generadas
            </span>
          </div>
          <div className="section-card-body">
            <div style={{ padding: '12px', background: 'rgba(2, 132, 199, 0.12)', borderLeft: '3px solid #0284c7', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
              <p style={{ color: '#7dd3fc', fontWeight: 600, marginBottom: '4px' }}>💡 Protocolos Situados de Práctica (MCCEMS)</p>
              <p style={{ color: 'var(--c-text)', marginBottom: '6px' }}>
                Instrumentos de trabajo experimental, técnico, de taller o estudio de caso situados en el contexto formativo del estudiante.
                Establecen el propósito, las normas de seguridad e higiene, materiales necesarios, procedimiento paso a paso y criterios de verificación formativa.
              </p>
            </div>

            {/* One card per canonical curricular block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {curricularBlocks.map((block) => {
                const practiceNum = block.blockIndex + 1;
                const practiceTitle = block.title || block.name;
                const generatedGuide = findExtra('practice_guide', block.blockIndex);
                const loadingKey = `practice_guide-${block.blockIndex}--`;
                const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                return (
                  <div
                    key={block.blockIndex}
                    style={{
                      padding: '14px 18px',
                      background: 'var(--c-bg-surface)',
                      border: generatedGuide ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--c-border)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {isLaboral ? `AC ${block.blockIndex + 1}` : `Bloque ${practiceNum}`}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                            {generatedGuide ? '✓ Protocolo Generado' : '⏳ Pendiente'}
                          </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--c-text)' }}>
                          🔬 Guía de Práctica · {practiceTitle}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {generatedGuide ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreviewExtra(generatedGuide)}
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              👁️ Ver
                            </button>
                            <a
                              href={`/api/docx/extra/${generatedGuide.id}`}
                              className="btn"
                              style={{ padding: '6px 14px', fontSize: '12px', background: '#0284c7', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
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
                            {renderDeleteControl(generatedGuide.id, 'Eliminar guía de práctica')}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleGenerateExtra(
                                'practice_guide',
                                `Guía de Práctica · Bloque ${practiceNum}: ${practiceTitle}`,
                                block.blockIndex,
                                {
                                  activityName: block.title,
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
                              background: generatingKey !== null ? '#7dd3fc' : '#0284c7',
                              color: '#fff',
                              fontWeight: 600,
                              cursor: generatingKey !== null ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isCurrentGenerating ? '⏳ Generando guía...' : '🔬 Generar Guía de Práctica'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {curricularBlocks.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
                  No se encontraron bloques curriculares en esta planeación.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feedback */}
        <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
      </div>
    );
  }

  if (currentSubTab === 'teacherGuides') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {renderSubTabsBar()}
        <div
          id="subtabpanel-teacherGuides"
          role="tabpanel"
          aria-labelledby="subtab-teacherGuides"
          tabIndex={0}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📘 Solucionario Pedagógico y Guías del Docente</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.12)', borderLeft: '3px solid #7c3aed', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
                <p style={{ color: '#c4b5fd', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es la Guía del Docente y Solucionario?</p>
                <p style={{ color: 'var(--c-text)', marginBottom: '6px' }}>
                  Documento pedagógico de uso exclusivo para el docente que integra las resoluciones modelo paso a paso,
                  criterios de mediación didáctica y respuestas oficiales a los problemas planteados en el Libro de Trabajo del estudiante.
                  Garantiza el acompañamiento formativo, la prevención de errores comunes y la evaluación situada bajo el Marco Curricular Común (MCCEMS).
                </p>
                {planning.metodologiaActiva && (
                  <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '13px' }}>
                    🎯 Metodología activa seleccionada: <strong>{planning.metodologiaActiva}</strong> — las pautas de mediación reflejan sus fases específicas.
                  </p>
                )}
              </div>

              {/* One card per canonical curricular block (Corte 1, 2, 3) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {curricularBlocks.map((block) => {
                  const practiceNum = block.blockIndex + 1;
                  const practiceTitle = block.title;
                  const generatedGuide = findExtra('teacher_guide', block.blockIndex);
                  const loadingKey = `teacher_guide-${block.blockIndex}--`;
                  const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                  return (
                    <div
                      key={block.blockIndex}
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
                            📘 Solucionario Docente · Bloque {practiceNum} ({block.corteLabel}): {practiceTitle}
                          </span>
                          <div style={{ fontSize: '12px', color: '#c4b5fd', marginTop: '2px' }}>
                            {block.hours} hrs · {block.methodology || 'Metodología activa'} · Clave de Respuestas
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {generatedGuide ? (
                            (() => {
                              const bReview = blockReviews[block.blockIndex];
                              const akIssues = bReview?.byMaterial.answer_key.issues ?? [];
                              const akBlocked = bReview ? !bReview.byMaterial.answer_key.ok : false;
                              const akTooltip = akBlocked
                                ? akIssues
                                    .filter((i) => i.severity === 'error')
                                    .map((i) => `${i.code}: ${i.message}`)
                                    .join('\n')
                                : akIssues.length > 0
                                  ? akIssues.map((i) => `${i.code}: ${i.message}`).join('\n')
                                  : undefined;
                              return (
                                <>
                                  <span style={{ fontSize: '12px', color: akBlocked ? '#fb7185' : '#34d399', fontWeight: 600, background: akBlocked ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)', padding: '3px 10px', borderRadius: '12px' }} title={akTooltip}>
                                    {akBlocked ? '⚠️ Solucionario bloqueado (R1)' : '✓ Solucionario generado'}
                                  </span>
                                  <button
                                    onClick={() => setPreviewExtra(generatedGuide)}
                                    className="btn"
                                    style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(124,58,237,0.2)', border: '1px solid #7c3aed', color: '#c4b5fd', borderRadius: '6px' }}
                                  >
                                    👁️ Ver Solucionario
                                  </button>
                                  <a
                                    href={akBlocked ? '#' : `/api/docx/extra/${generatedGuide.id}`}
                                    onClick={(e) => {
                                      if (akBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={akBlocked}
                                    title={akTooltip}
                                    className="btn"
                                    style={{ padding: '6px 14px', fontSize: '12px', background: '#7c3aed', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, opacity: akBlocked ? 0.45 : 1, cursor: akBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ Word
                                  </a>
                                  <a
                                    href={akBlocked ? '#' : `/api/pdf/extra/${generatedGuide.id}`}
                                    target={akBlocked ? undefined : '_blank'}
                                    rel={akBlocked ? undefined : 'noopener noreferrer'}
                                    onClick={(e) => {
                                      if (akBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={akBlocked}
                                    title={akTooltip}
                                    style={{ padding: '6px 14px', fontSize: '12px', background: '#dc2626', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, opacity: akBlocked ? 0.45 : 1, cursor: akBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ PDF
                                  </a>
                                  {renderDeleteControl(generatedGuide.id, 'Eliminar solucionario')}
                                </>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() =>
                                handleGenerateExtra(
                                  'teacher_guide',
                                  `Guía del Docente y Solucionario · Bloque ${practiceNum}: ${practiceTitle}`,
                                  block.blockIndex,
                                  {
                                    activityName: block.title,
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
                              {isCurrentGenerating ? '⏳ Generando solucionario...' : '📘 Generar Guía del Docente (Solucionario)'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Preview of learning outcome if available */}
                      {block.learningOutcome && (
                        <div style={{ padding: '10px 16px', fontSize: '13px', color: '#6d28d9', borderTop: '1px dashed #ddd6fe' }}>
                          <strong>📌 Resultado de aprendizaje:</strong> {block.learningOutcome}
                        </div>
                      )}
                    </div>
                  );
                })}

                {curricularBlocks.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
                    No se encontraron bloques curriculares en esta planeación.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback */}
          <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {renderSubTabsBar()}
        <div
          id="subtabpanel-extras"
          role="tabpanel"
          aria-labelledby="subtab-extras"
          tabIndex={0}
          style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
        >

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
                  Estructurados en secciones continuas por Bloque curricular (NEM / MCCEMS 2026-2027).
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
                <span className="text-xs" style={{ color: 'var(--c-navy-light)', fontWeight: 600 }}>Anexo 12 USICAMM</span>
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
          {curricularBlocks.map((block) => {
            const roman = ['I', 'II', 'III'][block.blockIndex] || `${block.blockIndex + 1}`;
            const blockNumStr = isLaboral ? `AC ${block.blockIndex + 1}` : `Bloque ${roman} (${block.corteLabel})`;
            const blockTitle = block.title || block.name;

            // Buscar recursos derivados de este bloque
            const rubricExtra = findExtra('rubric', block.blockIndex);
            const checklistExtra = findExtra('checklist', block.blockIndex);
            const materialExtra = findExtra('material', block.blockIndex);
            const practiceGuideExtra = findExtra('practice_guide', block.blockIndex);
            const guideExtra = findExtra('teacher_guide', block.blockIndex);
            const visualExtras = extras.filter((ex) => {
              if (ex.type !== 'visual') return false;
              return ex.keyIndex === block.blockIndex;
            });

            const hasWorkbook = Boolean(blockWorkbooks[block.blockIndex]?.workbook);
            const hasAnyMaterial = Boolean(rubricExtra || checklistExtra || materialExtra || practiceGuideExtra || guideExtra || visualExtras.length > 0);
            const blockReview = blockReviews[block.blockIndex];
            const rubricBlocked = blockReview ? !blockReview.byMaterial.rubric.ok : false;
            const rubricTooltip = blockReview?.byMaterial.rubric.issues.map((i) => `${i.code}: ${i.message}`).join('\n') || undefined;
            const checklistBlocked = blockReview ? !blockReview.byMaterial.checklist.ok : false;
            const checklistTooltip = blockReview?.byMaterial.checklist.issues.map((i) => `${i.code}: ${i.message}`).join('\n') || undefined;
            const materialBlocked = blockReview ? !blockReview.byMaterial.didactic_material.ok : false;
            const materialTooltip = blockReview?.byMaterial.didactic_material.issues.map((i) => `${i.code}: ${i.message}`).join('\n') || undefined;

            return (
              <div key={block.blockIndex} className="section-card" style={{ border: hasAnyMaterial ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--c-border)' }}>
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

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {blockReview && (() => {
                      const isClean = blockReview.ok && blockReview.warnings.length === 0;
                      const isWarn = blockReview.ok && blockReview.warnings.length > 0;
                      const bg = isClean
                        ? 'rgba(16, 185, 129, 0.15)'
                        : isWarn
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(244, 63, 94, 0.15)';
                      const fg = isClean ? '#34d399' : isWarn ? '#fbbf24' : '#fb7185';
                      const border = isClean
                        ? 'rgba(16, 185, 129, 0.35)'
                        : isWarn
                          ? 'rgba(245, 158, 11, 0.35)'
                          : 'rgba(244, 63, 94, 0.4)';
                      const dot = isClean ? '🟢' : isWarn ? '🟡' : '🔴';
                      const label = isClean
                        ? 'Materiales: Verificados'
                        : isWarn
                          ? `Materiales: ${blockReview.warnings.length} advertencia${blockReview.warnings.length === 1 ? '' : 's'}`
                          : `Materiales: ${blockReview.errors.length} error${blockReview.errors.length === 1 ? '' : 'es'}`;
                      const tooltip = isClean
                        ? `Revisión determinista R1 aprobada (${blockReview.score}/100)`
                        : (blockReview.ok ? blockReview.warnings : blockReview.errors)
                            .map((iss) => `${iss.code}: ${iss.message}`)
                            .join('\n');
                      return (
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            background: bg,
                            border: `1px solid ${border}`,
                            color: fg,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                          title={tooltip}
                        >
                          {dot} {label}
                        </span>
                      );
                    })()}
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
                      {/* ── SECCIÓN 1: INSTRUMENTOS DE EVALUACIÓN FORMATIVA Y SUMATIVA ── */}
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid rgba(59, 130, 246, 0.22)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginBottom: '10px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--c-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              📋 Instrumentos de Evaluación Formativa y Sumativa
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '1px 7px',
                                borderRadius: '10px',
                                background: (rubricExtra || checklistExtra) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                                color: (rubricExtra || checklistExtra) ? '#34d399' : '#94a3b8',
                                border: `1px solid ${(rubricExtra || checklistExtra) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                              }}
                            >
                              {(rubricExtra && checklistExtra) ? '2 listos' : (rubricExtra || checklistExtra) ? '1 listo' : 'Pendientes'}
                            </span>
                          </div>

                          {/* Acciones de descarga compilada de instrumentos del bloque */}
                          {(rubricExtra || checklistExtra) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '10.5px', color: 'var(--c-text-muted)' }}>
                                Compendio bloque:
                              </span>
                              <a
                                href={`/api/docx/extra/combined?planningId=${planning.id}&type=evaluation&blockIndex=${block.blockIndex}`}
                                className="btn btn-amber"
                                style={{ padding: '3px 8px', fontSize: '10.5px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                title="Descargar todos los instrumentos de este bloque en un solo archivo Word"
                              >
                                ↓ Word ({rubricExtra && checklistExtra ? '2 en 1' : '1'})
                              </a>
                              <a
                                href={`/api/pdf/extra/combined?planningId=${planning.id}&type=evaluation&blockIndex=${block.blockIndex}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{ padding: '3px 8px', fontSize: '10.5px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                title="Descargar todos los instrumentos de este bloque en un solo archivo PDF"
                              >
                                ↓ PDF ({rubricExtra && checklistExtra ? '2 en 1' : '1'})
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Grid de Instrumentos de Evaluación */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                          {/* 1. Rúbrica Analítica Oficial */}
                          <div style={{
                            padding: '10px 12px',
                            background: 'var(--c-bg-surface)',
                            border: '1px solid var(--c-border)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Instrumento Normativo
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--c-text-muted)' }}>4 Niveles NEM</span>
                              </div>
                              <h4 style={{ margin: '2px 0 3px 0', fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text)' }}>
                                📊 Rúbrica Analítica ({blockNumStr})
                              </h4>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-muted)', lineHeight: 1.35 }}>
                                Descriptores cualitativos por niveles de dominio vinculados a los aprendizajes del bloque.
                              </p>
                            </div>

                            <div>
                              {rubricExtra ? (
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    onClick={() => setPreviewExtra(rubricExtra)}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                  >
                                    👁️ Ver
                                  </button>
                                  <a
                                    href={rubricBlocked ? '#' : `/api/docx/extra/${rubricExtra.id}`}
                                    onClick={(e) => {
                                      if (rubricBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={rubricBlocked}
                                    title={rubricTooltip}
                                    className="btn btn-amber"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, opacity: rubricBlocked ? 0.45 : 1, cursor: rubricBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ Word
                                  </a>
                                  <a
                                    href={rubricBlocked ? '#' : `/api/pdf/extra/${rubricExtra.id}`}
                                    target={rubricBlocked ? undefined : '_blank'}
                                    rel={rubricBlocked ? undefined : 'noopener noreferrer'}
                                    onClick={(e) => {
                                      if (rubricBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={rubricBlocked}
                                    title={rubricTooltip}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, opacity: rubricBlocked ? 0.45 : 1, cursor: rubricBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ PDF
                                  </a>
                                  {renderDeleteControl(rubricExtra.id, 'Eliminar rúbrica', 'small')}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSyncSuite(block.blockIndex)}
                                  disabled={syncingSuite === block.blockIndex}
                                  className="btn btn-navy"
                                  style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  {syncingSuite === block.blockIndex ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 2. Lista de Cotejo Formativa */}
                          <div style={{
                            padding: '10px 12px',
                            background: 'var(--c-bg-surface)',
                            border: '1px solid var(--c-border)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Instrumento Formativo
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--c-text-muted)' }}>Dicotómico</span>
                              </div>
                              <h4 style={{ margin: '2px 0 3px 0', fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text)' }}>
                                ✅ Lista de Cotejo ({blockNumStr})
                              </h4>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-muted)', lineHeight: 1.35 }}>
                                Reactivos observables de autoevaluación y coevaluación del producto formativo.
                              </p>
                            </div>

                            <div>
                              {checklistExtra ? (
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    onClick={() => setPreviewExtra(checklistExtra)}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                  >
                                    👁️ Ver
                                  </button>
                                  <a
                                    href={checklistBlocked ? '#' : `/api/docx/extra/${checklistExtra.id}`}
                                    onClick={(e) => {
                                      if (checklistBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={checklistBlocked}
                                    title={checklistTooltip}
                                    className="btn btn-amber"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, opacity: checklistBlocked ? 0.45 : 1, cursor: checklistBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ Word
                                  </a>
                                  <a
                                    href={checklistBlocked ? '#' : `/api/pdf/extra/${checklistExtra.id}`}
                                    target={checklistBlocked ? undefined : '_blank'}
                                    rel={checklistBlocked ? undefined : 'noopener noreferrer'}
                                    onClick={(e) => {
                                      if (checklistBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={checklistBlocked}
                                    title={checklistTooltip}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, opacity: checklistBlocked ? 0.45 : 1, cursor: checklistBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ PDF
                                  </a>
                                  {renderDeleteControl(checklistExtra.id, 'Eliminar lista de cotejo', 'small')}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSyncSuite(block.blockIndex)}
                                  disabled={syncingSuite === block.blockIndex}
                                  className="btn btn-navy"
                                  style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  {syncingSuite === block.blockIndex ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── SECCIÓN 2: SOPORTE DOCENTE Y PROTOCOLOS SITUADOS ── */}
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.25)',
                          border: '1px solid rgba(139, 92, 246, 0.22)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginBottom: '10px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--c-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              🛠️ Soporte Docente y Protocolos Situados
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                              Insumos de aula/taller y protocolos formativos
                            </span>
                          </div>
                        </div>

                        {/* Grid de Soporte Docente y Protocolos */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                          {/* 3. Materiales Didácticos del Docente */}
                          <div style={{
                            padding: '10px 12px',
                            background: 'var(--c-bg-surface)',
                            border: '1px solid var(--c-border)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Soporte Docente
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--c-text-muted)' }}>Insumos Técnicos</span>
                              </div>
                              <h4 style={{ margin: '2px 0 3px 0', fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text)' }}>
                                📦 Materiales e Insumos ({blockNumStr})
                              </h4>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-muted)', lineHeight: 1.35 }}>
                                Guión técnico, reactivos didácticos y requerimientos de aula/taller.
                              </p>

                              {/* Insumos ilustrados detectados en formato píldoras */}
                              {(() => {
                                const blockText = [
                                  materialExtra?.contentText || '',
                                  ...block.activities.flatMap((a) => [
                                    a.apertura?.materials || '',
                                    a.ejecucion?.materials || '',
                                    a.conclusion?.materials || '',
                                  ]),
                                ].join(' ');
                                const detected = parseMaterialTokensWithFallback(blockText);
                                const allUnique = Array.from(new Map(detected.map((m) => [m.slug, m])).values());
                                if (allUnique.length === 0) return null;
                                return (
                                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {allUnique.slice(0, 3).map((mat, mIdx) => (
                                      <span
                                        key={`${mat.slug}-${mIdx}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          background: 'rgba(139, 92, 246, 0.1)',
                                          border: '1px solid rgba(139, 92, 246, 0.25)',
                                          color: '#c4b5fd',
                                        }}
                                        title={mat.label}
                                      >
                                        📐 {mat.label || mat.slug}
                                      </span>
                                    ))}
                                    {allUnique.length > 3 && (
                                      <span style={{ fontSize: '10px', color: 'var(--c-text-muted)' }}>
                                        +{allUnique.length - 3} más
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            <div style={{ marginTop: '4px' }}>
                              {materialExtra ? (
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    onClick={() => setPreviewExtra(materialExtra)}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                  >
                                    👁️ Ver
                                  </button>
                                  <a
                                    href={materialBlocked ? '#' : `/api/docx/extra/${materialExtra.id}`}
                                    onClick={(e) => {
                                      if (materialBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={materialBlocked}
                                    title={materialTooltip}
                                    className="btn btn-amber"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, opacity: materialBlocked ? 0.45 : 1, cursor: materialBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ Word
                                  </a>
                                  <a
                                    href={materialBlocked ? '#' : `/api/pdf/extra/${materialExtra.id}`}
                                    target={materialBlocked ? undefined : '_blank'}
                                    rel={materialBlocked ? undefined : 'noopener noreferrer'}
                                    onClick={(e) => {
                                      if (materialBlocked) e.preventDefault();
                                    }}
                                    aria-disabled={materialBlocked}
                                    title={materialTooltip}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, opacity: materialBlocked ? 0.45 : 1, cursor: materialBlocked ? 'not-allowed' : 'pointer' }}
                                  >
                                    ↓ PDF
                                  </a>
                                  {renderDeleteControl(materialExtra.id, 'Eliminar material didáctico', 'small')}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSyncSuite(block.blockIndex)}
                                  disabled={syncingSuite === block.blockIndex}
                                  className="btn btn-navy"
                                  style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  {syncingSuite === block.blockIndex ? '⏳ Sincronizando…' : '⚡ Extraer del Libro'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 4. Guía de Práctica / Protocolo Situado */}
                          <div style={{
                            padding: '10px 12px',
                            background: 'var(--c-bg-surface)',
                            border: '1px solid var(--c-border)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Protocolo Situado
                                </span>
                                <span style={{ fontSize: '10.5px', color: 'var(--c-text-muted)' }}>Taller / Lab</span>
                              </div>
                              <h4 style={{ margin: '2px 0 3px 0', fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text)' }}>
                                🔬 Guía de Práctica ({blockNumStr})
                              </h4>
                              <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-muted)', lineHeight: 1.35 }}>
                                Protocolo formativo de experimentación, seguridad e investigación situada.
                              </p>
                            </div>

                            <div style={{ marginTop: '4px' }}>
                              {practiceGuideExtra ? (
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewExtra(practiceGuideExtra)}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px', fontWeight: 600 }}
                                  >
                                    👁️ Ver
                                  </button>
                                  <a
                                    href={`/api/docx/extra/${practiceGuideExtra.id}`}
                                    className="btn btn-amber"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                  >
                                    ↓ Word
                                  </a>
                                  <a
                                    href={`/api/pdf/extra/${practiceGuideExtra.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                  >
                                    ↓ PDF
                                  </a>
                                  {renderDeleteControl(practiceGuideExtra.id, 'Eliminar guía de práctica', 'small')}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleGenerateExtra(
                                      'practice_guide',
                                      `Guía de Práctica · Bloque ${block.blockIndex + 1}: ${blockTitle}`,
                                      block.blockIndex,
                                      { activityName: blockTitle, practiceNumber: block.blockIndex + 1, practiceTitle: blockTitle }
                                    )
                                  }
                                  disabled={generatingKey !== null}
                                  className="btn btn-navy"
                                  style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  {generatingKey?.startsWith(`practice_guide-${block.blockIndex}--`) ? '⏳ Generando…' : '⚡ Generar Guía'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recursos Gráficos si existen diagramas generados */}
                      {visualExtras.length > 0 && (
                        <div style={{
                          padding: '10px 14px',
                          background: 'rgba(236, 72, 153, 0.05)',
                          border: '1px solid rgba(236, 72, 153, 0.25)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f472b6' }}>
                              🎨 Recursos Gráficos ({visualExtras.length} diagramas)
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {visualExtras.map((vExtra, vIdx) => (
                              <div key={vExtra.id || vIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '5px', padding: '3px 6px' }}>
                                <button
                                  onClick={() => setPreviewExtra(vExtra)}
                                  className="btn"
                                  style={{ padding: '2px 6px', fontSize: '11px', background: 'transparent', border: 'none', color: '#fbcfe8', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  👁️ {vExtra.title || `Gráfico Misión ${vIdx + 1}`}
                                </button>
                                {renderDeleteControl(vExtra.id, 'Eliminar gráfico', 'mini')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                          onClick={() => handleSyncSuite(block.blockIndex)}
                          disabled={syncingSuite === block.blockIndex}
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
                          <RefreshCw size={12} className={syncingSuite === block.blockIndex ? 'animate-spin' : ''} />
                          {syncingSuite === block.blockIndex ? 'Sincronizando…' : 'Volver a sincronizar Suite'}
                        </button>
                      </div>

                      <BlockPresentationActions planningId={planning.id} blockIndex={block.blockIndex} />
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
                            const el = document.getElementById(`workbook-card-${block.blockIndex}`);
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
      </div>

      {/* Feedback Widget */}
      <GenerationFeedback entityType="planning" entityId={planning.id} />
    </>
  );
}
