'use client';

import React from 'react';
import type { PaecWizardController } from './usePaecWizardActions';

export function PaecSetupContextFields({ w }: { w: PaecWizardController }) {
  const {
    projectName,
    setProjectName,
    problemStatement,
    setProblemStatement,
    cycleType,
    setCycleType,
    community,
    setCommunity,
    school,
    setSchool,
    cctSearching,
    cctWarning,
    setCctWarning,
    loadingZona,
    zonaFeedback,
    handleConsultarZona,
    handleCctLookup,
  } = w;

  return (
    <>
          {/* Datos del Proyecto */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>1. Identificación del Proyecto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Nombre Preliminar del Proyecto Escolar Comunitario <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="paec-project-name"
                  type="text"
                  required
                  placeholder="Ej: Transformando el PET en Soluciones Comunitarias Ecológicas"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Problemática o Necesidad seleccionada por el Comité del Plantel <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  id="paec-problem-statement"
                  required
                  rows={3}
                  placeholder="Ej: Alto índice de contaminación por residuos plásticos en los alrededores del plantel y falta de cultura de reciclaje en la comunidad."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ciclo Semestral / Bloque de Relevo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={cycleType}
                  onChange={(e) => setCycleType(e.target.value as 'A' | 'B' | 'annual')}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff' }}
                >
                  <option value="A">Semestre A (1° y 3° Semestre - Septiembre-Enero)</option>
                  <option value="B">Semestre B (2° y 4° Semestre - Febrero-Junio)</option>
                  <option value="annual">Proyecto Completo (1° al 6° Semestre)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contexto Comunitario */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>2. Ficha de Datos de la Comunidad (INEGI/Entorno)</h2>
            <p style={{ margin: '-10px 0 16px', fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
              Puedes consultar y obtener los datos demográficos y socioeconómicos de tu localidad en el buscador oficial de INEGI:{' '}
              <a href="https://www.inegi.org.mx/app/areasgeograficas/" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'underline' }}>
                Sistema de Áreas Geográficas de INEGI 🔗
              </a>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Ubicación Geográfica y Nombre de la Localidad <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="paec-community-location"
                  type="text"
                  required
                  placeholder="Ej: San Antonio Tepetitlán, Municipio de Chignahuapan, Puebla"
                  value={community.location}
                  onChange={(e) => setCommunity({ ...community, location: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Situación Demográfica <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="paec-community-demographics"
                  type="text"
                  required
                  placeholder="Ej: Población de 4,200 habitantes, mayoría joven menor de 25 años"
                  value={community.demographics}
                  onChange={(e) => setCommunity({ ...community, demographics: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Actividades Socioeconómicas Principales <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="paec-community-economy"
                  type="text"
                  required
                  placeholder="Ej: Agricultura de temporal, comercio local y artesanías"
                  value={community.economy}
                  onChange={(e) => setCommunity({ ...community, economy: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Tradiciones Socioculturales</label>
                <input
                  type="text"
                  placeholder="Ej: Fiestas patronales locales, tradiciones comunitarias"
                  value={community.traditions}
                  onChange={(e) => setCommunity({ ...community, traditions: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Seguridad Pública</label>
                <input
                  type="text"
                  placeholder="Ej: Nivel de seguridad moderado, presencia de policía municipal"
                  value={community.security}
                  onChange={(e) => setCommunity({ ...community, security: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Situación Medioambiental</label>
                <input
                  type="text"
                  placeholder="Ej: Escasez de agua en temporada seca, manejo deficiente de residuos sólidos"
                  value={community.environment}
                  onChange={(e) => setCommunity({ ...community, environment: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
            </div>
          </div>

          {/* Contexto del Plantel */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', color: '#818cf8', margin: 0, fontWeight: 700 }}>3. Ficha de Datos del Plantel</h2>
              {cctSearching && (
                <span style={{ fontSize: '12px', color: '#38bdf8' }}>🔍 Buscando en catálogo de Puebla...</span>
              )}
            </div>

            {/* Búsqueda y Autocompletado por CCT */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '12px', color: '#818cf8', textTransform: 'uppercase' }}>
                    Clave CCT (Puebla)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', minWidth: 0, alignItems: 'stretch' }}>
                    <input
                      type="text"
                      placeholder="Ej: 21EBH0200X"
                      value={school.cct || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSchool(prev => ({ ...prev, cct: val }));
                        if (val.length >= 7) {
                          handleCctLookup(val);
                        } else {
                          setCctWarning(null);
                        }
                      }}
                      onBlur={() => {
                        if (school.cct && school.cct.length >= 5) {
                          handleCctLookup(school.cct);
                        }
                      }}
                      style={{ flex: 1, minWidth: '100px', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff', fontFamily: 'monospace', fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      onClick={handleConsultarZona}
                      disabled={loadingZona}
                      style={{
                        flexShrink: 0,
                        padding: '8px 14px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: loadingZona ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                      }}
                      title="Consultar diagnóstico, estadísticas 911/F11 y contexto territorial desde la Cartografía de Zona Escolar"
                    >
                      {loadingZona ? '⏳ Consultando...' : '✨ Consultar Zona'}
                    </button>
                  </div>
                  {cctWarning && (
                    <div style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px', fontWeight: 500 }}>
                      ⚠️ {cctWarning} (puedes capturar los datos manualmente)
                    </div>
                  )}
                  {zonaFeedback && (
                    <div style={{
                      color: zonaFeedback.startsWith('✅') ? '#34d399' : '#fbbf24',
                      fontSize: '11.5px',
                      marginTop: '6px',
                      fontWeight: 600,
                      background: 'rgba(0,0,0,0.2)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                    }}>
                      {zonaFeedback}
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Nombre del Plantel
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Bachillerato Digital Núm. 46"
                    value={school.schoolName || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, schoolName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Municipio
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Venustiano Carranza"
                    value={school.municipality || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, municipality: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Localidad
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: San José"
                    value={school.locality || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, locality: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px', fontSize: '12px', color: 'rgba(240,244,255,0.7)' }}>
                    Zona Escolar
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Zona Escolar 004"
                    value={school.schoolZone || ''}
                    onChange={(e) => setSchool(prev => ({ ...prev, schoolZone: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f0f4ff' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Matrícula Escolar (Estudiantes) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="paec-school-enrollment"
                  type="text"
                  required
                  placeholder="Ej: 280 alumnos inscritos en ambos semestres"
                  value={school.enrollment}
                  onChange={(e) => setSchool({ ...school, enrollment: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
                  Plantilla Docente <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="paec-school-teachercount"
                  type="text"
                  required
                  placeholder="Ej: 12 docentes, 1 orientador y 2 administrativos"
                  value={school.teacherCount}
                  onChange={(e) => setSchool({ ...school, teacherCount: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Indicadores Educativos (Aprovechamiento/Rezago)</label>
                <input
                  type="text"
                  placeholder="Ej: 78% de aprobación, 10% deserción semestral"
                  value={school.indicators}
                  onChange={(e) => setSchool({ ...school, indicators: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Programas Activos Previos</label>
                <input
                  type="text"
                  placeholder="Ej: Programa ConstruyeT, campaña de salud escolar"
                  value={school.previousPrograms}
                  onChange={(e) => setSchool({ ...school, previousPrograms: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Instalaciones y Equipamiento Destacado</label>
                <input
                  type="text"
                  placeholder="Ej: Aulas equipadas, biblioteca, cancha deportiva, área verde"
                  value={school.facilities}
                  onChange={(e) => setSchool({ ...school, facilities: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
            </div>
          </div>

    </>
  );
}
