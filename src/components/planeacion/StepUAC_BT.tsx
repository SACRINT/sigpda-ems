'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ExtractedPdfData } from '@/types/planning';
import {
  CARRERAS_TECNICAS_BT,
  getModulosPorSemestreBT,
  BTCarrera,
  BTModulo,
  BTSubmodulo
} from '@/lib/bt-carreras-catalog';
import { SEMESTERS_WITHOUT_COMPONENT } from '@/lib/subsystem-config';
import { cleanSocioemotionalName } from '@/lib/utils';

export interface UACSelection {
  uacName: string;
  semester: number;
  component: string;
  subsystem?: string;
  curriculumName?: string;
}

interface Props {
  onNext: (data: UACSelection, initialData?: ExtractedPdfData) => void;
  selectedSubsystem: string;
  onSubsystemChange: (subsystem: string) => void;
}

export default function StepUAC_BT({ onNext, selectedSubsystem, onSubsystemChange }: Props) {
  const [form, setForm] = useState<UACSelection>({
    uacName: '',
    semester: 2, // En Bachillerato Tecnológico, la Carrera Técnica inicia desde 2° semestre
    component: 'laboral', // En BT el componente técnico es protagonista
    subsystem: selectedSubsystem || 'tecnologico',
    curriculumName: 'Contabilidad',
  });

  const [searchCareerQuery, setSearchCareerQuery] = useState('');
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>('contabilidad');
  const [selectedSubmoduloIndex, setSelectedSubmoduloIndex] = useState<number>(0);
  
  // Para componentes no laborales (fundamental, ampliado, etc.)
  const [catalogPrograms, setCatalogPrograms] = useState<any[]>([]);
  const [selectedCatalogUac, setSelectedCatalogUac] = useState<any>(null);
  
  const [isManualInput, setIsManualInput] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isLaboral = form.component === 'laboral';
  // En BT, Carrera Técnica solo se deshabilita en 1er semestre
  const isLaboralDisabled = SEMESTERS_WITHOUT_COMPONENT.bt.includes(form.semester);
  const isFfeDisabled = form.semester < 5;
  const isProgresionesModel = form.semester >= 5;

  // Filtrado de carreras por búsqueda
  const filteredCarreras = useMemo(() => {
    if (!searchCareerQuery.trim()) return CARRERAS_TECNICAS_BT;
    const q = searchCareerQuery.toLowerCase().trim();
    return CARRERAS_TECNICAS_BT.filter(c => 
      c.nombre.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [searchCareerQuery]);

  // Carrera activa
  const activeCarrera: BTCarrera | undefined = useMemo(() => {
    return CARRERAS_TECNICAS_BT.find(c => c.id === selectedCarreraId) || CARRERAS_TECNICAS_BT[0];
  }, [selectedCarreraId]);

  // Módulo activo según el semestre seleccionado (Sem 2 -> Mód I, Sem 3 -> Mód II, etc.)
  const activeModulo: BTModulo | undefined = useMemo(() => {
    if (!activeCarrera || form.semester < 2 || form.semester > 6) return undefined;
    return getModulosPorSemestreBT(activeCarrera.id, form.semester);
  }, [activeCarrera, form.semester]);

  // Submódulo activo
  const activeSubmodulo: BTSubmodulo | undefined = useMemo(() => {
    if (!activeModulo || !activeModulo.submodulos.length) return undefined;
    const idx = Math.min(selectedSubmoduloIndex, activeModulo.submodulos.length - 1);
    return activeModulo.submodulos[idx];
  }, [activeModulo, selectedSubmoduloIndex]);

  // Sincronizar form cuando cambia carrera, módulo o submódulo en Carrera Técnica
  useEffect(() => {
    if (isLaboral && activeCarrera && activeModulo && activeSubmodulo && !isManualInput) {
      setForm(prev => ({
        ...prev,
        uacName: `Submódulo ${selectedSubmoduloIndex + 1}: ${activeSubmodulo.nombre}`,
        curriculumName: activeCarrera.nombre,
        subsystem: selectedSubsystem,
      }));
    }
  }, [isLaboral, activeCarrera, activeModulo, activeSubmodulo, selectedSubmoduloIndex, selectedSubsystem, isManualInput]);

  // Carga de catálogo para componentes no técnicos (fundamental, ampliado, etc.)
  useEffect(() => {
    if (isLaboral) return;

    const fetchPrograms = async () => {
      setLoadingPrograms(true);
      try {
        const subParam = selectedSubsystem ? `&subsystem=${selectedSubsystem}` : '&subsystem=tecnologico';
        const res = await fetch(`/api/programs?semester=${form.semester}&component=${form.component}${subParam}`);
        const data = await res.json();

        if (data.programs) {
          let filtered = data.programs;
          if (form.component === 'ampliado') {
            if (form.semester === 1 || form.semester === 2) {
              filtered = data.programs.filter((p: any) =>
                p.uac_name.includes('Artísticas y Culturales') ||
                p.uac_name.includes('Físicas y Deportivas')
              );
            } else {
              filtered = data.programs.filter((p: any) =>
                !p.uac_name.includes('Artísticas y Culturales') &&
                !p.uac_name.includes('Físicas y Deportivas')
              );
            }
          }

          setCatalogPrograms(filtered);

          if (filtered.length > 0) {
            const first = filtered[0];
            setSelectedCatalogUac(first);
            setForm(prev => ({
              ...prev,
              uacName: form.component === 'ampliado' ? cleanSocioemotionalName(first.uac_name, form.semester) : first.uac_name,
              curriculumName: first.curriculum_name || '',
              subsystem: selectedSubsystem,
            }));
            setIsManualInput(false);
          }
        }
      } catch (err) {
        console.error('Error fetching BT catalog programs:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchPrograms();
  }, [form.semester, form.component, selectedSubsystem, isLaboral]);

  // Cambio de semestre
  const handleSemesterChange = (newSemester: number) => {
    let nextComponent = form.component;
    if (SEMESTERS_WITHOUT_COMPONENT.bt.includes(newSemester) && form.component === 'laboral') {
      nextComponent = 'fundamental';
    } else if (newSemester < 5 && form.component === 'ext_optativo') {
      nextComponent = 'fundamental';
    }

    setForm(prev => ({
      ...prev,
      semester: newSemester,
      component: nextComponent,
    }));
    setSelectedSubmoduloIndex(0);
  };

  // Cambio de componente
  const handleComponentChange = (newComponent: string) => {
    const isNowLaboral = newComponent === 'laboral';
    setForm(prev => ({
      ...prev,
      component: newComponent,
      curriculumName: isNowLaboral ? (activeCarrera?.nombre || 'Contabilidad') : '',
      uacName: '',
    }));
    setIsManualInput(false);
    setSelectedSubmoduloIndex(0);
  };

  // Cambio de Carrera Técnica
  const handleCarreraChange = (carreraId: string) => {
    if (carreraId === 'manual_career') {
      setIsManualInput(true);
      setForm(prev => ({ ...prev, uacName: '', curriculumName: '' }));
      return;
    }
    setIsManualInput(false);
    setSelectedCarreraId(carreraId);
    setSelectedSubmoduloIndex(0);
  };

  // Cambio de Submódulo
  const handleSubmoduloChange = (val: string) => {
    if (val === 'manual_submodulo') {
      setIsManualInput(true);
      setForm(prev => ({ ...prev, uacName: '' }));
      return;
    }
    setIsManualInput(false);
    const idx = parseInt(val, 10);
    setSelectedSubmoduloIndex(isNaN(idx) ? 0 : idx);
  };

  // Manejador para UACs no laborales (fundamental, ampliado)
  const handleNonLaboralUacChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'manual') {
      setIsManualInput(true);
      setSelectedCatalogUac(null);
      setForm(prev => ({ ...prev, uacName: '' }));
    } else {
      setIsManualInput(false);
      const selected = catalogPrograms.find(p => p.id === val);
      if (selected) {
        setSelectedCatalogUac(selected);
        setForm(prev => ({
          ...prev,
          uacName: form.component === 'ampliado' ? cleanSocioemotionalName(selected.uac_name, form.semester) : selected.uac_name,
          curriculumName: selected.curriculum_name || '',
        }));
      }
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.uacName.trim()) e.uacName = 'El nombre de la UAC o Submódulo es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isLaboral && activeCarrera && activeModulo && activeSubmodulo && !isManualInput) {
      const horasTotales = activeSubmodulo.horasTotales;
      const horasPorFase = Math.round(horasTotales / 3);
      const horasFase3 = horasTotales - (horasPorFase * 2);

      const initialData: ExtractedPdfData = {
        uacName: form.uacName,
        learningOutcome: `Desarrollar las competencias profesionales y laborales correspondientes al ${activeModulo.nombre}: "${activeSubmodulo.nombre}" de la Carrera Técnica en ${activeCarrera.nombre}, integrando saberes técnicos, habilidades prácticas y estándares de la industria.`,
        totalHours: horasTotales,
        activities: [
          {
            order: 1,
            name: `Fase 1: Diagnóstico técnico, marco normativo y preparación operativa de ${activeSubmodulo.nombre}`,
            hours: horasPorFase,
          },
          {
            order: 2,
            name: `Fase 2: Ejecución práctica, procesos operativos y aplicación en taller/laboratorio`,
            hours: horasPorFase,
          },
          {
            order: 3,
            name: `Fase 3: Simulación profesional, control de calidad y entrega de evidencias técnicas`,
            hours: horasFase3,
          },
        ],
        evidences: [
          'Portafolio de evidencias y reportes técnicos de laboratorio/taller',
          'Práctica demostrativa de simulación profesional evaluable',
          'Lista de cotejo / rúbrica de desempeño de competencia laboral',
        ],
        parseConfidence: 'high',
        year: activeCarrera.tipoPrograma === 'nuevo' ? 2024 : 2016,
      };

      onNext(form, initialData);
    } else if (isManualInput || !selectedCatalogUac) {
      onNext(form);
    } else {
      const initialData: ExtractedPdfData = {
        uacName: selectedCatalogUac.uac_name,
        learningOutcome: selectedCatalogUac.learning_outcome,
        totalHours: selectedCatalogUac.total_hours || 54,
        activities: selectedCatalogUac.activities || [
          { order: 1, name: `Propósito Formativo 1`, hours: 18 },
          { order: 2, name: `Propósito Formativo 2`, hours: 18 },
          { order: 3, name: `Propósito Formativo 3`, hours: 18 },
        ],
        evidences: selectedCatalogUac.evidences,
        parseConfidence: 'high',
        year: selectedCatalogUac.year || 2025,
        contenidosFormativos: selectedCatalogUac.contenidos_formativos,
      };
      onNext(form, initialData);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="card-title">Paso 1: Datos de la UAC — Bachillerato Tecnológico</h2>
          <p className="card-subtitle">
            Selecciona el subsistema tecnológico, semestre y la Carrera Técnica oficial (66 especialidades COSFAC/DGETI).
          </p>
        </div>
        <div>
          <span className="badge badge-blue" style={{ padding: '6px 12px', fontSize: 12 }}>
            ⚙️ Bachillerato Tecnológico: Base 16 Semanas Lectivas
          </span>
        </div>
      </div>

      <div style={{
        marginTop: 12,
        marginBottom: 16,
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.4,
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.25)',
        color: '#60a5fa'
      }}>
        <strong>📌 Estructura Modular Técnica Oficial:</strong> En Bachilleratos Tecnológicos (CBTIS, CBTA, CECyTE), la <strong>Carrera Técnica</strong> inicia en <strong>2.° semestre</strong> (Módulo I) y concluye en <strong>6.° semestre</strong> (Módulo V) con una carga semestral basada en 16 semanas de mediación docente directa.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required">Subsistema Tecnológico</label>
              <select
                className="form-select"
                value={selectedSubsystem}
                onChange={e => onSubsystemChange(e.target.value)}
              >
                <option value="tecnologico">Bachillerato Tecnológico (General)</option>
                <option value="cbtis">CBTIS</option>
                <option value="cbta">CBTA</option>
                <option value="cecyte">CECyTE</option>
                <option value="bge">── Cambiar a Bachillerato General Estatal (BGE) ──</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label form-label-required">Semestre</label>
              <select
                className="form-select"
                value={form.semester}
                onChange={e => handleSemesterChange(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map(s => (
                  <option key={s} value={s}>
                    {s}° Semestre {s >= 2 ? `(Módulo ${['', 'I', 'II', 'III', 'IV', 'V'][s - 1]} Técnico)` : '(Tronco Común)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label form-label-required">Componente Curricular</label>
              <select
                className="form-select"
                value={form.component}
                onChange={e => handleComponentChange(e.target.value)}
              >
                <option
                  value="laboral"
                  disabled={isLaboralDisabled}
                  style={isLaboralDisabled ? { color: '#aaa' } : { fontWeight: 'bold' }}
                >
                  Carrera Técnica (2°-6° sem.)
                </option>
                <option value="fundamental">Currículum Fundamental</option>
                <option value="ext_obligatorio">F. Fundamental Extendida Obligatoria (FFEO)</option>
                <option
                  value="ext_optativo"
                  disabled={isFfeDisabled}
                  style={isFfeDisabled ? { color: '#aaa' } : {}}
                >
                  F. Fundamental Extendida (FFE){isFfeDisabled ? ' (5°-6° sem.)' : ''}
                </option>
                <option value="ampliado">Currículum Ampliado</option>
              </select>
              {isLaboralDisabled && form.component === 'laboral' && (
                <span className="form-hint" style={{ color: 'var(--c-amber)', fontWeight: 500 }}>
                  ⚠️ En Bachillerato Tecnológico, la Carrera Técnica inicia a partir del 2.° semestre.
                </span>
              )}
            </div>
          </div>

          {/* Sección exclusiva para Carrera Técnica */}
          {isLaboral && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Buscador y Selector de las 66 Carreras Técnicas */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label form-label-required" style={{ margin: 0 }}>
                    Carrera Técnica (66 Carreras Oficiales COSFAC / DGETI)
                  </label>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {filteredCarreras.length} carreras disponibles
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Escribe para buscar carrera (ej: Contabilidad, Programación, Mecatrónica, Agropecuario...)"
                    value={searchCareerQuery}
                    onChange={e => setSearchCareerQuery(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  {searchCareerQuery && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSearchCareerQuery('')}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <select
                  className="form-select"
                  value={isManualInput ? 'manual_career' : selectedCarreraId}
                  onChange={e => handleCarreraChange(e.target.value)}
                  size={searchCareerQuery ? 6 : 1}
                  style={{ maxHeight: searchCareerQuery ? '180px' : 'auto' }}
                >
                  {filteredCarreras.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.tipoPrograma === 'nuevo' ? '⭐ (Prog. Actualizado)' : ''}
                    </option>
                  ))}
                  <option value="manual_career">➕ Otra carrera técnica (capturar manualmente)</option>
                </select>
              </div>

              {/* Banner Informativo del Módulo según el Semestre */}
              {activeModulo && !isManualInput && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8
                }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#818cf8', fontWeight: 600 }}>
                      Módulo Profesional de {form.semester}.° Semestre
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e7ff', marginTop: 2 }}>
                      {activeModulo.nombre}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-purple" style={{ fontSize: 12 }}>
                      {activeModulo.horasSemanales} h/semana · Base 16 semanas ({activeModulo.horasSemanales * 16} hrs módulo)
                    </span>
                  </div>
                </div>
              )}

              {/* Selector de Submódulo */}
              <div className="form-group">
                <label className="form-label form-label-required">
                  Submódulo Oficial a Planear
                </label>
                
                {activeModulo && activeModulo.submodulos.length > 0 ? (
                  <select
                    className="form-select"
                    value={isManualInput ? 'manual_submodulo' : selectedSubmoduloIndex}
                    onChange={e => handleSubmoduloChange(e.target.value)}
                  >
                    {activeModulo.submodulos.map((sub, idx) => (
                      <option key={idx} value={idx}>
                        Submódulo {idx + 1}: {sub.nombre} ({sub.horasTotales} hrs · {sub.horasSemanales} h/sem)
                      </option>
                    ))}
                    <option value="manual_submodulo">➕ Otro submódulo (capturar manualmente / subir PDF)</option>
                  </select>
                ) : (
                  <div className="alert alert-warning" style={{ fontSize: 13 }}>
                    No se encontraron submódulos predefinidos para este semestre. Puedes capturar el submódulo manualmente.
                  </div>
                )}

                {isManualInput && (
                  <input
                    className="form-input animate-fade-in"
                    placeholder="Escribe el nombre del submódulo técnico..."
                    value={form.uacName}
                    onChange={e => setForm({ ...form, uacName: e.target.value })}
                    required
                    autoFocus
                    style={{ marginTop: 8 }}
                  />
                )}
                {errors.uacName && <span className="form-error">{errors.uacName}</span>}
                <span className="form-hint">
                  Selecciona el submódulo correspondiente al período de trabajo docente.
                </span>
              </div>

              {/* Tarjeta de Resumen Curricular Oficial BT */}
              {!isManualInput && activeSubmodulo && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Carga Horaria Oficial (Base 16 sem.)</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>
                      {activeSubmodulo.horasTotales} hrs ({activeSubmodulo.horasSemanales} h/semana)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Módulo Profesional</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8' }}>
                      {activeModulo?.nombre.split('.')[0] || `Módulo ${form.semester - 1}`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Actividades de Competencia</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                      3 Fases Técnicas ({Math.round(activeSubmodulo.horasTotales / 3)}h c/u)
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Si NO es Carrera Técnica: Flujo Normal para Fundamental/Ampliado/FFE */}
          {!isLaboral && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label form-label-required">Nombre de la UAC</label>

                {loadingPrograms && catalogPrograms.length === 0 ? (
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
                    <div className="spinner spinner-dark" style={{ width: '16px', height: '16px' }} />
                    <span>Cargando UACs del catálogo oficial...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <select
                      className="form-select"
                      value={
                        isManualInput || catalogPrograms.length === 0
                          ? 'manual'
                          : (selectedCatalogUac?.id || (catalogPrograms[0]?.id ?? 'manual'))
                      }
                      onChange={handleNonLaboralUacChange}
                    >
                      {catalogPrograms.map((p) => {
                        const displayName = form.component === 'ampliado'
                          ? cleanSocioemotionalName(p.uac_name, form.semester)
                          : p.uac_name;
                        const suffix = p.curriculum_name ? ` (${p.curriculum_name})` : '';
                        return (
                          <option key={p.id} value={p.id}>
                            {displayName}{suffix} ({p.total_hours || 54} hrs)
                          </option>
                        );
                      })}
                      <option value="manual">➕ Agregar otra UAC (capturar manualmente / subir PDF)</option>
                    </select>

                    {(isManualInput || (catalogPrograms.length === 0 && !loadingPrograms)) && (
                      <input
                        className="form-input animate-fade-in"
                        placeholder="Escribe el nombre de la UAC..."
                        value={form.uacName}
                        onChange={e => setForm({ ...form, uacName: e.target.value })}
                        required
                        autoFocus
                      />
                    )}
                  </div>
                )}
                {errors.uacName && <span className="form-error">{errors.uacName}</span>}
              </div>

              {!isManualInput && selectedCatalogUac && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Carga Horaria</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>
                      {selectedCatalogUac.total_hours || 54} hrs totales ({Math.round((selectedCatalogUac.total_hours || 54) / 16)} h/semana)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      {isProgresionesModel ? 'Progresiones Registradas' : 'Propósitos Formativos'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8' }}>
                      {selectedCatalogUac.activities?.length || 3} {isProgresionesModel ? 'progresiones' : 'propósitos clave'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Contenidos / Temas</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                      {selectedCatalogUac.contenidos_formativos?.length > 0
                        ? `${selectedCatalogUac.contenidos_formativos.reduce((acc: number, c: any) => acc + (c.contenidos?.length || 0), 0)} temas precargados`
                        : 'Listos para sincronizar'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Carrera Técnica / Especialidad Curricular</label>
            <input
              className="form-input"
              placeholder={isManualInput ? "Ej: Contabilidad, Programación, Mecatrónica..." : ""}
              value={form.curriculumName || ''}
              onChange={e => setForm({ ...form, curriculumName: e.target.value })}
              disabled={!isManualInput}
              style={!isManualInput ? { background: 'rgba(255,255,255,0.04)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)', cursor: 'not-allowed' } : {}}
            />
            <span className="form-hint">
              {isLaboral
                ? 'Nombre oficial de la Carrera Técnica seleccionada del catálogo.'
                : 'Área de especialidad o currículo (se autocompleta con el catálogo).'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button type="submit" className="btn btn-primary">
              Continuar →
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
