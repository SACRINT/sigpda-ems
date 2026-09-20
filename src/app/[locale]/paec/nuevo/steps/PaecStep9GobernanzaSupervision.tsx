'use client';

import type { PaecProject, PaecGobernanza, PaecInformeSupervision, PaecAuditCriterion } from '@/types/paec';

interface Props {
  project: PaecProject;
  projectId?: string | null;
  collapsedGobernanza: boolean;
  setCollapsedGobernanza: (v: boolean) => void;
  collapsedInforme: boolean;
  setCollapsedInforme: (v: boolean) => void;
  auditResult: any;
  loadingAudit: boolean;
  auditError: string | null;
  fetchAudit: (projectId: string) => void;
  auditFilter: 'all' | 'deficient';
  setAuditFilter: (v: 'all' | 'deficient') => void;
  showAuditDetails: boolean;
  setShowAuditDetails: (v: boolean) => void;
}

export default function PaecStep9GobernanzaSupervision({
  project,
  projectId,
  collapsedGobernanza,
  setCollapsedGobernanza,
  collapsedInforme,
  setCollapsedInforme,
  auditResult,
  loadingAudit,
  auditError,
  fetchAudit,
  auditFilter,
  setAuditFilter,
  showAuditDetails,
  setShowAuditDetails,
}: Props) {
  const gob: PaecGobernanza | undefined = project.fase4Gobernanza || undefined;
  const inf: PaecInformeSupervision | undefined = project.fase4InformeSupervision || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Secciones Colapsables de Paso 9 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 1. Gobernanza Escolar en 4 Niveles */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            onClick={() => setCollapsedGobernanza(!collapsedGobernanza)}
            style={{ padding: '14px 18px', background: 'rgba(99,102,241,0.22)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>👥</span>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#c7d2fe' }}>
                1. Gobernanza Escolar en 4 Niveles Institucionales
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {collapsedGobernanza ? '▶ Mostrar' : '▼ Ocultar'}
            </span>
          </div>

          {!collapsedGobernanza && (
            <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Grid 4 Niveles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#93c5fd', fontSize: '13px', marginBottom: '4px' }}>
                    Nivel 1: Coordinación Directiva
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                    Liderazgo institucional, asignación de recursos y vinculación oficial con dependencias externas.
                  </p>
                </div>

                <div style={{ padding: '12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: '13px', marginBottom: '4px' }}>
                    Nivel 2: Colegiado Docente
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                    Academias transversales, articulación de progresiones MCCEMS y evaluación formativa colegiada.
                  </p>
                </div>

                <div style={{ padding: '12px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#fde68a', fontSize: '13px', marginBottom: '4px' }}>
                    Nivel 3: Brigadas Estudiantiles
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                    Protagonismo juvenil, ejecución de trabajo de campo comunitario y documentación en bitácoras.
                  </p>
                </div>

                <div style={{ padding: '12px', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#fbcfe8', fontSize: '13px', marginBottom: '4px' }}>
                    Nivel 4: Red Comunitaria
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
                    Padres de familia, contraloría social y aliados vecinales para la sostenibilidad del cambio.
                  </p>
                </div>
              </div>

              {/* Calendario de Gobernanza */}
              {gob?.calendario && gob.calendario.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', color: '#c7d2fe', margin: '8px 0' }}>Calendario de Sesiones y Seguimiento:</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(99,102,241,0.25)', color: '#fff' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tipo de Sesión</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Frecuencia</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Participantes</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Objetivo Estratégico</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Evidencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gob.calendario.map((c, ci) => (
                          <tr key={ci} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.tipo}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#93c5fd' }}>{c.frecuencia}</td>
                            <td style={{ padding: '6px 8px' }}>{c.participantes}</td>
                            <td style={{ padding: '6px 8px' }}>{c.objetivo}</td>
                            <td style={{ padding: '6px 8px', color: '#6ee7b7' }}>{c.evidencia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preguntas Guía NEM */}
              {gob?.metodologiaEvaluacion?.preguntasGuiaNem && (
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
                  <h4 style={{ fontSize: '13px', color: '#a5b4fc', margin: '0 0 6px' }}>Preguntas Guía NEM de Evaluación Formativa:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', fontSize: '12px' }}>
                    <div><strong>¿Dónde estamos?:</strong> {gob.metodologiaEvaluacion.preguntasGuiaNem.dondeEstamos}</div>
                    <div><strong>¿Hacia dónde vamos?:</strong> {gob.metodologiaEvaluacion.preguntasGuiaNem.haciaDondeVamos}</div>
                    <div><strong>¿Cómo superamos?:</strong> {gob.metodologiaEvaluacion.preguntasGuiaNem.comoSuperamos}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Informe Final de Supervisión (Guía 004) */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            onClick={() => setCollapsedInforme(!collapsedInforme)}
            style={{ padding: '14px 18px', background: 'rgba(14,165,233,0.22)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#7dd3fc' }}>
                2. Informe Final de Supervisión Escolar (Guía Oficial 004)
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {collapsedInforme ? '▶ Mostrar' : '▼ Ocultar'}
            </span>
          </div>

          {!collapsedInforme && (
            <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {inf ? (
                <>
                  {/* Resumen Ejecutivo */}
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', borderLeft: '3px solid #0ea5e9' }}>
                    <strong style={{ color: '#7dd3fc' }}>Resumen Ejecutivo de la Supervisión:</strong>
                    <p style={{ margin: '6px 0 0', lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>
                      {inf.resumenEjecutivo}
                    </p>
                  </div>

                  {/* Tabla de Metas vs Logros */}
                  {inf.metasVsLogros && inf.metasVsLogros.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '14px', color: '#7dd3fc', margin: '0 0 8px' }}>
                        Tabla Comparativa: Metas Planteadas vs Logros Obtenidos
                      </h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                              <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Meta Planteada</th>
                              <th style={{ padding: '6px 8px', textAlign: 'left', width: '25%' }}>Indicador de Verificación</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Línea Base (Pre)</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Resultado Final (Post)</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>% Cumplimiento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inf.metasVsLogros.map((m, mi) => (
                              <tr key={mi} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.meta}</td>
                                <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.8)' }}>{m.indicador}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#cbd5e1' }}>{m.programado}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#6ee7b7', fontWeight: 600 }}>{m.alcanzado}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                                    background: m.porcentaje >= 80 ? 'rgba(16,185,129,0.2)' : m.porcentaje >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                    color: m.porcentaje >= 80 ? '#34d399' : m.porcentaje >= 60 ? '#fbbf24' : '#f87171'
                                  }}>
                                    {m.porcentaje}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Indicadores Pre / Post Intervención */}
                  {inf.analisisPrePost && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                      <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Participación Total</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f4ff', marginTop: '2px' }}>{inf.analisisPrePost.participacionTotal}</div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Alcance Comunitario</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#93c5fd', marginTop: '2px' }}>{inf.analisisPrePost.alcanceComunitario}</div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Cambio de Conocimientos</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#6ee7b7', marginTop: '2px' }}>{inf.analisisPrePost.cambioConocimientos}</div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Desarrollo Competencias</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fde68a', marginTop: '2px' }}>{inf.analisisPrePost.desarrolloCompetencias}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Informe de supervisión disponible al generar la fase 9.</div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Tarjeta de Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM) */}
      <div style={{
        marginTop: '8px',
        padding: '24px',
        borderRadius: '12px',
        background: 'rgba(13,21,48,0.92)',
        border: `1px solid ${
          !auditResult ? 'rgba(255,255,255,0.15)' :
          ((auditResult as any).percentage ?? (auditResult as any).score ?? 0) >= 80 ? 'rgba(16, 185, 129, 0.45)' :
          ((auditResult as any).percentage ?? (auditResult as any).score ?? 0) >= 60 ? 'rgba(245, 158, 11, 0.45)' :
          'rgba(239, 68, 68, 0.45)'
        }`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>
        {/* Header de la Tarjeta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>📋</span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>
                Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM)
              </h3>
            </div>
            <p style={{ color: 'rgba(240,244,255,0.65)', fontSize: '13px', margin: '4px 0 0' }}>
              Evaluación integral de rigor normativo, FODA, transversalidad UAC, cronograma macro, plan de relevos y anexos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => projectId && fetchAudit(projectId)}
            disabled={loadingAudit}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#f0f4ff',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: loadingAudit ? 'not-allowed' : 'pointer'
            }}
            title="Volver a ejecutar auditoría de calidad"
          >
            {loadingAudit ? (
              <>
                <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Auditando...
              </>
            ) : (
              <>🔄 Re-auditar</>
            )}
          </button>
        </div>

        {/* Estado Cargando */}
        {loadingAudit && !auditResult && (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(240,244,255,0.7)' }}>
            <span className="spinner" style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ marginTop: '12px', fontSize: '14px' }}>Ejecutando evaluación de los 23 criterios DBEPA/NEM...</p>
          </div>
        )}

        {/* Estado Error */}
        {auditError && !auditResult && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '8px', color: '#fca5a5' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Error al obtener la auditoría:</div>
            <div style={{ fontSize: '13px' }}>{auditError}</div>
            <button
              type="button"
              onClick={() => projectId && fetchAudit(projectId)}
              className="btn btn-sm"
              style={{ marginTop: '10px', background: '#ef4444', color: '#fff', border: 'none' }}
            >
              Reintentar Auditoría
            </button>
          </div>
        )}

        {/* Visualización de Resultados */}
        {auditResult && (() => {
          const rawAudit = auditResult as any;
          const scorePct = Math.round(rawAudit.percentage ?? rawAudit.score ?? 0);
          const isGreen = scorePct >= 80;
          const isYellow = scorePct >= 60 && scorePct < 80;
          const isRed = scorePct < 60;

          const semaforoColor = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#ef4444';
          const semaforoBg = isGreen ? 'rgba(16, 185, 129, 0.12)' : isYellow ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
          const semaforoBorder = isGreen ? 'rgba(16, 185, 129, 0.4)' : isYellow ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';

          const statusTitle = (rawAudit.status || rawAudit.estatus) === 'aprobado_excelente'
            ? 'Aprobado con Excelencia'
            : (rawAudit.status || rawAudit.estatus) === 'aprobado'
            ? 'Aprobado'
            : 'Requiere Ajustes';

          const criteriaList: PaecAuditCriterion[] = rawAudit.criteria || rawAudit.criterios || [];
          const summary = rawAudit.summary || {
            passedCount: criteriaList.filter((c: PaecAuditCriterion) => c.status === 'pass').length,
            warningCount: criteriaList.filter((c: PaecAuditCriterion) => c.status === 'warning').length,
            failedCount: criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail').length,
          };
          const totalScore = rawAudit.totalScore ?? Math.round((scorePct / 100) * 92);

          const criteriaToRender: PaecAuditCriterion[] = auditFilter === 'deficient'
            ? criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail' || c.status === 'warning')
            : criteriaList;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Semáforo Visual & Bloque de Puntaje */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                alignItems: 'center',
                background: semaforoBg,
                border: `1px solid ${semaforoBorder}`,
                padding: '20px',
                borderRadius: '10px'
              }}>
                {/* Semáforo Físico & Puntaje Grande */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: '#090d1a',
                    padding: '8px 10px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
                  }}>
                    <div
                      title="Verde (≥80): Aprobado con Excelencia"
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isGreen ? '#10b981' : '#064e3b',
                        boxShadow: isGreen ? '0 0 12px #10b981, 0 0 4px #10b981' : 'none',
                        border: '1px solid rgba(0,0,0,0.5)',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <div
                      title="Amarillo (60-79): Aprobado con Observaciones"
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isYellow ? '#f59e0b' : '#78350f',
                        boxShadow: isYellow ? '0 0 12px #f59e0b, 0 0 4px #f59e0b' : 'none',
                        border: '1px solid rgba(0,0,0,0.5)',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <div
                      title="Rojo (<60): Requiere Ajustes"
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isRed ? '#ef4444' : '#7f1d1d',
                        boxShadow: isRed ? '0 0 12px #ef4444, 0 0 4px #ef4444' : 'none',
                        border: '1px solid rgba(0,0,0,0.5)',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '38px', fontWeight: 800, color: semaforoColor, lineHeight: 1 }}>
                        {scorePct}%
                      </span>
                      <span style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', fontWeight: 500 }}>
                        ({totalScore} / 92 pts)
                      </span>
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: semaforoColor,
                        color: '#fff',
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase'
                      }}>
                        {isGreen ? '🟢 ' : isYellow ? '🟡 ' : '🔴 '}
                        {statusTitle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 Contadores de Criterios */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{summary.passedCount}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase' }}>Cumple</div>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>{summary.warningCount}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase' }}>Advertencias</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>{summary.failedCount}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase' }}>Deficientes</div>
                  </div>
                </div>
              </div>

              {/* Controles de Filtro */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAuditFilter('all')}
                    className="btn btn-sm"
                    style={{
                      background: auditFilter === 'all' ? 'var(--c-blue-mid)' : 'rgba(255,255,255,0.06)',
                      color: auditFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '12px'
                    }}
                  >
                    Todos ({criteriaList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter('deficient')}
                    className="btn btn-sm"
                    style={{
                      background: auditFilter === 'deficient' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)',
                      color: auditFilter === 'deficient' ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      fontSize: '12px'
                    }}
                  >
                    Observados ({summary.warningCount + summary.failedCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAuditDetails(!showAuditDetails)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}
                >
                  {showAuditDetails ? '▲ Ocultar Lista' : '▼ Mostrar Lista Detallada'}
                </button>
              </div>

              {/* Lista Detallada de Criterios */}
              {showAuditDetails && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {criteriaToRender.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', color: '#6ee7b7' }}>
                      🎉 ¡Excelente! No se encontraron criterios deficientes ni advertencias en este proyecto.
                    </div>
                  ) : (
                    criteriaToRender.map((c) => {
                      const isPass = c.status === 'pass';
                      const isWarn = c.status === 'warning';
                      const cardBorder = isPass ? 'rgba(16,185,129,0.3)' : isWarn ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
                      const cardBg = isPass ? 'rgba(16,185,129,0.05)' : isWarn ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)';
                      const badgeBg = isPass ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';

                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            background: cardBg,
                            border: `1px solid ${cardBorder}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '13px' }}>
                                Criterio {c.id}: {c.name}
                              </span>
                              <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.5)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                {c.dimension}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.7)' }}>
                                Puntaje: <strong>{c.score}/4</strong> ({c.expectedLevel})
                              </span>
                              <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '10px', background: badgeBg, color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
                                {isPass ? 'Cumple' : isWarn ? 'Advertencia' : 'Deficiente'}
                              </span>
                            </div>
                          </div>

                          <div style={{ fontSize: '12.5px', color: 'rgba(240,244,255,0.85)', lineHeight: 1.4 }}>
                            <strong style={{ color: isPass ? '#6ee7b7' : isWarn ? '#fde68a' : '#fca5a5' }}>Feedback: </strong>
                            {c.feedback}
                          </div>

                          <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>
                            <strong>Evidencia encontrada: </strong>{c.evidenceFound}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
