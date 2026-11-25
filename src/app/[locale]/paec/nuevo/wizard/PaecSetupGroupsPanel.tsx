'use client';

import React from 'react';
import {
  FORMACIONES_LABORALES,
  FORMACIONES_SOCIOEMOCIONALES,
  resolverSocioemocionalGrupo,
  obtenerFfeSemestre6,
  toggleGroupFfeSubject,
  removeGroupFfeSubject,
  clearGroupFfeSubjects,
} from '@/lib/escuela-grupos';
import { FFE_PAIRS } from './helpers';
import type { PaecWizardController } from './usePaecWizardActions';

export function PaecSetupGroupsPanel({ w }: { w: PaecWizardController }) {
  const {
    cycleType,
    setSelectedLaboralCustom,
    setSelectedFfeCustom,
    setGroupsCount,
    schoolType,
    setSchoolType,
    semestersConfig,
    setSemestersConfig,
    setGroupAssignments,
    groupAssignments,
    expandedGroupFfe,
    setExpandedGroupFfe,
    carrerasBT,
  } = w;

  return (
    <>
              {/* 4.1 Tipo de Plantel */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '13.5px', color: '#f0f4ff' }}>
                  Modalidad Oficial del Plantel
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {[
                    { id: 'general' as const, label: '🏫 Bachillerato General (BGE)', desc: 'Capacitaciones laborales y optativas FFE' },
                    { id: 'tecnico' as const, label: '⚙️ Bachillerato Tecnológico (BT)', desc: 'Módulos profesionales de carreras técnicas' },
                    { id: 'telebachillerato' as const, label: '🌄 Telebachillerato Comunitario', desc: 'Malla comunitaria articulada' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSchoolType(m.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: schoolType === m.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${schoolType === m.id ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                        color: schoolType === m.id ? '#ffffff' : 'rgba(240,244,255,0.7)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', color: schoolType === m.id ? '#818cf8' : '#f0f4ff' }}>{m.label}</div>
                      <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4.2 Presets de Grupos */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13.5px', color: '#f0f4ff' }}>
                    Estructura de Grupos por Semestre Activo
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'Estructura 1-1-1', n: 1 },
                      { label: 'Estructura 2-2-2', n: 2 },
                      { label: 'Estructura 3-3-3', n: 3 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          const sems = cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
                          const newConfig: Record<number, number> = {};
                          sems.forEach((s) => (newConfig[s] = p.n));
                          setSemestersConfig(newConfig);
                          setGroupsCount(`${p.n} grupo${p.n > 1 ? 's' : ''} por semestre`);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#a5b4fc',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contadores por semestre activo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {(cycleType === 'A' ? [1, 3, 5] : cycleType === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6]).map((sem) => (
                    <div key={sem} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600 }}>{sem}° Semestre</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                          {semestersConfig[sem] || 1} {((semestersConfig[sem] || 1) > 1 ? 'grupos' : 'grupo')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = semestersConfig[sem] || 1;
                            if (cur > 1) setSemestersConfig((prev) => ({ ...prev, [sem]: cur - 1 }));
                          }}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = semestersConfig[sem] || 1;
                            if (cur < 8) setSemestersConfig((prev) => ({ ...prev, [sem]: cur + 1 }));
                          }}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4.3 Asignación por Grupo (Laboral / FFE / BT) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13.5px', color: '#f0f4ff' }}>
                  Asignación de Trayectos Especializados por Grupo
                </label>
                <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.6)', margin: '0 0 14px' }}>
                  Las materias del tronco fundamental aplican automáticamente una sola vez. Asigna aquí qué formación laboral, FFE o carrera cursa cada grupo para incluirlas sin duplicados.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const socio3Config = groupAssignments.find(g => g.semester === 3 && g.ffeoSocioemocional)?.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES[0];
                    const socio5Config = groupAssignments.find(g => g.semester === 5 && g.ffeoSocioemocional)?.ffeoSocioemocional || FORMACIONES_SOCIOEMOCIONALES.find(s => s !== socio3Config) || FORMACIONES_SOCIOEMOCIONALES[1];
                    const resolvedSocio = resolverSocioemocionalGrupo(socio3Config, socio5Config);
                    const opcionesSocio5 = FORMACIONES_SOCIOEMOCIONALES.filter(s => s !== socio3Config);

                    return groupAssignments.map((grp) => {
                      const isLaboralSem = grp.semester === 3 || grp.semester === 4;
                      const isFfeSem = grp.semester === 5 || grp.semester === 6;
                      const groupLetter = grp.groupName.split(' ')[1] || grp.groupId.split('-')[1];
                      const matching3rd = (cycleType !== 'B' && grp.semester === 4)
                        ? groupAssignments.find(g => g.semester === 3 && (g.groupId === `3-${groupLetter}` || g.groupName.endsWith(groupLetter)))
                        : null;
                      const matching5th = (cycleType !== 'B' && grp.semester === 6)
                        ? groupAssignments.find(g => g.semester === 5 && (g.groupId === `5-${groupLetter}` || g.groupName.endsWith(groupLetter)))
                        : null;
                      const matching6thId = cycleType === 'B' ? undefined : `6-${groupLetter}`;

                      if (!isLaboralSem && !isFfeSem && schoolType !== 'tecnico') {
                        return (
                          <div key={grp.groupId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#a5b4fc' }}>Grupo {grp.groupName}</span>
                            <span style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.6)' }}>
                              Tronco Fundamental MCCEMS + Actividades Físicas y Deportivas {grp.semester === 1 ? 'I' : 'II'}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={grp.groupId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', gap: '10px' }}>
                          <div style={{ minWidth: '130px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#ffffff' }}>Grupo {grp.groupName}</span>
                            <div style={{ fontSize: '11px', color: '#818cf8', marginTop: '2px' }}>
                              {schoolType === 'tecnico' ? 'Carrera Técnica BT' : isLaboralSem ? 'Formación Laboral (3°-4°)' : 'Formación Laboral y FFE (5°-6°)'}
                            </div>
                          </div>

                          <div style={{ flex: '1', minWidth: '240px' }}>
                            {schoolType === 'tecnico' ? (
                              <select
                                value={grp.trackId || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGroupAssignments((prev) =>
                                    prev.map((g) => (g.groupId === grp.groupId ? { ...g, trackId: val, trackName: val } : g))
                                  );
                                }}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a', color: '#f0f4ff', fontSize: '12.5px' }}
                              >
                                <option value="">Selecciona Carrera Técnica BT...</option>
                                {carrerasBT.map((c) => (
                                  <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                              </select>
                            ) : isLaboralSem ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '11.5px', color: '#818cf8', marginBottom: '2px' }}>
                                  Formación Laboral (3°-4°)
                                </label>
                                {grp.semester === 3 || !matching3rd ? (
                                  <select
                                    value={grp.trackName || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSelectedLaboralCustom([]);
                                      setGroupAssignments((prev) =>
                                        prev.map((g) => {
                                          if (g.groupId === grp.groupId) {
                                            return { ...g, trackId: val, trackName: val };
                                          }
                                          if (cycleType !== 'B' && grp.semester === 3 && g.semester === 4 && (g.groupId === `4-${groupLetter}` || g.groupName.endsWith(groupLetter))) {
                                            return { ...g, trackId: val, trackName: val };
                                          }
                                          return g;
                                        })
                                      );
                                    }}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a', color: '#f0f4ff', fontSize: '12.5px' }}
                                  >
                                    <option value="">Selecciona Capacitación Laboral (3°-4°)...</option>
                                    {FORMACIONES_LABORALES.map((f) => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', background: grp.trackName ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${grp.trackName ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`, fontSize: '12px' }}>
                                    <span style={{ color: '#818cf8', fontWeight: 600 }}>🔗 Heredada de 3° {groupLetter}:</span>
                                    {grp.trackName ? (
                                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{grp.trackName}</span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Selecciona la Formación Laboral en el Grupo 3° {groupLetter} para asignarla automáticamente</span>
                                    )}
                                  </div>
                                )}

                                {/* Selector Socioemocional 3° / 4° */}
                                {grp.semester === 3 || cycleType === 'B' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                    <span style={{ fontSize: '11px', color: '#f472b6', fontWeight: 600, whiteSpace: 'nowrap' }}>💖 Formación Socioemocional:</span>
                                    <select
                                      value={grp.ffeoSocioemocional || (cycleType === 'B' ? (grp.ffeoSocioemocional || resolvedSocio.sem4 || FORMACIONES_SOCIOEMOCIONALES[2]) : socio3Config)}
                                      onChange={(e) => {
                                        const newS = e.target.value;
                                        setGroupAssignments(prev => prev.map(g => {
                                          if (g.groupId === grp.groupId) return { ...g, ffeoSocioemocional: newS };
                                          if (cycleType !== 'B') {
                                            const res = resolverSocioemocionalGrupo(newS, socio5Config);
                                            if (g.semester === 3) return { ...g, ffeoSocioemocional: newS };
                                            if (g.semester === 4 || g.semester === 6) return { ...g, ffeoSocioemocional: res.sem4 };
                                          }
                                          return g;
                                        }));
                                      }}
                                      style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(244,114,182,0.3)', background: '#0f172a', color: '#fbcfe8', fontSize: '11.5px' }}
                                    >
                                      {FORMACIONES_SOCIOEMOCIONALES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11px', color: '#f472b6' }}>
                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>💖 Formación Socioemocional:</span>
                                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.25)', color: '#fbcfe8', fontSize: '11px' }}>
                                      {resolvedSocio.sem4} (Regla 4°=6°)
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                            // BLOQUE FFE Y FORMACIÓN LABORAL (5° Y 6° SEMESTRE) - H-04 Acoplamiento Obligatorio 5° ➔ 6°
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {/* Formación Laboral (5°-6°) */}
                              <div>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '11.5px', color: '#818cf8', marginBottom: '4px' }}>
                                  Formación Laboral (5°-6°)
                                </label>
                                {grp.semester === 5 || !matching5th ? (
                                  <select
                                    value={grp.trackName || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSelectedLaboralCustom([]);
                                      setGroupAssignments((prev) =>
                                        prev.map((g) => {
                                          if (g.groupId === grp.groupId) {
                                            return { ...g, trackId: val, trackName: val };
                                          }
                                          if (cycleType !== 'B' && grp.semester === 5 && g.semester === 6 && (g.groupId === `6-${groupLetter}` || g.groupName.endsWith(groupLetter))) {
                                            return { ...g, trackId: val, trackName: val };
                                          }
                                          return g;
                                        })
                                      );
                                    }}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a', color: '#f0f4ff', fontSize: '12.5px' }}
                                  >
                                    <option value="">Selecciona Capacitación Laboral (5°-6°)...</option>
                                    {FORMACIONES_LABORALES.map((f) => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', background: grp.trackName ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${grp.trackName ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`, fontSize: '12px' }}>
                                    <span style={{ color: '#818cf8', fontWeight: 600 }}>🔗 Heredada de 5° {groupLetter}:</span>
                                    {grp.trackName ? (
                                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{grp.trackName}</span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Selecciona la Formación Laboral en el Grupo 5° {groupLetter} para asignarla automáticamente</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Formación Fundamental Extendida (FFE) */}
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '11.5px', color: '#38bdf8', marginBottom: '4px' }}>
                                  Formación Fundamental Extendida (FFE)
                                </label>
                                {/* Barra de estado y botón desplegable */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: (grp.ffeSelections?.length || 0) > 0 ? (matching5th ? 'rgba(52,211,153,0.2)' : 'rgba(99,102,241,0.25)') : 'rgba(255,255,255,0.08)', color: (grp.ffeSelections?.length || 0) > 0 ? (matching5th ? '#6ee7b7' : '#a5b4fc') : '#94a3b8', fontWeight: 600, border: `1px solid ${matching5th ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
                                      {grp.ffeSelections?.length || 0} UACs FFE
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedGroupFfe(prev => ({ ...prev, [grp.groupId]: !prev[grp.groupId] }))}
                                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: expandedGroupFfe[grp.groupId] ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      {expandedGroupFfe[grp.groupId] ? (matching5th ? '▲ Ocultar continuidad' : '▲ Ocultar 20 FFE') : (matching5th ? '▼ Ver continuidad de 5°' : '▼ Seleccionar asignaturas individuales (20 FFE)')}
                                    </button>
                                  </div>

                                  {/* Si es 6° y existe 5°, se muestra indicador de vínculo */}
                                  {matching5th && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.3)' }}>
                                      <span>🔗 Vinculado a {matching5th.groupName}</span>
                                      {(matching5th.ffeSelections && matching5th.ffeSelections.length > 0) && (
                                        <span style={{ color: '#cbd5e1', fontWeight: 500 }}>({matching5th.ffeSelections.length} FFE)</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Resumen de materias seleccionadas actualmente */}
                                {matching5th ? (
                                  (grp.ffeSelections && grp.ffeSelections.length > 0) ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                      {grp.ffeSelections.map((subj) => (
                                        <span key={subj} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '4px' }}>
                                          ✓ {subj}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '6px' }}>
                                      Selecciona las 4 materias FFE en el grupo {matching5th.groupName} de 5° para heredar la continuidad obligatoria de 6°.
                                    </div>
                                  )
                                ) : (
                                  (grp.ffeSelections && grp.ffeSelections.length > 0) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                      {grp.ffeSelections.map((subj) => (
                                        <span key={subj} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                          {subj}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setGroupAssignments(prev => removeGroupFfeSubject(prev, grp.groupId, subj, matching6thId));
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: '11px', fontWeight: 'bold' }}
                                            title="Quitar asignatura"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )
                                )}

                                {/* Panel desplegable con las asignaturas */}
                                {expandedGroupFfe[grp.groupId] && (
                                  matching5th ? (
                                    <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600 }}>
                                        Continuidad Normativa Oficial (5° {groupLetter} ➔ 6° {groupLetter})
                                      </div>
                                      {(!matching5th.ffeSelections || matching5th.ffeSelections.length === 0) ? (
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                          El grupo {matching5th.groupName} aún no tiene asignaturas FFE seleccionadas. Configúralo en 5° Semestre para vincularlas automáticamente aquí.
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {matching5th.ffeSelections.map((s5) => {
                                            const s6 = obtenerFfeSemestre6(s5);
                                            return (
                                              <div key={s6} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', padding: '5px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  <span style={{ color: '#94a3b8' }}>5° {s5}</span>
                                                  <span style={{ color: '#6366f1' }}>➔</span>
                                                  <span style={{ color: '#34d399', fontWeight: 600 }}>6° {s6}</span>
                                                </div>
                                                <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 600 }}>✓ Acoplada oficialmente</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600 }}>
                                          Catálogo Oficial de 20 UACs FFE ({grp.semester}° Semestre)
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedFfeCustom([]);
                                            setGroupAssignments(prev => clearGroupFfeSubjects(prev, grp.groupId, matching6thId));
                                          }}
                                          style={{ fontSize: '10px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                          Limpiar asignaturas
                                        </button>
                                      </div>

                                      {/* Recursos Sociocognitivos (7) */}
                                      <div>
                                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                                          📘 Recursos Sociocognitivos (7 asignaturas)
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '5px' }}>
                                          {FFE_PAIRS.filter(p => p.category === 'Recursos Sociocognitivos').map((pair) => {
                                            const subjectName = grp.semester === 6 ? pair.name6 : pair.name5;
                                            const isChecked = (grp.ffeSelections || []).includes(subjectName);
                                            return (
                                              <label key={pair.name5} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '11px', cursor: 'pointer', color: isChecked ? '#ffffff' : 'rgba(240,244,255,0.7)', lineHeight: 1.25 }}>
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => {
                                                    setGroupAssignments(prev => toggleGroupFfeSubject(prev, grp.groupId, subjectName, matching6thId));
                                                  }}
                                                  style={{ marginTop: '1px' }}
                                                />
                                                <span>{subjectName}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Áreas de Conocimiento (13) */}
                                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>
                                          🔬 Áreas de Conocimiento (13 asignaturas)
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '5px' }}>
                                          {FFE_PAIRS.filter(p => p.category !== 'Recursos Sociocognitivos').map((pair) => {
                                            const subjectName = grp.semester === 6 ? pair.name6 : pair.name5;
                                            const isChecked = (grp.ffeSelections || []).includes(subjectName);
                                            return (
                                              <label key={pair.name5} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '11px', cursor: 'pointer', color: isChecked ? '#ffffff' : 'rgba(240,244,255,0.7)', lineHeight: 1.25 }}>
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => {
                                                    setGroupAssignments(prev => toggleGroupFfeSubject(prev, grp.groupId, subjectName, matching6thId));
                                                  }}
                                                  style={{ marginTop: '1px' }}
                                                />
                                                <span>{subjectName}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>

                              {/* Selector Socioemocional 5° / 6° */}
                              {grp.semester === 5 || cycleType === 'B' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                                  <span style={{ fontSize: '11px', color: '#f472b6', fontWeight: 600, whiteSpace: 'nowrap' }}>💖 Formación Socioemocional:</span>
                                  <select
                                    value={grp.ffeoSocioemocional || (cycleType === 'B' ? (grp.ffeoSocioemocional || resolvedSocio.sem6 || FORMACIONES_SOCIOEMOCIONALES[2]) : (opcionesSocio5.includes(socio5Config) ? socio5Config : opcionesSocio5[0]))}
                                    onChange={(e) => {
                                      const newS5 = e.target.value;
                                      setGroupAssignments(prev => prev.map(g => {
                                        if (g.groupId === grp.groupId) return { ...g, ffeoSocioemocional: newS5 };
                                        if (cycleType !== 'B') {
                                          const res = resolverSocioemocionalGrupo(socio3Config, newS5);
                                          if (g.semester === 5) return { ...g, ffeoSocioemocional: newS5 };
                                          if (g.semester === 4 || g.semester === 6) return { ...g, ffeoSocioemocional: res.sem4 };
                                        }
                                        return g;
                                      }));
                                    }}
                                    style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(244,114,182,0.3)', background: '#0f172a', color: '#fbcfe8', fontSize: '11.5px' }}
                                  >
                                    {FORMACIONES_SOCIOEMOCIONALES.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', fontSize: '11px', color: '#f472b6' }}>
                                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>💖 Formación Socioemocional:</span>
                                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.25)', color: '#fbcfe8', fontSize: '11px' }}>
                                    {resolvedSocio.sem6} (Regla 4°=6°)
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                </div>
              </div>

    </>
  );
}
