'use client';

import React from 'react';
import {
  CATEGORIAS_OFICIALES,
  inputStyle,
  labelStyle,
  sectionCard,
} from './helpers';
import type { PmcWizardController } from './usePmcGenerationAndNav';

export function Step3Diagnostico({ w }: { w: PmcWizardController }) {
  const {
    schoolCct,
    cicloEscolar,
    diagnosticoComunidad,
    setDiagnosticoComunidad,
    indicadores,
    setIndicadores,
    metasConfirmadas,
    setMetasConfirmadas,
    metasMateriasConfirmadas,
    setMetasMateriasConfirmadas,
    foda,
    setFoda,
    categoriasPriorizadas,
    loadingZona,
    zonaFeedback,
    f11Warnings,
    fileInputF11Ref,
    activeMomento911,
    uploadingF11,
    uploading911,
    docsStatus,
    triggerUpload911,
    handleConsultarZona,
    handleConfirmarMetasCiclo,
    handleConfirmarMetasMaterias,
    toggleCategoria,
    toggleTema,
    isCatSelected,
    isTemaSelected,
    totalTemasSeleccionados,
  } = w;

  return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 3: Diagnóstico Socioeducativo
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Proporciona los datos del contexto comunitario, los indicadores académicos del ciclo anterior
              y el análisis FODA. La IA usará esta información para redactar el diagnóstico oficial.
            </p>

            {/* Banner: Carga de Datos Oficiales + Cartografía de Zona */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.28)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <div>
                <strong style={{ color: '#c7d2fe', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📊 Datos Oficiales para el Diagnóstico
                </strong>
                <p style={{ margin: '2px 0 0', color: 'rgba(240, 244, 255, 0.6)', fontSize: '12px' }}>
                  Sube tu F11 y Estadística 911, o consulta la Cartografía de Zona para benchmarks regionales.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputF11Ref.current?.click()}
                  disabled={uploadingF11}
                  style={{
                    padding: '7px 14px',
                    background: uploadingF11 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploadingF11 ? '⏳...' : `📊 F11${docsStatus.f11 ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => triggerUpload911('fin_anterior')}
                  disabled={uploading911}
                  style={{
                    padding: '7px 14px',
                    background: uploading911 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'fin_anterior' ? '⏳...' : `📈 911 Fin Ant.${docsStatus.n911FinAnt ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_anterior')}
                  disabled={uploading911}
                  style={{
                    padding: '7px 14px',
                    background: uploading911 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_anterior' ? '⏳...' : `📈 911 Ini Ant.${docsStatus.n911IniAnt ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_actual')}
                  disabled={uploading911}
                  style={{
                    padding: '7px 14px',
                    background: uploading911 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_actual' ? '⏳...' : `📈 911 Inicio Act.${docsStatus.n911IniAct ? ' ✓' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={handleConsultarZona}
                  disabled={loadingZona || !schoolCct.trim()}
                  style={{
                    padding: '7px 14px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: schoolCct.trim() ? 'pointer' : 'not-allowed',
                    opacity: schoolCct.trim() ? 1 : 0.5,
                  }}
                >
                  {loadingZona ? 'Consultando...' : '🗺️ Zona'}
                </button>
              </div>
            </div>

            {zonaFeedback && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {zonaFeedback}
              </div>
            )}

            {/* Contexto Comunitario */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>🌍 Contexto de la Comunidad</h3>
              <label style={labelStyle}>Descripción del contexto socioeducativo de la comunidad *</label>
              <textarea
                style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
                value={diagnosticoComunidad}
                onChange={e => setDiagnosticoComunidad(e.target.value)}
                placeholder="Describe la comunidad donde se ubica el plantel: ubicación geográfica, número de habitantes, condiciones socioeconómicas, acceso a servicios, problemáticas sociales relevantes (migración, marginación, violencia), acceso a internet y tecnología, distancia a centros urbanos, principales fuentes de empleo, etc."
              />
              <small style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
                Incluye datos cuantitativos si los tienes (número de habitantes, % de marginación, etc.)
              </small>
            </div>

            {/* Indicadores académicos */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '8px' }}>📊 Indicadores Académicos y Metas del Plantel</h3>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '8px' }}>
                La plataforma <strong>calcula todos los porcentajes</strong> a partir de los documentos oficiales subidos (F11 y Estadística 911). Las metas del ciclo {cicloEscolar} son sugeridas conforme a los lineamientos oficiales y deben ser confirmadas antes de generar el plan.
              </p>
              <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px', color: '#7dd3fc', marginBottom: '16px' }}>
                💡 <strong>Cálculo Determinístico:</strong> Ningún porcentaje de línea base se captura a mano. Si falta un archivo, se muestra &quot;N/D (falta &lt;archivo&gt;)&quot;. Las metas son lo único que se sugiere y tú dispones o confirmas su valor final.
              </div>

              {/* H-225: Advertencia de Línea Base si usa fallback de fin o falta concentrado de inicio */}
              {indicadores.baselineWarning && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span>⚠️</span>
                  <span><strong>Advertencia de Línea Base:</strong> {indicadores.baselineWarning}</span>
                </div>
              )}

              {/* H-226: Consumo visible de Cross-Checks F11 ↔ 911 */}
              {Boolean(indicadores.totalAlumnosF11 && (indicadores.existenciaFin || indicadores.matriculaAnterior)) && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11.5px',
                  color: '#c7d2fe',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔍</span> Cross-Checks F11 ↔ 911 (Consistencia de Control Escolar y Estadística):
                  </div>
                  <div style={{ fontSize: '11px', color: '#e0e7ff', lineHeight: 1.5 }}>
                    • Total Alumnos F11: <strong>{indicadores.totalAlumnosF11}</strong> vs Existencia 911: <strong>{indicadores.existenciaFin ?? indicadores.matriculaAnterior}</strong>
                    {indicadores.bajas !== undefined && ` (Bajas F11: ${indicadores.bajas})`}
                    {indicadores.bajasDefinitivas !== undefined && ` vs (Bajas 911: ${indicadores.bajasDefinitivas})`}
                  </div>
                </div>
              )}

              {/* H-240: F11 column mismatch / zip truncation warnings */}
              {f11Warnings.length > 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.10)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#fde68a',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Advertencias del F11 (requiere revisión):</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.6 }}>
                    {f11Warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* 5 Tarjetas Situacionales */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f0f4ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>👥</span> Diagnóstico Situacional del Alumnado (F11 Base: {indicadores.totalAlumnosF11 ? `${indicadores.totalAlumnosF11} alumnos` : 'N/D (falta F11)'})
                  </h4>
                  <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.6)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                    100% calculado determinísticamente
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                  {/* Card 1: Aprobados */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: (Regulares + Irregulares) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.aprobacion_ant?.formula ||
                           (indicadores.regulares !== undefined && indicadores.irregulares !== undefined && indicadores.porcentajes?.aprobados !== undefined
                             ? `(${indicadores.regulares} Regulares + ${indicadores.irregulares} Irregulares) / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.aprobados}%`
                             : 'Fórmula: (Regulares + Irregulares) / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🎓 Aprobados
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.aprobados !== undefined ? `${indicadores.porcentajes.aprobados}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.aprobados !== undefined ? `${indicadores.aprobados} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#a7f3d0', marginTop: '6px', fontStyle: 'italic' }}>
                      Con derecho a reinscripción
                    </div>
                  </div>

                  {/* Card 2: Regulares */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Alumnos regulares (0 adeudos) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.regulares?.formula ||
                           (indicadores.regulares !== undefined && indicadores.porcentajes?.regulares !== undefined
                             ? `${indicadores.regulares} alumnos regulares / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.regulares}%`
                             : 'Fórmula: Alumnos regulares / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📘 Regulares
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.regulares !== undefined ? `${indicadores.porcentajes.regulares}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.regulares !== undefined ? `${indicadores.regulares} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#bae6fd', marginTop: '6px', fontStyle: 'italic' }}>
                      0 adeudos de materias
                    </div>
                  </div>

                  {/* Card 3: Irregulares */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Alumnos irregulares (1-3 adeudos) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.irregulares?.formula ||
                           (indicadores.irregulares !== undefined && indicadores.porcentajes?.irregulares !== undefined
                             ? `${indicadores.irregulares} alumnos irregulares / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.irregulares}%`
                             : 'Fórmula: Alumnos irregulares / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📙 Irregulares
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.irregulares !== undefined ? `${indicadores.porcentajes.irregulares}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.irregulares !== undefined ? `${indicadores.irregulares} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fef08a', marginTop: '6px', fontStyle: 'italic' }}>
                      arrastrando hasta 3 materias
                    </div>
                  </div>

                  {/* Card 4: Reprobados */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Alumnos reprobados (4+ adeudos) / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.reprobacion_ant?.formula ||
                           (indicadores.reprobados !== undefined && indicadores.porcentajes?.reprobados !== undefined
                             ? `${indicadores.reprobados} alumnos reprobados / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.reprobados}%`
                             : 'Fórmula: Alumnos reprobados / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fda4af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📕 Reprobados
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#f43f5e', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.reprobados !== undefined ? `${indicadores.porcentajes.reprobados}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.reprobados !== undefined ? `${indicadores.reprobados} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fecdd3', marginTop: '6px', fontStyle: 'italic' }}>
                      no inscribibles al siguiente semestre
                    </div>
                  </div>

                  {/* Card 5: Bajas */}
                  <div
                    title={
                      !indicadores.totalAlumnosF11
                        ? 'Fórmula: Bajas registradas ("B") / Total alumnos F11 (falta cargar F11)'
                        : (indicadores._calc?.bajas?.formula ||
                           (indicadores.bajas !== undefined && indicadores.porcentajes?.bajas !== undefined
                             ? `${indicadores.bajas} bajas registradas ("B") / ${indicadores.totalAlumnosF11} = ${indicadores.porcentajes.bajas}%`
                             : 'Fórmula: Bajas registradas / Total alumnos F11'))
                    }
                    style={{
                      background: 'rgba(251, 146, 60, 0.08)',
                      border: '1px solid rgba(251, 146, 60, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'help',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fdba74', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ⚠️ Bajas
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#fb923c', margin: '4px 0 2px' }}>
                      {indicadores.totalAlumnosF11 && indicadores.porcentajes?.bajas !== undefined ? `${indicadores.porcentajes.bajas}%` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.75)' }}>
                      {indicadores.totalAlumnosF11 && indicadores.bajas !== undefined ? `${indicadores.bajas} alumnos` : 'N/D (falta F11)'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fed7aa', marginTop: '6px', fontStyle: 'italic' }}>
                      Marcados con clave &quot;B&quot;
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Indicadores Académicos Oficiales (H-221) */}
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '38%' }}>Indicador</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '31%' }}>% Ciclo Anterior (Línea Base)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '31%' }}>% Meta {cicloEscolar}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: 'Aprobación',
                        fuente: 'F11',
                        antKey: 'aprobacion_ant' as const,
                        metaKey: 'aprobacion_meta' as const,
                        falta: 'N/D (falta F11)',
                      },
                      {
                        label: 'Reprobación',
                        fuente: 'F11',
                        antKey: 'reprobacion_ant' as const,
                        metaKey: 'reprobacion_meta' as const,
                        falta: 'N/D (falta F11)',
                      },
                      {
                        label: 'Abandono escolar / Deserción',
                        fuente: '911 Fin',
                        antKey: 'abandono_ant' as const,
                        metaKey: 'abandono_meta' as const,
                        falta: 'N/D (falta 911 Fin)',
                      },
                      {
                        label: 'Eficiencia terminal',
                        fuente: '911 Fin',
                        antKey: 'et_ant' as const,
                        metaKey: 'et_meta' as const,
                        falta: 'N/D (falta 911 Fin)',
                      },
                    ].map((row, i) => {
                      const antVal = indicadores[row.antKey];
                      const metaVal = indicadores[row.metaKey];
                      const hasBaseline = antVal !== undefined && !isNaN(Number(antVal));
                      return (
                        <tr key={row.label} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.06)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontWeight: 600, color: '#f0f4ff' }}>{row.label}</span>
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: row.fuente === 'F11' ? 'rgba(14,165,233,0.2)' : 'rgba(245,158,11,0.2)',
                              color: row.fuente === 'F11' ? '#7dd3fc' : '#fcd34d',
                              border: `1px solid ${row.fuente === 'F11' ? 'rgba(14,165,233,0.3)' : 'rgba(245,158,11,0.3)'}`
                            }}>
                              {row.fuente}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {hasBaseline ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: '#f0f4ff' }}>
                                  {antVal}%
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(16,185,129,0.15)',
                                  color: '#6ee7b7',
                                  border: '1px solid rgba(16,185,129,0.25)',
                                }}>
                                  cálculo oficial
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ color: 'rgba(240,244,255,0.4)', fontWeight: 600 }}>—</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(239,68,68,0.15)',
                                  color: '#fca5a5',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                }}>
                                  {row.falta}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {hasBaseline ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  style={{
                                    width: '74px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(99,102,241,0.4)',
                                    textAlign: 'center',
                                    background: 'rgba(99,102,241,0.12)',
                                    color: '#f0f4ff',
                                    fontWeight: 700,
                                  }}
                                  value={metaVal ?? ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                    setIndicadores(p => ({
                                      ...p,
                                      [row.metaKey]: val,
                                      metas_confirmadas: false,
                                    }));
                                    setMetasConfirmadas(false);
                                  }}
                                  placeholder="—"
                                />
                                <span>%</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(99,102,241,0.2)',
                                  color: '#a5b4fc',
                                  border: '1px solid rgba(99,102,241,0.3)',
                                }}>
                                  sugerida
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: metasConfirmadas ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                                  color: metasConfirmadas ? '#6ee7b7' : '#fcd34d',
                                  border: `1px solid ${metasConfirmadas ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                }}>
                                  {metasConfirmadas ? '✓ confirmada' : 'pendiente'}
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ color: 'rgba(240,244,255,0.4)', fontWeight: 600 }}>—</span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(245,158,11,0.15)',
                                  color: '#fcd34d',
                                  border: '1px solid rgba(245,158,11,0.25)',
                                }}>
                                  N/D (falta línea base)
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Matrícula y Confirmación de Metas del Ciclo */}
              <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(8,12,24,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Matrícula total del plantel (alumnos)</label>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                          911 Inicio
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: indicadores.matricula ? '#f0f4ff' : 'rgba(240,244,255,0.4)', padding: '6px 0' }}>
                        {indicadores.matricula ? `${indicadores.matricula} alumnos` : '— (N/D falta 911 Inicio)'}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Matrícula meta proyectada</label>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                          sugerida
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        style={{ ...inputStyle, width: '160px' }}
                        value={indicadores.matricula_meta ?? ''}
                        onChange={e => {
                          const val = parseInt(e.target.value) || undefined;
                          setIndicadores(p => ({ ...p, matricula_meta: val, metas_confirmadas: false }));
                          setMetasConfirmadas(false);
                        }}
                        placeholder={indicadores.matricula ? String(indicadores.matricula) : '—'}
                      />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleConfirmarMetasCiclo}
                      style={{
                        padding: '10px 18px',
                        background: metasConfirmadas ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {metasConfirmadas ? '✓ Metas del Ciclo Confirmadas' : '🎯 Confirmar Metas del Ciclo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Metas por Asignatura (Paquete A2 / D5) */}
              {Array.isArray(indicadores.reprobacionPorMateria) && indicadores.reprobacionPorMateria.length > 0 && (
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f0f4ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📚</span> Metas de Reducción de Reprobación por Asignatura
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(240,244,255,0.6)' }}>
                        Calculadas a partir del F11 según regla de bandas (&le;5%: 0.0%, 5-20%: -5 pts, &gt;20%: -10 pts). Tú dispones y confirmas la meta final.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmarMetasMaterias}
                      style={{
                        padding: '8px 14px',
                        background: metasMateriasConfirmadas ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {metasMateriasConfirmadas ? '✓ Metas por Asignatura Confirmadas' : '🎯 Confirmar Metas por Asignatura'}
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(14,165,233,0.18)', color: '#f0f4ff' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Asignatura / UAC</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>n</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '100px' }}>Reprobados</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '120px' }}>% Reprobación Actual</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>% Meta Sugerida</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '120px' }}>Meta Plantel (%)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicadores.reprobacionPorMateria.map((mat, mIdx) => {
                          const isZero = mat.porcentaje === 0 || mat.reprobados === 0;
                          return (
                            <tr key={mat.materia + mIdx} style={{ background: mIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(14,165,233,0.04)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#f0f4ff' }}>
                                {mat.materia}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: 'rgba(240,244,255,0.8)' }}>
                                {mat.n}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: mat.reprobados > 0 ? '#fda4af' : '#6ee7b7' }}>
                                {mat.reprobados}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: mat.porcentaje > 15 ? '#fb7185' : mat.porcentaje > 5 ? '#fcd34d' : '#6ee7b7' }}>
                                {mat.porcentaje}%
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#a5b4fc', fontWeight: 600 }}>
                                {mat.metaSugerida !== undefined ? `${mat.metaSugerida}%` : '0.0%'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                {isZero ? (
                                  <span style={{ fontSize: '11px', color: '#6ee7b7' }}>0.0%</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    style={{
                                      width: '65px',
                                      padding: '3px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(14,165,233,0.4)',
                                      textAlign: 'center',
                                      background: 'rgba(14,165,233,0.1)',
                                      color: '#f0f4ff',
                                      fontWeight: 600,
                                    }}
                                    value={mat.metaUsuario !== undefined ? mat.metaUsuario : mat.metaSugerida ?? 0}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setIndicadores(p => {
                                        const list = [...(p.reprobacionPorMateria || [])];
                                        if (list[mIdx]) {
                                          list[mIdx] = { ...list[mIdx], metaUsuario: val, metaConfirmada: false };
                                        }
                                        return { ...p, reprobacionPorMateria: list };
                                      });
                                      setMetasMateriasConfirmadas(false);
                                    }}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                {isZero ? (
                                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' }}>
                                    sin reprobación
                                  </span>
                                ) : mat.metaConfirmada ? (
                                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                                    ✓ Confirmada
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    Sugerida
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* FODA */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>📋 Análisis FODA del Plantel</h3>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.7)', marginBottom: '16px', lineHeight: '1.5' }}>
                ✨ <strong>Generado y enriquecido automáticamente:</strong> La plataforma integra los antecedentes del PMC previo, las problemáticas del PAEC, las estadísticas de F11 y 911, y el contexto territorial. El colectivo docente puede revisar, validar o enriquecer cada cuadrante según sus acuerdos colegiados.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { key: 'fortalezas' as const, label: '💪 Fortalezas', hint: 'Recursos, capacidades y ventajas internas del plantel', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', color: '#34d399' },
                  { key: 'oportunidades' as const, label: '🌟 Oportunidades', hint: 'Factores externos favorables que puede aprovechar el plantel', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.25)', color: '#38bdf8' },
                  { key: 'debilidades' as const, label: '⚠️ Debilidades', hint: 'Limitaciones internas y áreas de oportunidad del plantel', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', color: '#fcd34d' },
                  { key: 'amenazas' as const, label: '🔴 Amenazas', hint: 'Factores externos que pueden afectar negativamente al plantel', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.25)', color: '#fb7185' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ ...labelStyle, color: field.color }}>{field.label}</label>
                    <small style={{ display: 'block', color: 'rgba(240,244,255,0.45)', fontSize: '11px', marginBottom: '6px' }}>{field.hint}</small>
                    <textarea
                      style={{ ...inputStyle, minHeight: '100px', background: field.bg, border: `1px solid ${field.border}`, resize: 'vertical' }}
                      value={foda[field.key]}
                      onChange={e => setFoda(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Lista los principales ${field.label.split(' ')[1].toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Categorías y Temas Priorizados */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>🎯 Categorías y Temas a Priorizar *</h3>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.55)', marginBottom: '8px' }}>
                Según los <strong>Lineamientos MCCEMS 2025-2026</strong>, el PMC se organiza en <strong>3 categorías oficiales</strong>. Selecciona la(s) categoría(s) y marca los <strong>temas específicos</strong> que tu plantel abordará. La IA generará metas SMART (con Diagnóstico → Meta → Estrategia → Producto) para cada tema seleccionado.
              </p>
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#a5b4fc' }}>
                <strong>📐 Metodología SMART:</strong> Cada meta que genere la IA será: <em>Específica · Medible · Alcanzable · Relevante · Temporal</em> — siguiendo la estructura: <strong>Diagnóstico → Meta → Estrategia → Producto</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {CATEGORIAS_OFICIALES.map(cat => {
                  const selected = isCatSelected(cat.id);
                  const temasSeleccionados = categoriasPriorizadas.find(c => c.id === cat.id)?.temas ?? [];
                  return (
                    <div key={cat.id} style={{ border: `2px solid ${selected ? cat.color : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', overflow: 'hidden', transition: 'all 0.2s' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: selected ? `${cat.color}22` : 'rgba(255,255,255,0.03)', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCategoria(cat)}
                          style={{ width: '18px', height: '18px', accentColor: cat.color, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: selected ? cat.color : '#f0f4ff' }}>{cat.nombre}</span>
                          {selected && temasSeleccionados.length > 0 && (
                            <span style={{ marginLeft: '10px', fontSize: '11px', background: cat.color, color: '#fff', borderRadius: '20px', padding: '2px 8px' }}>
                              {temasSeleccionados.length} tema(s)
                            </span>
                          )}
                        </div>
                      </label>
                      {selected && (
                        <div style={{ padding: '8px 16px 14px 48px', background: 'rgba(8,12,24,0.6)', borderTop: `1px solid ${cat.color}40` }}>
                          <p style={{ fontSize: '11px', color: 'rgba(240,244,255,0.4)', marginBottom: '8px', fontStyle: 'italic' }}>
                            Selecciona los temas específicos que trabajará tu plantel en esta categoría:
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {cat.temas.map(tema => (
                              <label key={tema} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isTemaSelected(cat.id, tema) ? cat.color : 'rgba(240,244,255,0.75)', fontWeight: isTemaSelected(cat.id, tema) ? 600 : 400 }}>
                                <input
                                  type="checkbox"
                                  checked={isTemaSelected(cat.id, tema)}
                                  onChange={() => toggleTema(cat.id, tema)}
                                  style={{ width: '14px', height: '14px', marginTop: '2px', accentColor: cat.color, flexShrink: 0 }}
                                />
                                {tema}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {totalTemasSeleccionados > 0 && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', fontSize: '13px', color: '#34d399', fontWeight: 600 }}>
                  ✅ {categoriasPriorizadas.length} categoría(s) · {totalTemasSeleccionados} tema(s) seleccionado(s) — la IA generará una meta SMART por cada tema
                </div>
              )}
            </div>
          </div>
  );
}
