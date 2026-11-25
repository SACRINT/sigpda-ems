'use client';

import React from 'react';
import type { PmcMetasController } from './usePmcMetasComplementarias';

export function SubTabPersonales({ ctrl }: { ctrl: PmcMetasController }) {
  const {
    planAccion,
    staffData,
    saving,
    selectedStaffIndex,
    personalNombre,
    setPersonalNombre,
    personalCargo,
    setPersonalCargo,
    personalMeta,
    setPersonalMeta,
    personalEstrategia,
    setPersonalEstrategia,
    personalEntregable,
    setPersonalEntregable,
    personalPeriodo,
    setPersonalPeriodo,
    editingPersonalIndex,
    editingPersonalData,
    setEditingPersonalData,
    staffWithoutGoal,
    handleSelectStaff,
    handleSavePersonalMeta,
    handleDeletePersonalMeta,
    handleStartEditPersonalMeta,
    handleCancelEditPersonalMeta,
    handleSaveEditPersonalMeta,
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
              <span>➕</span> Agregar Meta Individual al Personal Manualmente
            </h4>

            <form onSubmit={handleSavePersonalMeta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Seleccionar docente de la plantilla escolar:</label>
                  <select
                    value={selectedStaffIndex}
                    onChange={(e) => handleSelectStaff(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="custom">+ Ingresar docente o personal nuevo manualmente...</option>
                    {staffWithoutGoal.length > 0 && (
                      <optgroup label="Docentes sin meta registrada (Recomendados)">
                        {staffWithoutGoal.map((s) => {
                          const realIdx = staffData.indexOf(s);
                          return (
                            <option key={`without-${realIdx}`} value={String(realIdx)}>
                              ⚠️ {s.nombre} ({s.cargo || 'Docente'}) — Sin meta
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Todo el personal registrado">
                      {staffData.map((s, idx) => (
                        <option key={`all-${idx}`} value={String(idx)}>
                          {s.nombre} ({s.cargo || 'Docente'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Nombre del Docente / Trabajador *</label>
                  <input
                    type="text"
                    value={personalNombre}
                    onChange={(e) => setPersonalNombre(e.target.value)}
                    placeholder="Ej. Mtro. Juan Carlos Pérez Gómez"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Cargo o Función *</label>
                  <input
                    type="text"
                    value={personalCargo}
                    onChange={(e) => setPersonalCargo(e.target.value)}
                    placeholder="Ej. Docente de Pensamiento Matemático / Tutor"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Período de Ejecución</label>
                  <input
                    type="text"
                    value={personalPeriodo}
                    onChange={(e) => setPersonalPeriodo(e.target.value)}
                    placeholder="Ej. Ciclo Escolar 2025-2026"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Redacción de Meta Individual SMART *</label>
                <textarea
                  value={personalMeta}
                  onChange={(e) => setPersonalMeta(e.target.value)}
                  placeholder="Ej. Lograr que el 90% de los estudiantes del grupo alcancen los aprendizajes esperados..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '68px', lineHeight: 1.5 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Estrategia de Implementación / Acciones</label>
                  <textarea
                    value={personalEstrategia}
                    onChange={(e) => setPersonalEstrategia(e.target.value)}
                    placeholder="Ej. Sesiones de asesoría personalizada y rúbricas de evaluación formativa."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Entregable / Evidencia Comprobable</label>
                  <textarea
                    value={personalEntregable}
                    onChange={(e) => setPersonalEntregable(e.target.value)}
                    placeholder="Ej. Portafolio de evidencias de proyectos situados y listas de cotejo."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
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
                  <span>💾</span> Guardar y Añadir Meta Individual
                </button>
              </div>
            </form>
          </div>

          {/* Lista de Metas Individuales Actuales */}
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e0e7ff', marginBottom: '12px' }}>
              Personal Docente y de Apoyo con Meta Registrada ({planAccion?.metas_personales?.length || 0})
            </h4>

            {(!planAccion?.metas_personales || planAccion.metas_personales.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                No hay metas individuales registradas en este PMC. Usa el asistente o el formulario superior para agregarlas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {planAccion.metas_personales.map((item, idx) => {
                  const isEditing = editingPersonalIndex === idx && editingPersonalData;
                  if (isEditing) {
                    return (
                      <div
                        key={`personal-edit-${idx}`}
                        style={{
                          background: 'rgba(30, 41, 59, 0.85)',
                          border: '1.5px solid rgba(99, 102, 241, 0.5)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>✏️</span> Editando Meta Individual de {editingPersonalData.nombre}
                          </span>
                          <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', padding: '2px 8px', borderRadius: '4px' }}>
                            #{idx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Nombre del Docente:</label>
                            <input
                              type="text"
                              value={editingPersonalData.nombre}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, nombre: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Cargo o Función:</label>
                            <input
                              type="text"
                              value={editingPersonalData.cargo}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, cargo: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Período:</label>
                            <input
                              type="text"
                              value={editingPersonalData.periodo}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, periodo: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Redacción de la Meta Individual:</label>
                          <textarea
                            value={editingPersonalData.meta_individual}
                            onChange={(e) => setEditingPersonalData({ ...editingPersonalData, meta_individual: e.target.value })}
                            rows={3}
                            style={{ ...inputStyle, minHeight: '70px', lineHeight: 1.45 }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Estrategia Individual:</label>
                            <textarea
                              value={editingPersonalData.estrategia}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, estrategia: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Entregable Comprobable:</label>
                            <textarea
                              value={editingPersonalData.entregable}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, entregable: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={handleCancelEditPersonalMeta}
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
                            onClick={handleSaveEditPersonalMeta}
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
                      key={`personal-${idx}`}
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
                          <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            #{idx + 1}
                          </span>
                          <strong style={{ fontSize: '14px', color: '#f8fafc' }}>{item.nombre}</strong>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>• {item.cargo}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>({item.periodo})</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#e2e8f0', margin: '4px 0', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                          <strong>Meta:</strong> {item.meta_individual}
                        </p>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                          <span><strong>Estrategia:</strong> {item.estrategia}</span>
                          <span><strong>Entregable:</strong> {item.entregable}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditPersonalMeta(idx)}
                          disabled={saving}
                          title="Editar meta individual"
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#a5b4fc',
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
                          onClick={() => handleDeletePersonalMeta(idx)}
                          disabled={saving}
                          title="Eliminar meta individual"
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
