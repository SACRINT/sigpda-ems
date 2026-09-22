'use client';

import React from 'react';
import type { GeneratedPlanningContent, Planning, PlanningExtra, SecuenciaBloque } from '@/types/planning';
import { generateBlockSessions, type DetailedSession } from '@/lib/session-progression-engine';
import GenerationFeedback from '@/components/feedback/GenerationFeedback';
import { Clock, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export interface PlanningTabSecuenciasProps {
  planning: Planning;
  sequenceData?: Record<number, SecuenciaBloque>;
  collapsedBlocks: Record<number, boolean>;
  toggleBlock: (actIdx: number) => void;
  toggleAllBlocks: () => void;
  allBlocksCollapsed: boolean;
  findExtra: (type: string, keyIndex: number | null, title?: string, sessionNum?: number) => PlanningExtra | undefined;
  generatingKey: string | null;
  setPreviewExtra: (extra: PlanningExtra | null) => void;
  handleDeleteExtra: (extraId: string) => Promise<void>;
  handleGenerateExtra: (
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'teacher_guide',
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
  blockWorkbooks?: Record<number, { loaded?: boolean; generating?: boolean; workbook?: unknown; progress?: unknown; error?: string | null }>;
}

export default function PlanningTabSecuencias({
  planning,
  sequenceData = {},
  collapsedBlocks,
  toggleBlock,
  toggleAllBlocks,
  allBlocksCollapsed,
  findExtra,
  generatingKey,
  setPreviewExtra,
  handleDeleteExtra,
  handleGenerateExtra,
  blockWorkbooks = {},
}: PlanningTabSecuenciasProps) {
  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;

  const blockSessionsMap: DetailedSession[][] = (content?.sectionIV?.activities || []).map((act, actIdx) => {
    const outcome = content?.sectionII?.learningOutcomes?.[actIdx] || '';
    const savedSeq = sequenceData?.[actIdx] || null;
    return generateBlockSessions(act, actIdx, act.hours || (isLaboral ? 18 : 12), outcome, isLaboral, savedSeq);
  });
  const allDetailedSessions: DetailedSession[] = blockSessionsMap.flat();

  return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Info & Actions Banner */}
          <div className="section-card">
            <div
              className="section-card-header"
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} />
                <span className="section-card-title" style={{ color: '#fff', fontSize: '16px' }}>
                  Planes de Clase Desglosados por Sesión (50 min c/u)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '12px',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  {allDetailedSessions.length} Sesiones · {content?.sectionIV?.activities?.length || 0} {isLaboral ? 'Actividades Clave' : 'Bloques'}
                </span>
                {(content?.sectionIV?.activities?.length || 0) > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllBlocks}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {allBlocksCollapsed ? '📂 Expandir todos los bloques' : '📁 Colapsar todos los bloques'}
                  </button>
                )}
              </div>
            </div>

            <div className="section-card-body" style={{ padding: '16px 20px' }}>
              <div
                style={{
                  padding: '14px 18px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderLeft: '4px solid #3b82f6',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <p style={{ color: '#60a5fa', fontWeight: 600, margin: 0 }}>
                    💡 Secuencia Didáctica Progresiva (DBEPA / USICAMM):
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.18)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.35)', fontWeight: 600 }}>
                      🔵 Apertura (Saberes y Reto)
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.18)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: 600 }}>
                      🟡 Desarrollo (Construcción y Taller)
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.18)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 600 }}>
                      🟢 Cierre (Evaluación y Metacognición)
                    </span>
                  </div>
                </div>
                <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Cada bloque cuenta con su sección física independiente y su propia progresión de sesiones articuladas. Cada sesión tiene asignado su momento didáctico, título situado y descripción de lo que se construye en el aula o taller.
                </p>
              </div>
            </div>
          </div>

          {/* Distinct physical sections per block */}
          {content?.sectionIV?.activities?.map((act, actIdx) => {
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
            const blockNumStr = romanNumerals[actIdx] || String(actIdx + 1);
            const blockSessions = blockSessionsMap[actIdx] || [];
            const generatedCount = blockSessions.filter(
              (s) => !!findExtra('lesson_plan', s.activityIndex, undefined, s.sessionNum)
            ).length;
            const isCollapsed = !!collapsedBlocks[actIdx];

            // Clean title formatting
            const hasBlockPrefix =
              act.name.toLowerCase().startsWith('bloque') ||
              act.name.toLowerCase().startsWith('actividad') ||
              act.name.toLowerCase().startsWith('práctica') ||
              act.name.toLowerCase().startsWith('módulo') ||
              act.name.toLowerCase().startsWith('submódulo');

            const blockDisplayTitle = hasBlockPrefix
              ? act.name
              : `${isLaboral ? 'Actividad Clave' : 'Bloque'} ${blockNumStr}: ${act.name}`;

            const learningOutcome = content?.sectionII?.learningOutcomes?.[actIdx];

            return (
              <div
                key={actIdx}
                className="section-card"
                style={{
                  border: '1px solid rgba(59, 130, 246, 0.28)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: 'rgba(15, 23, 42, 0.75)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Elegant Block Section Header */}
                <div
                  onClick={() => toggleBlock(actIdx)}
                  style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.75) 100%)',
                    borderBottom: isCollapsed ? 'none' : '1px solid rgba(59, 130, 246, 0.22)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          letterSpacing: '0.04em',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                        }}
                      >
                        {isLaboral ? `AC ${actIdx + 1}` : `Bloque ${blockNumStr}`}
                      </span>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '16px', lineHeight: 1.3 }}>
                        {blockDisplayTitle}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '12.5px',
                        color: '#94a3b8',
                        marginTop: '8px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
                        ⏱️ <strong>{act.hours || blockSessions.length} horas</strong> curriculares
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
                        📝 <strong>{blockSessions.length} sesiones</strong> (50 min c/u)
                      </span>
                      {act.methodology && (
                        <>
                          <span>•</span>
                          <span style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#c4b5fd', border: '1px solid rgba(124, 58, 237, 0.3)', padding: '1px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
                            🎯 {act.methodology}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background:
                          generatedCount === blockSessions.length && blockSessions.length > 0
                            ? 'rgba(16, 185, 129, 0.2)'
                            : generatedCount > 0
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(148, 163, 184, 0.12)',
                        color:
                          generatedCount === blockSessions.length && blockSessions.length > 0
                            ? '#34d399'
                            : generatedCount > 0
                            ? '#60a5fa'
                            : '#94a3b8',
                        border:
                          generatedCount === blockSessions.length && blockSessions.length > 0
                            ? '1px solid rgba(16, 185, 129, 0.4)'
                            : generatedCount > 0
                            ? '1px solid rgba(59, 130, 246, 0.4)'
                            : '1px solid rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      {generatedCount === blockSessions.length && blockSessions.length > 0
                        ? `✓ ${generatedCount}/${blockSessions.length} Planes Generados`
                        : `${generatedCount} de ${blockSessions.length} planes generados`}
                    </span>

                    {generatedCount > 0 && (
                      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/api/docx/extra/bulk?planningId=${planning.id}&blockIndex=${actIdx}&type=lesson_plan`}
                          download
                          title="Descargar todos los planes de clase de este bloque en formato Word (.zip)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(30, 64, 175, 0.35) 100%)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#93c5fd',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          📦 Word (.zip)
                        </a>
                        <a
                          href={`/api/pdf/extra/bulk?planningId=${planning.id}&blockIndex=${actIdx}&type=lesson_plan`}
                          download
                          title="Descargar todos los planes de clase de este bloque en formato PDF (.zip)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#fca5a5',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          📄 PDF (.zip)
                        </a>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBlock(actIdx);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#94a3b8',
                        padding: '5px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                  </div>
                </div>

                {/* Block Body */}
                {!isCollapsed && (
                  <div style={{ padding: '16px 20px' }}>
                    {/* Block Info Banner: Contenido Formativo & Resultado de Aprendizaje */}
                    <div
                      style={{
                        padding: '14px 18px',
                        background: 'rgba(30, 41, 59, 0.55)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {act.contenidoFormativo && (
                        <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                          <strong style={{ color: '#60a5fa' }}>📌 Contenido formativo / Subtemas:</strong>{' '}
                          {act.contenidoFormativo}
                        </div>
                      )}
                      {learningOutcome && (
                        <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                          <strong style={{ color: '#34d399' }}>🎯 Resultado de aprendizaje:</strong>{' '}
                          {learningOutcome}
                        </div>
                      )}
                      {act.saberes && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', fontSize: '11.5px' }}>
                          {act.saberes.saber && (
                            <span style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#93c5fd', padding: '2px 8px', borderRadius: '4px' }}>
                              🧠 <strong>Saber:</strong> {act.saberes.saber.substring(0, 60)}…
                            </span>
                          )}
                          {act.saberes.saberHacer && (
                            <span style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fcd34d', padding: '2px 8px', borderRadius: '4px' }}>
                              ⚙️ <strong>Hacer:</strong> {act.saberes.saberHacer.substring(0, 60)}…
                            </span>
                          )}
                          {act.saberes.saberSer && (
                            <span style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '4px' }}>
                              🤝 <strong>Ser:</strong> {act.saberes.saberSer.substring(0, 60)}…
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section divider with subtle text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0 14px 0' }}>
                      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.35))' }} />
                      <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                        Desglose de Sesiones ({blockSessions.length} sesiones de 50 min)
                      </span>
                      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.35), transparent)' }} />
                    </div>

                    {/* Sessions List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {blockSessions.map((session, sIdx) => {
                        const generated = findExtra('lesson_plan', session.activityIndex, undefined, session.sessionNum);
                        const loadingKey = `lesson_plan-${session.activityIndex}-${session.sessionNum}-`;
                        const isCurrentGenerating = generatingKey?.startsWith(loadingKey);
                        const blockWb = blockWorkbooks[session.activityIndex];
                        const hasBlockWorkbook = Boolean(blockWb?.workbook);
                        const isWorkbookGenerating = Boolean(blockWb?.generating);

                        return (
                          <div
                            key={sIdx}
                            style={{
                              padding: '14px 16px',
                              background: generated
                                ? 'rgba(16, 185, 129, 0.04)'
                                : sIdx % 2 === 0
                                ? 'rgba(30, 41, 59, 0.45)'
                                : 'rgba(30, 41, 59, 0.25)',
                              border: generated
                                ? '1px solid rgba(16, 185, 129, 0.25)'
                                : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                          >
                            {/* Top row: Phase Badge + Session Number + Status + Actions */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '10px',
                                marginBottom: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Phase Badge */}
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: session.phaseColor.bg,
                                    color: session.phaseColor.text,
                                    border: `1px solid ${session.phaseColor.border}`,
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  [{session.phase}]
                                </span>

                                {/* Session number pill */}
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#f8fafc',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Sesión {session.sessionNum} de {session.totalSessions} (50 min)
                                </span>

                                {/* Status badge */}
                                {generated ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '11px', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                      <CheckCircle size={12} /> Plan Generado
                                    </span>
                                    {hasBlockWorkbook && (
                                      <span style={{ fontSize: '10.5px', color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                        ✓ En libro de bloque
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                      Pendiente de generar
                                    </span>
                                    {hasBlockWorkbook && (
                                      <span style={{ fontSize: '10.5px', color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                        ✓ En libro de bloque
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div>
                                {generated ? (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button
                                      onClick={() => setPreviewExtra(generated)}
                                      className="btn"
                                      style={{
                                        padding: '4px 9px',
                                        fontSize: '11px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.4)',
                                        color: '#93c5fd',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                      }}
                                    >
                                      👁️ Ver
                                    </button>
                                    <a
                                      href={`/api/docx/extra/${generated.id}`}
                                      className="btn btn-amber"
                                      style={{ padding: '4px 9px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                      ↓ Word
                                    </a>
                                    <a
                                      href={`/api/pdf/extra/${generated.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        padding: '4px 9px',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        textDecoration: 'none',
                                        background: '#dc2626',
                                        color: '#fff',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ↓ PDF
                                    </a>
                                    <button
                                      onClick={() => handleDeleteExtra(generated.id)}
                                      className="btn"
                                      title="Eliminar plan generado"
                                      style={{
                                        padding: '4px 8px',
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
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                    <button
                                      onClick={() =>
                                        handleGenerateExtra(
                                          'lesson_plan',
                                          `Plan de Clase: Sesión ${session.sessionNum} - ${session.title}`,
                                          session.activityIndex,
                                          {
                                            sessionNum: session.sessionNum,
                                            totalSessions: session.totalSessions,
                                            activityName: session.activityName,
                                            sessionTopic: session.title,
                                            sessionFocus: session.focus,
                                            teachingActivity: session.teachingActivity,
                                            learningActivity: session.learningActivity,
                                            evidence: session.evidence,
                                            evaluation: session.evaluation,
                                            phase: session.phase,
                                          }
                                        )
                                      }
                                      disabled={generatingKey !== null || isWorkbookGenerating}
                                      className="btn btn-navy"
                                      title={
                                        isWorkbookGenerating
                                          ? 'Generación de libro de bloque en curso...'
                                          : 'Se genera automáticamente con el Libro de Bloque. Usar solo para regenerar esta sesión.'
                                      }
                                      style={{
                                        padding: '6px 14px',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: generatingKey !== null || isWorkbookGenerating ? 'not-allowed' : 'pointer',
                                        opacity: isWorkbookGenerating ? 0.6 : 1,
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                        color: '#fff',
                                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                                      }}
                                    >
                                      {isCurrentGenerating
                                        ? '⏳ Creando plan...'
                                        : isWorkbookGenerating
                                        ? '⏳ Generando en bloque...'
                                        : '⚡ Generar Plan de Clase'}
                                    </button>
                                    <span style={{ fontSize: '10px', color: '#94a3b8', maxWidth: '220px', textAlign: 'right', lineHeight: '1.25' }}>
                                      Se genera automáticamente con el Libro de Bloque. Usar solo para regenerar esta sesión.
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Middle row: Specific Session Title */}
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                              📌 {session.title}
                            </div>

                            {/* Bottom row: What is built / achieved in this session */}
                            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '6px' }}>
                              {session.description}
                            </div>

                            {/* Focus / Didactic goal pill */}
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                borderLeft: `3px solid ${session.phaseColor.text}`,
                              }}
                            >
                              <strong style={{ color: session.phaseColor.text }}>🎯 Construcción de la sesión:</strong>{' '}
                              <span>{session.focus}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(!content?.sectionIV?.activities || content.sectionIV.activities.length === 0) && (
            <div className="section-card" style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
              No se encontraron bloques o actividades clave en la Sección IV de esta planeación.
            </div>
          )}

          {/* Feedback Widget */}
          <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
  );
}
