'use client';

import React from 'react';
import { AMBITOS_OFICIALES } from './types';
import type { PmcMetasController } from './usePmcMetasComplementarias';

export function SubTabInstitucionales({ ctrl }: { ctrl: PmcMetasController }) {
  const {
    planAccion,
    saving,
    instAmbito,
    setInstAmbito,
    instTema,
    setInstTema,
    instMeta,
    setInstMeta,
    instEstrategia,
    setInstEstrategia,
    instResponsable,
    setInstResponsable,
    instEntregable,
    setInstEntregable,
    instSituacion,
    setInstSituacion,
    instPeriodoInicio,
    setInstPeriodoInicio,
    instPeriodoFin,
    setInstPeriodoFin,
    editingInstIndex,
    editingInstData,
    setEditingInstData,
    handleSaveInstitucionalMeta,
    handleDeleteInstMeta,
    handleStartEditInstMeta,
    handleCancelEditInstMeta,
    handleSaveEditInstMeta,
    inputStyle,
    labelStyle,
  } = ctrl;

  return (
        <div>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '20px',
            }}
          >
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#a5b4fc', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>➕</span> Agregar Meta Institucional al Plan de Acción Manualmente
            </h4>

            <form onSubmit={handleSaveInstitucionalMeta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Ámbito / Área Oficial *</label>
                  <select
                    value={instAmbito}
                    onChange={(e) => setInstAmbito(e.target.value)}
                    style={inputStyle}
                  >
                    {AMBITOS_OFICIALES.map((amb) => (
                      <option key={amb.id} value={amb.id}>
                        {amb.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Tema Específico de Intervención *</label>
                  <input
                    type="text"
                    value={instTema}
                    onChange={(e) => setInstTema(e.target.value)}
                    placeholder="Ej. Rezago y Reprobación en Matemáticas"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Personal Designado / Responsable</label>
                  <input
                    type="text"
                    value={instResponsable}
                    onChange={(e) => setInstResponsable(e.target.value)}
                    placeholder="Ej. Director y Academia de Ciencias Exactas"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Redacción de Meta Institucional SMART *</label>
                <textarea
                  value={instMeta}
                  onChange={(e) => setInstMeta(e.target.value)}
                  placeholder="Ej. Incrementar el índice de aprobación escolar al 88% al término del ciclo escolar mediante tutorías especializadas..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '68px', lineHeight: 1.5 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Estrategia de Implementación (Formato 4.1)</label>
                  <textarea
                    value={instEstrategia}
                    onChange={(e) => setInstEstrategia(e.target.value)}
                    placeholder="Ej. Talleres de regularización sabatinos y clubes de estudio guiados por docentes."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Producto que Comprobará la Meta (Formato 5.1)</label>
                  <textarea
                    value={instEntregable}
                    onChange={(e) => setInstEntregable(e.target.value)}
                    placeholder="Ej. Listas de asistencia a tutorías, registros de evaluación bimestral e informe final de indicadores."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Situación Actual que Justifica la Meta</label>
                  <input
                    type="text"
                    value={instSituacion}
                    onChange={(e) => setInstSituacion(e.target.value)}
                    placeholder="Ej. Se detectó un 22% de reprobación en el ciclo previo."
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Mes Inicio</label>
                  <input
                    type="text"
                    value={instPeriodoInicio}
                    onChange={(e) => setInstPeriodoInicio(e.target.value)}
                    placeholder="Septiembre"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Mes Término</label>
                  <input
                    type="text"
                    value={instPeriodoFin}
                    onChange={(e) => setInstPeriodoFin(e.target.value)}
                    placeholder="Julio"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                  }}
                >
                  <span>💾</span> Guardar y Añadir Meta Institucional
                </button>
              </div>
            </form>
          </div>

          {/* Lista de Metas Institucionales Actuales */}
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e0e7ff', marginBottom: '12px' }}>
              Metas Institucionales Activas ({planAccion?.metas_institucionales?.length || 0})
            </h4>

            {(!planAccion?.metas_institucionales || planAccion.metas_institucionales.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                No hay metas institucionales registradas en el plan. Usa el asistente o el formulario superior para agregarlas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {planAccion.metas_institucionales.map((item, idx) => {
                  const isEditing = editingInstIndex === idx && editingInstData;
                  if (isEditing) {
                    return (
                      <div
                        key={`inst-edit-${idx}`}
                        style={{
                          background: 'rgba(30, 41, 59, 0.85)',
                          border: '1.5px solid rgba(16, 185, 129, 0.5)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>✏️</span> Editando Meta Institucional: {editingInstData.tema || editingInstData.nombre_categoria}
                          </span>
                          <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.2)', color: '#a7f3d0', padding: '2px 8px', borderRadius: '4px' }}>
                            #{idx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Tema Específico:</label>
                            <input
                              type="text"
                              value={editingInstData.tema}
                              onChange={(e) => setEditingInstData({ ...editingInstData, tema: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Responsable / Personal Designado:</label>
                            <input
                              type="text"
                              value={editingInstData.personal_designado}
                              onChange={(e) => setEditingInstData({ ...editingInstData, personal_designado: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Período (Mes Inicio - Mes Fin):</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                value={editingInstData.periodo_inicio}
                                onChange={(e) => setEditingInstData({ ...editingInstData, periodo_inicio: e.target.value })}
                                placeholder="Inicio"
                                style={inputStyle}
                              />
                              <input
                                type="text"
                                value={editingInstData.periodo_fin}
                                onChange={(e) => setEditingInstData({ ...editingInstData, periodo_fin: e.target.value })}
                                placeholder="Fin"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Redacción de la Meta Institucional:</label>
                          <textarea
                            value={editingInstData.meta}
                            onChange={(e) => setEditingInstData({ ...editingInstData, meta: e.target.value })}
                            rows={3}
                            style={{ ...inputStyle, minHeight: '70px', lineHeight: 1.45 }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Estrategia de Implementación:</label>
                            <textarea
                              value={editingInstData.estrategia}
                              onChange={(e) => setEditingInstData({ ...editingInstData, estrategia: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Producto Comprobable (Entregable):</label>
                            <textarea
                              value={editingInstData.entregable}
                              onChange={(e) => setEditingInstData({ ...editingInstData, entregable: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Situación Actual que Justifica la Meta:</label>
                          <input
                            type="text"
                            value={editingInstData.diagnostico_meta || editingInstData.linea_base || ''}
                            onChange={(e) => setEditingInstData({ ...editingInstData, diagnostico_meta: e.target.value, linea_base: e.target.value })}
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={handleCancelEditInstMeta}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.06)',
                              color: '#94a3b8',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditInstMeta}
                            disabled={saving}
                            style={{
                              padding: '7px 16px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: saving ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                            }}
                          >
                            💾 Guardar Cambios
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`inst-${idx}`}
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            #{idx + 1}
                          </span>
                          <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                            {item.nombre_categoria || item.categoria}
                          </strong>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>• {item.tema}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>({item.periodo_inicio} - {item.periodo_fin})</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#e2e8f0', margin: '4px 0', lineHeight: 1.45 }}>
                          <strong>Meta:</strong> {item.meta}
                        </p>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                          <span><strong>Responsable:</strong> {item.personal_designado}</span>
                          <span><strong>Estrategia:</strong> {item.estrategia}</span>
                          <span><strong>Entregable:</strong> {item.entregable}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditInstMeta(idx)}
                          disabled={saving}
                          title="Editar meta institucional"
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#6ee7b7',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInstMeta(idx)}
                          disabled={saving}
                          title="Eliminar meta institucional"
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
  );
}
