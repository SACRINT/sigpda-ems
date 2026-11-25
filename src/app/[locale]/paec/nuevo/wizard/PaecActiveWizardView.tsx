'use client';

import React from 'react';
import Link from 'next/link';
import type {
  PaecAuditCriterion,
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
} from '@/types/paec';
import {
  ALL_STEPS,
  getVisibleSteps,
  getRelativeStepNumber,
  canNavigateStep,
} from '@/lib/paec-steps';
import {
  PaecStep1Diagnostico,
  PaecStep2Justificacion,
  PaecStep3Mapeo,
  PaecStep4Cronograma,
  PaecStep5DetalleCurricular,
  PaecStep6PlanOpA,
  PaecStep7PlanOpB,
  PaecStep8Implementacion,
  PaecStep9GobernanzaSupervision,
} from '../steps';
import { PaecStepQualityAuditBadge } from '@/components/paec/PaecStepQualityAuditBadge';
import { CYCLE_LABELS } from './helpers';
import { PaecZonaModal } from './PaecZonaModal';
import type { PaecWizardController } from './usePaecWizardActions';

export function PaecActiveWizardView({ w }: { w: PaecWizardController }) {
  const {
    locale,
    projectId,
    project,
    generating,
    activeStep,
    setActiveStep,
    error,
    setError,
    errorType,
    retryCount,
    needsInputWarning,
    projectName,
    problemStatement,
    showFullProblem,
    setShowFullProblem,
    cycleType,
    isEditingContent,
    setIsEditingContent,
    editPayload,
    setEditPayload,
    auditResult,
    stepAudits,
    loadingAudit,
    auditError,
    showAuditDetails,
    setShowAuditDetails,
    auditFilter,
    setAuditFilter,
    showQGTooltip,
    setShowQGTooltip,
    collapsedCarta,
    setCollapsedCarta,
    collapsedMinuta,
    setCollapsedMinuta,
    collapsedOficios,
    setCollapsedOficios,
    activeAnexoTab,
    setActiveAnexoTab,
    collapsedGobernanza,
    setCollapsedGobernanza,
    collapsedInforme,
    setCollapsedInforme,
    fetchAudit,
    generateCurrentStep,
    getCurrentStepData,
    saveStepEdits,
  } = w;

  function isStepGenerated(s: number): boolean {
    if (!project) return false;
    switch (s) {
      case 1: return !!project.fase1Diagnostico;
      case 2: return !!project.fase2Justificacion;
      case 3: return !!(project.fase2Mapeo && project.fase2Mapeo.length > 0);
      case 4: return !!(project.fase2Cronograma && project.fase2Cronograma.length > 0);
      case 5: return !!(project.fase2DetalleCurricular && project.fase2DetalleCurricular.length > 0);
      case 6: return !!(project.fase3PlanOperativoA && project.fase3PlanOperativoA.length > 0) || !!(project.fase2PlanOperativo?.semestreA && project.fase2PlanOperativo.semestreA.length > 0);
      case 7: return !!(project.fase3PlanOperativoB && project.fase3PlanOperativoB.length > 0) || !!(project.fase2PlanOperativo?.semestreB && project.fase2PlanOperativo.semestreB.length > 0);
      case 8: return !!project.fase3Implementacion || !!project.fase2Anexos;
      case 9: return !!(project.fase4Gobernanza || project.fase4InformeSupervision);
      default: return false;
    }
  }

  const generated = isStepGenerated(activeStep);
  const visibleSteps = getVisibleSteps(cycleType);
  const currentStepIdx = visibleSteps.findIndex(s => s.num === activeStep);
  const prevStep = currentStepIdx > 0 ? visibleSteps[currentStepIdx - 1] : null;
  const nextStep = currentStepIdx >= 0 && currentStepIdx < visibleSteps.length - 1 ? visibleSteps[currentStepIdx + 1] : null;
  const isLastVisibleStep = currentStepIdx === visibleSteps.length - 1;
  const activeStepInfo = ALL_STEPS.find(s => s.num === activeStep) || ALL_STEPS[0];

  return (
    <div style={{ maxWidth: '1024px', margin: '0 auto', paddingBottom: '40px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Header */}
      <div className="page-header" style={{
        borderBottom: '1px solid var(--c-border)',
        paddingBottom: '16px',
        marginBottom: '24px',
        width: '100%',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word'
      }}>
        <Link href={`/${locale}/paec`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
          ← Volver a Proyectos
        </Link>
        <h1 className="page-title" style={{
          fontSize: '26px',
          fontWeight: 800,
          color: '#f0f4ff',
          lineHeight: 1.3,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          margin: '0 0 10px 0'
        }}>
          {projectName}
        </h1>

        {problemStatement && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginTop: '8px',
            marginBottom: '14px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📌 Problemática Comunitaria Detectada
              </span>
              {problemStatement.length > 220 && (
                <button
                  type="button"
                  onClick={() => setShowFullProblem(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#93c5fd',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    textDecoration: 'underline'
                  }}
                >
                  {showFullProblem ? 'Ver menos ▲' : 'Ver fundamentación completa ▼'}
                </button>
              )}
            </div>
            <p style={{
              color: 'rgba(240, 244, 255, 0.85)',
              fontSize: '13.5px',
              lineHeight: 1.6,
              margin: 0,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-line'
            }}>
              {showFullProblem || problemStatement.length <= 220
                ? problemStatement
                : `${problemStatement.slice(0, 220)}...`}
            </p>
          </div>
        )}

        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-semester" style={{ backgroundColor: 'var(--c-blue-mid)', color: '#fff' }}>
            {CYCLE_LABELS[cycleType]}
          </span>
          <span className="badge" style={{ backgroundColor: project?.status === 'completed' ? '#28a745' : '#ffc107', color: project?.status === 'completed' ? '#fff' : '#212529' }}>
            {project?.status === 'completed' ? 'Completado' : `Borrador — Paso ${getRelativeStepNumber(visibleSteps, activeStep)} de ${visibleSteps.length}`}
          </span>
          {Boolean(
            project?.status === 'completed' ||
            (cycleType === 'A'
              ? (project?.fase3Implementacion || project?.fase2Anexos || isStepGenerated(8))
              : (project?.fase4Gobernanza || project?.fase4InformeSupervision || isStepGenerated(9)))
          ) && (
            <a href={`/api/docx/paec/${projectId}`} className="btn btn-amber btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--c-amber)', color: '#fff', marginLeft: 'auto' }}>
              <span>↓</span> Descargar PEC Completo (DOCX)
            </a>
          )}
        </div>
      </div>

      {/* Horizontal Step Indicator */}
      <div className="step-wizard" style={{ marginBottom: '20px', maxWidth: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
        {visibleSteps.map((s, sIdx) => {
          const isDone = isStepGenerated(s.num);
          const isActive = s.num === activeStep;
          const canNavigate = canNavigateStep(visibleSteps, sIdx, isStepGenerated, project?.currentStep);
          return (
            <button
              key={s.num}
              onClick={() => {
                // Allowed to click any step that has been generated or is the current/next unlocked step
                if (canNavigate) {
                  setActiveStep(s.num);
                  setError(null);
                }
              }}
              className={`step-item ${isDone ? 'done' : isActive ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: canNavigate ? 'pointer' : 'not-allowed', outline: 'none' }}
              disabled={!canNavigate}
            >
              <div className="step-num">{isDone ? '✓' : s.num}</div>
              <span className="step-label" style={{ fontWeight: isActive ? 700 : 500 }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Quality Gate Visual (Debajo del Stepper) */}
      {project && (
        <div style={{
          marginBottom: '24px',
          background: 'rgba(13,21,48,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          padding: '14px 18px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          position: 'relative'
        }}>
          {auditResult ? (() => {
            const rawAudit = auditResult as unknown as Record<string, unknown>;
            const percentageVal = typeof rawAudit.percentage === 'number'
              ? rawAudit.percentage
              : typeof rawAudit.score === 'number'
              ? rawAudit.score
              : 0;
            const scorePct = Math.round(percentageVal);
            const isGreen = scorePct >= 80;
            const isYellow = scorePct >= 60 && scorePct < 80;
            const barColor = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#ef4444';
            const statusLabel = isGreen ? 'Excelente (≥80 pts)' : isYellow ? 'Regular (60-79 pts)' : 'Requiere Ajustes (<60 pts)';
            const rawCriteria = (rawAudit.criteria || rawAudit.criterios || []) as PaecAuditCriterion[];
            const criteriaList: PaecAuditCriterion[] = Array.isArray(rawCriteria) ? rawCriteria : [];
            const failedOrWarn = criteriaList.filter((c: PaecAuditCriterion) => c.status === 'fail' || c.status === 'warning');

            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🛡️</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#f0f4ff' }}>Quality Gate MCCEMS / NEM: </span>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: barColor }}>{scorePct}/100</span>
                      <span style={{ marginLeft: '8px', fontSize: '11.5px', padding: '2px 8px', borderRadius: '10px', background: `${barColor}22`, color: barColor, border: `1px solid ${barColor}55`, fontWeight: 600 }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowQGTooltip(!showQGTooltip)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '12px', color: failedOrWarn.length > 0 ? (isYellow ? '#fbbf24' : '#f87171') : '#34d399', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      {failedOrWarn.length > 0 ? `⚠️ ${failedOrWarn.length} Criterios Observados` : '✓ 23 Criterios Cumplidos'}
                      <span style={{ marginLeft: '4px', fontSize: '10px' }}>{showQGTooltip ? '▲ Ocultar' : '▼ Ver'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => projectId && fetchAudit(projectId)}
                      disabled={loadingAudit}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '6px', cursor: loadingAudit ? 'not-allowed' : 'pointer' }}
                      title="Actualizar evaluación del Quality Gate"
                    >
                      {loadingAudit ? '⏳...' : '🔄 Re-auditar'}
                    </button>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(5, scorePct))}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${barColor}, ${isGreen ? '#34d399' : isYellow ? '#fbbf24' : '#f87171'})`,
                    borderRadius: '4px',
                    transition: 'width 0.6s ease-in-out'
                  }} />
                </div>

                {/* Non-blocking Warning notice if < 80 */}
                {scorePct < 80 && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: isYellow ? '#fde68a' : '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>ℹ️</span>
                    <span>El proyecto tiene áreas de oportunidad según la rúbrica oficial MCCEMS ({failedOrWarn.length} observaciones). Puedes continuar avanzando o consultar los criterios señalados.</span>
                  </div>
                )}

                {/* Tooltip / Popover con desglose */}
                {showQGTooltip && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'rgba(8,12,28,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#f0f4ff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Desglose de Criterios MCCEMS / NEM ({criteriaList.length} evaluados):</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }} onClick={() => setShowQGTooltip(false)}>✕ Cerrar</span>
                    </div>
                    {failedOrWarn.length === 0 ? (
                      <div style={{ fontSize: '11.5px', color: '#34d399', padding: '6px 0' }}>
                        🎉 Todos los 23 criterios evaluados cumplen con la rúbrica MCCEMS/NEM.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {failedOrWarn.map((c: PaecAuditCriterion) => (
                          <div key={c.id} style={{
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: c.status === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            borderLeft: `3px solid ${c.status === 'fail' ? '#ef4444' : '#f59e0b'}`,
                            fontSize: '11.5px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f0f4ff', fontWeight: 600 }}>
                              <span>#{c.id} {c.name}</span>
                              <span style={{ color: c.status === 'fail' ? '#f87171' : '#fbbf24', fontSize: '10.5px' }}>
                                {c.status === 'fail' ? 'Deficiente (0-1 pt)' : 'Advertencia (2 pts)'}
                              </span>
                            </div>
                            <div style={{ color: 'rgba(240,244,255,0.75)', marginTop: '2px', fontSize: '11px' }}>
                              {c.feedback}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })() : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              <span>🛡️ Quality Gate MCCEMS / NEM: Evaluación disponible tras generar fases.</span>
              <button
                type="button"
                onClick={() => projectId && fetchAudit(projectId)}
                disabled={loadingAudit}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11.5px', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.15)', cursor: loadingAudit ? 'not-allowed' : 'pointer' }}
              >
                {loadingAudit ? 'Evaluando...' : 'Calcular Score'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Panel Content */}
      <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        
        {needsInputWarning && (
          <div
            data-testid="needs-input-banner"
            style={{
              backgroundColor: 'rgba(234,179,8,0.12)',
              color: '#fde047',
              border: '1px solid rgba(234,179,8,0.3)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Insumos Mínimos Requeridos (Regla B-001 Cero Invención)
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#fef08a' }}>
                  {needsInputWarning.message}
                </div>
                {needsInputWarning.missingFields.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#fef9c3' }}>
                    <span style={{ fontWeight: 600 }}>Campos no detectados: </span>
                    {needsInputWarning.missingFields.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  data-testid="bypass-needs-input-button"
                  onClick={() => generateCurrentStep(true)}
                  disabled={generating}
                  className="btn btn-secondary"
                  style={{
                    backgroundColor: 'rgba(234,179,8,0.25)',
                    borderColor: 'rgba(234,179,8,0.5)',
                    color: '#fef08a',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  ⚡ Generar de todas formas (Preliminar)
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div id="step1-error-banner" style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {errorType === 'timeout' && '⏳ Timeout de red'}
                  {errorType === 'json' && '⚠️ Respuesta IA malformada (JSON)'}
                  {errorType === 'rate_limit' && '🚦 Límite de API alcanzado'}
                  {errorType === 'network' && '📡 Error de conexión de red'}
                  {(!errorType || errorType === 'unknown') && '❌ Error al procesar la fase'}
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.5 }}>{error}</div>
                <div style={{ fontSize: '12px', color: 'rgba(251,113,133,0.8)', marginTop: '4px' }}>
                  Intentos realizados: {retryCount[activeStep] || 0} de 3
                </div>
              </div>
              {(retryCount[activeStep] || 0) < 3 ? (
                <button
                  type="button"
                  onClick={() => generateCurrentStep()}
                  disabled={generating}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#e11d48',
                    borderColor: '#be123c',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: generating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {generating ? (
                    <>
                      <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      Reintentando...
                    </>
                  ) : (
                    <>↻ Reintentar (Paso {activeStep})</>
                  )}
                </button>
              ) : (
                <div style={{ fontSize: '12px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px', color: '#fda4af' }}>
                  Límite de reintentos alcanzado (3/3)
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATE A: NOT GENERATED YET */}
        {!generated && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🤖</div>
            <h2 style={{ color: 'var(--c-navy)', marginBottom: '12px', fontSize: '22px', fontWeight: 600 }}>Paso {activeStep}: {activeStepInfo.label}</h2>
            <p style={{ color: 'var(--c-text-muted)', maxWidth: '560px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              {activeStep === 1 && 'La Inteligencia Artificial recopilará los datos de la comunidad y del plantel para estructurar las 4 tablas oficiales de diagnóstico y realizar el análisis FODA del proyecto.'}
              {activeStep === 2 && 'Se redactará la justificación formal del proyecto, los 5 pilares estratégicos de viabilidad, los propósitos integrales (educativo, social y funcional) y las metas del PEC.'}
              {activeStep === 3 && 'La IA cruzará las asignaturas activas de tus semestres seleccionados (Modelo de Relevos) con la problemática común para detallar los temas prácticos de aprendizaje transversal.'}
              {activeStep === 4 && 'Estructuración del plan macro dividiendo las etapas del proyecto escolar en 6 fases bimestrales ordenadas cronológicamente con asignaturas responsables y justificación pedagógica.'}
              {activeStep === 5 && 'Matriz de Detalle Curricular por Semestre: fundamentación curricular inquebrantable (propósitos formativos o progresiones de aprendizaje NOM-MCCEMS) y vinculación con fases para cada UAC.'}
              {activeStep === 6 && 'Desglose detallado del Plan Operativo Semestre A (16 semanas × 8 columnas) con actividades semanales, UACs, progresiones, metodologías activas e instrumentos de evaluación.'}
              {activeStep === 7 && 'Desglose del Plan Operativo Semestre B (16 semanas × 8 columnas) con continuidad metodológica por relevos y preparación de la muestra o feria de aprendizajes final.'}
              {activeStep === 8 && 'Fase de Implementación y Anexos: Carta de Convocatoria Comunitaria, Minuta de Arranque con firmas, 3 Oficios de Vinculación y los 6 anexos técnicos normativos con vista en tabs.'}
              {activeStep === 9 && 'Gobernanza Escolar e Informe de Supervisión: Estructura de gobernanza escolar en 4 niveles, Informe Final de Supervisión Escolar con tabla de Metas vs Logros (Pre/Post) y scorecard técnico.'}
            </p>

            <button
              onClick={() => generateCurrentStep()}
              disabled={generating}
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              {generating ? (
                <>
                  <span className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  Generando con Inteligencia Artificial (Toma unos segundos)...
                </>
              ) : (
                <>Generar Fase con IA ✨</>
              )}
            </button>
          </div>
        )}

        {/* STATE B: SUCCESSFULLY GENERATED CONTENT VIEW */}
        {generated && project && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)', paddingBottom: '14px', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', color: 'var(--c-navy)', margin: 0, fontWeight: 700 }}>
                {activeStepInfo.label} {isEditingContent ? '(Modo Edición)' : '(Contenido Generado)'}
              </h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {isEditingContent ? (
                  <>
                    <button
                      onClick={saveStepEdits}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '13px', backgroundColor: '#28a745', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      <span>💾</span> Guardar Cambios
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingContent(false);
                        setEditPayload(null);
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '13px', color: '#dc3545', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditPayload(getCurrentStepData());
                        setIsEditingContent(true);
                      }}
                      className="btn btn-amber btn-sm"
                      style={{ fontSize: '13px', backgroundColor: 'var(--c-blue-mid)', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      <span>✏️</span> Editar Contenido
                    </button>
                    <button
                      onClick={() => generateCurrentStep()}
                      disabled={generating}
                      className="btn btn-ghost"
                      style={{ fontSize: '13px', color: 'var(--c-navy-light)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: generating ? 'not-allowed' : 'pointer' }}
                    >
                      {generating ? (
                        <>
                          <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--c-navy-light)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          Regenerando fase...
                        </>
                      ) : (
                        'Regenerar esta fase 🔄'
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Step Quality Audit Badge (MCCEMS/NEM 23 Criterios) */}
            <PaecStepQualityAuditBadge
              step={activeStep}
              stepAudit={stepAudits[activeStep] || null}
              globalAudit={auditResult}
              onReaudit={() => projectId && fetchAudit(projectId)}
              isLoading={loadingAudit}
            />

            {/* Step 1 Visual Render */}
            {activeStep === 1 && (
              <PaecStep1Diagnostico
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as Fase1Diagnostico | null}
                setEditPayload={setEditPayload as (v: Fase1Diagnostico | null) => void}
              />
            )}

            {/* Step 2 Visual Render */}
            {activeStep === 2 && (
              <PaecStep2Justificacion
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as Fase2Justificacion | null}
                setEditPayload={setEditPayload as (v: Fase2Justificacion | null) => void}
              />
            )}

            {/* Step 3 Visual Render */}
            {activeStep === 3 && (
              <PaecStep3Mapeo
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as MapeoRow[] | null}
                setEditPayload={setEditPayload as (v: MapeoRow[] | null) => void}
              />
            )}

            {/* Step 4 Visual Render */}
            {activeStep === 4 && (
              <PaecStep4Cronograma
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as CronogramaRow[] | null}
                setEditPayload={setEditPayload as (v: CronogramaRow[] | null) => void}
              />
            )}

            {/* Step 5 Visual Render: Detalle Curricular */}
            {activeStep === 5 && (
              <PaecStep5DetalleCurricular
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as DetalleCurricularRow[] | null}
                setEditPayload={setEditPayload as (v: DetalleCurricularRow[] | null) => void}
              />
            )}

            {/* Step 6 Visual Render: Plan Operativo Semestre A */}
            {activeStep === 6 && (
              <PaecStep6PlanOpA
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as PlanOperativoRow[] | null}
                setEditPayload={setEditPayload as (v: PlanOperativoRow[] | null) => void}
              />
            )}

            {/* Step 7 Visual Render: Plan Operativo Semestre B */}
            {activeStep === 7 && (
              <PaecStep7PlanOpB
                project={project}
                isEditingContent={isEditingContent}
                editPayload={editPayload as PlanOperativoRow[] | null}
                setEditPayload={setEditPayload as (v: PlanOperativoRow[] | null) => void}
              />
            )}

            {/* Step 8 Visual Render: Implementación y Anexos */}
            {activeStep === 8 && (
              <PaecStep8Implementacion
                project={project}
                collapsedCarta={collapsedCarta}
                setCollapsedCarta={setCollapsedCarta}
                collapsedMinuta={collapsedMinuta}
                setCollapsedMinuta={setCollapsedMinuta}
                collapsedOficios={collapsedOficios}
                setCollapsedOficios={setCollapsedOficios}
                activeAnexoTab={activeAnexoTab}
                setActiveAnexoTab={setActiveAnexoTab}
              />
            )}

            {/* Step 9 Visual Render: Gobernanza e Informe Supervisión */}
            {activeStep === 9 && (
              <PaecStep9GobernanzaSupervision
                project={project}
                projectId={projectId}
                collapsedGobernanza={collapsedGobernanza}
                setCollapsedGobernanza={setCollapsedGobernanza}
                collapsedInforme={collapsedInforme}
                setCollapsedInforme={setCollapsedInforme}
                auditResult={auditResult}
                loadingAudit={loadingAudit}
                auditError={auditError}
                fetchAudit={fetchAudit}
                auditFilter={auditFilter}
                setAuditFilter={setAuditFilter}
                showAuditDetails={showAuditDetails}
                setShowAuditDetails={setShowAuditDetails}
              />
            )}

            {/* Navigation / Next actions */}
            <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--c-border)', paddingTop: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              {prevStep && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep(prevStep.num);
                    setError(null);
                  }}
                  className="btn btn-ghost"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  ← {prevStep.label}
                </button>
              )}
              
              {!isLastVisibleStep && nextStep ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep(nextStep.num);
                    setError(null);
                  }}
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  disabled={generating || (!isStepGenerated(activeStep) && (project?.currentStep || 1) < nextStep.num)}
                >
                  Siguiente: {nextStep.label} (Paso {nextStep.num}) →
                </button>
              ) : (isStepGenerated(activeStep) || project?.status === 'completed') ? (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#28a745', fontWeight: 600 }}>
                    🎉 ¡Proyecto PAEC-PEC Completo ({cycleType === 'annual' ? '9 Pasos' : 'Ciclo ' + cycleType})!
                  </span>
                  <a href={`/api/docx/paec/${projectId}`} className="btn btn-amber" style={{ backgroundColor: 'var(--c-amber)', color: '#fff' }}>
                    ↓ Descargar Word
                  </a>
                  <a href={`/api/pdf/paec/${projectId}`} className="btn btn-primary" style={{ backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff' }}>
                    ↓ PAEC Oficial PDF
                  </a>
                </div>
              ) : null}
            </div>

          </div>
        )}


        <PaecZonaModal w={w} />
      </div>
    </div>
  );
}
