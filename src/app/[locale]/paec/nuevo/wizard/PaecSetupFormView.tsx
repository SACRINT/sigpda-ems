'use client';

import React from 'react';
import Link from 'next/link';
import { PaecSetupContextFields } from './PaecSetupContextFields';
import { PaecSetupGroupsPanel } from './PaecSetupGroupsPanel';
import { PaecSetupCurriculumSummary } from './PaecSetupCurriculumSummary';
import type { PaecWizardController } from './usePaecWizardActions';

export function PaecSetupFormView({ w }: { w: PaecWizardController }) {
  const {
    locale,
    loading,
    schoolType,
    fileInputPaecRef,
    uploadingPaec,
    parsedPaecData,
    showPaecReviewModal,
    setShowPaecReviewModal,
    paecSuccessBanner,
    setPaecSuccessBanner,
    paecWarnings,
    setPaecWarnings,
    handleUploadPreviousPaec,
    handleApplyParsedPaec,
    isStep1Valid,
    handleCreate,
  } = w;

  return (
      <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href={`/${locale}/paec`} className="btn btn-ghost" style={{ padding: '8px 12px', color: 'rgba(240,244,255,0.7)' }}>
            ← Volver
          </Link>
          <div>
            <h1 style={{ fontSize: '28px', color: '#f0f4ff', margin: 0, fontWeight: 800, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", letterSpacing: '-0.5px' }}>Nuevo Proyecto PAEC-PEC</h1>
            <p style={{ color: 'rgba(240,244,255,0.6)', margin: '4px 0 0' }}>Completa los datos iniciales de tu plantel y comunidad para comenzar</p>
          </div>
        </div>

        {paecSuccessBanner && (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{paecSuccessBanner}</span>
            <button
              type="button"
              onClick={() => setPaecSuccessBanner(null)}
              style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        )}

        {paecWarnings.length > 0 && (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontWeight: 700 }}>⚠️ Advertencias de extracción del PAEC anterior:</span>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                {paecWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setPaecWarnings([])}
              style={{ background: 'none', border: 'none', color: '#fcd34d', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              title="Cerrar advertencias"
            >
              ×
            </button>
          </div>
        )}

        {/* Barra de Carga Rápida de PAEC Anterior */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📄</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>¿Cuentas con un PAEC anterior en PDF o Word?</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>Sube el archivo para extraer automáticamente problemáticas, diagnóstico y datos del plantel</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputPaecRef.current?.click()}
            disabled={uploadingPaec}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.45)',
              color: '#c7d2fe', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {uploadingPaec ? '⏳ Analizando documento...' : '📄 Cargar PAEC Anterior (PDF/Word)'}
          </button>
          <input
            ref={fileInputPaecRef}
            type="file"
            accept=".pdf,.docx,.doc"
            style={{ display: 'none' }}
            onChange={handleUploadPreviousPaec}
          />
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <PaecSetupContextFields w={w} />
          {/* Estructura de Grupos, Capacitaciones y FFE */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', color: '#818cf8', margin: 0, fontWeight: 700 }}>4. Estructura Curricular y Grupos del Plantel</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
                  Regla de Oro PAEC: Tronco fundamental único por semestre + trayectos específicos por grupo sin asignaturas duplicadas.
                </p>
              </div>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontWeight: 600 }}>
                {schoolType === 'tecnico' ? '⚙️ Bachillerato Tecnológico' : '🏫 Bachillerato General'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <PaecSetupGroupsPanel w={w} />
              <PaecSetupCurriculumSummary w={w} />
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              type="submit"
              disabled={!isStep1Valid || loading}
              className="btn btn-primary"
              style={{
                padding: '12px 28px',
                fontSize: '16px',
                background: (!isStep1Valid || loading) ? '#64748b' : 'linear-gradient(135deg, var(--c-navy) 0%, var(--c-navy-light) 100%)',
                border: 'none',
                cursor: (!isStep1Valid || loading) ? 'not-allowed' : 'pointer',
                opacity: (!isStep1Valid || loading) ? 0.6 : 1,
              }}
            >
              {loading ? 'Guardando...' : 'Guardar y Empezar Generación →'}
            </button>
            {!isStep1Valid && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}>
                * Por favor completa todos los campos obligatorios marcados con asterisco (*) antes de continuar.
              </p>
            )}
          </div>
        </form>

        {/* Modal de Revisión y Confirmación de PAEC Anterior Extraído */}
        {showPaecReviewModal && parsedPaecData && (
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
              maxWidth: '740px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#f0f4ff', fontWeight: 700 }}>
                    📄 Revisión de Datos Extraídos del PAEC Anterior
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Revisa los datos extraídos automáticamente del documento antes de aplicarlos al formulario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaecReviewModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {paecWarnings.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Advertencias de extracción:</div>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {paecWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Proyecto y Problemática */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🎯 Identificación del Proyecto</h4>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Nombre del Proyecto:</strong>
                  <div style={{ fontSize: '13.5px', color: '#f0f4ff', fontWeight: 600 }}>{parsedPaecData.projectName || '(Sin detectar)'}</div>
                </div>
                <div>
                  <strong style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Problemática Central:</strong>
                  <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.4 }}>{parsedPaecData.problemStatement || '(Sin detectar)'}</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11.5px', color: '#a5b4fc' }}>
                  <span>Ciclo: <strong>{parsedPaecData.cycleType === 'annual' ? 'Anual' : `Semestre ${parsedPaecData.cycleType}`}</strong></span>
                  <span>Tipo: <strong>{parsedPaecData.schoolType}</strong></span>
                </div>
              </div>

              {/* Plantel */}
              {parsedPaecData.school && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🏫 Datos del Plantel</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', fontSize: '12px' }}>
                    <div><strong style={{ color: '#94a3b8' }}>Plantel:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.schoolName || '-'}</span></div>
                    <div><strong style={{ color: '#94a3b8' }}>CCT:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.cct || '-'}</span></div>
                    <div><strong style={{ color: '#94a3b8' }}>Director:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.directorName || '-'}</span></div>
                    <div><strong style={{ color: '#94a3b8' }}>Municipio:</strong> <span style={{ color: '#f0f4ff' }}>{parsedPaecData.school.municipality || '-'}</span></div>
                  </div>
                </div>
              )}

              {/* Comunidad */}
              {parsedPaecData.community && parsedPaecData.community.context && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: '#818cf8', fontWeight: 700 }}>🌱 Contexto Comunitario y Territorial</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', maxHeight: '100px', overflowY: 'auto', lineHeight: 1.4 }}>
                    {parsedPaecData.community.context}
                  </p>
                </div>
              )}

              {/* Botones de acción modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowPaecReviewModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyParsedPaec}
                  style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Aplicar al Formulario de PAEC
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
