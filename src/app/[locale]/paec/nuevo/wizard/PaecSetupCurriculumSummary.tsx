'use client';

import React from 'react';
import { UACS_LABORALES_OFICIALES_BGE } from '@/lib/capacitaciones-data';
import { CAPACITACION_TITLES, FFE_PAIRS } from './helpers';
import type { PaecWizardController } from './usePaecWizardActions';

export function PaecSetupCurriculumSummary({ w }: { w: PaecWizardController }) {
  const {
    cycleType,
    selectedFundamental,
    setSelectedFundamental,
    selectedLaboralCustom,
    setSelectedLaboralCustom,
    selectedFfeCustom,
    setSelectedFfeCustom,
    schoolType,
    assignedLaboralTracks,
    allAssignedLaboralUacs,
    selectedLaboral,
    allAssignedFfeUacs,
    selectedFfe,
    showFundamentalCustomizer,
    setShowFundamentalCustomizer,
    availableFundamentalUacs,
    uniqueUacsList,
    groupedLaboral,
  } = w;

  return (
    <>
              {/* 4.3.5 Selección de Asignaturas del Tronco Fundamental (Soporte Multi-PAEC) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13.5px', color: '#f0f4ff', margin: 0 }}>
                      <span>📘 Tronco Fundamental</span>
                      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: selectedFundamental.length > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(52,211,153,0.15)', color: selectedFundamental.length > 0 ? '#a5b4fc' : '#34d399', border: `1px solid ${selectedFundamental.length > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(52,211,153,0.3)'}` }}>
                        {selectedFundamental.length > 0 ? `${selectedFundamental.length} seleccionadas (Multi-PAEC)` : 'Todas incluidas (100%)'}
                      </span>
                    </label>
                    <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)', margin: '4px 0 0' }}>
                      Por defecto, el PAEC abarca el 100% de las materias fundamentales. Si tu plantel desarrolla múltiples proyectos PAEC paralelos, puedes seleccionar qué materias específicas participan en este proyecto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFundamentalCustomizer(prev => !prev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: showFundamentalCustomizer ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      color: '#a5b4fc',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {showFundamentalCustomizer ? '▲ Colapsar catálogo' : '⚙️ Personalizar asignaturas'}
                  </button>
                </div>

                {showFundamentalCustomizer && (
                  <div style={{ marginTop: '12px', padding: '14px', borderRadius: '8px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#c7d2fe', fontWeight: 600 }}>
                        Catálogo de Asignaturas Fundamentales ({availableFundamentalUacs.length} disponibles)
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedFundamental([])}
                          style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Incluir todas (Por defecto)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedFundamental(availableFundamentalUacs.map(u => u.nombre))}
                          style={{ fontSize: '11px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Marcar todas
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                      {availableFundamentalUacs.map((u) => {
                        const isChecked = selectedFundamental.length === 0 || selectedFundamental.includes(u.nombre);
                        return (
                          <label
                            key={`${u.semestre}_${u.nombre}`}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              background: isChecked ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                              border: `1px solid ${isChecked ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'}`,
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              color: isChecked ? '#ffffff' : 'rgba(240,244,255,0.5)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                let next: string[];
                                if (selectedFundamental.length === 0) {
                                  next = availableFundamentalUacs.map(item => item.nombre).filter(n => n !== u.nombre);
                                } else if (selectedFundamental.includes(u.nombre)) {
                                  next = selectedFundamental.filter(n => n !== u.nombre);
                                } else {
                                  next = [...selectedFundamental, u.nombre];
                                }
                                if (next.length === availableFundamentalUacs.length) {
                                  next = [];
                                }
                                setSelectedFundamental(next);
                              }}
                              style={{ marginTop: '2px' }}
                            />
                            <div>
                              <span style={{ fontWeight: 600, color: '#818cf8', marginRight: '4px' }}>{u.semestre}°</span>
                              <span>{u.nombre}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Laboral Checklist / Confirmación (Sincronizado con Grupos H-02 y Selección Multi-PAEC) */}
              <div id="paec-laboral-section" tabIndex={-1} style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px', marginTop: '16px', outline: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: 'var(--c-navy)', margin: 0 }}>
                      <span>Capacitaciones para el Trabajo (Formación Laboral) activas *</span>
                      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: selectedLaboralCustom.length > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(52,211,153,0.15)', color: selectedLaboralCustom.length > 0 ? '#a5b4fc' : '#34d399', border: `1px solid ${selectedLaboralCustom.length > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(52,211,153,0.3)'}` }}>
                        {selectedLaboralCustom.length > 0 ? `${selectedLaboral.length} de ${allAssignedLaboralUacs.length} seleccionadas (Multi-PAEC)` : `${selectedLaboral.length} UACs incluidas (100%)`}
                      </span>
                    </label>
                    <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginBottom: '14px', marginTop: '4px' }}>
                      {assignedLaboralTracks.length > 0
                        ? `Selecciona con las casillas qué materias laborales específicas participan en este PAEC (ideal si tu plantel desarrolla múltiples proyectos en paralelo).`
                        : 'Selecciona las capacitaciones de tu escuela en la sección de grupos arriba (3° a 6° semestre) para incorporarlas al padrón curricular.'}
                    </p>
                  </div>
                  {assignedLaboralTracks.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedLaboralCustom([])}
                        style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Incluir todas (Por defecto)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLaboralCustom([...allAssignedLaboralUacs])}
                        style={{ fontSize: '11px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Marcar todas
                      </button>
                    </div>
                  )}
                </div>

                {assignedLaboralTracks.length === 0 ? (
                  <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>⚠️</span>
                    <div>
                      <strong>No se ha seleccionado ninguna Capacitación Laboral en los grupos.</strong>
                      <div style={{ fontSize: '12px', marginTop: '4px', color: '#fecaca' }}>
                        Para el componente curricular laboral (3° a 6° semestre), asigna la capacitación de cada grupo en la tabla superior. Cada capacitación incluye 8 UACs oficiales distribuidas en los 4 semestres.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(8,12,24,0.5)' }}>
                    {assignedLaboralTracks.map((capKey) => {
                      const title = CAPACITACION_TITLES[capKey] || capKey;
                      const semGroups = groupedLaboral[capKey] || {};
                      const capUacs = Object.values(semGroups).flat();

                      return (
                        <div key={capKey} style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '12px', background: 'rgba(99,102,241,0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#818cf8' }}>{title}</span>
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontWeight: 600 }}>
                              ✓ Asignada en Grupos ({capUacs.length || 8} UACs)
                            </span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            {(cycleType === 'A' ? [3, 5] : cycleType === 'B' ? [4, 6] : [3, 4, 5, 6]).map((sem) => {
                              const uacs = semGroups[sem] || (UACS_LABORALES_OFICIALES_BGE[capKey]?.[sem] || []).map(name => ({ uac_name: name, semester: sem, curriculum_name: capKey }));
                              if (uacs.length === 0) return null;
                              return (
                                <div key={sem} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', marginBottom: '6px' }}>{sem}° Semestre</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {uacs.map((u) => {
                                      const isChecked = selectedLaboralCustom.length === 0 || selectedLaboralCustom.includes(u.uac_name);
                                      return (
                                        <label
                                          key={u.uac_name}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            fontSize: '11.5px',
                                            lineHeight: 1.3,
                                            cursor: 'pointer',
                                            padding: '4px 6px',
                                            borderRadius: '4px',
                                            background: isChecked ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isChecked ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                                            color: isChecked ? '#e2e8f0' : 'rgba(240,244,255,0.4)',
                                            transition: 'all 0.15s ease',
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              let next: string[];
                                              if (selectedLaboralCustom.length === 0) {
                                                next = allAssignedLaboralUacs.filter(n => n !== u.uac_name);
                                              } else if (selectedLaboralCustom.includes(u.uac_name)) {
                                                next = selectedLaboralCustom.filter(n => n !== u.uac_name);
                                              } else {
                                                next = [...selectedLaboralCustom, u.uac_name];
                                              }
                                              if (next.length === allAssignedLaboralUacs.length) {
                                                next = [];
                                              }
                                              setSelectedLaboralCustom(next);
                                            }}
                                            style={{ marginTop: '2px', cursor: 'pointer' }}
                                          />
                                          <span>{u.uac_name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FFE Resumen Vinculado a Grupos (H-04 y Selección Multi-PAEC) */}
              <div id="paec-ffe-section" tabIndex={-1} style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px', marginTop: '16px', outline: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: 'var(--c-navy)', margin: 0 }}>
                      <span>Formación Fundamental Extendida (FFE/FFEO) vinculadas al plantel</span>
                      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: selectedFfeCustom.length > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(52,211,153,0.15)', color: selectedFfeCustom.length > 0 ? '#a5b4fc' : '#34d399', border: `1px solid ${selectedFfeCustom.length > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(52,211,153,0.3)'}` }}>
                        {selectedFfeCustom.length > 0 ? `${selectedFfe.length} de ${allAssignedFfeUacs.length} seleccionadas (Multi-PAEC)` : `${selectedFfe.length} UACs activas en total`}
                      </span>
                    </label>
                    <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginBottom: '14px', marginTop: '4px' }}>
                      Selecciona con las casillas cuáles asignaturas de FFE participan en este proyecto específico para otorgar flexibilidad a planteles con dos o más proyectos simultáneos.
                    </p>
                  </div>
                  {allAssignedFfeUacs.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedFfeCustom([])}
                        style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Incluir todas (Por defecto)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFfeCustom([...allAssignedFfeUacs])}
                        style={{ fontSize: '11px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Marcar todas
                      </button>
                    </div>
                  )}
                </div>

                {allAssignedFfeUacs.length === 0 ? (
                  <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No hay asignaturas de FFE seleccionadas aún. Configura los grupos de 5° y/o 6° Semestre en la sección superior para activarlas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(8,12,24,0.5)' }}>
                    {FFE_PAIRS.filter(pair => allAssignedFfeUacs.includes(pair.name5) || allAssignedFfeUacs.includes(pair.name6)).map((pair) => {
                      const has5 = allAssignedFfeUacs.includes(pair.name5);
                      const has6 = allAssignedFfeUacs.includes(pair.name6);

                      const isChecked5 = has5 && (selectedFfeCustom.length === 0 || selectedFfeCustom.includes(pair.name5));
                      const isChecked6 = has6 && (selectedFfeCustom.length === 0 || selectedFfeCustom.includes(pair.name6));

                      return (
                        <div key={pair.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '6px', background: 'rgba(99,102,241,0.05)', gap: '8px' }}>
                          <div style={{ minWidth: '200px', flex: '1' }}>
                            <strong style={{ fontSize: '12.5px', color: '#a5b4fc' }}>{pair.label}</strong>
                            <span style={{ marginLeft: '8px', fontSize: '10.5px', color: '#64748b' }}>({pair.category})</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11.5px' }}>
                            {has5 && cycleType !== 'B' && (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '3px 8px', borderRadius: '4px', background: isChecked5 ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isChecked5 ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.05)'}`, color: isChecked5 ? '#38bdf8' : 'rgba(240,244,255,0.4)' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked5}
                                  onChange={() => {
                                    let next: string[];
                                    if (selectedFfeCustom.length === 0) {
                                      next = allAssignedFfeUacs.filter(n => n !== pair.name5);
                                    } else if (selectedFfeCustom.includes(pair.name5)) {
                                      next = selectedFfeCustom.filter(n => n !== pair.name5);
                                    } else {
                                      next = [...selectedFfeCustom, pair.name5];
                                    }
                                    if (next.length === allAssignedFfeUacs.length) {
                                      next = [];
                                    }
                                    setSelectedFfeCustom(next);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span>5°: {pair.name5}</span>
                              </label>
                            )}
                            {has5 && has6 && cycleType === 'annual' && <span style={{ color: '#475569' }}>➔</span>}
                            {has6 && cycleType !== 'A' && (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '3px 8px', borderRadius: '4px', background: isChecked6 ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isChecked6 ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.05)'}`, color: isChecked6 ? '#34d399' : 'rgba(240,244,255,0.4)' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked6}
                                  onChange={() => {
                                    let next: string[];
                                    if (selectedFfeCustom.length === 0) {
                                      next = allAssignedFfeUacs.filter(n => n !== pair.name6);
                                    } else if (selectedFfeCustom.includes(pair.name6)) {
                                      next = selectedFfeCustom.filter(n => n !== pair.name6);
                                    } else {
                                      next = [...selectedFfeCustom, pair.name6];
                                    }
                                    if (next.length === allAssignedFfeUacs.length) {
                                      next = [];
                                    }
                                    setSelectedFfeCustom(next);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span>6°: {pair.name6}</span>
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4.4 RESUMEN MAESTRO EN TIEMPO REAL: CERO DUPLICADOS */}
              <div style={{ marginTop: '16px', padding: '18px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(99,102,241,0.35)', boxShadow: '0 4px 18px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🎯</span>
                      <h3 style={{ margin: 0, fontSize: '15.5px', color: '#ffffff', fontWeight: 700 }}>
                        Padrón Curricular Consolidado del PAEC
                      </h3>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.2)', color: '#34d399', fontWeight: 600, border: '1px solid rgba(16,185,129,0.4)' }}>
                        ✓ CERO DUPLICADOS
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                      Resumen integral de asignaturas seleccionadas: Fundamental (1 vez) ∪ Laborales Únicas ∪ FFE Únicas ∪ BT Únicos
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: '#818cf8' }}>{uniqueUacsList.length}</span>
                    <span style={{ fontSize: '12px', color: 'rgba(240,244,255,0.8)', fontWeight: 600 }}>UACs Únicas</span>
                  </div>
                </div>

                {/* Badges de Desglose */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(30,58,138,0.5)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', fontWeight: 500 }}>
                    📘 Fundamental: {uniqueUacsList.filter((u) => u.component === 'fundamental').length}
                  </span>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(234,88,12,0.25)', border: '1px solid rgba(249,115,22,0.4)', color: '#fdba74', fontWeight: 500 }}>
                    💖 Socioemocional: {uniqueUacsList.filter((u) => u.component === 'socioemocional').length}
                  </span>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(6,78,59,0.5)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', fontWeight: 500 }}>
                    💼 Laboral: {uniqueUacsList.filter((u) => u.component === 'laboral').length}
                  </span>
                  <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(88,28,135,0.5)', border: '1px solid rgba(168,85,247,0.3)', color: '#d8b4fe', fontWeight: 500 }}>
                    🧬 FFE: {uniqueUacsList.filter((u) => u.component === 'ffe').length}
                  </span>
                  {schoolType === 'tecnico' && (
                    <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(120,53,15,0.5)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', fontWeight: 500 }}>
                      ⚙️ Profesional BT: {uniqueUacsList.filter((u) => u.component === 'profesional_bt').length}
                    </span>
                  )}
                </div>

                {/* Vista previa colapsable de las materias */}
                <div style={{ marginTop: '12px', maxHeight: '180px', overflowY: 'auto', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px' }}>
                    {uniqueUacsList.map((u, i) => (
                      <div key={`${u.semester}-${u.uacName}-${i}`} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(240,244,255,0.85)' }}>
                        <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', fontWeight: 600, fontSize: '10px' }}>
                          {u.semester}°
                        </span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.uacName}>
                          {u.uacName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
    </>
  );
}
