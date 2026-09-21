/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import type { Planning } from '@/types/planning';

export interface PlanningTabAuditoriaProps {
  planning: Planning;
  auditReport: any | null;
  auditLoading: boolean;
  auditError: string | null;
  auditLoaded: boolean;
  expandedDimension: string | null;
  setExpandedDimension: React.Dispatch<React.SetStateAction<string | null>>;
  handleRunAudit: () => Promise<void> | void;
  handleReAudit: () => Promise<void> | void;
}

export default function PlanningTabAuditoria({
  auditReport,
  auditLoading,
  auditError,
  auditLoaded,
  expandedDimension,
  setExpandedDimension,
  handleRunAudit: _handleRunAudit,
  handleReAudit,
}: PlanningTabAuditoriaProps) {
  return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '8px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--c-navy)', margin: 0 }}>📊 Auditoría Pedagógica IA</h2>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                Evaluación automática en 4 dimensiones MCCEMS · Motor v2 · SEMS
              </p>
            </div>
            {auditLoaded && !auditLoading && (
              <button
                onClick={handleReAudit}
                style={{
                  padding: '9px 18px', fontSize: '13px', fontWeight: 600,
                  background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: '8px',
                  color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                🔄 Re-auditar
              </button>
            )}
          </div>

          {/* Loading */}
          {auditLoading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '16px', padding: '60px 20px', background: 'var(--c-bg-surface)', borderRadius: '12px',
              border: '1px dashed var(--c-border-2)',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: '4px solid var(--c-border-2)', borderTopColor: 'var(--c-accent)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: '15px', color: 'var(--c-text-muted)', fontWeight: 500, margin: 0 }}>
                Analizando planeación contra el programa oficial SEP…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {!auditLoading && auditError && (
            <div style={{
              padding: '20px 24px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
              borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '22px' }}>❌</span>
              <div>
                <div style={{ fontWeight: 700, color: '#fb7185', fontSize: '14px' }}>Error al ejecutar la auditoría</div>
                <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '4px' }}>{auditError}</div>
                <button
                  onClick={handleReAudit}
                  style={{
                    marginTop: '12px', padding: '7px 16px', fontSize: '13px', fontWeight: 600,
                    background: '#be123c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Audit Results */}
          {!auditLoading && !auditError && auditReport && (() => {
            const score: number = auditReport.overall_score ?? 0;
            const level: string = auditReport.compliance_level ?? 'requiere_mejora';
            const scoreColor = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fb923c' : '#f87171';
            const scoreBg = score >= 80 ? 'rgba(16, 185, 129, 0.12)' : score >= 60 ? 'rgba(245, 158, 11, 0.12)' : score >= 40 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(244, 63, 94, 0.12)';
            const levelLabel: Record<string, string> = {
              excelente: '🏆 Excelente',
              satisfactorio: '✅ Satisfactorio',
              requiere_mejora: '⚠️ Requiere Mejora',
              no_alineado: '❌ No Alineado',
            };
            const dimLabel: Record<string, string> = {
              propositos_alineacion: '1. Alineación con Propósitos Formativos',
              cobertura_contenidos: '2. Cobertura de Contenidos Temáticos',
              secuenciacion_logica: '3. Secuenciación Lógica y Momentos Didácticos',
              adecuacion_evidencias: '4. Adecuación de Evidencias e Instrumentos',
            };
            const statusIcon: Record<string, string> = { cumple: '✅', parcial: '⚠️', no_cumple: '❌' };
            const dimScores = auditReport.dimension_scores || {};
            const findings = auditReport.findings || {};
            const recommendations: any[] = auditReport.recommendations || [];
            const sevColor: Record<string, string> = { alta: '#f43f5e', media: '#f59e0b', baja: '#10b981' };

            return (
              <>
                {/* Score Card */}
                <div style={{
                  display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap',
                  padding: '24px', borderRadius: '14px', background: scoreBg,
                  border: `2px solid ${scoreColor}33`,
                }}>
                  {/* Circular score */}
                  <div style={{
                    position: 'relative', width: '100px', height: '100px', flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="10"
                        strokeDasharray={`${(score / 100) * 263.9} 263.9`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '24px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
                      <span style={{ fontSize: '11px', color: scoreColor, fontWeight: 600 }}>/ 100</span>
                    </div>
                  </div>

                  {/* Level + meta */}
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: scoreColor }}>
                      {levelLabel[level] || level}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--c-text)', marginTop: '4px' }}>
                      {auditReport.uac_name} · {auditReport.semester}° Semestre
                    </div>
                    {auditReport.created_at && (
                      <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '6px' }}>
                        Auditado: {new Date(auditReport.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* Mini dimension bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px', flex: 1 }}>
                    {Object.entries(dimScores).map(([key, dim]: [string, any]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', width: '14px', textAlign: 'center' }}>
                          {statusIcon[dim.status] || '⚠️'}
                        </span>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${dim.score}%`, height: '100%',
                            background: dim.score >= 80 ? '#10b981' : dim.score >= 60 ? '#f59e0b' : '#f43f5e',
                            borderRadius: '99px', transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text)', width: '28px', textAlign: 'right' }}>
                          {dim.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dimension Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>Detalle por Dimensión</h3>
                  {Object.entries(dimScores).map(([key, dim]: [string, any]) => {
                    const isExpanded = expandedDimension === key;
                    const dimScore: number = dim.score ?? 0;
                    const dimColor = dimScore >= 80 ? '#34d399' : dimScore >= 60 ? '#fbbf24' : '#f87171';
                    const dimBg = dimScore >= 80 ? 'rgba(16, 185, 129, 0.08)' : dimScore >= 60 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(244, 63, 94, 0.08)';
                    return (
                      <div key={key} style={{ border: `1px solid ${dimColor}33`, borderRadius: '10px', overflow: 'hidden' }}>
                        <button
                          onClick={() => setExpandedDimension(isExpanded ? null : key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '14px 16px', background: dimBg, border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: '18px' }}>{statusIcon[dim.status] || '⚠️'}</span>
                          <span style={{ flex: 1, fontWeight: 700, fontSize: '14px', color: 'var(--c-text)' }}>
                            {dimLabel[key] || key}
                          </span>
                          <span style={{
                            fontSize: '16px', fontWeight: 900, color: dimColor,
                            background: `${dimColor}18`, borderRadius: '6px', padding: '2px 10px',
                          }}>
                            {dimScore}/100
                          </span>
                          <span style={{ color: 'var(--c-text-muted)', fontSize: '13px' }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: '14px 16px', background: 'var(--c-bg-elevated)', borderTop: `1px solid ${dimColor}22` }}>
                            <p style={{ fontSize: '13.5px', color: 'var(--c-text-2)', lineHeight: 1.6, margin: 0 }}>
                              {dim.feedback}
                            </p>
                            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700,
                                background: dim.status === 'cumple' ? 'rgba(16,185,129,0.15)' : dim.status === 'parcial' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                                color: dim.status === 'cumple' ? '#34d399' : dim.status === 'parcial' ? '#fcd34d' : '#fb7185',
                              }}>
                                {dim.status === 'cumple' ? 'Cumple' : dim.status === 'parcial' ? 'Cumple Parcialmente' : 'No Cumple'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>Ponderación: {Math.round((dim.weight ?? 0) * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Findings */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {/* Fortalezas */}
                  {findings.fortalezas?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#34d399', marginBottom: '10px' }}>✅ Fortalezas</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.fortalezas.map((f: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Desalineaciones */}
                  {findings.desalineaciones?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#fbbf24', marginBottom: '10px' }}>⚠️ Desalineaciones Detectadas</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.desalineaciones.map((d: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Omisiones */}
                  {findings.omisiones_detectadas?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#fb7185', marginBottom: '10px' }}>❌ Contenidos Omitidos</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.omisiones_detectadas.map((o: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Propósitos cubiertos */}
                  {findings.propositos_cubiertos?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#818cf8', marginBottom: '10px' }}>📌 Propósitos Cubiertos</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.propositos_cubiertos.map((p: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>🎯 Recomendaciones del Auditor</h3>
                    {recommendations.map((rec: any, i: number) => {
                      const sev: string = rec.severidad ?? 'media';
                      const bg = sev === 'alta' ? 'rgba(244,63,94,0.12)' : sev === 'media' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)';
                      const border = sev === 'alta' ? 'rgba(244,63,94,0.3)' : sev === 'media' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)';
                      return (
                        <div key={i} style={{
                          padding: '14px 16px', background: bg, border: `1px solid ${border}`,
                          borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'flex-start',
                        }}>
                          <span style={{
                            padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                            background: sevColor[sev] ?? '#f59e0b', color: '#fff', flexShrink: 0, marginTop: '1px',
                          }}>
                            {sev.toUpperCase()}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: 'var(--c-text-muted)', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {dimLabel[rec.dimension] || rec.dimension}
                            </div>
                            <div style={{ fontSize: '13.5px', color: 'var(--c-text)', lineHeight: 1.6 }}>{rec.mensaje}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
  );
}
