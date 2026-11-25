'use client';

import React from 'react';
import type { PmcMetasController } from './usePmcMetasComplementarias';

export function SubTabIaQuirurgica({ ctrl }: { ctrl: PmcMetasController }) {
  const {
    planAccion,
    staffData,
    setSubTab,
    saving,
    aiSelectedStaffIndex,
    aiDocenteNombre,
    setAiDocenteNombre,
    aiDocenteCargo,
    setAiDocenteCargo,
    aiHorasBase,
    setAiHorasBase,
    aiRawGoalText,
    setAiRawGoalText,
    aiTipoMeta,
    setAiTipoMeta,
    aiAmbitoSugerido,
    setAiAmbitoSugerido,
    aiNormalizing,
    normalizedPreview,
    setNormalizedPreview,
    staffWithoutGoal,
    handleSelectStaffForAI,
    handleNormalizeWithAI,
    previewItems,
    handleUpdatePreviewIndividual,
    handleUpdatePreviewInstitucional,
    handleConfirmSurgicalInsertion,
    handleStartEditPersonalMeta,
    handleStartEditInstMeta,
    inputStyle,
    labelStyle,
  } = ctrl;

  return (
        <div>
          {/* Card Asistente */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '22px',
              marginBottom: '22px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>🪄</span>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#a7f3d0', margin: 0 }}>
                  Normalización Inteligente de Metas en Bruto (MCCEMS / NEM / DGB)
                </h4>
                <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0' }}>
                  Solo escribe o pega una o varias metas tal como las propuso el personal docente. La IA las convertirá en metas SMART oficiales,
                  formulará sus estrategias, entregables y fichas técnicas, y las insertará en todas las secciones pertinentes.
                </p>
              </div>
            </div>

            <form onSubmit={handleNormalizeWithAI} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {/* Selector de docente */}
                <div>
                  <label style={labelStyle}>1. ¿Quién solicita o ejecutará esta meta? *</label>
                  <select
                    value={aiSelectedStaffIndex}
                    onChange={(e) => handleSelectStaffForAI(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="custom">➕ Escribir nombre de docente / personal nuevo...</option>
                    {staffWithoutGoal.length > 0 && (
                      <optgroup label="Docentes sin meta registrada (Recomendados)">
                        {staffWithoutGoal.map((s) => {
                          const realIdx = staffData.indexOf(s);
                          return (
                            <option key={`ai-without-${realIdx}`} value={String(realIdx)}>
                              ⚠️ {s.nombre} ({s.cargo || 'Docente'}) — Sin meta
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Toda la plantilla escolar">
                      {staffData.map((s, idx) => (
                        <option key={`ai-all-${idx}`} value={String(idx)}>
                          {s.nombre} ({s.cargo || 'Docente'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Nombre */}
                <div>
                  <label style={labelStyle}>Nombre del Docente *</label>
                  <input
                    type="text"
                    value={aiDocenteNombre}
                    onChange={(e) => setAiDocenteNombre(e.target.value)}
                    placeholder="Ej. Docente 1"
                    style={inputStyle}
                    required
                  />
                </div>

                {/* Cargo */}
                <div>
                  <label style={labelStyle}>Cargo / Función Docente</label>
                  <input
                    type="text"
                    value={aiDocenteCargo}
                    onChange={(e) => setAiDocenteCargo(e.target.value)}
                    placeholder="Ej. Docente de Lengua y Comunicación"
                    style={inputStyle}
                  />
                </div>

                {/* Horas Base (Opcional) */}
                <div>
                  <label style={labelStyle}>Horas Base (Opcional)</label>
                  <input
                    type="text"
                    value={aiHorasBase}
                    onChange={(e) => setAiHorasBase(e.target.value)}
                    placeholder="Ej. 20 hrs"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Meta en Bruto */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. Meta en bruto proporcionada por el docente (texto sin normalizar) *</span>
                  <span style={{ fontSize: '11px', color: '#6ee7b7' }}>Permite 1 sola meta o varias numeradas</span>
                </label>
                <textarea
                  value={aiRawGoalText}
                  onChange={(e) => setAiRawGoalText(e.target.value)}
                  placeholder="Puedes escribir una meta individual o varias al mismo tiempo numeradas (1. ..., 2. ...). Ejemplo:&#10;1. Realizar los 2 cursos en tiempo y forma de acuerdo a la calendarización del COSFAC y acreditar dichos cursos en un 100% obteniendo la constancia.&#10;2. Participar en las actividades de 'Vive Saludable y Vive Feliz' promoviendo hábitos de vida saludable, bienestar físico y emocional en los estudiantes."
                  rows={4}
                  style={{ ...inputStyle, minHeight: '85px', lineHeight: 1.5, fontSize: '13.5px' }}
                  required
                />
              </div>

              {/* Opciones de alcance y ámbito */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>3. ¿Dónde debe integrarse esta meta en el documento oficial?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f1f5f9', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipo_meta"
                        checked={aiTipoMeta === 'ambas'}
                        onChange={() => setAiTipoMeta('ambas')}
                      />
                      <span>
                        <strong>Ambas (Recomendado):</strong> Meta Individual del Docente (Secc. 7) + Plan de Acción (Secc. 6, Tablas 5.1/Adicionales, Fichas Técnicas y Monitoreo Trimestral Secc. 8)
                      </span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipo_meta"
                        checked={aiTipoMeta === 'individual'}
                        onChange={() => setAiTipoMeta('individual')}
                      />
                      <span>Solo Meta Individual del Personal (Sección 7)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipo_meta"
                        checked={aiTipoMeta === 'institucional'}
                        onChange={() => setAiTipoMeta('institucional')}
                      />
                      <span>Solo Plan de Acción Institucional (Secciones 6 y 8)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Ámbito de intervención sugerido:</label>
                  <select
                    value={aiAmbitoSugerido}
                    onChange={(e) => setAiAmbitoSugerido(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="auto">✨ Automático (Detectado por IA según el texto)</option>
                    <option value="aprovechamiento">1. Aprovechamiento académico y asistencia educativa (Área obligatoria 5.1)</option>
                    <option value="practica_docente">2. Práctica docente y formación continua (Área obligatoria 5.1)</option>
                    <option value="infraestructura">3. Infraestructura y equipamiento escolar (Área obligatoria 5.1)</option>
                    <option value="convivencia_paec">4. Convivencia escolar y PAEC (Área obligatoria 5.1)</option>
                    <option value="adicional">5. Ámbito Adicional Priorizado por el Plantel</option>
                  </select>
                </div>
              </div>

              {/* Botón de Normalizar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={aiNormalizing || !aiDocenteNombre.trim() || !aiRawGoalText.trim()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: aiNormalizing
                      ? 'rgba(16,185,129,0.3)'
                      : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: aiNormalizing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  {aiNormalizing ? (
                    <>
                      <span>⏳</span> Normalizando con IA según MCCEMS / NEM...
                    </>
                  ) : (
                    <>
                      <span>🪄</span> Normalizar con IA y Visualizar Inserción
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── PREVIEW DE RESULTADO NORMALIZADO ─────────────────────────────── */}
          {normalizedPreview && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
                border: '2px solid rgba(16, 185, 129, 0.6)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#6ee7b7', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✨</span> Proyección de Inserción Quirúrgica en el Documento Oficial
                    {previewItems.length > 1 && (
                      <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', padding: '3px 9px', borderRadius: '12px', fontWeight: 700 }}>
                        {previewItems.length} Metas Detectadas
                      </span>
                    )}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Revisa cómo se {previewItems.length > 1 ? 'integrarán estas metas' : 'integrará esta meta'} en cada sección oficial del PMC. Puedes ajustar cualquier campo antes de confirmar.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNormalizedPreview(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#cbd5e1',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSurgicalInsertion}
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13.5px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <span>✅</span> Confirmar e Insertar Quirúrgicamente {previewItems.length > 1 ? `las ${previewItems.length} Metas` : 'la Meta'} en el PMC
                  </button>
                </div>
              </div>

              {previewItems.map((item, itemIdx) => (
                <div
                  key={`preview-item-${itemIdx}`}
                  style={{
                    marginBottom: itemIdx < previewItems.length - 1 ? '24px' : '0',
                    paddingBottom: itemIdx < previewItems.length - 1 ? '20px' : '0',
                    borderBottom: itemIdx < previewItems.length - 1 ? '1px dashed rgba(255, 255, 255, 0.15)' : 'none',
                  }}
                >
                  {previewItems.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12.5px', background: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>
                        🎯 META #{itemIdx + 1}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                        {item.meta_institucional?.tema || (item.meta_individual?.meta_individual ? item.meta_individual.meta_individual.slice(0, 60) + '...' : `Meta ${itemIdx + 1}`)}
                      </strong>
                    </div>
                  )}

                  {/* Tarjeta Sección 7: Meta Individual */}
                  {item.meta_individual && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', background: 'rgba(99, 102, 241, 0.3)', color: '#c7d2fe', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          SECCIÓN 7 DEL DOCUMENTO
                        </span>
                        <strong style={{ fontSize: '14px', color: '#e0e7ff' }}>
                          Metas Individuales del Personal: {item.meta_individual.nombre} ({item.meta_individual.cargo})
                        </strong>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={labelStyle}>Meta y Compromiso Individual SMART:</label>
                          <textarea
                            value={item.meta_individual.meta_individual}
                            onChange={(e) => handleUpdatePreviewIndividual(itemIdx, 'meta_individual', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, minHeight: '56px' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Estrategia Individual en Aula:</label>
                            <input
                              type="text"
                              value={item.meta_individual.estrategia}
                              onChange={(e) => handleUpdatePreviewIndividual(itemIdx, 'estrategia', e.target.value)}
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>Entregable Comprobable:</label>
                            <input
                              type="text"
                              value={item.meta_individual.entregable}
                              onChange={(e) => handleUpdatePreviewIndividual(itemIdx, 'entregable', e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tarjeta Secciones 6 y 8: Plan de Acción, 5.1 / Adicional, Fichas Técnicas y Monitoreo */}
                  {item.meta_institucional && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          SECCIONES 6 Y 8 DEL DOCUMENTO
                        </span>
                        <strong style={{ fontSize: '14px', color: '#e0e7ff' }}>
                          Plan de Acción, Tablas Oficiales Formato 5.1 / Adicionales, Fichas Técnicas y Monitoreo Trimestral
                        </strong>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Ámbito / Clasificación Formato 5.1:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.nombre_categoria}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'nombre_categoria', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Tema Específico / Subcategoría:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.tema}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'tema', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Responsable / Personal Designado:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.personal_designado}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'personal_designado', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Meta Institucional Oficial:</label>
                          <textarea
                            value={item.meta_institucional.meta}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'meta', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, minHeight: '52px' }}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Estrategia de Implementación (Formato 4.1):</label>
                          <textarea
                            value={item.meta_institucional.estrategia}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'estrategia', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, minHeight: '52px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Producto que Comprobará la Meta (Formato 5.1):</label>
                          <input
                            type="text"
                            value={item.meta_institucional.entregable}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'entregable', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Situación Actual que Justifica la Meta:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.diagnostico_meta || item.meta_institucional.necesidad || ''}
                            onChange={(e) => {
                              handleUpdatePreviewInstitucional(itemIdx, 'diagnostico_meta', e.target.value);
                              handleUpdatePreviewInstitucional(itemIdx, 'necesidad', e.target.value);
                            }}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      {/* Detalle Ficha Técnica y Monitoreo */}
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '12px',
                          color: '#94a3b8',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#cbd5e1' }}>Acción Específica (Formato 3.1):</strong>{' '}
                          {item.meta_institucional.accion_especifica || item.meta_institucional.estrategia}
                        </div>
                        <div>
                          <strong style={{ color: '#cbd5e1' }}>Finalidad (Formato 3.1):</strong>{' '}
                          {item.meta_institucional.finalidad || 'Consolidar los aprendizajes'}
                        </div>
                        <div>
                          <strong style={{ color: '#cbd5e1' }}>Mecanismo de Monitoreo (Secc. 8):</strong>{' '}
                          Cortes de {item.meta_institucional.periodo_inicio || 'Septiembre'} a {item.meta_institucional.periodo_fin || 'Julio'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Botón inferior de confirmación */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleConfirmSurgicalInsertion}
                  disabled={saving}
                  style={{
                    padding: '11px 26px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <span>✅</span> Confirmar e Insertar Quirúrgicamente {previewItems.length > 1 ? `las ${previewItems.length} Metas` : 'la Meta'} en el PMC
                </button>
              </div>
            </div>
          )}

          {/* Resumen de metas registradas */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e0e7ff', marginBottom: '10px' }}>
              📋 Metas Registradas Actualmente en el Proyecto
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#c7d2fe' }}>Metas Individuales ({planAccion?.metas_personales?.length || 0})</span>
                  <button type="button" onClick={() => setSubTab('personales')} style={{ fontSize: '11.5px', color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver / Gestionar
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', maxHeight: '140px', overflowY: 'auto' }}>
                  {(planAccion?.metas_personales || []).length === 0 ? (
                    <span>No hay metas individuales capturadas.</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(planAccion?.metas_personales || []).map((m, idx) => (
                        <li key={`sum-p-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong style={{ color: '#f1f5f9' }}>{m.nombre}:</strong> {m.meta_individual}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('personales');
                              handleStartEditPersonalMeta(idx);
                            }}
                            title="Editar esta meta"
                            style={{
                              background: 'rgba(99, 102, 241, 0.2)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#c7d2fe',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✏️ Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#a7f3d0' }}>Metas Institucionales ({planAccion?.metas_institucionales?.length || 0})</span>
                  <button type="button" onClick={() => setSubTab('institucionales')} style={{ fontSize: '11.5px', color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver / Gestionar
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', maxHeight: '140px', overflowY: 'auto' }}>
                  {(planAccion?.metas_institucionales || []).length === 0 ? (
                    <span>No hay metas institucionales capturadas.</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(planAccion?.metas_institucionales || []).map((m, idx) => (
                        <li key={`sum-i-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong style={{ color: '#f1f5f9' }}>{m.tema || m.nombre_categoria}:</strong> {m.meta}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('institucionales');
                              handleStartEditInstMeta(idx);
                            }}
                            title="Editar esta meta"
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#a7f3d0',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✏️ Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
