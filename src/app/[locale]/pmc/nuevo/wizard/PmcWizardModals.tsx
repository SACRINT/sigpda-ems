'use client';

import React from 'react';
import { formatZoneMetric } from '@/lib/zone-metric-format';
import { type PmcPreviousExtractStaff, type EditablePlanElement } from './helpers';
import type { PmcWizardController } from './usePmcGenerationAndNav';

export function PmcWizardModals({ w }: { w: PmcWizardController }) {
  const {
    updateEditableElemento,
    zonaData,
    showZonaModal,
    setShowZonaModal,
    showCoverageModal,
    setShowCoverageModal,
    parsedPmcData,
    editableElementosPlan,
    ingestWarnings,
    ingestCoverage,
    showPmcReviewModal,
    setShowPmcReviewModal,
    handleApplyParsedPmc,
    handleAplicarSugerenciasZona,
    realStaffCount,
    personalWithGoals,
    coveragePercent,
    handleProceedDownload,
    handleGoToStep4,
  } = w;

  return (
    <>
        {/* MODAL DE CONSULTA DE CARTOGRAFÍA DE ZONA */}
        {showZonaModal && zonaData?.zona && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                    🗺️ Cartografía de Zona {zonaData.zona.identificacion.zonaNumero}
                  </h3>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Supervisor(a): <strong style={{ color: '#e2e8f0' }}>{zonaData.zona.identificacion.supervisorName}</strong> · Clave: {zonaData.zona.identificacion.zonaClave}
                  </span>
                </div>
                <button
                  onClick={() => setShowZonaModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Metas CREAA */}
              {zonaData.zona.momento5Metas?.metaGeneralZona && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                    🎯 Meta Estratégica de Zona (Fórmula CREAA):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#e0e7ff', lineHeight: 1.4 }}>
                    {zonaData.zona.momento5Metas.metaGeneralZona}
                  </p>
                </div>
              )}

              {/* Indicadores 911/F11 del Plantel */}
              {zonaData.plantel && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                    📊 Línea Base 911/F11 Registrada para tu Plantel:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Matrícula</span>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                        {formatZoneMetric(zonaData.plantel.matricula)}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Abandono</span>
                      <strong style={{ fontSize: '14px', color: '#fbbf24' }}>
                        {formatZoneMetric(zonaData.plantel.abandono, { pct: true })}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Efic. Terminal</span>
                      <strong style={{ fontSize: '14px', color: '#34d399' }}>
                        {formatZoneMetric(zonaData.plantel.eficienciaTerminal, { pct: true })}
                      </strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '14px', color: '#f87171' }}>
                        {formatZoneMetric(zonaData.plantel.reprobacion, { pct: true })}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnóstico Territorial */}
              {zonaData.zona.momento3Territorio?.descripcionTerritorial && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                    📍 Diagnóstico Territorial Sugerido (Momento 3):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {zonaData.zona.momento3Territorio.descripcionTerritorial}
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowZonaModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cerrar sin aplicar
                </button>
                <button
                  type="button"
                  onClick={handleAplicarSugerenciasZona}
                  style={{
                    padding: '8px 18px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✨ Aplicar sugerencias de zona a mi PMC
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Revisión y Confirmación de PMC Anterior Extraído */}
        {showPmcReviewModal && parsedPmcData && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            backdropFilter: 'blur(5px)',
          }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '16px',
              maxWidth: '880px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#f0f4ff', fontWeight: 700 }}>
                    📄 Revisión de Datos Extraídos del PMC Anterior
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Revisa la información extraída automáticamente antes de pre-llenar los campos del wizard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPmcReviewModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {/* Banner de Cobertura Honesta (H-296): verde sólo si ratio >= 0.9 y sin parcialMetas; si no, conteo exacto */}
              {ingestCoverage && (() => {
                const ratio = typeof ingestCoverage.ratio === 'number'
                  ? ingestCoverage.ratio
                  : (ingestCoverage.detectados ? ingestCoverage.extraidos / ingestCoverage.detectados : 1);
                const isParcialMetas = Boolean(ingestCoverage.detalles?.metas?.parcial);
                const isComplete = !ingestCoverage.parcial && ratio >= 0.9 && !isParcialMetas;
                const totalEsperado = ingestCoverage.esperado ?? ingestCoverage.detectados ?? ingestCoverage.extraidos;
                const totalExtraidos = editableElementosPlan.length > 0 ? editableElementosPlan.length : ingestCoverage.extraidos;
                const faltantes = Math.max(0, totalEsperado - totalExtraidos);

                const metasCount = editableElementosPlan.filter(e => e.tipo === 'meta').length;
                const actCount = editableElementosPlan.filter(e => e.tipo === 'actividad').length;
                const otrosCount = editableElementosPlan.length - metasCount - actCount;
                const desgloseText = editableElementosPlan.length > 0
                  ? ` (${metasCount} metas, ${actCount} actividades${otrosCount > 0 ? `, ${otrosCount} complementarios` : ''})`
                  : '';

                if (isComplete) {
                  return (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#6ee7b7',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>✅</span>
                      <span>
                        <strong>Extracción completa:</strong> se estructuraron satisfactoriamente {totalExtraidos} elementos{desgloseText} de {totalEsperado} previstos en el documento ({Math.round(ratio * 100)}%).
                      </span>
                    </div>
                  );
                }

                if (ingestCoverage.parcial) {
                  return (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#fbbf24',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>⚠️</span>
                      <span>
                        <strong>Extracción parcial ({Math.round(ratio * 100)}%):</strong> se extrajeron {totalExtraidos} elementos{desgloseText} de {totalEsperado} previstos (faltan {faltantes} por estructurar). Puedes revisar y editar los elementos en la tabla inferior antes de continuar.
                      </span>
                    </div>
                  );
                }

                if (ingestCoverage.indeterminada) {
                  return (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px dashed rgba(245, 158, 11, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      color: '#fbbf24',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '16px' }}>ℹ️</span>
                      <span>
                        <strong>Cobertura no totalizada:</strong> se extrajeron {ingestCoverage.extraidos} elementos, pero el modelo no reportó el total detectado para contrastar. Revisa los elementos en el modal.
                      </span>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Banner Ámbar de Advertencias Literales del Parser (H-182) */}
              {ingestWarnings.length > 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚠️ Advertencias de Ingesta ({ingestWarnings.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#fde68a', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {ingestWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Plantel */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🏫 Datos del Plantel</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px' }}>
                  <div><strong style={{ color: '#94a3b8' }}>Plantel:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.schoolName || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>CCT:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.schoolCct || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Director:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.directorName || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Supervisor:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.supervisorName || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Zona:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.schoolZone || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Municipio:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.municipality || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Ciclo Escolar:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.cicloEscolar || '(Sin detectar)'}</span></div>
                  <div><strong style={{ color: '#94a3b8' }}>Subsistema:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPmcData.subsystem || 'BGE'}</span></div>
                </div>
              </div>

              {/* Personal */}
              {parsedPmcData.staffData && parsedPmcData.staffData.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                    👥 Plantilla Docente y Administrativa ({parsedPmcData.staffData.length} miembros detectados)
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                    {parsedPmcData.staffData.map((s: PmcPreviousExtractStaff, idx: number) => (
                      <span key={idx} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.25)' }}>
                        {s.nombre} ({s.cargo})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnóstico Comunidad */}
              {parsedPmcData.diagnosticoComunidad && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🌱 Diagnóstico Comunitario Detectado</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                    {parsedPmcData.diagnosticoComunidad}
                  </p>
                </div>
              )}

              {/* Indicadores Académicos */}
              {parsedPmcData.indicadores && Object.values(parsedPmcData.indicadores).some(v => v !== null && v !== undefined) && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>📊 Indicadores Académicos</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Aprobación</span>
                      <strong style={{ fontSize: '13px', color: '#34d399' }}>{parsedPmcData.indicadores.aprobacion_ant ?? '-'}%</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '13px', color: '#f87171' }}>{parsedPmcData.indicadores.reprobacion_ant ?? '-'}%</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Abandono</span>
                      <strong style={{ fontSize: '13px', color: '#fbbf24' }}>{parsedPmcData.indicadores.abandono_ant ?? '-'}%</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Efic. Terminal</span>
                      <strong style={{ fontSize: '13px', color: '#38bdf8' }}>{parsedPmcData.indicadores.et_ant ?? '-'}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Elementos del Plan de Acción Previo (Revisión editable C1) */}
              {editableElementosPlan.length > 0 ? (() => {
                const metasGroup = editableElementosPlan.map((e, idx) => ({ e, idx })).filter(item => item.e.tipo === 'meta');
                const actividadesGroup = editableElementosPlan.map((e, idx) => ({ e, idx })).filter(item => item.e.tipo === 'actividad');
                const otrosGroup = editableElementosPlan.map((e, idx) => ({ e, idx })).filter(item => item.e.tipo !== 'meta' && item.e.tipo !== 'actividad');

                const renderElementCard = ({ e, idx }: { e: EditablePlanElement; idx: number }) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: e.requiere_revision ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Tipo:</label>
                        <select
                          value={e.tipo}
                          onChange={(ev) => updateEditableElemento(idx, { tipo: ev.target.value as EditablePlanElement['tipo'] })}
                          style={{
                            background: '#1e293b',
                            color: '#f0f4ff',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="meta">🎯 Meta (Resultado con indicador)</option>
                          <option value="actividad">⚡ Actividad (Acción de ejecución)</option>
                          <option value="estrategia">🛠️ Estrategia (Medio/Agrupación)</option>
                          <option value="indicador">📊 Indicador</option>
                          <option value="responsable">👤 Responsable</option>
                          <option value="evidencia">📁 Evidencia</option>
                          <option value="cronograma">📅 Cronograma</option>
                          <option value="otro">📌 Otro elemento</option>
                        </select>
                        {e.categoria && (
                          <span style={{ fontSize: '10px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            {e.categoria}
                          </span>
                        )}
                        {e.tema && (
                          <span style={{ fontSize: '10px', color: '#c7d2fe', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            {e.tema}
                          </span>
                        )}
                        {e.responsable && (
                          <span style={{ fontSize: '10px', color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                            👤 {e.responsable}
                          </span>
                        )}
                      </div>
                      {e.requiere_revision && (
                        <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          ⚠️ Requiere revisión
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                      <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 700 }}>
                          📖 Texto Original del Documento (Solo lectura)
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {e.texto_original || '(Vacío)'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '10px', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 700 }}>
                          ✍️ Texto Normalizado / Corregido (Editable)
                        </div>
                        <textarea
                          value={e.texto_normalizado}
                          onChange={(ev) => updateEditableElemento(idx, { texto_normalizado: ev.target.value })}
                          rows={3}
                          style={{
                            width: '100%',
                            background: 'rgba(30, 41, 59, 0.85)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            color: '#f0f4ff',
                            lineHeight: 1.4,
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                          placeholder="Redacción de la meta o elemento..."
                        />
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                        📋 Elementos del Plan de Acción Previo ({editableElementosPlan.length} detectados)
                      </h4>
                      <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)' }}>
                        {metasGroup.length} Metas · {actividadesGroup.length} Actividades · {otrosGroup.length} Otros
                      </span>
                    </div>

                    {/* Bloque 1: Metas Institucionales */}
                    {metasGroup.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#93c5fd', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🎯</span> Metas Institucionales ({metasGroup.length})
                        </div>
                        <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                          {metasGroup.map(renderElementCard)}
                        </div>
                      </div>
                    )}

                    {/* Bloque 2: Actividades */}
                    {actividadesGroup.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚡</span> Actividades del Plan ({actividadesGroup.length})
                        </div>
                        <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                          {actividadesGroup.map(renderElementCard)}
                        </div>
                      </div>
                    )}

                    {/* Bloque 3: Otros elementos */}
                    {otrosGroup.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📌</span> Otros Elementos ({otrosGroup.length})
                        </div>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                          {otrosGroup.map(renderElementCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : parsedPmcData.metas_institucionales_previas && parsedPmcData.metas_institucionales_previas.length > 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>
                    🎯 Metas del Plan de Acción Previo ({parsedPmcData.metas_institucionales_previas.length} detectadas)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {parsedPmcData.metas_institucionales_previas.map((m, idx: number) => (
                      <div key={idx} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                        <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{m.categoria} · {m.tema}:</span>{' '}
                        <span style={{ color: '#f0f4ff' }}>{m.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Botones de acción modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowPmcReviewModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyParsedPmc}
                  style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Aplicar al Formulario de PMC
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Modal Informativo de Cobertura de Metas (C10 / D6 - Jamás bloquear export) */}
        {showCoverageModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px',
            backdropFilter: 'blur(5px)',
          }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#fef3c7', fontWeight: 700 }}>
                    Recomendación de Calidad Normativa (C10)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCoverageModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '18px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#fef3c7', lineHeight: 1.5 }}>
                  La cobertura actual de metas individuales es del <strong>{coveragePercent}%</strong> ({personalWithGoals} de {realStaffCount} trabajadores registrados con meta formulada).
                </p>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  Los lineamientos normativos de la SEP Puebla / SEMS recomiendan una cobertura de al menos el <strong>80%</strong> de la plantilla para asegurar la corresponsabilidad escolar.
                </p>
              </div>

              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.4 }}>
                Puedes descargar el documento ahora mismo o regresar al Paso 4 para complementar las metas de los trabajadores faltantes.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleGoToStep4}
                  style={{
                    padding: '9px 16px',
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '8px',
                    color: '#c7d2fe',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Completar metas (Paso 4)
                </button>
                <button
                  type="button"
                  onClick={handleProceedDownload}
                  style={{
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Descargar de todos modos
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
