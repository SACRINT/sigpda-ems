'use client';

import React from 'react';
import { PMC_CATEGORIAS_OFICIALES } from '@/lib/constants/pmc-categorias';
import { cleanPmcPlaceholders } from '@/lib/pmc/plan-element-normalizer';
import { derivePersonalMetasFromStaff } from '@/lib/pmc/staff-reconciler';
import { deduplicateMetasInstitucionales } from '@/lib/pmc-meta-deduplicator';
import { PmcMetasComplementarias, type PlanAccionData, type StaffMemberData } from '../PmcMetasComplementarias';
import {
  isPreviousMetaAdapted,
  generarEstrategiaSituada,
  inputStyle,
  labelStyle,
  sectionCard,
  type MetaInstitucional,
  type PlanAccion,
} from './helpers';
import type { PmcWizardController } from './usePmcGenerationAndNav';

export function Step4GeneracionIA({ w }: { w: PmcWizardController }) {
  const {
    projectId,
    setActiveStep,
    saving,
    setSaving,
    generating,
    editingMeta,
    setEditingMeta,
    editingPersonal,
    setEditingPersonal,
    showPaso4Complementarias,
    setShowPaso4Complementarias,
    cicloEscolar,
    subsystem,
    totalStaff,
    staffData,
    setStaffData,
    indicadores,
    metasConfirmadas,
    categoriasPriorizadas,
    normativaData,
    diagnosticoGenerado,
    planAccion,
    setPlanAccion,
    allowPartialGeneration,
    setAllowPartialGeneration,
    metasPreviasReferencia,
    parsedPmcData,
    ingestCoverage,
    setSuccessBanner,
    generateStep,
    syncPersonalMetas,
    realStaffCount,
    personalWithGoals,
    coveragePercent,
  } = w;

  return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 4: Generación con Inteligencia Artificial
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              La IA redactará el diagnóstico oficial y el plan de acción con metas SMART para tu plantel.
              Puedes editar cualquier sección después de generarla.
            </p>

            {/* Banner: Bloqueo de Generación si las metas no están confirmadas */}
            {!metasConfirmadas && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#fcd34d', fontSize: '13.5px', display: 'block', marginBottom: '2px' }}>
                      Confirmación de Metas Requerida
                    </strong>
                    <span style={{ color: 'rgba(240,244,255,0.8)', fontSize: '12.5px', lineHeight: 1.5 }}>
                      Para asegurar rigor metodológico y normativo, debes revisar y confirmar las metas académicas del ciclo en el Paso 3 antes de generar con IA.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(245,158,11,0.3)',
                  }}
                >
                  Ir al Paso 3 →
                </button>
              </div>
            )}

            {/* H-099: Marco Normativo Oficial */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    ⚖️ Marco Normativo y Fundamentación Jurídica
                    {normativaData ? (
                      <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>
                        ✓ Vinculado{Array.isArray((normativaData as { documentos?: unknown[] })?.documentos) ? ` (${(normativaData as { documentos?: unknown[] }).documentos!.length} documentos)` : ''}
                      </span>
                    ) : (
                      <span style={{ marginLeft: '8px', color: '#f59e0b', fontSize: '13px' }}>
                        ⚠️ Pendiente de sincronización
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Sustento legal oficial: Art. 3° Constitucional, Ley General de Educación, Ley de Educación del Estado de Puebla y MCCEMS
                  </p>
                </div>
                <button
                  onClick={() => generateStep('normativa')}
                  disabled={generating !== null}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: generating === 'normativa' ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: generating !== null ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                  }}
                >
                  {generating === 'normativa' ? '⏳ Sincronizando...' : normativaData ? '🔄 Sincronizar Normativa' : '✨ Generar Normativa'}
                </button>
              </div>
              {normativaData ? (
                <div style={{ background: 'rgba(8,12,24,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.6 }}>
                  <div style={{ color: '#818cf8', fontWeight: 600, marginBottom: '4px' }}>
                    {(normativaData as { titulo?: string })?.titulo || 'Marco Normativo Institucional'}
                  </div>
                  <div style={{ color: 'rgba(240,244,255,0.75)', fontSize: '12px' }}>
                    {(normativaData as { descripcion?: string })?.descripcion ||
                      'El presente Plan de Mejora Continua se sustenta en el marco jurídico y normativo vigente para la Educación Media Superior en el Estado de Puebla.'}
                  </div>
                </div>
              ) : generating === 'normativa' ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 600, color: '#818cf8', margin: 0 }}>Sincronizando normateca jurídica oficial...</p>
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(240,244,255,0.45)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '13px' }}>
                  Haz clic en &quot;Generar Normativa&quot; para vincular los documentos oficiales vigentes a tu PMC.
                </div>
              )}
            </div>

            {/* Generate Diagnóstico */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    📄 Diagnóstico Socioeducativo
                    {diagnosticoGenerado && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ Generado</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Presentación, contexto, análisis de indicadores, FODA y priorización de categorías
                  </p>
                </div>
                <button
                  onClick={() => generateStep('diagnostico')}
                  disabled={generating !== null || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)}
                  title={!metasConfirmadas ? 'Debes confirmar las metas del ciclo en el Paso 3 primero' : (ingestCoverage?.parcial && !allowPartialGeneration) ? 'El PMC previo tiene cobertura de extracción parcial (<90%). Autoriza abajo para continuar.' : undefined}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: generating === 'diagnostico' ? 'rgba(255,255,255,0.1)' : (!metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (generating !== null || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    boxShadow: (!metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 'none' : '0 2px 8px rgba(99,102,241,0.4)',
                    opacity: (!metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 0.5 : 1,
                  }}
                >
                  {generating === 'diagnostico' ? '⏳ Generando...' : diagnosticoGenerado ? '🔄 Regenerar' : '✨ Generar Diagnóstico'}
                </button>
              </div>
              {!metasConfirmadas && (
                <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ Debes confirmar las metas del ciclo en el Paso 3 antes de generar el diagnóstico.
                </p>
              )}
              {ingestCoverage?.parcial && (() => {
                const detectados = typeof ingestCoverage.detectados === 'number' ? ingestCoverage.detectados : null;
                const isComplete = detectados !== null ? ingestCoverage.extraidos >= detectados : false;
                const ratioDisplay = typeof ingestCoverage.ratio === 'number' ? Math.round(ingestCoverage.ratio * 100) : null;
                const detectadosLabel = detectados !== null ? String(detectados) : '?';
                const totalEsperado = ingestCoverage.esperado ?? detectados ?? ingestCoverage.extraidos;

                return (
                  <div style={{
                    fontSize: '12px',
                    color: isComplete ? '#6ee7b7' : '#f87171',
                    background: isComplete ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.12)',
                    border: isComplete ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.25)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span>{isComplete ? '✅' : '⚠️'}</span>
                      <strong>
                        {isComplete
                          ? `Metas extraídas del PMC anterior (${ingestCoverage.extraidos} metas estructuradas)`
                          : `Extracción parcial del PMC anterior (${ingestCoverage.extraidos}/${detectadosLabel})`}
                      </strong>
                    </div>
                    <p style={{ margin: '0 0 8px', color: 'rgba(240,244,255,0.85)', lineHeight: 1.5 }}>
                      {isComplete
                        ? `Se consolidaron exitosamente ${ingestCoverage.extraidos} metas (incluyendo las metas individuales de la plantilla docente). Cobertura total de actividades: ${ratioDisplay !== null ? `${ratioDisplay}%` : 'N/D'} (${ingestCoverage.extraidos}/${totalEsperado}).`
                        : 'El PMC anterior cargado tiene cobertura de extracción parcial (<90%). Puedes continuar usando las metas extraídas actualmente autorizando la generación.'}
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fcd34d', fontWeight: 600, fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={allowPartialGeneration}
                        onChange={(e) => setAllowPartialGeneration(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                      />
                      <span>Autorizar generación con las metas extraídas ({parsedPmcData?.metas_institucionales_previas?.length ?? ingestCoverage?.detalles?.metas?.extraidos ?? ingestCoverage.extraidos} metas listas)</span>
                    </label>
                  </div>
                );
              })()}
              {diagnosticoGenerado && (
                <div style={{ background: 'rgba(8,12,24,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.7 }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Presentación:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6', color: 'rgba(240,244,255,0.85)' }}>{diagnosticoGenerado.presentacion}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Contexto Socioeducativo:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.contexto}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Análisis de Indicadores Académicos:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.analisis_indicadores}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Síntesis FODA:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.sintesis_foda}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#818cf8' }}>Priorización de Categorías:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.priorizacion}</p>
                  </div>
                </div>
              )}
              {!diagnosticoGenerado && generating !== 'diagnostico' && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(240,244,255,0.45)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '13px' }}>
                  Haz clic en &quot;Generar Diagnóstico&quot; para que la IA redacte el diagnóstico oficial del PMC
                </div>
              )}
              {generating === 'diagnostico' && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontWeight: 600, color: '#818cf8' }}>Generando diagnóstico...</p>
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)' }}>La IA está analizando el contexto y los indicadores del plantel</p>
                </div>
              )}
            </div>

            {/* Generate Plan de Acción */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    🎯 Plan de Acción con Metas SMART
                    {(planAccion?.metas_institucionales?.length || 0) > 0 && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ {planAccion?.metas_institucionales?.length} Metas Institucionales</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Metas institucionales por categoría + metas individuales para los {totalStaff} trabajadores
                  </p>
                </div>
                <button
                  onClick={() => generateStep('plan_accion')}
                  disabled={generating !== null || !diagnosticoGenerado || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)}
                  title={!metasConfirmadas ? 'Debes confirmar las metas del ciclo en el Paso 3 primero' : !diagnosticoGenerado ? 'Primero debes generar el diagnóstico oficial' : (ingestCoverage?.parcial && !allowPartialGeneration) ? 'El PMC previo tiene cobertura de extracción parcial (<90%). Autoriza arriba para continuar.' : undefined}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: generating === 'plan_accion' ? 'rgba(255,255,255,0.1)' : (!diagnosticoGenerado || !metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: (generating !== null || !diagnosticoGenerado || !metasConfirmadas || (Boolean(ingestCoverage?.parcial) && !allowPartialGeneration)) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    opacity: (!diagnosticoGenerado || !metasConfirmadas || (ingestCoverage?.parcial && !allowPartialGeneration)) ? 0.5 : 1,
                  }}
                >
                  {generating === 'plan_accion' ? '⏳ Generando...' : (planAccion?.metas_institucionales?.length || 0) > 0 ? '🔄 Regenerar Metas Institucionales con IA' : '✨ Generar Plan de Acción con IA'}
                </button>
              </div>
              {!metasConfirmadas ? (
                <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ Debes confirmar las metas del ciclo en el Paso 3 antes de generar el plan de acción.
                </p>
              ) : !diagnosticoGenerado ? (
                <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ Primero genera el diagnóstico para poder generar el plan de acción.
                </p>
              ) : null}
              {ingestCoverage?.parcial && !allowPartialGeneration && (
                <p style={{ fontSize: '12px', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                  ⚠️ El PMC anterior cargado tiene cobertura de extracción parcial (&lt;90%). Marca la casilla de autorización arriba para desbloquear la generación.
                </p>
              )}

              {/* Metas del ciclo previo (Referencia Histórica Aislada - H-006) */}
              {metasPreviasReferencia.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fcd34d', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📜</span> Metas del Ciclo Previo (Insumo Histórico de Referencia)
                    </h4>
                    <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                      {metasPreviasReferencia.length} metas extraídas
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.7)', margin: '0 0 12px', lineHeight: 1.5 }}>
                    Estas metas provienen del PMC anterior cargado. Por rigor normativo no se incluyen automáticamente en el Plan de Acción 2026-2027 para evitar compromisos extemporáneos. Puedes adaptar aquellas que requieran continuidad formal:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {metasPreviasReferencia.map((mp, idx) => {
                      const isAlreadyAdded = isPreviousMetaAdapted(mp, planAccion?.metas_institucionales, idx);

                      return (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1, fontSize: '12px' }}>
                            <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: '2px' }}>
                              {mp.categoria || 'Categoría general'} {mp.tema ? `— ${mp.tema}` : ''}
                            </div>
                            <div style={{ color: '#f0f4ff', marginBottom: '4px' }}><strong>Meta:</strong> {mp.meta || 'Sin redacción'}</div>
                            {mp.texto_original && mp.texto_original !== mp.meta && (
                              <div style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)', marginBottom: '4px' }}>
                                <em>Original:</em> {mp.texto_original}
                              </div>
                            )}
                            {mp.estrategia && <div style={{ color: 'rgba(240,244,255,0.65)' }}><strong>Estrategia:</strong> {mp.estrategia}</div>}
                            {mp.linea_base && <div style={{ color: 'rgba(240,244,255,0.5)' }}><strong>Línea base:</strong> {mp.linea_base}</div>}
                          </div>
                          <button
                            type="button"
                            disabled={Boolean(isAlreadyAdded)}
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              const cat = mp.categoria || PMC_CATEGORIAS_OFICIALES[0].nombre;
                              const cleanMetaText = cleanPmcPlaceholders(mp.meta);
                              const estrategiaSintetizada = cleanPmcPlaceholders(mp.estrategia?.trim()) || generarEstrategiaSituada(cat, cleanMetaText);
                              const adaptedMeta: MetaInstitucional = {
                                categoria: cat,
                                nombre_categoria: cat,
                                tema: mp.tema || 'Mejora continua',
                                meta: cleanMetaText ? `Continuidad (${cicloEscolar}): ${cleanMetaText}` : '',
                                estrategia: estrategiaSintetizada,
                                linea_base: mp.linea_base || '',
                                personal_designado: mp.responsable || '',
                                entregable: mp.entregable || 'Reporte de seguimiento',
                                periodo_inicio: 'Agosto 2026',
                                periodo_fin: 'Junio 2027',
                                diagnostico_meta: `Meta adaptada del ciclo previo: ${cleanMetaText}`,
                                continuidad_de: mp.texto_original ? mp.texto_original.trim() : (cleanMetaText || `meta_previa_${idx}`),
                                accion_especifica: estrategiaSintetizada,
                                finalidad: `Fortalecer la continuidad institucional de las acciones en ${cat} durante el ciclo 2026-2027.`,
                                necesidad: `Consolidar las metas institucionales de continuidad identificadas en el ciclo escolar previo.`,
                                proceso_evaluacion: 'Evaluación formativa y seguimiento bimestral en Consejo Técnico Escolar.',
                                subcategorias_vinculadas: [mp.tema || 'Mejora continua'],
                                estrategias_seguimiento: 'Cortes bimestrales en CTE y listas de cotejo de evidencias.',
                                observaciones: 'Meta de continuidad institucional adaptada del ciclo previo.',
                              };
                              const currentPersonal = (planAccion?.metas_personales && planAccion.metas_personales.length > 0)
                                ? planAccion.metas_personales
                                : derivePersonalMetasFromStaff(staffData, cicloEscolar);
                              const nextInstitucionales = deduplicateMetasInstitucionales(
                                [...(planAccion?.metas_institucionales || []), adaptedMeta],
                                indicadores
                              );
                              const nextPlan: PlanAccion = {
                                metas_institucionales: nextInstitucionales,
                                metas_personales: currentPersonal,
                              };
                              setPlanAccion(nextPlan);
                              setEditingMeta(Math.max(0, nextInstitucionales.length - 1));
                              // H-286: Auto-persistir en Neon DB para que un F5 no pierda la meta adaptada
                              if (projectId) {
                                fetch(`/api/pmc/${projectId}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ plan_accion: nextPlan }),
                                }).catch(() => {});
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: isAlreadyAdded ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(99,102,241,0.4)',
                              background: isAlreadyAdded ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.2)',
                              color: isAlreadyAdded ? '#6ee7b7' : '#c7d2fe',
                              cursor: isAlreadyAdded ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                              opacity: isAlreadyAdded ? 0.75 : 1,
                            }}
                          >
                            {isAlreadyAdded ? '✓ Agregada al Plan' : '➕ Adaptar para 2026-2027'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {planAccion && (
                <div>
                  {/* Metas institucionales */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                      Metas Institucionales ({planAccion.metas_institucionales.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowPaso4Complementarias((prev) => !prev)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid rgba(16,185,129,0.4)',
                        background: showPaso4Complementarias ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.15)',
                        color: '#6ee7b7',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{showPaso4Complementarias ? '▲ Ocultar Panel de Metas' : '➕ Agregar Metas Manuales (Docentes / Institucionales)'}</span>
                    </button>
                  </div>

                  {showPaso4Complementarias && (
                    <div style={{ marginBottom: '16px' }}>
                      <PmcMetasComplementarias
                        projectId={projectId}
                        planAccion={planAccion as unknown as PlanAccionData | null}
                        setPlanAccion={setPlanAccion as unknown as React.Dispatch<React.SetStateAction<PlanAccionData | null>>}
                        staffData={staffData as unknown as StaffMemberData[]}
                        setStaffData={setStaffData as unknown as React.Dispatch<React.SetStateAction<StaffMemberData[]>>}
                        cicloEscolar={cicloEscolar}
                        subsystem={subsystem}
                        indicadores={indicadores}
                      />
                    </div>
                  )}
                  {planAccion.metas_institucionales.length === 0 && (
                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(240,244,255,0.6)', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
                      Aún no hay metas institucionales formuladas. Haz clic en <strong>✨ Generar Plan de Acción con IA</strong> o adapta las metas del ciclo previo de arriba.
                    </div>
                  )}
                  {planAccion.metas_institucionales.map((meta, i) => (
                    <div key={i} style={{ marginBottom: '12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)', overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>
                          {meta.nombre_categoria} — {meta.tema}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setEditingMeta(editingMeta === i ? null : i)}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            {editingMeta === i ? 'Cerrar' : '✏️ Editar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlanAccion(prev => {
                                if (!prev) return null;
                                const updated = prev.metas_institucionales.filter((_, mIdx) => mIdx !== i);
                                return { ...prev, metas_institucionales: updated };
                              });
                              if (editingMeta === i) setEditingMeta(null);
                            }}
                            style={{
                              background: 'rgba(239,68,68,0.2)',
                              border: '1px solid rgba(239,68,68,0.4)',
                              color: '#fca5a5',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                            title="Eliminar esta meta del plan"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'rgba(8,12,24,0.5)', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.6 }}>
                        {editingMeta === i ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                              { key: 'meta', label: 'Meta SMART', multi: true },
                              { key: 'estrategia', label: 'Estrategia de implementación', multi: true },
                              { key: 'accion_especifica', label: 'Acciones Específicas a Realizar (Formato 4.1)', multi: true },
                              { key: 'personal_designado', label: 'Personal designado', multi: false },
                              { key: 'entregable', label: 'Entregable / Evidencia', multi: true },
                              { key: 'estrategias_seguimiento', label: 'Estrategias de Seguimiento (Formato 4.1)', multi: true },
                              { key: 'periodo_inicio', label: 'Período inicio (MM/YYYY)', multi: false },
                              { key: 'periodo_fin', label: 'Período fin (MM/YYYY)', multi: false },
                              { key: 'observaciones', label: 'Observaciones (Formato 4.1)', multi: true },
                            ].map(f => (
                              <div key={f.key}>
                                <label style={{ ...labelStyle, fontSize: '12px' }}>{f.label}</label>
                                {f.multi ? (
                                  <textarea
                                    value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_institucionales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_institucionales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, minHeight: '70px', fontSize: '13px' }}
                                  />
                                ) : (
                                  <>
                                    <input
                                      value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                      onChange={e => {
                                        const copy = { ...planAccion! };
                                        const arr = [...copy.metas_institucionales];
                                        arr[i] = { ...arr[i], [f.key]: e.target.value };
                                        copy.metas_institucionales = arr;
                                        setPlanAccion(copy);
                                      }}
                                      placeholder={f.key === 'personal_designado' ? 'Ej. Director y Colegiado Docente, o selecciona de la plantilla abajo' : ''}
                                      style={{ ...inputStyle, fontSize: '13px' }}
                                    />
                                    {f.key === 'personal_designado' && (
                                      <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(99,102,241,0.08)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span>👥 Asignar responsable(s) de tu plantilla escolar:</span>
                                          {meta.personal_designado && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const copy = { ...planAccion! };
                                                const arr = [...copy.metas_institucionales];
                                                arr[i] = { ...arr[i], personal_designado: '' };
                                                copy.metas_institucionales = arr;
                                                setPlanAccion(copy);
                                              }}
                                              style={{ background: 'none', border: 'none', color: '#fca5a5', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                              Limpiar responsable
                                            </button>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {[
                                            'Director y Colegiado Docente',
                                            'Todo el Personal Docente',
                                            'Comité de Tutorías',
                                            'Director(a) del Plantel',
                                          ].map(preset => (
                                            <button
                                              key={preset}
                                              type="button"
                                              onClick={() => {
                                                const copy = { ...planAccion! };
                                                const arr = [...copy.metas_institucionales];
                                                arr[i] = { ...arr[i], personal_designado: preset };
                                                copy.metas_institucionales = arr;
                                                setPlanAccion(copy);
                                              }}
                                              style={{
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(99,102,241,0.35)',
                                                background: 'rgba(99,102,241,0.2)',
                                                color: '#c7d2fe',
                                                cursor: 'pointer',
                                              }}
                                            >
                                              + {preset}
                                            </button>
                                          ))}
                                          {staffData
                                            .filter(s => s.nombre && s.nombre.trim())
                                            .map((staffMember, sIdx) => {
                                              const sName = staffMember.nombre.trim();
                                              const isAssigned = meta.personal_designado?.includes(sName);
                                              return (
                                                <button
                                                  key={sIdx}
                                                  type="button"
                                                  onClick={() => {
                                                    const copy = { ...planAccion! };
                                                    const arr = [...copy.metas_institucionales];
                                                    const current = arr[i].personal_designado || '';
                                                    const nextVal = current.trim()
                                                      ? (current.includes(sName) ? current : `${current}, ${sName}`)
                                                      : `${sName} (${staffMember.cargo})`;
                                                    arr[i] = { ...arr[i], personal_designado: nextVal };
                                                    copy.metas_institucionales = arr;
                                                    setPlanAccion(copy);
                                                  }}
                                                  style={{
                                                    fontSize: '11px',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    border: isAssigned ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.15)',
                                                    background: isAssigned ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                                                    color: isAssigned ? '#6ee7b7' : '#e0e7ff',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                  }}
                                                  title={`Asignar a ${sName} (${staffMember.cargo})`}
                                                >
                                                  <span>{isAssigned ? '✓' : '+'}</span>
                                                  <span>{sName}</span>
                                                  <span style={{ opacity: 0.6, fontSize: '10px' }}>({staffMember.cargo})</span>
                                                </button>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ gridColumn: '1/-1' }}><strong>Meta:</strong> {meta.meta}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong>Estrategia:</strong> {meta.estrategia}</div>
                            <div><strong>Responsable:</strong> {meta.personal_designado}</div>
                            <div><strong>Período:</strong> {meta.periodo_inicio} — {meta.periodo_fin}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong>Entregable:</strong> {meta.entregable}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Metas personales */}
                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(99,102,241,0.06)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>🎯</span> Metas Individuales del Personal (Corresponsabilidad Docente — Criterio C10)
                        </h4>
                        <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.7)', margin: '4px 0 0', lineHeight: 1.5 }}>
                          La plataforma sugiere metas SMART por cargo para todo tu personal (o las que hayas definido en el Paso 2). Si el director está de acuerdo las deja tal como están; si no, puede editarlas directamente.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => syncPersonalMetas(undefined, false)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(99,102,241,0.4)',
                            background: 'rgba(99,102,241,0.2)',
                            color: '#c7d2fe',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Sincroniza y arrastra nombres y metas capturadas en el Paso 2"
                        >
                          🔄 Sincronizar con Plantilla (Paso 2)
                        </button>
                        <button
                          type="button"
                          onClick={() => syncPersonalMetas(undefined, true)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(245,158,11,0.4)',
                            background: 'rgba(245,158,11,0.15)',
                            color: '#fcd34d',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Regenera sugerencias SMART oficiales por cada cargo de la plantilla"
                        >
                          ✨ Regenerar sugerencias SMART por rol
                        </button>
                      </div>
                    </div>

                    {/* Status banner de Cobertura C10 */}
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: coveragePercent >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      border: `1px solid ${coveragePercent >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      color: coveragePercent >= 80 ? '#6ee7b7' : '#fcd34d',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span>{coveragePercent >= 80 ? '✅' : '⚠️'}</span>
                      <span>
                        Cobertura de metas: <strong>{personalWithGoals} de {realStaffCount} trabajadores ({coveragePercent}%)</strong>
                        {coveragePercent >= 80 ? ' — Cumple con la recomendación de corresponsabilidad docente de la norma SEP Puebla / SEMS.' : ' — Se recomienda al menos 80%.'}
                      </span>
                    </div>

                    <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(planAccion?.metas_personales || []).map((mp, i) => {
                        const isFromStep2 = staffData.some(
                          s => s.nombre?.trim().toLowerCase() === mp.nombre?.trim().toLowerCase() &&
                               ((s.metas_individuales && s.metas_individuales.length > 0 && s.metas_individuales[0]?.meta?.trim().length >= 5) ||
                                (s.meta_individual && s.meta_individual.trim().length >= 5))
                        );

                        return (
                          <div key={i} style={{ padding: '12px', background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#c7d2fe' }}>{mp.nombre}</div>
                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: 'rgba(240,244,255,0.7)' }}>{mp.cargo}</span>
                                <span style={{ fontSize: '10.5px', background: isFromStep2 ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.18)', color: isFromStep2 ? '#6ee7b7' : '#a5b4fc', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  {isFromStep2 ? '🏷️ Definida en Paso 2' : '✨ Sugerencia SMART por Cargo (Aceptada)'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingPersonal(editingPersonal === i ? null : i)}
                                  style={{ background: 'rgba(99,102,241,0.3)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  {editingPersonal === i ? '✓ Listo' : '✏️ Editar'}
                                </button>
                              </div>
                            </div>

                            {editingPersonal === i ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                  { key: 'meta_individual', label: 'Redacción de Meta Individual SMART' },
                                  { key: 'estrategia', label: 'Estrategia / Acciones de implementación' },
                                  { key: 'entregable', label: 'Entregable / Evidencia verificable' },
                                  { key: 'periodo', label: 'Período de ejecución' },
                                ].map(f => (
                                  <div key={f.key}>
                                    <label style={{ ...labelStyle, fontSize: '11px' }}>{f.label}</label>
                                    <textarea
                                      value={((mp as unknown) as Record<string, string>)[f.key] || ''}
                                      onChange={e => {
                                        const copy = { ...planAccion! };
                                        const arr = [...copy.metas_personales];
                                        arr[i] = { ...arr[i], [f.key]: e.target.value };
                                        copy.metas_personales = arr;
                                        setPlanAccion(copy);
                                      }}
                                      style={{ ...inputStyle, minHeight: f.key === 'meta_individual' || f.key === 'estrategia' ? '54px' : '36px', fontSize: '12px' }}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                                <div><strong>Meta:</strong> {mp.meta_individual}</div>
                                {mp.estrategia && <div style={{ marginTop: '3px', color: 'rgba(240,244,255,0.75)' }}><strong>Estrategia:</strong> {mp.estrategia}</div>}
                                <div style={{ marginTop: '3px', color: 'rgba(240,244,255,0.85)' }}><strong>Entregable:</strong> {mp.entregable}</div>
                                <div style={{ marginTop: '3px', color: 'rgba(240,244,255,0.5)', fontSize: '11px' }}><strong>Período:</strong> {mp.periodo}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!projectId || !planAccion) return;
                        setSaving(true);
                        await fetch(`/api/pmc/${projectId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ plan_accion: planAccion }),
                        });
                        setSaving(false);
                        setSuccessBanner('✓ Cambios en el plan de acción guardados correctamente.');
                        setTimeout(() => setSuccessBanner(null), 3500);
                      }}
                      style={{ marginTop: '14px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                      disabled={saving}
                    >
                      {saving ? 'Guardando...' : '💾 Guardar cambios del plan'}
                    </button>
                  </div>
                </div>
              )}
              {generating === 'plan_accion' && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontWeight: 600, color: '#818cf8' }}>Generando plan de acción...</p>
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)' }}>La IA está creando metas SMART para {totalStaff} trabajadores y {categoriasPriorizadas.length} categorías</p>
                </div>
              )}
            </div>
          </div>
  );
}
