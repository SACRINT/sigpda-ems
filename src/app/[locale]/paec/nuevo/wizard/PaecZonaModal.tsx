'use client';

import React from 'react';
import { formatZoneMetric } from '@/lib/zone-metric-format';
import type { PaecWizardController } from './usePaecWizardActions';

export function PaecZonaModal({ w }: { w: PaecWizardController }) {
  const {
    zonaData,
    showZonaModal,
    setShowZonaModal,
    handleAplicarSugerenciasZona,
  } = w;

  return (
    <>
        {/* Modal de Sincronización con Cartografía de Zona (Fase 9) */}
        {showZonaModal && zonaData?.zona && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 25, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}>
            <div style={{
              background: '#0d1530',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              color: '#f0f4ff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#c7d2fe' }}>
                    🗺️ Cartografía de Zona Escolar Disponible
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Sincronización asistida para el PAEC basada en el MCCEMS Puebla 2026-2027
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowZonaModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '20px',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Ficha de la Zona */}
              <div style={{
                background: '#1e293b',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Zona Escolar</span>
                  <strong style={{ fontSize: '13px', color: '#818cf8' }}>
                    {zonaData.zona.identificacion.zonaNumero ? `Zona ${zonaData.zona.identificacion.zonaNumero}` : 'Zona Oficial'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Supervisión</span>
                  <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {zonaData.zona.identificacion.supervisorName || 'Supervisión de Zona'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Subsistema</span>
                  <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {zonaData.zona.identificacion.subsistema || 'EMS Puebla'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Ciclo Escolar</span>
                  <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {zonaData.zona.identificacion.cicloEscolar || '2026-2027'}
                  </strong>
                </div>
              </div>

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

              {/* Registro previo en Cartografía (si existe) */}
              {zonaData.plantel?.paecProyecto && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase' }}>
                    📌 PAEC Pre-registrado en la Cartografía de Zona:
                  </span>
                  <p style={{ margin: '4px 0 2px', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                    {zonaData.plantel.paecProyecto}
                  </p>
                  {zonaData.plantel.paecProblematica && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>
                      {zonaData.plantel.paecProblematica}
                    </p>
                  )}
                </div>
              )}

              {/* Diagnóstico Territorial de Zona */}
              {zonaData.zona.momento3Territorio?.descripcionTerritorial && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                    📍 Diagnóstico Territorial de Zona (Momento 3):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {zonaData.zona.momento3Territorio.descripcionTerritorial}
                  </p>
                </div>
              )}

              {/* Problemáticas Comunes de la Zona */}
              {zonaData.zona.problematicasComunes && zonaData.zona.problematicasComunes.length > 0 && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                    🎯 Problemáticas Comunitarias Identificadas en la Zona:
                  </span>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1' }}>
                    {zonaData.zona.problematicasComunes.map((prob, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{prob}</li>
                    ))}
                  </ul>
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
                  ✨ Aplicar sugerencias de zona a mi PAEC
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
