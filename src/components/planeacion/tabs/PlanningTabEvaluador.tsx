'use client';

import React, { useMemo } from 'react';
import type { Planning } from '@/types/planning';
import { evaluatePlanningQuality, PlanningQualityReport } from '@/lib/planning/quality-pipeline';

export interface EvaluadorCriterio {
  criterio: string;
  categoria?: string;
  puntajeObtenido?: number;
  puntajeMax?: number;
  cumple?: 'SI' | 'PARCIAL' | 'NO' | string;
  observacion?: string;
}

export interface PlanningEvaluationResult {
  puntajeTotal: number;
  puntajeMaximo: number;
  porcentaje?: number;
  nivelCumplimiento?: 'COMPLETO' | 'PARCIAL' | 'INSUFICIENTE' | string;
  rubricaUsada?: string;
  puntosFuertes?: string[];
  mejorasUrgentes?: string[];
  criterios?: EvaluadorCriterio[];
  retroalimentacionDocente?: string;
  alineacionPaecPec?: string;
  [key: string]: unknown;
}

export interface PlanningTabEvaluadorProps {
  planning: Planning;
  evalResult: PlanningEvaluationResult | null;
  evalLoading: boolean;
  evalError: string | null;
  handleRunEvaluacion: (forceReeval?: boolean) => Promise<void> | void;
}

export default function PlanningTabEvaluador({
  planning,
  evalResult,
  evalLoading,
  evalError,
  handleRunEvaluacion,
}: PlanningTabEvaluadorProps) {
  const qualityReport = useMemo<PlanningQualityReport | null>(() => {
    if (!planning?.contentJson) return null;
    try {
      return evaluatePlanningQuality(planning);
    } catch {
      return null;
    }
  }, [planning]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 1. Quality Pipeline MCCEMS 2026-2027 ── */}
      {qualityReport && (
        <div className="section-card" style={{ border: '1px solid var(--c-border)' }}>
          <div
            className="section-card-header"
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="section-card-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛡️ Control de Calidad Pedagógica MCCEMS 2026-2027
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '9999px',
                background:
                  qualityReport.status === 'excelente'
                    ? '#10b981'
                    : qualityReport.status === 'aprobada'
                    ? '#3b82f6'
                    : qualityReport.status === 'requiere_ajustes'
                    ? '#f59e0b'
                    : '#ef4444',
                color: '#fff',
                textTransform: 'uppercase',
              }}
            >
              {qualityReport.status.replace('_', ' ')} • {qualityReport.score}/100
            </span>
          </div>

          <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Reto Situado 4/4 */}
              <div style={{ background: 'var(--c-bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>🎯 Reto Situado (4/4)</span>
                  <span style={{ fontWeight: 800, color: qualityReport.checks.retoSituado.isValid ? '#10b981' : '#f59e0b' }}>
                    {qualityReport.checks.retoSituado.score}/4
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <span style={{ color: qualityReport.checks.retoSituado.details.hasInfinitiveVerb ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.retoSituado.details.hasInfinitiveVerb ? '✓' : '✗'} Verbo en infinitivo
                  </span>
                  <span style={{ color: qualityReport.checks.retoSituado.details.hasLocalContext ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.retoSituado.details.hasLocalContext ? '✓' : '✗'} Contexto local Puebla
                  </span>
                  <span style={{ color: qualityReport.checks.retoSituado.details.hasRealProblem ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.retoSituado.details.hasRealProblem ? '✓' : '✗'} Problemática comunitaria
                  </span>
                  <span style={{ color: qualityReport.checks.retoSituado.details.hasCurricularAlignment ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.retoSituado.details.hasCurricularAlignment ? '✓' : '✗'} Propósito curricular
                  </span>
                </div>
              </div>

              {/* Tres Saberes */}
              <div style={{ background: 'var(--c-bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>📚 Tres Saberes</span>
                  <span style={{ fontWeight: 800, color: qualityReport.checks.tresSaberes.isValid ? '#10b981' : '#f59e0b' }}>
                    {qualityReport.checks.tresSaberes.coverageScore}/3
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <span style={{ color: qualityReport.checks.tresSaberes.hasSaber ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.tresSaberes.hasSaber ? '✓' : '✗'} Saber (Teórico / Conceptual)
                  </span>
                  <span style={{ color: qualityReport.checks.tresSaberes.hasSaberHacer ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.tresSaberes.hasSaberHacer ? '✓' : '✗'} Saber Hacer (Práctico / Taller)
                  </span>
                  <span style={{ color: qualityReport.checks.tresSaberes.hasSaberSer ? '#10b981' : '#94a3b8' }}>
                    {qualityReport.checks.tresSaberes.hasSaberSer ? '✓' : '✗'} Saber Ser (Actitudinal / Ética)
                  </span>
                </div>
              </div>

              {/* Coherencia Metodológica */}
              <div style={{ background: 'var(--c-bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>⚙️ Metodología Activa</span>
                  <span style={{ fontWeight: 800, color: qualityReport.checks.coherenciaMetodologica.isValid ? '#10b981' : '#f59e0b' }}>
                    {qualityReport.checks.coherenciaMetodologica.score}%
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', margin: 0 }}>
                  <strong>Asignada:</strong> {qualityReport.checks.coherenciaMetodologica.metodologiaNombre}
                </p>
                <p style={{ fontSize: '11px', color: qualityReport.checks.coherenciaMetodologica.isValid ? '#10b981' : '#f59e0b', marginTop: '6px' }}>
                  {qualityReport.checks.coherenciaMetodologica.isValid ? '✓ Secuencia coherente y activa' : '⚠️ Detectada pasividad en fases'}
                </p>
              </div>

              {/* Horas por Corte */}
              <div style={{ background: 'var(--c-bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>⏱️ Horas por Corte</span>
                  <span style={{ fontWeight: 800, color: qualityReport.checks.horasPorCorte.isValid ? '#10b981' : '#3b82f6' }}>
                    {qualityReport.checks.horasPorCorte.plannedHours}h
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', margin: 0 }}>
                  Dosificación semestral en 3 cortes de evaluación curricular.
                </p>
                <p style={{ fontSize: '11px', color: qualityReport.checks.horasPorCorte.isValid ? '#10b981' : '#3b82f6', marginTop: '6px' }}>
                  {qualityReport.checks.horasPorCorte.isValid ? '✓ Horas balanceadas' : 'ℹ️ Distribución estándar aplicada'}
                </p>
              </div>
            </div>

            {qualityReport.feedback.length > 0 && (
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', padding: '12px 14px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', marginBottom: '6px' }}>
                  💡 Observaciones del Pipeline de Calidad:
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
                  {qualityReport.feedback.slice(0, 3).map((fb, idx) => (
                    <li key={idx}>{fb}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. Evaluador IA — Rúbrica Oficial Anexo 12 USICAMM ── */}
      <div className="section-card">
        <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)', color: '#fff' }}>
          <span className="section-card-title" style={{ color: '#fff' }}>🏅 Evaluador IA — Rúbrica Oficial Anexo 12 USICAMM</span>
        </div>
        <div className="section-card-body">
              {evalLoading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#dc2626' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                  <p style={{ fontWeight: 600 }}>Evaluando planeación con IA…</p>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Esto puede tardar 15-30 segundos. La IA analiza todos los criterios del Anexo 12.</p>
                </div>
              )}

              {evalError && (
                <div style={{ background: '#FEE2E2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', color: '#991b1b' }}>
                  <p style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Error al evaluar</p>
                  <p style={{ fontSize: '14px', margin: 0 }}>{evalError}</p>
                  <button
                    onClick={() => handleRunEvaluacion(true)}
                    style={{ marginTop: '12px', padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔄 Reintentar
                  </button>
                </div>
              )}

              {!evalResult && !evalLoading && !evalError && (
                <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--c-bg-surface)', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: '42px', marginBottom: '12px' }}>🏅</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '8px' }}>
                    Auditoría Oficial con IA (Anexo 12 USICAMM / MCCEMS)
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--c-text-muted)', maxWidth: '560px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                    Esta planeación aún no ha sido evaluada. La IA auditará los criterios pedagógicos oficiales, asignará puntuaciones cuantitativas fijas y emitirá dictamen de mejora.
                  </p>
                  <button
                    onClick={() => handleRunEvaluacion(false)}
                    style={{
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🚀 Iniciar Evaluación IA Ahora
                  </button>
                </div>
              )}

              {evalResult && !evalLoading && (
                <>
                  {/* Score hero */}
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', padding: '20px', background: 'var(--c-bg-surface)', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <div style={{
                        width: '96px', height: '96px', borderRadius: '50%', margin: '0 auto 8px',
                        background: `conic-gradient(${evalResult.nivelCumplimiento === 'COMPLETO' ? '#10b981' : evalResult.nivelCumplimiento === 'PARCIAL' ? '#f59e0b' : '#ef4444'} ${(evalResult.puntajeTotal / evalResult.puntajeMaximo) * 360}deg, var(--c-border) 0)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 0 8px var(--c-bg-surface) inset',
                      }}>
                        <div style={{ background: 'var(--c-card-bg)', borderRadius: '50%', width: '72px', height: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text)' }}>{evalResult.puntajeTotal}</span>
                          <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>/{evalResult.puntajeMaximo}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: evalResult.nivelCumplimiento === 'COMPLETO' ? '#10b981' : evalResult.nivelCumplimiento === 'PARCIAL' ? '#d97706' : '#dc2626' }}>
                        {evalResult.nivelCumplimiento === 'COMPLETO' ? '✅ COMPLETO' : evalResult.nivelCumplimiento === 'PARCIAL' ? '⚠️ PARCIAL' : '❌ REQUIERE CORRECCIÓN'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '8px' }}><strong>Rúbrica:</strong> {evalResult.rubricaUsada}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {evalResult.puntosFuertes?.slice(0, 3).map((pf: string, i: number) => (
                          <span key={i} style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>✓ {pf}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {evalResult.mejorasUrgentes?.slice(0, 3).map((m: string, i: number) => (
                          <span key={i} style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>⚡ {m}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('¿Deseas volver a auditar esta planeación con la IA? Se consumirán tokens de IA para regenerar la evaluación.')) {
                          handleRunEvaluacion(true);
                        }
                      }}
                      style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: '12px', fontWeight: 600, background: 'var(--c-bg-elevated)', color: 'var(--c-text)', border: '1px solid var(--c-border-2)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      🔄 Re-evaluar
                    </button>
                  </div>

                  {/* Criteria table */}
                  <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border-2)' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Criterio</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Categoría</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Pts</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Cumple</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.criterios?.map((cr: EvaluadorCriterio, idx: number) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--c-bg-surface)' : 'transparent', borderBottom: '1px solid var(--c-border)' }}>
                            <td style={{ padding: '9px 12px', color: 'var(--c-text)', fontWeight: 500 }}>{cr.criterio}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '12px' }}>{cr.categoria}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: cr.cumple === 'SI' ? '#10b981' : cr.cumple === 'PARCIAL' ? '#f59e0b' : '#f43f5e' }}>
                              {cr.puntajeObtenido}/{cr.puntajeMax}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{ background: cr.cumple === 'SI' ? 'rgba(16,185,129,0.15)' : cr.cumple === 'PARCIAL' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)', color: cr.cumple === 'SI' ? '#34d399' : cr.cumple === 'PARCIAL' ? '#fcd34d' : '#fb7185', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                                {cr.cumple}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', color: 'var(--c-text-muted)', fontSize: '12.5px' }}>{cr.observacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Retroalimentación */}
                  {evalResult.retroalimentacionDocente && (
                    <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ fontWeight: 700, color: 'var(--c-accent-bright)', marginBottom: '8px' }}>💬 Retroalimentación Docente</p>
                      <p style={{ fontSize: '14px', color: 'var(--c-text)', lineHeight: 1.7, margin: 0 }}>{evalResult.retroalimentacionDocente}</p>
                    </div>
                  )}
                  {evalResult.alineacionPaecPec && (
                    <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
                      <p style={{ fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>🌿 Alineación PAEC/PEC</p>
                      <p style={{ fontSize: '14px', color: 'var(--c-text)', lineHeight: 1.7, margin: 0 }}>{evalResult.alineacionPaecPec}</p>
                    </div>
                  )}
                </>
              )}

              {!evalLoading && !evalResult && !evalError && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: 'var(--c-text-muted)' }}>Iniciando evaluación automática…</p>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
