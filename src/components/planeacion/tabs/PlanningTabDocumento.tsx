/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import type { GeneratedPlanningContent, Planning, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import DocumentA4Viewer from '@/components/common/DocumentA4Viewer';
import {
  FileText, Zap, BookOpen, Download, RefreshCw, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Library
} from 'lucide-react';

export interface PlanningTabDocumentoProps {
  planning: Planning;
  activeSubTab?: 'planning' | 'a4print';
  sequenceData?: Record<number, SecuenciaBloque>;
  downloadingPdf?: boolean;
  handleDownloadPdf?: () => Promise<void> | void;
  handleDownloadSecuenciaPdf?: () => Promise<void> | void;
  downloadingSeqPdf?: boolean;
  accumulatedWorkbookWords?: number;
  macroTargetWords?: number;
  generatedWorkbookCount?: number;
  totalWorkbookBlocks?: number;
  blockWordCountDetails?: string[];
  semestralThresholdMet?: boolean;
  semestralReady?: boolean;
  generatingSeqBlock?: number | null;
  editingSeqBlock?: number | null;
  expandedSeqBlock?: number | null;
  blockWorkbooks?: Record<number, any>;
  editedSessions?: Record<number, any>;
  handleGenerateSecuencia?: (blockIdx: number) => Promise<void>;
  setExpandedSeqBlock?: React.Dispatch<React.SetStateAction<number | null>>;
  handleSyncSuite?: (blockIdx: number) => Promise<void>;
  syncingSuite?: number | null;
  handleGenerateWorkbook?: (blockIdx: number) => Promise<void>;
  seqMessage?: { block: number; text: string; type: 'success' | 'error' } | null;
  handleSaveSecuencia?: (blockIdx: number) => Promise<void>;
  setEditingSeqBlock?: React.Dispatch<React.SetStateAction<number | null>>;
  handleStartEdit?: (blockIdx: number) => void;
  handleUpdateEditedSession?: (blockIndex: number, sessionIdx: number, field: any, val: any) => void;
}

export default function PlanningTabDocumento({
  planning,
  activeSubTab = 'planning',
  sequenceData = {},
  downloadingPdf = false,
  handleDownloadPdf,
  handleDownloadSecuenciaPdf = async () => {},
  downloadingSeqPdf = false,
  accumulatedWorkbookWords = 0,
  macroTargetWords = 0,
  generatedWorkbookCount = 0,
  totalWorkbookBlocks = 0,
  blockWordCountDetails = [],
  semestralThresholdMet = false,
  semestralReady = false,
  generatingSeqBlock = null,
  editingSeqBlock = null,
  expandedSeqBlock = null,
  blockWorkbooks = {},
  editedSessions = {},
  handleGenerateSecuencia = async () => {},
  setExpandedSeqBlock = () => {},
  handleSyncSuite = async () => {},
  syncingSuite = null,
  handleGenerateWorkbook = async () => {},
  seqMessage = null,
  handleSaveSecuencia = async () => {},
  setEditingSeqBlock = () => {},
  handleStartEdit = () => {},
  handleUpdateEditedSession = () => {},
}: PlanningTabDocumentoProps) {
  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;
  const activityLabel = isLaboral ? 'Actividades Clave' : 'Propósitos y Contenidos formativos';
  const prefix = isLaboral ? 'AC' : 'PC';
  const allBlocksGenerated = (generatedWorkbookCount === totalWorkbookBlocks && totalWorkbookBlocks > 0);

  if (activeSubTab === 'a4print') {
    return (
        <DocumentA4Viewer
          planning={{ ...planning, sequenceJson: sequenceData }}
          onDownloadDocx={() => {
            window.location.href = `/api/docx/${planning.id}`;
          }}
        />
    );
  }

  return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section I */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">I. Datos Generales y Administrativos</span>
            </div>
            <div className="section-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div><strong>Docente:</strong> {s1?.teacherName}</div>
                <div><strong>UAC/Ubicación:</strong> {s1?.uacName}</div>
                <div><strong>Semestre:</strong> {s1?.semester}° Semestre</div>
                <div><strong>Grupos:</strong> {s1?.groups}</div>
                <div><strong>Carga horaria:</strong> {s1?.totalHours} hrs.</div>
                <div><strong>Subsistema:</strong> {s1?.subsystem}</div>
              </div>
            </div>
          </div>

          {/* Section II */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">II. Propósito Formativo (Intencionalidad Curricular)</span>
            </div>
            <div className="section-card-body">
              <p style={{ marginBottom: '16px', lineHeight: 1.6 }}>{content?.sectionII?.purpose}</p>
              
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>Resultados de Aprendizaje:</p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginBottom: '16px' }}>
                {content?.sectionII?.learningOutcomes?.map((out, idx) => (
                  <li key={idx} style={{ marginBottom: '4px', fontSize: '14px' }}>{out}</li>
                ))}
              </ul>

              <p><strong>Vinculación PAEC:</strong></p>
              <p style={{ color: 'var(--c-text-2)', fontStyle: 'italic', fontSize: '14px' }}>
                {content?.sectionII?.paecConnection}
              </p>
            </div>
          </div>

          {/* Activities Dosificación Table */}
          {content?.sectionII?.activities && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Dosificación de Actividades Clave y Tiempos</span>
              </div>
              <div className="section-card-body" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>{activityLabel}</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Corte de Evaluación</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.sectionII.activities.map((a, i) => (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)',
                          borderBottom: '1px solid var(--c-border)',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--c-text)' }}>{a.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 12px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '12px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--c-accent-bright)',
                            border: '1px solid var(--c-accent-border)',
                          }}>
                            {a.corte || 'Corte ' + (i + 1)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--c-text)' }}>{a.hours} hrs.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section IV: Secuencia Didáctica Completa por Momentos Pedagógicos (Opción A) */}
          <div className="section-card">
            <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span className="section-card-title">IV. Diseño de Secuencia Didáctica (Momentos Pedagógicos)</span>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-muted)' }}>
                  Eslabón Didáctico Micro: Sesiones de 50 min distribuidas en Apertura, Desarrollo y Cierre.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {Object.keys(sequenceData).length > 0 && (
                  <>
                    <a
                      href={`/api/docx/secuencia/${planning.id}`}
                      className="btn"
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid var(--c-accent-border)',
                        color: 'var(--c-accent-bright)',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Descargar solo la Secuencia Didáctica oficial en Word (.docx)"
                    >
                      <Download size={13} /> Secuencia (Word)
                    </a>
                    <button
                      type="button"
                      onClick={handleDownloadSecuenciaPdf}
                      disabled={downloadingSeqPdf}
                      className="btn"
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#f87171',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Descargar solo la Secuencia Didáctica oficial en PDF (.pdf)"
                    >
                      {downloadingSeqPdf ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />} Secuencia (PDF)
                    </button>
                  </>
                )}
                <span className="text-xs" style={{ background: 'var(--c-accent-subtle)', color: 'var(--c-accent-bright)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid var(--c-accent-border)' }}>
                  MCCEMS / DBEPA
                </span>
              </div>
            </div>

            <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ── BANNER MAESTRO SEMESTRAL (FASE 4: COMPILADOR SIN TOKENS IA) ── */}
              <div
                style={{
                  borderRadius: '12px',
                  padding: '18px 22px',
                  background: allBlocksGenerated
                    ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(49, 46, 129, 0.95) 50%, rgba(30, 58, 138, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  border: allBlocksGenerated
                    ? '1.5px solid rgba(167, 139, 250, 0.5)'
                    : '1px solid rgba(59, 130, 246, 0.25)',
                  boxShadow: allBlocksGenerated
                    ? '0 10px 30px -5px rgba(124, 58, 237, 0.35), 0 0 15px rgba(139, 92, 246, 0.2)'
                    : '0 4px 12px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span
                      style={{
                        background: allBlocksGenerated
                          ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'
                          : 'rgba(148, 163, 184, 0.15)',
                        color: allBlocksGenerated ? '#ffffff' : '#cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        border: allBlocksGenerated
                          ? '1px solid rgba(196, 181, 253, 0.4)'
                          : '1px solid rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      <Library size={13} /> Compendio Semestral Maestro
                    </span>

                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: allBlocksGenerated ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.18)',
                        color: allBlocksGenerated ? '#34d399' : '#fcd34d',
                        border: allBlocksGenerated ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      {allBlocksGenerated ? `✓ ${generatedWorkbookCount} de ${totalWorkbookBlocks} Bloques Listos` : `${generatedWorkbookCount} de ${totalWorkbookBlocks} Bloques Listos`}
                    </span>

                    <span
                      style={{
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#94a3b8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      ⚡ 0 Tokens IA (Ensamblado Instantáneo)
                    </span>
                  </div>

                  <h3 style={{ margin: '4px 0 6px', fontSize: '17px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                    Libro de Texto Semestral Consolidado (~150-200 Páginas)
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, maxWidth: '650px' }}>
                    {semestralReady && semestralThresholdMet
                      ? '¡Todos los bloques del semestre están generados y cumplen la meta macro oficial! Descarga el libro maestro unificado con numeración continua, índice consolidado y portadas oficiales SEP/DBEPA.'
                      : semestralReady
                      ? `Todos los bloques han sido generados con un volumen de ${accumulatedWorkbookWords.toLocaleString()} palabras (meta recomendada: ${macroTargetWords.toLocaleString()}). La descarga del compendio unificado está disponible.`
                      : `Genera los libros individuales de cada bloque a continuación (${generatedWorkbookCount}/${totalWorkbookBlocks} listos). Al completar todos los bloques se desbloqueará la descarga del Libro Maestro Semestral.`}
                  </p>

                  {/* Detalle de palabras por bloque */}
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#93c5fd' }}>Volumen por bloque:</span>
                    <span>{blockWordCountDetails.join(' · ')}</span>
                    <span style={{
                      fontWeight: 700,
                      color: semestralThresholdMet ? '#34d399' : '#fcd34d',
                      background: semestralThresholdMet ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: semestralThresholdMet ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                    }}>
                      Total: {accumulatedWorkbookWords.toLocaleString()} / {macroTargetWords.toLocaleString()} palabras ({Math.min(100, Math.round((accumulatedWorkbookWords / macroTargetWords) * 100))}%)
                    </span>
                  </div>
                </div>

                {/* Botones de Descarga Semestral */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {semestralReady ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                      {!semestralThresholdMet && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}>
                          ⚠️ Volumen parcial (&lt; {macroTargetWords.toLocaleString()} palabras) — Descarga habilitada
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a
                          href={`/api/docx/libro-semestral/${planning.id}`}
                          download
                          className="btn"
                          style={{
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                          title="Descargar Libro Maestro Semestral completo en Word (.docx)"
                        >
                          <Download size={15} /> Compendio Semestral (Word)
                        </a>
                        <a
                          href={`/api/pdf/libro-semestral/${planning.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                          title="Descargar o ver Libro Maestro Semestral completo en PDF (.pdf)"
                        >
                          <Download size={15} /> Compendio Semestral (PDF)
                        </a>
                        <a
                          href={`/api/sacrint/manifest/${planning.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                          title="Descargar Manifiesto Institucional de Curso para SACRINT_SYSTEMS (.json)"
                        >
                          <Download size={15} /> Manifiesto SACRINT (JSON)
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', opacity: 0.5, cursor: 'not-allowed' }}>
                      <button
                        disabled
                        className="btn"
                        style={{
                          padding: '8px 14px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          cursor: 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Download size={14} /> Semestral Word ({generatedWorkbookCount}/{totalWorkbookBlocks})
                      </button>
                      <button
                        disabled
                        className="btn"
                        style={{
                          padding: '8px 14px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          cursor: 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Download size={14} /> Semestral PDF ({generatedWorkbookCount}/{totalWorkbookBlocks})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {content?.sectionIV?.activities?.map((a, i) => {
                const seq = sequenceData[i];
                const hasSeq = Boolean(seq && seq.sessions && seq.sessions.length > 0);
                const isGenerating = generatingSeqBlock === i;
                const isEditing = editingSeqBlock === i;
                const isExpanded = expandedSeqBlock === i;
                const wbItem = blockWorkbooks[i];
                const sessionsList: SecuenciaSesion[] = isEditing
                  ? (editedSessions[i] || seq?.sessions || [])
                  : (seq?.sessions || []);

                const aperturaCount = sessionsList.filter(s => s.phase === 'Apertura').length;
                const desarrolloCount = sessionsList.filter(s => s.phase === 'Desarrollo').length;
                const cierreCount = sessionsList.filter(s => s.phase === 'Cierre').length;

                return (
                  <div
                    key={i}
                    style={{
                      border: '1px solid var(--c-border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--c-bg-surface)',
                    }}
                  >
                    {/* Block Header */}
                    <div
                      style={{
                        padding: '14px 18px',
                        background: i % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)',
                        borderBottom: isExpanded ? '1px solid var(--c-border)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '15px', color: 'var(--c-accent-bright)' }}>
                            {prefix}{i + 1}: {a.name}
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                            ({a.hours} hrs. — <em style={{ color: 'var(--c-accent-bright)' }}>{a.methodology}</em>)
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {hasSeq ? (
                            <span style={{ fontSize: '11.5px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={13} /> Secuencia Didáctica Micro ({seq.sessions.length} sesiones de 50 min)
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              ⏳ Secuencia Micro Pendiente
                            </span>
                          )}

                          {wbItem?.workbook ? (
                            <span style={{ fontSize: '11.5px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <BookOpen size={12} /> Libro de Bloque Listo
                            </span>
                          ) : wbItem?.generating ? (
                            <span style={{ fontSize: '11.5px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RefreshCw size={12} className="animate-spin" /> Generando Libro
                            </span>
                          ) : null}

                          {a.saberes && (
                            <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                              • Taxonomía 3 Saberes activa
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isGenerating ? (
                          <button
                            type="button"
                            disabled
                            className="btn animate-pulse-subtle"
                            style={{
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                              color: '#ffffff',
                              border: '1px solid rgba(59, 130, 246, 0.5)',
                              borderRadius: '6px',
                              cursor: 'wait',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 0 14px rgba(37, 99, 235, 0.45)',
                            }}
                          >
                            <span
                              className="spinner"
                              style={{
                                width: '13px',
                                height: '13px',
                                borderWidth: '2px',
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderTopColor: '#ffffff',
                                animation: 'spin 0.7s linear infinite',
                              }}
                            />
                            <span>Diseñando sesiones con IA…</span>
                            <span style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 500 }}>(espera ~15-20s)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (hasSeq) {
                                if (confirm(`¿Deseas volver a generar la secuencia didáctica del Bloque ${i + 1} con IA? Se consumirán tokens de IA y se actualizarán las ${a.hours} sesiones.`)) {
                                  handleGenerateSecuencia(i);
                                }
                              } else {
                                handleGenerateSecuencia(i);
                              }
                            }}
                            className="btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: hasSeq ? 'var(--c-surface)' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                              color: hasSeq ? 'var(--c-text)' : '#fff',
                              border: hasSeq ? '1px solid var(--c-border)' : 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <Zap size={13} /> {hasSeq ? '🔄 Regenerar con IA' : '⚡ Generar Secuencia (IA)'}
                          </button>
                        )}

                        {hasSeq && (
                          <button
                            type="button"
                            onClick={() => setExpandedSeqBlock(prev => prev === i ? null : i)}
                            className="btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: 'var(--c-bg-surface)',
                              border: '1px solid var(--c-border)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Ocultar' : 'Ver Sesiones'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── CUADERNO DE TRABAJO ACTIVO POR BLOQUE (FASE 4) ── */}
                    <div
                      id={`workbook-card-${i}`}
                      style={{
                        margin: '12px 16px 14px',
                        padding: '14px 18px',
                        borderRadius: '10px',
                        background: wbItem?.workbook
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)'
                          : wbItem?.generating
                          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 41, 59, 0.6) 100%)'
                          : 'rgba(15, 23, 42, 0.5)',
                        border: wbItem?.workbook
                          ? '1px solid rgba(16, 185, 129, 0.35)'
                          : wbItem?.generating
                          ? '1px solid rgba(59, 130, 246, 0.4)'
                          : '1px solid rgba(59, 130, 246, 0.2)',
                        boxShadow: wbItem?.generating
                          ? '0 0 16px rgba(59, 130, 246, 0.2)'
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: '260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <BookOpen size={12} /> Libro de Bloque (35-80 págs)
                            </span>
                            <strong style={{ fontSize: '14px', color: '#f1f5f9' }}>
                              Cuaderno de Trabajo Activo · {prefix}{i + 1}
                            </strong>

                            {wbItem?.workbook ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                }}
                              >
                                ✓ Generado (v{wbItem.version || 1}) · {wbItem.workbook.totalPages || (wbItem.workbook.missions?.length || 4) * 12} págs
                              </span>
                            ) : wbItem?.generating ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(59, 130, 246, 0.2)',
                                  color: '#60a5fa',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <RefreshCw size={11} className="animate-spin" /> Generando con IA...
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(148, 163, 184, 0.15)',
                                  color: '#94a3b8',
                                  border: '1px solid rgba(148, 163, 184, 0.25)',
                                }}
                              >
                                ⏳ Pendiente
                              </span>
                            )}

                            {wbItem?.workbook?.qualityScore !== undefined && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                  background: wbItem.workbook.qualityScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: wbItem.workbook.qualityScore >= 80 ? '#34d399' : '#fbbf24',
                                  border: `1px solid ${wbItem.workbook.qualityScore >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                }}
                              >
                                Calidad: {wbItem.workbook.qualityScore}/100
                              </span>
                            )}
                          </div>

                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                            Incluye 4 misiones didácticas completas, retos escalonados, renglones caligráficos, tablas vacías, código/diagramas y evaluación NEM.
                          </p>
                        </div>

                        {/* Acciones del Bloque */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {wbItem?.workbook ? (
                            <>
                              <a
                                href={`/api/docx/libro-bloque/${planning.id}?blockIndex=${i}`}
                                download
                                className="btn"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: 'rgba(37, 99, 235, 0.2)',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  color: '#93c5fd',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s',
                                }}
                                title="Descargar libro del bloque en Word (.docx)"
                              >
                                <Download size={13} /> Word (.docx)
                              </a>

                              <a
                                href={`/api/pdf/libro-bloque/${planning.id}?blockIndex=${i}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s',
                                }}
                                title="Descargar o ver libro del bloque en PDF (.pdf)"
                              >
                                <Download size={13} /> PDF (.pdf)
                              </a>

                              <button
                                type="button"
                                onClick={() => handleSyncSuite(i)}
                                disabled={syncingSuite === i}
                                className="btn"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: '#6ee7b7',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s',
                                }}
                                title="Sincronizar Suite (24 Planes de Clase, Rúbricas y Materiales Didácticos)"
                              >
                                <FileText size={13} /> {syncingSuite === i ? '⏳ Sincronizando Suite…' : '📑 Suite (24 Planes)'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Regenerar el Libro de Trabajo del Bloque ${i + 1}? Se volverán a ejecutar los 4 redactores concurrentes con IA.`)) {
                                    handleGenerateWorkbook(i);
                                  }
                                }}
                                disabled={wbItem.generating}
                                className="btn"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                  color: '#94a3b8',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Volver a generar este libro de bloque con IA"
                              >
                                <RefreshCw size={12} /> Regenerar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerateWorkbook(i)}
                              disabled={wbItem?.generating}
                              className="btn"
                              style={{
                                padding: '7px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                background: wbItem?.generating
                                  ? 'rgba(59, 130, 246, 0.3)'
                                  : 'linear-gradient(135deg, #059669 0%, #2563eb 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: wbItem?.generating ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: wbItem?.generating ? 'none' : '0 3px 10px rgba(5, 150, 105, 0.35)',
                                transition: 'all 0.15s',
                              }}
                            >
                              {wbItem?.generating ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" /> Generando...
                                </>
                              ) : (
                                <>
                                  <Zap size={13} /> Generar Libro de Bloque (IA)
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Barra de progreso en vivo durante la generación */}
                      {wbItem?.generating && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '11.5px' }}>
                            <span style={{ color: '#93c5fd', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <RefreshCw size={12} className="animate-spin text-blue-400" />
                              {wbItem.progress?.currentStep || 'Escribiendo misiones didácticas con IA...'}
                            </span>
                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                              {wbItem.progress?.percent || 15}%
                            </span>
                          </div>
                          <div
                            style={{
                              height: '8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(5, Math.min(100, wbItem.progress?.percent || 15))}%`,
                                background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)',
                                borderRadius: '4px',
                                transition: 'width 0.4s ease-in-out',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Mensaje de error si falla */}
                      {wbItem?.error && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '8px 12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '6px',
                            color: '#f87171',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <AlertTriangle size={14} />
                          <span>{wbItem.error}</span>
                          <button
                            onClick={() => handleGenerateWorkbook(i)}
                            style={{
                              marginLeft: 'auto',
                              background: 'none',
                              border: 'underline',
                              color: '#fca5a5',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            Reintentar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Block Body Content */}
                    {isExpanded && (
                      <div style={{ padding: '16px 18px', background: 'var(--c-bg-surface)' }}>
                        {/* Feedback message banner */}
                        {seqMessage && seqMessage.block === i && (
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: '6px',
                              marginBottom: '14px',
                              fontSize: '13px',
                              background: seqMessage.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                              color: seqMessage.type === 'success' ? '#34d399' : '#fb7185',
                              border: `1px solid ${seqMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                            }}
                          >
                            {seqMessage.text}
                          </div>
                        )}

                        {hasSeq ? (
                          <>
                            {/* Summary & Edit Toolbar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: 'rgba(3,105,161,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(56,189,248,0.3)' }}>
                                  Apertura: {aperturaCount} ses.
                                </span>
                                <span style={{ fontSize: '11px', background: 'rgba(21,128,61,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(74,222,128,0.3)' }}>
                                  Desarrollo: {desarrolloCount} ses.
                                </span>
                                <span style={{ fontSize: '11px', background: 'rgba(126,34,206,0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(192,132,252,0.3)' }}>
                                  Cierre: {cierreCount} ses.
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', alignSelf: 'center' }}>
                                  Total: {sessionsList.length} sesiones de 50 min
                                </span>
                              </div>

                              <div>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveSecuencia(i)}
                                      className="btn btn-primary"
                                      style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, background: '#16a34a', border: 'none', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}
                                    >
                                      💾 Guardar Cambios
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSeqBlock(null)}
                                      className="btn"
                                      style={{ padding: '5px 10px', fontSize: '12px', background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)', borderRadius: '5px', cursor: 'pointer' }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(i)}
                                    className="btn"
                                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', borderRadius: '5px', cursor: 'pointer' }}
                                  >
                                    ✏️ Editar Sesiones
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Sessions Table */}
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                <thead>
                                  <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Sesión / Fase</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>Título Situado</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '220px' }}>Rol del Docente</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '220px' }}>Rol del Estudiante</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '160px' }}>Evidencia Formativa</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px' }}>Evaluación</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionsList.map((s, sIdx) => {
                                    const phaseColor =
                                      s.phase === 'Apertura'
                                        ? { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' }
                                        : s.phase === 'Cierre'
                                        ? { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' }
                                        : { bg: '#dcfce7', text: '#15803d', border: '#86efac' };

                                    return (
                                      <tr
                                        key={sIdx}
                                        style={{
                                          background: sIdx % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)',
                                          borderBottom: '1px solid var(--c-border)',
                                        }}
                                      >
                                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                                          <div style={{ fontWeight: 700, fontSize: '12px' }}>S{s.sessionNum}</div>
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              marginTop: '4px',
                                              fontSize: '10px',
                                              padding: '1px 6px',
                                              borderRadius: '10px',
                                              fontWeight: 600,
                                              background: phaseColor.bg,
                                              color: phaseColor.text,
                                              border: `1px solid ${phaseColor.border}`,
                                            }}
                                          >
                                            {s.phase}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={s.title}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'title', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ fontWeight: 600, color: 'var(--c-accent-bright)' }}>{s.title}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <textarea
                                              value={s.teachingActivity}
                                              rows={2}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'teachingActivity', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ lineHeight: 1.4, color: 'var(--c-text-2)' }}>{s.teachingActivity}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <textarea
                                              value={s.learningActivity}
                                              rows={2}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'learningActivity', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ lineHeight: 1.4, color: 'var(--c-text)' }}>{s.learningActivity}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={s.evidence || ''}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'evidence', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ fontSize: '11.5px', color: 'var(--c-text-muted)' }}>{s.evidence || '—'}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={s.evaluation || ''}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'evaluation', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ fontSize: '11.5px', color: 'var(--c-text-muted)' }}>{s.evaluation || 'Formativa continua'}</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--c-bg-surface)', borderRadius: '8px', border: '1px dashed var(--c-border-accent)' }}>
                            <p style={{ fontWeight: 600, color: 'var(--c-accent-bright)', marginBottom: '6px' }}>
                              ⚡ Secuencia Didáctica Micro no generada para este bloque
                            </p>
                            <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.5 }}>
                              Usa el botón <strong>&quot;Generar Secuencia (IA)&quot;</strong> en el encabezado del bloque para generar las {a.hours} sesiones de 50 minutos con momentos didácticos (Apertura, Desarrollo, Cierre).
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
  );
}
