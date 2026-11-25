'use client';

import React from 'react';
import { PmcMetasComplementarias, type PlanAccionData, type StaffMemberData } from '../PmcMetasComplementarias';
import { sectionCard } from './helpers';
import type { PmcWizardController } from './usePmcGenerationAndNav';

export function Step5Exportacion({ w }: { w: PmcWizardController }) {
  const {
    projectId,
    step5Tab,
    setStep5Tab,
    schoolName,
    schoolCct,
    cicloEscolar,
    subsystem,
    staffData,
    setStaffData,
    indicadores,
    categoriasPriorizadas,
    planAccion,
    setPlanAccion,
    goToStep,
    realStaffCount,
    personalWithGoals,
    coveragePercent,
    isLowCoverage,
    handleExportWithCoverageCheck,
  } = w;

  return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 5: Revisión Final y Exportación
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Tu PMC está completo. Descarga los documentos oficiales para su entrega a la supervisión.
            </p>

            {/* Summary card */}
            <div style={{ ...sectionCard, background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0.2) 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>✅ PMC Completado</h3>
              <p style={{ fontSize: '14px', opacity: 0.85, margin: '0 0 16px' }}>
                {schoolName} · CCT: {schoolCct} · Ciclo {cicloEscolar}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Trabajadores con meta', value: planAccion?.metas_personales.length || 0 },
                  { label: 'Metas institucionales', value: planAccion?.metas_institucionales.length || 0 },
                  { label: 'Categorías priorizadas', value: categoriasPriorizadas.length },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Banner de Advertencia de Calidad Normativa si cobertura < 80% */}
            {isLowCoverage && (
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div style={{ flex: 1, fontSize: '13px', color: '#fef3c7', lineHeight: 1.4 }}>
                  <strong>Advertencia de Calidad Normativa (C10):</strong> Cobertura de metas del personal al{' '}
                  <strong style={{ color: '#fbbf24' }}>{coveragePercent}%</strong> ({personalWithGoals} de {realStaffCount} trabajadores). La norma SEP Puebla / SEMS recomienda al menos 80% de corresponsabilidad docente. Puedes descargar de todos modos o volver al Paso 4.
                </div>
                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  style={{
                    flexShrink: 0,
                    padding: '7px 14px',
                    background: 'rgba(245,158,11,0.25)',
                    border: '1px solid rgba(245,158,11,0.45)',
                    borderRadius: '6px',
                    color: '#fef3c7',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ← Paso 4: Completar
                </button>
              </div>
            )}

            {/* ── Selector de Pestañas del Paso 5 ───────────────────────────── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep5Tab('descargas')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: step5Tab === 'descargas' ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.12)',
                  background: step5Tab === 'descargas' ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(79,70,229,0.2) 100%)' : 'rgba(255,255,255,0.04)',
                  color: step5Tab === 'descargas' ? '#e0e7ff' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: step5Tab === 'descargas' ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>📥</span> Descarga de Documentos Oficiales
              </button>

              <button
                type="button"
                onClick={() => setStep5Tab('metas_complementarias')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: step5Tab === 'metas_complementarias' ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.12)',
                  background: step5Tab === 'metas_complementarias' ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.15) 100%)' : 'rgba(255,255,255,0.04)',
                  color: step5Tab === 'metas_complementarias' ? '#a7f3d0' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: step5Tab === 'metas_complementarias' ? '0 4px 12px rgba(16,185,129,0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>🎯</span> Metas Adicionales y Ajustes (Sin Regenerar)
                <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.25)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  Nuevo
                </span>
              </button>
            </div>

            {step5Tab === 'metas_complementarias' ? (
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
            ) : (
              <>
                {/* Banner de tranquilidad y adición rápida */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '18px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💡</span>
                    <span>
                      ¿Omitiste la meta de algún docente o necesitas registrar metas adicionales de último momento?{' '}
                      <strong>No requieres volver a generar todo el PMC.</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep5Tab('metas_complementarias')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid rgba(16,185,129,0.4)',
                      background: 'rgba(16,185,129,0.2)',
                      color: '#6ee7b7',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ➕ Agregar Metas Faltantes
                  </button>
                </div>

                {/* Download buttons */}
                <div style={sectionCard}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#818cf8', marginBottom: '18px' }}>📥 Documentos Oficiales y Entregables</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. ENTREGA PRINCIPAL OFICIAL PARA SUPERVISIÓN */}
                <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.45) 100%)', border: '1.5px solid rgba(99, 102, 241, 0.5)', borderRadius: '10px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#e0e7ff' }}>🏛️ Programa de Mejora Continua (PMC) — Documento Oficial</span>
                      <span style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>ENTREGA OFICIAL SUPERVISIÓN</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(240, 244, 255, 0.8)', marginTop: '6px', lineHeight: '1.5' }}>
                      Documento oficial institucional de 8 secciones canónicas conforme a los lineamientos vigentes de Supervisión Escolar SEMS Puebla. Versiones en Word (.docx) y PDF con contenido, estructura, tablas normativas de 4 columnas con justificación y matriz de seguimiento 100% espejo.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <a
                      href={`/api/pdf/pmc/${projectId}`}
                      onClick={(e) => handleExportWithCoverageCheck(e, `/api/pdf/pmc/${projectId}`)}
                      className="btn btn-primary"
                      style={{ backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📕 Descargar PMC Oficial (.pdf)
                    </a>
                    <a
                      href={`/api/docx/pmc/${projectId}`}
                      onClick={(e) => handleExportWithCoverageCheck(e, `/api/docx/pmc/${projectId}`)}
                      className="btn btn-primary"
                      style={{ backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📄 Descargar PMC Oficial (.docx)
                    </a>
                  </div>
                </div>

                {/* 2. ANEXO TÉCNICO OFICIAL DE SUPERVISIÓN */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#34d399' }}>📊 Anexo Técnico: Matriz de Supervisión y Metas (.xlsx)</span>
                      <span style={{ background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>ANEXO OFICIAL</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>
                      Formato oficial de 3 hojas (Indicadores, Punto de partida, METAS) y Anexo de Plan de Acción alineado byte a byte a los requerimientos de la Supervisión Escolar SEMS Puebla.
                    </div>
                  </div>
                  <a
                    href={`/api/excel/metas/${projectId}`}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, backgroundColor: '#059669', borderColor: '#059669', textDecoration: 'none', fontWeight: 600 }}
                  >
                    ↓ Descargar Excel Anexo (.xlsx)
                  </a>
                </div>

                {/* 3. PLANTILLAS DE SEGUIMIENTO Y EVALUACIÓN */}
                <div style={{ marginTop: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(240,244,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>📁 Plantillas Oficiales de Seguimiento y Monitoreo</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Informe Parcial */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '2px' }}>📋 Plantilla: Informe Parcial de Avance</div>
                        <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)' }}>
                          Formato para el seguimiento a mitad de ciclo. Incluye las metas de tu PMC con espacios para registrar los avances y evidencias reales.
                        </div>
                      </div>
                      <a
                        href={`/api/docx/pmc/${projectId}/informe-parcial`}
                        className="btn btn-sm"
                        style={{ flexShrink: 0, background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.4)', color: '#38bdf8', textDecoration: 'none' }}
                      >
                        ↓ Informe Parcial (.docx)
                      </a>
                    </div>

                    {/* Informe Final */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#34d399', marginBottom: '2px' }}>📋 Plantilla: Informe Final</div>
                        <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)' }}>
                          Formato para el informe anual al cierre del ciclo escolar con espacios para evidencias y conclusiones.
                        </div>
                      </div>
                      <a
                        href={`/api/docx/pmc/${projectId}/informe-final`}
                        className="btn btn-sm"
                        style={{ flexShrink: 0, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', textDecoration: 'none' }}
                      >
                        ↓ Informe Final (.docx)
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

                <div style={{ ...sectionCard, background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fcd34d', marginBottom: '8px' }}>📌 Instrucciones para los Informes</h3>
                  <ul style={{ fontSize: '13px', color: 'rgba(240,244,255,0.75)', paddingLeft: '18px', margin: 0, lineHeight: '1.8' }}>
                    <li>El <strong>Informe Parcial</strong> se entrega aproximadamente a mitad del ciclo escolar (enero-febrero 2026)</li>
                    <li>El <strong>Informe Final</strong> se entrega al cierre del ciclo escolar (junio-julio 2026)</li>
                    <li>Cada trabajador debe registrar sus avances con <strong>evidencias documentales reales</strong> (no fotografías solas)</li>
                    <li>El director(a) consolida los informes individuales y elabora el informe institucional final</li>
                    <li>Los informes deben ser firmados por el director y validados por el supervisor de zona</li>
                  </ul>
                </div>
              </>
            )}
          </div>
  );
}
