'use client';

import React from 'react';
import { PMC_CATEGORIAS_OFICIALES, normalizePmcCategoria } from '@/lib/constants/pmc-categorias';
import {
  CARGOS_COMUNES,
  inputStyle,
  labelStyle,
  sectionCard,
} from './helpers';
import type { PmcWizardController } from './usePmcGenerationAndNav';

export function Step2Personal({ w }: { w: PmcWizardController }) {
  const {
    setDirectorName,
    cicloEscolar,
    totalStaff,
    staffData,
    setStaffData,
    adjustStaffCount,
    removeStaffMember,
    addStaffMember,
  } = w;

  return (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 2: Personal del Plantel
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Registra a <strong>todo el personal</strong> del plantel. Cada persona debe participar en el PMC
              con una meta individual. Si no defines su meta ahora, la IA generará una acorde a su cargo.
            </p>

            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Número total de trabajadores en el plantel</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => adjustStaffCount(totalStaff - 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--c-border)', cursor: 'pointer', fontSize: '16px' }}>−</button>
                    <span style={{ fontSize: '24px', fontWeight: 700, minWidth: '40px', textAlign: 'center', color: '#818cf8' }}>{totalStaff}</span>
                    <button onClick={() => adjustStaffCount(totalStaff + 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '16px', background: 'rgba(255,255,255,0.06)', color: '#f0f4ff' }}>+</button>
                    <span style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)', marginLeft: '8px' }}>personas</span>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', fontSize: '13px', color: '#a5b4fc' }}>
                  💡 Incluye: director, docentes, orientador, prefectos, administrativos, intendentes, etc. Todos deben tener una meta en el PMC.
                </div>
              </div>

              {staffData.map((member, idx) => (
                <div key={idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--c-border)', paddingTop: idx === 0 ? 0 : '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <strong style={{ fontSize: '14px', color: '#818cf8' }}>
                        {member.nombre || `Trabajador ${idx + 1}`}
                      </strong>
                    </div>
                    {staffData.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStaffMember(idx)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                        title="Eliminar este trabajador de la plantilla"
                      >
                        ✕ Eliminar trabajador
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 110px', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Nombre completo *</label>
                      <input
                        style={inputStyle}
                        value={member.nombre}
                        onChange={e => {
                          const val = e.target.value;
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], nombre: val };
                          setStaffData(copy);
                          if (copy[idx].cargo === 'Director(a)') {
                            setDirectorName(val);
                          }
                        }}
                        placeholder="Nombre del trabajador"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cargo / Función *</label>
                      <select
                        style={inputStyle}
                        value={member.cargo || 'Docente'}
                        onChange={e => {
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], cargo: e.target.value };
                          setStaffData(copy);
                          if (e.target.value === 'Director(a)') {
                            setDirectorName(copy[idx].nombre);
                          }
                        }}
                      >
                        {member.cargo && !CARGOS_COMUNES.includes(member.cargo) && (
                          <option value={member.cargo}>{member.cargo}</option>
                        )}
                        {CARGOS_COMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Horas Base</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        style={inputStyle}
                        value={member.horas_base ?? ''}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], horas_base: val };
                          setStaffData(copy);
                        }}
                        placeholder={member.cargo === 'Director(a)' ? '40' : '20'}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Metas individuales para el ciclo {cicloEscolar} (opcional — si no defines las metas la IA las generará)</label>
                      {(member.metas_individuales && member.metas_individuales.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                          {member.metas_individuales.map((meta, mIdx) => {
                            const catNorm = normalizePmcCategoria(meta.categoria);
                            const catObj = PMC_CATEGORIAS_OFICIALES.find(c => c.nombre === catNorm) || PMC_CATEGORIAS_OFICIALES[0];
                            const isKnownTema = catObj.temas.includes(meta.tema);

                            return (
                              <div key={mIdx} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                  <div>
                                    <label style={{ fontSize: '10.5px', color: '#a5b4fc', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Categoría Oficial (Cuadro 2 Lineamientos)</label>
                                    <select
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11.5px', cursor: 'pointer' }}
                                      value={catNorm}
                                      onChange={e => {
                                        const newCat = e.target.value;
                                        const newCatObj = PMC_CATEGORIAS_OFICIALES.find(c => c.nombre === newCat) || PMC_CATEGORIAS_OFICIALES[0];
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        const currentTema = metas[mIdx]?.tema || '';
                                        const newTema = newCatObj.temas.includes(currentTema) ? currentTema : newCatObj.temas[0];
                                        metas[mIdx] = { ...metas[mIdx], categoria: newCat, tema: newTema };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                    >
                                      {PMC_CATEGORIAS_OFICIALES.map(cat => (
                                        <option key={cat.id} value={cat.nombre} style={{ background: '#1e1b4b', color: '#f0f4ff' }}>
                                          {cat.numero}. {cat.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10.5px', color: '#a5b4fc', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Ámbito / Tema Específico</label>
                                    <select
                                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11.5px', cursor: 'pointer' }}
                                      value={isKnownTema ? meta.tema : (meta.tema ? '__custom__' : catObj.temas[0])}
                                      onChange={e => {
                                        const val = e.target.value;
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        metas[mIdx] = { ...metas[mIdx], tema: val === '__custom__' ? (meta.tema || '') : val };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                    >
                                      {catObj.temas.map(t => (
                                        <option key={t} value={t} style={{ background: '#1e1b4b', color: '#f0f4ff' }}>
                                          {t}
                                        </option>
                                      ))}
                                      {!isKnownTema && meta.tema && (
                                        <option value="__custom__" style={{ background: '#1e1b4b', color: '#f0f4ff' }}>
                                          Otro: {meta.tema}
                                        </option>
                                      )}
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    title="Eliminar esta meta"
                                    onClick={() => {
                                      const copy = [...staffData];
                                      const metas = [...(copy[idx].metas_individuales || [])];
                                      metas.splice(mIdx, 1);
                                      copy[idx] = { ...copy[idx], metas_individuales: metas };
                                      setStaffData(copy);
                                    }}
                                    style={{ background: 'rgba(244,63,94,0.2)', border: 'none', color: '#fb7185', cursor: 'pointer', fontSize: '12px', padding: '6px 10px', borderRadius: '4px', alignSelf: 'flex-end', height: '32px' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                  <label style={{ fontSize: '10.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Redacción de la Meta Individual</label>
                                  <textarea
                                    style={{ ...inputStyle, minHeight: '50px', resize: 'vertical', fontSize: '12px', padding: '6px 8px' }}
                                    value={meta.meta || ''}
                                    onChange={e => {
                                      const copy = [...staffData];
                                      const metas = [...(copy[idx].metas_individuales || [])];
                                      metas[mIdx] = { ...metas[mIdx], meta: e.target.value };
                                      copy[idx] = { ...copy[idx], metas_individuales: metas };
                                      setStaffData(copy);
                                    }}
                                    placeholder="Ej: Acreditar 2 cursos de formación docente COSFAC con calificación aprobatoria..."
                                  />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div>
                                    <label style={{ fontSize: '10px', color: 'rgba(240,244,255,0.6)', display: 'block', marginBottom: '2px' }}>Estrategia / Acciones (opcional)</label>
                                    <input
                                      type="text"
                                      style={{ ...inputStyle, padding: '4px 8px', fontSize: '11px' }}
                                      value={meta.estrategia || ''}
                                      onChange={e => {
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        metas[mIdx] = { ...metas[mIdx], estrategia: e.target.value };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                      placeholder="Ej. Inscripción y seguimiento en plataforma"
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10px', color: 'rgba(240,244,255,0.6)', display: 'block', marginBottom: '2px' }}>Entregable / Evidencia (opcional)</label>
                                    <input
                                      type="text"
                                      style={{ ...inputStyle, padding: '4px 8px', fontSize: '11px' }}
                                      value={meta.entregable || ''}
                                      onChange={e => {
                                        const copy = [...staffData];
                                        const metas = [...(copy[idx].metas_individuales || [])];
                                        metas[mIdx] = { ...metas[mIdx], entregable: e.target.value };
                                        copy[idx] = { ...copy[idx], metas_individuales: metas };
                                        setStaffData(copy);
                                      }}
                                      placeholder="Ej. Constancias COSFAC"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.4)', fontStyle: 'italic', marginBottom: '8px' }}>
                          Sin metas predefinidas — la IA generará metas individuales acordes al cargo y las categorías seleccionadas.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...staffData];
                          const metas = [...(copy[idx].metas_individuales || [])];
                          metas.push({
                            categoria: PMC_CATEGORIAS_OFICIALES[0].nombre,
                            tema: PMC_CATEGORIAS_OFICIALES[0].temas[0],
                            meta: '',
                            estrategia: '',
                            entregable: '',
                            periodo: `agosto ${cicloEscolar.split('-')[0] || '2026'} - junio ${cicloEscolar.split('-')[1] || '2027'}`,
                          });
                          copy[idx] = { ...copy[idx], metas_individuales: metas };
                          setStaffData(copy);
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px dashed rgba(99,102,241,0.4)', background: 'transparent', color: '#818cf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Agregar meta individual
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={addStaffMember}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px dashed rgba(99,102,241,0.5)',
                    background: 'rgba(99,102,241,0.08)',
                    color: '#a5b4fc',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ➕ Agregar trabajador
                </button>
              </div>
            </div>
          </div>
  );
}
