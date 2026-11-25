'use client';

import React from 'react';
import {
  SUBSISTEMAS,
  inputStyle,
  labelStyle,
  sectionCard,
} from './helpers';
import type { PmcWizardController } from './usePmcGenerationAndNav';

export function Step1DatosInstitucionales({ w }: { w: PmcWizardController }) {
  const {
    schoolName,
    setSchoolName,
    schoolCct,
    setSchoolCct,
    municipality,
    setMunicipality,
    locality,
    setLocality,
    schoolZone,
    setSchoolZone,
    directorName,
    directorSource,
    setDirectorSource,
    directorMismatchWarning,
    alternativeDirector,
    setAlternativeDirector,
    supervisorName,
    setSupervisorName,
    cicloEscolar,
    setCicloEscolar,
    subsystem,
    setSubsystem,
    loadingZona,
    fileInputPmcRef,
    uploadingPmc,
    parsedPmcData,
    ingestCoverage,
    setShowPmcReviewModal,
    fileInputPaecRef,
    uploadingPaec,
    fileInputF11Ref,
    fileInput911Ref,
    activeMomento911,
    uploadingF11,
    uploading911,
    docsStatus,
    triggerUpload911,
    handleUploadPreviousPmc,
    handleDirectorNameChange,
    handleUploadF11,
    handleUpload911,
    handleUploadPreviousPaec,
    handleConsultarZona,
  } = w;

  return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 1: Datos Institucionales
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Ingresa los datos generales del plantel educativo. Esta información aparecerá en la portada del PMC.
            </p>

            {/* Barra de Acciones Inteligentes: Cargar PMC Anterior + F11 + Estadística 911 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Carga Inteligente de Documentos Oficiales</div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>Sube F11 (calificaciones), Estadística 911 (matrícula), PMC o PAEC anterior para pre-llenar tu PMC</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputF11Ref.current?.click()}
                  disabled={uploadingF11}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.f11 ? 'rgba(14,165,233,0.35)' : 'rgba(14,165,233,0.2)',
                    border: '1px solid rgba(14,165,233,0.45)',
                    color: '#7dd3fc', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploadingF11 ? '⏳ Analizando F11...' : `📊 F11 (Fin Ciclo Anterior)${docsStatus.f11 ? ' ✓' : ''}`}
                </button>
                <input ref={fileInputF11Ref} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,image/*" style={{ display: 'none' }} onChange={handleUploadF11} />

                <button
                  type="button"
                  onClick={() => triggerUpload911('fin_anterior')}
                  disabled={uploading911}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.n911FinAnt ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.2)',
                    border: '1px solid rgba(245,158,11,0.45)',
                    color: '#fcd34d', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'fin_anterior' ? '⏳...' : `📈 911 (Fin Ciclo Ant.)${docsStatus.n911FinAnt ? ' ✓' : ''}`}
                </button>

                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_anterior')}
                  disabled={uploading911}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.n911IniAnt ? 'rgba(56,189,248,0.35)' : 'rgba(56,189,248,0.2)',
                    border: '1px solid rgba(56,189,248,0.45)',
                    color: '#38bdf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_anterior' ? '⏳...' : `📈 911 (Inicio Ciclo Ant.)${docsStatus.n911IniAnt ? ' ✓' : ''}`}
                </button>

                <button
                  type="button"
                  onClick={() => triggerUpload911('inicio_actual')}
                  disabled={uploading911}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.n911IniAct ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.2)',
                    border: '1px solid rgba(16,185,129,0.45)',
                    color: '#6ee7b7', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploading911 && activeMomento911 === 'inicio_actual' ? '⏳...' : `📈 911 (Inicio Ciclo Act.)${docsStatus.n911IniAct ? ' ✓' : ''}`}
                </button>
                <input ref={fileInput911Ref} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,image/*" style={{ display: 'none' }} onChange={handleUpload911} />

                <button
                  type="button"
                  onClick={() => fileInputPmcRef.current?.click()}
                  disabled={uploadingPmc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.pmcAnt ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.2)',
                    border: '1px solid rgba(99,102,241,0.45)',
                    color: '#c7d2fe', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploadingPmc ? '⏳ Analizando...' : `📄 Cargar PMC Anterior${docsStatus.pmcAnt ? ' ✓' : ''}`}
                </button>
                <input ref={fileInputPmcRef} type="file" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,image/*" style={{ display: 'none' }} onChange={handleUploadPreviousPmc} />

                <button
                  type="button"
                  onClick={() => fileInputPaecRef.current?.click()}
                  disabled={uploadingPaec}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '8px',
                    background: docsStatus.paecAnt ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.2)',
                    border: '1px solid rgba(168,85,247,0.45)',
                    color: '#e9d5ff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {uploadingPaec ? '⏳ Analizando PAEC...' : `📄 Cargar PAEC anterior (PDF/Word)${docsStatus.paecAnt ? ' ✓' : ''}`}
                </button>
                <input ref={fileInputPaecRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={handleUploadPreviousPaec} />
              </div>
            </div>

            {/* Banner de estado PMC anterior y reintento de extracción (H-282) */}
            {docsStatus.pmcAnt && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: '8px', marginBottom: '20px',
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                color: '#c7d2fe', fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📜</span>
                  <span>
                    <strong>PMC anterior cargado:</strong> {parsedPmcData?.metas_institucionales_previas?.length ?? ingestCoverage?.detalles?.metas?.extraidos ?? 0} metas institucionales ({parsedPmcData?.elementos_plan?.length ?? ingestCoverage?.extraidos ?? 0} elementos listos)
                    {ingestCoverage?.parcial && typeof ingestCoverage.detectados === 'number' && ingestCoverage.extraidos < ingestCoverage.detectados && (
                      <span style={{ color: '#fbbf24', marginLeft: '6px' }}>— Cobertura parcial ({ingestCoverage.extraidos}/{ingestCoverage.detectados})</span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPmcReviewModal(true)}
                    style={{
                      background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                      color: '#e0e7ff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    👁️ Revisar datos
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputPmcRef.current?.click()}
                    disabled={uploadingPmc}
                    style={{
                      background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
                      color: '#fcd34d', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    {uploadingPmc ? '⏳ Procesando...' : '🔄 Reintentar extracción'}
                  </button>
                </div>
              </div>
            )}

            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>🏫 Datos del Plantel</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Nombre oficial del plantel *</label>
                  <input style={inputStyle} value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ej: Bachillerato General Oficial 'Lázaro Cárdenas'" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={labelStyle}>Clave de Centro de Trabajo (CCT) *</label>
                    <button
                      type="button"
                      onClick={handleConsultarZona}
                      disabled={loadingZona || !schoolCct.trim()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: schoolCct.trim() ? '#818cf8' : 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        cursor: schoolCct.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        marginBottom: '4px',
                      }}
                    >
                      {loadingZona ? '🔍 Consultando...' : '✨ Consultar Datos de Zona'}
                    </button>
                  </div>
                  <input style={inputStyle} value={schoolCct} onChange={e => setSchoolCct(e.target.value.toUpperCase())} placeholder="Ej: 21EBH0000A" maxLength={12} />
                  <small style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>Formato: 21EBH0000X (10 caracteres)</small>
                </div>
                <div>
                  <label style={labelStyle}>Subsistema</label>
                  <select style={inputStyle} value={subsystem} onChange={e => setSubsystem(e.target.value)}>
                    {SUBSISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Municipio *</label>
                  <input style={inputStyle} value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="Ej: Zacapoaxtla" />
                </div>
                <div>
                  <label style={labelStyle}>Localidad / Comunidad *</label>
                  <input style={inputStyle} value={locality} onChange={e => setLocality(e.target.value)} placeholder="Ej: San Marcos Tlacoyalco" />
                </div>
                <div>
                  <label style={labelStyle}>Zona Escolar</label>
                  <input style={inputStyle} value={schoolZone} onChange={e => setSchoolZone(e.target.value)} placeholder="Ej: Zona 004" />
                </div>
                <div>
                  <label style={labelStyle}>Ciclo escolar</label>
                  <input style={inputStyle} value={cicloEscolar} onChange={e => setCicloEscolar(e.target.value)} placeholder="2025-2026" />
                </div>
              </div>
            </div>

            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>👤 Autoridades</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Nombre del Director(a) *</label>
                  <input style={inputStyle} value={directorName} onChange={e => handleDirectorNameChange(e.target.value)} placeholder="Nombre completo del director(a)" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: directorSource === 'manual' ? 'rgba(99,102,241,0.2)' : directorSource === 'bd' ? 'rgba(16,185,129,0.2)' : 'rgba(14,165,233,0.2)',
                      color: directorSource === 'manual' ? '#a5b4fc' : directorSource === 'bd' ? '#6ee7b7' : '#7dd3fc',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      {directorSource === 'manual' ? '✏️ Edición manual (Prioridad Máxima)' :
                       directorSource === 'bd' ? '🏛️ Registrado en BD' :
                       directorSource === 'f11' ? '📊 Extraído de F11' :
                       directorSource === '911' ? '📈 Extraído de Estadística 911' :
                       directorSource === 'paec' ? '📘 Extraído de PAEC' :
                       directorSource === 'pmc_anterior' ? '📜 Extraído de PMC anterior' :
                       directorSource === 'draft' ? '💾 Restaurado de borrador' : '⚠️ Pendiente de captura o carga'}
                    </span>
                  </div>
                  {alternativeDirector && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#93c5fd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}>
                      <span>
                        ℹ️ Director actualizado con PMC anterior (&ldquo;{directorName}&rdquo;). En {alternativeDirector.source === '911' ? 'Estadística 911' : alternativeDirector.source === 'f11' ? 'F11' : 'otro origen'} figuraba &ldquo;{alternativeDirector.name}&rdquo;.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const prevName = alternativeDirector.name;
                          const prevSource = alternativeDirector.source;
                          setAlternativeDirector({ name: directorName, source: directorSource });
                          handleDirectorNameChange(prevName);
                          setDirectorSource(prevSource);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Usar &ldquo;{alternativeDirector.name}&rdquo; ({alternativeDirector.source === '911' ? '911' : 'previo'})
                      </button>
                    </div>
                  )}
                  {directorMismatchWarning && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', fontSize: '12px', color: '#fcd34d' }}>
                      ⚠️ {directorMismatchWarning}
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Nombre del Supervisor(a) de Zona</label>
                  <input style={inputStyle} value={supervisorName} onChange={e => setSupervisorName(e.target.value)} placeholder="Nombre completo del supervisor(a)" />
                </div>
              </div>
            </div>
          </div>
  );
}
