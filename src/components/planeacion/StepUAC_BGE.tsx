'use client';

import { useState, useEffect } from 'react';
import type { ExtractedPdfData } from '@/types/planning';
import {
  FORMACIONES_LABORALES_BGE,
  getUacNamesForCapacitacion,
  normalizeKey,
} from '@/lib/capacitaciones-data';
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

export default function StepUAC_BGE({ onNext, selectedSubsystem, onSubsystemChange }: Props) {
  const [form, setForm] = useState<UACSelection>({
    uacName: '',
    semester: 3,
    component: 'fundamental',
    subsystem: selectedSubsystem || 'bge',
    curriculumName: '',
  });

  const [catalogPrograms, setCatalogPrograms] = useState<any[]>([]);
  const [selectedCatalogUac, setSelectedCatalogUac] = useState<any>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');

  const isLaboralDisabled = SEMESTERS_WITHOUT_COMPONENT.bge.includes(form.semester);
  const isFfeDisabled = form.semester < 5;
  const isProgresionesModel = form.semester >= 5;

  // Lista de especialidades / capacitaciones para BGE (15 oficiales)
  const specialties: string[] = form.component === 'laboral' ? [...FORMACIONES_LABORALES_BGE] : [];

  // Especialidad activa efectiva
  const activeSpecialty = selectedSpecialty || (form.component === 'laboral' ? (specialties[0] || '') : '');

  // Filtrar UACs según el componente y la capacitación seleccionada
  const filteredUacs: any[] = form.component === 'laboral'
    ? (() => {
        if (!activeSpecialty || activeSpecialty === 'manual_specialty') {
          return [];
        }

        const normSpec = normalizeKey(activeSpecialty);
        let matches = catalogPrograms.filter(p => normalizeKey(p.curriculum_name) === normSpec);

        const expectedNames = getUacNamesForCapacitacion(activeSpecialty, form.semester);
        if (expectedNames.length > 0) {
          const foundByTitle = catalogPrograms.filter(p =>
            expectedNames.some(exp => normalizeKey(p.uac_name) === normalizeKey(exp))
          );
          if (foundByTitle.length > 0) {
            matches = foundByTitle;
          } else if (matches.length === 0) {
            matches = expectedNames.map((name, i) => ({
              id: `uac-bge-laboral-${form.semester}-${i}`,
              uac_name: name,
              semester: form.semester,
              component: 'laboral',
              curriculum_name: activeSpecialty,
              total_hours: 54,
              learning_outcome: `Desarrollar competencias formativas y laborales en ${name}`,
              activities: [
                { order: 1, name: `Actividad Clave 1: Diagnóstico y preparación técnica en ${name}`, hours: 18 },
                { order: 2, name: `Actividad Clave 2: Ejecución técnica y operativa en ${name}`, hours: 18 },
                { order: 3, name: `Actividad Clave 3: Simulación profesional y entrega de evidencias en ${name}`, hours: 18 },
              ],
              evidences: [
                'Reporte de proceso técnico',
                'Simulación operativa evaluable',
                'Lista de cotejo / rúbrica de desempeño',
              ],
            }));
          }
        }

        return matches;
      })()
    : catalogPrograms;

  // Carga de programas desde el catálogo oficial BGE
  useEffect(() => {
    const fetchPrograms = async () => {
      setLoadingPrograms(true);
      try {
        const subParam = selectedSubsystem ? `&subsystem=${selectedSubsystem}` : '&subsystem=bge';
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

          if (form.component === 'laboral') {
            let currentSpec = selectedSpecialty;
            if (!currentSpec || currentSpec === 'manual_specialty' || !specialties.some(s => normalizeKey(s) === normalizeKey(currentSpec))) {
              currentSpec = specialties[0] || '';
              setSelectedSpecialty(currentSpec);
            }

            if (currentSpec && currentSpec !== 'manual_specialty') {
              const normSpec = normalizeKey(currentSpec);
              let matches = filtered.filter((p: any) => normalizeKey(p.curriculum_name) === normSpec);

              const expected = getUacNamesForCapacitacion(currentSpec, form.semester);
              if (expected.length > 0) {
                const found = filtered.filter((p: any) =>
                  expected.some(exp => normalizeKey(p.uac_name) === normalizeKey(exp))
                );
                if (found.length > 0) matches = found;
                else if (matches.length === 0) {
                  matches = expected.map((name, i) => ({
                    id: `uac-bge-laboral-${form.semester}-${i}`,
                    uac_name: name,
                    semester: form.semester,
                    component: 'laboral',
                    curriculum_name: currentSpec,
                    total_hours: 54,
                    learning_outcome: `Desarrollar competencias formativas y laborales en ${name}`,
                    activities: [
                      { order: 1, name: `Actividad Clave 1: Diagnóstico y preparación técnica en ${name}`, hours: 18 },
                      { order: 2, name: `Actividad Clave 2: Ejecución técnica y operativa en ${name}`, hours: 18 },
                      { order: 3, name: `Actividad Clave 3: Simulación profesional y entrega de evidencias en ${name}`, hours: 18 },
                    ],
                    evidences: [
                      'Reporte de proceso técnico',
                      'Simulación operativa evaluable',
                      'Lista de cotejo / rúbrica de desempeño',
                    ],
                  }));
                }
              }

              if (matches.length > 0) {
                const first = matches[0];
                setSelectedCatalogUac(first);
                setForm(prev => ({
                  ...prev,
                  uacName: first.uac_name,
                  curriculumName: currentSpec,
                  subsystem: selectedSubsystem,
                }));
                setIsManualInput(false);
              }
            }
          } else {
            // Para otros componentes (fundamental, ampliado, etc.)
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
        }
      } catch (err) {
        console.error('Error fetching BGE catalog programs:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchPrograms();
  }, [form.semester, form.component, selectedSubsystem]);

  // Cambio de semestre
  const handleSemesterChange = (newSemester: number) => {
    let nextComponent = form.component;
    if (SEMESTERS_WITHOUT_COMPONENT.bge.includes(newSemester) && form.component === 'laboral') {
      nextComponent = 'fundamental';
    } else if (newSemester < 5 && form.component === 'ext_optativo') {
      nextComponent = 'fundamental';
    }

    setForm(prev => ({
      ...prev,
      semester: newSemester,
      component: nextComponent,
    }));
  };

  // Cambio de componente
  const handleComponentChange = (newComponent: string) => {
    const isLaboral = newComponent === 'laboral';
    const defaultSpec = FORMACIONES_LABORALES_BGE[0];
    const specToUse = isLaboral ? (selectedSpecialty || defaultSpec) : '';

    if (isLaboral) {
      setSelectedSpecialty(specToUse);
      setIsManualInput(false);

      const expected = getUacNamesForCapacitacion(specToUse, form.semester);
      if (expected.length > 0) {
        const uacObj = {
          id: `uac-bge-laboral-${form.semester}-0`,
          uac_name: expected[0],
          semester: form.semester,
          component: 'laboral',
          curriculum_name: specToUse,
          total_hours: 54,
          learning_outcome: `Desarrollar competencias formativas y laborales en ${expected[0]}`,
          activities: [
            { order: 1, name: `Actividad Clave 1: Diagnóstico y preparación técnica en ${expected[0]}`, hours: 18 },
            { order: 2, name: `Actividad Clave 2: Ejecución técnica y operativa en ${expected[0]}`, hours: 18 },
            { order: 3, name: `Actividad Clave 3: Simulación profesional y entrega de evidencias en ${expected[0]}`, hours: 18 },
          ],
          evidences: [
            'Reporte de proceso técnico',
            'Simulación operativa evaluable',
            'Lista de cotejo / rúbrica de desempeño',
          ],
        };
        setSelectedCatalogUac(uacObj);
        setForm(prev => ({
          ...prev,
          component: newComponent,
          uacName: expected[0],
          curriculumName: specToUse,
        }));
        return;
      }
    }

    setForm(prev => ({
      ...prev,
      component: newComponent,
      curriculumName: isLaboral ? specToUse : '',
      uacName: '',
    }));
  };

  // Cambio de capacitación
  const handleSpecialtyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'manual_specialty') {
      setIsManualInput(true);
      setSelectedSpecialty('manual_specialty');
      setSelectedCatalogUac(null);
      setForm(prev => ({ ...prev, uacName: '', curriculumName: '' }));
    } else {
      setSelectedSpecialty(val);
      setIsManualInput(false);

      const expected = getUacNamesForCapacitacion(val, form.semester);
      let matches = catalogPrograms.filter(p => normalizeKey(p.curriculum_name) === normalizeKey(val));

      if (expected.length > 0) {
        const found = catalogPrograms.filter(p =>
          expected.some(exp => normalizeKey(p.uac_name) === normalizeKey(exp))
        );
        if (found.length > 0) {
          matches = found;
        } else if (matches.length === 0) {
          matches = expected.map((name, i) => ({
            id: `uac-bge-laboral-${form.semester}-${i}`,
            uac_name: name,
            semester: form.semester,
            component: 'laboral',
            curriculum_name: val,
            total_hours: 54,
            learning_outcome: `Desarrollar competencias formativas y laborales en ${name}`,
            activities: [
              { order: 1, name: `Actividad Clave 1: Diagnóstico y preparación técnica en ${name}`, hours: 18 },
              { order: 2, name: `Actividad Clave 2: Ejecución técnica y operativa en ${name}`, hours: 18 },
              { order: 3, name: `Actividad Clave 3: Simulación profesional y entrega de evidencias en ${name}`, hours: 18 },
            ],
            evidences: [
              'Reporte de proceso técnico',
              'Simulación operativa evaluable',
              'Lista de cotejo / rúbrica de desempeño',
            ],
          }));
        }
      }

      if (matches.length > 0) {
        const first = matches[0];
        setSelectedCatalogUac(first);
        setForm(prev => ({
          ...prev,
          uacName: first.uac_name,
          curriculumName: val,
        }));
      } else {
        setSelectedCatalogUac(null);
        setForm(prev => ({
          ...prev,
          uacName: '',
          curriculumName: val,
        }));
      }
    }
  };

  // Cambio de UAC en el select
  const handleUacSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'manual') {
      setIsManualInput(true);
      setSelectedCatalogUac(null);
      setForm(prev => ({
        ...prev,
        uacName: '',
        curriculumName: form.component === 'laboral' ? selectedSpecialty : '',
      }));
    } else {
      setIsManualInput(false);
      const selected = (form.component === 'laboral' ? filteredUacs : catalogPrograms).find(p => p.id === val)
        || catalogPrograms.find(p => p.id === val);

      if (selected) {
        setSelectedCatalogUac(selected);
        setForm(prev => ({
          ...prev,
          uacName: form.component === 'ampliado' ? cleanSocioemotionalName(selected.uac_name, form.semester) : selected.uac_name,
          curriculumName: form.component === 'laboral' ? selectedSpecialty : (selected.curriculum_name || ''),
        }));
      }
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.uacName.trim()) e.uacName = 'El nombre de la UAC es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isManualInput || !selectedCatalogUac) {
      onNext(form);
    } else {
      const initialData: ExtractedPdfData = {
        uacName: selectedCatalogUac.uac_name,
        learningOutcome: selectedCatalogUac.learning_outcome,
        totalHours: selectedCatalogUac.total_hours || 54,
        activities: selectedCatalogUac.activities || [
          { order: 1, name: `Actividad Clave 1: Diagnóstico y preparación técnica en ${selectedCatalogUac.uac_name}`, hours: 18 },
          { order: 2, name: `Actividad Clave 2: Ejecución técnica y operativa en ${selectedCatalogUac.uac_name}`, hours: 18 },
          { order: 3, name: `Actividad Clave 3: Simulación profesional y entrega de evidencias en ${selectedCatalogUac.uac_name}`, hours: 18 },
        ],
        evidences: selectedCatalogUac.evidences,
        parseConfidence: 'high',
        year: selectedCatalogUac.year || 2025,
        contenidosFormativos: form.component === 'laboral' ? undefined : selectedCatalogUac.contenidos_formativos,
      };
      onNext(form, initialData);
    }
  };

  const isLaboral = form.component === 'laboral';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="card-title">Paso 1: Datos de la UAC — Bachillerato General Estatal (BGE)</h2>
          <p className="card-subtitle">
            Selecciona el semestre, componente curricular y la Unidad de Aprendizaje Curricular oficial.
          </p>
        </div>
        <div>
          {isProgresionesModel ? (
            <span className="badge badge-purple" style={{ padding: '6px 12px', fontSize: 12 }}>
              🟣 Transición: Progresiones MCCEMS (5°-6° sem.)
            </span>
          ) : (
            <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: 12 }}>
              🟢 Modelo Oficial 2026-2027: Propósitos y Contenidos
            </span>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 12,
        marginBottom: 16,
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.4,
        background: isProgresionesModel ? 'rgba(168,85,247,0.08)' : 'rgba(16,185,129,0.08)',
        border: `1px solid ${isProgresionesModel ? 'rgba(168,85,247,0.25)' : 'rgba(16,185,129,0.25)'}`,
        color: isProgresionesModel ? '#c084fc' : '#34d399'
      }}>
        {isProgresionesModel ? (
          <>
            <strong>📌 Modelo de Transición Curricular Ciclo 2026-2027:</strong> Para 5.° y 6.° semestre, la planeación se estructura con <em>Progresiones de Aprendizaje MCCEMS</em>.
          </>
        ) : (
          <>
            <strong>✨ Modelo Curricular Oficial 2026-2027:</strong> Para 1.°, 2.°, 3.° y 4.° semestre, la planeación didáctica se estructura con <em>Propósitos Formativos y Contenidos de Estudio</em> oficiales de la SEP.
          </>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-required">Subsistema Educativo</label>
              <select
                className="form-select"
                value={selectedSubsystem}
                onChange={e => onSubsystemChange(e.target.value)}
              >
                <option value="bge">Bachillerato General Estatal (BGE)</option>
                <option value="digital">Bachillerato Digital</option>
                <option value="emsad">EMSAD</option>
                <option value="tecnologico">── Cambiar a Bachillerato Tecnológico ──</option>
                <option value="cbtis">CBTIS</option>
                <option value="cbta">CBTA</option>
                <option value="cecyte">CECyTE</option>
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
                  <option key={s} value={s}>{s}° Semestre {s >= 5 ? '(Progresiones)' : '(Propósitos)'}</option>
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
                <option
                  value="laboral"
                  disabled={isLaboralDisabled}
                  style={isLaboralDisabled ? { color: '#aaa' } : {}}
                >
                  Formación Laboral{isLaboralDisabled ? ' (3°-6° sem.)' : ''}
                </option>
              </select>
              {isLaboralDisabled && form.component === 'laboral' && (
                <span className="form-hint" style={{ color: 'var(--c-amber)', fontWeight: 500 }}>
                  ⚠️ En BGE, Formación Laboral aplica a partir del 3.er semestre.
                </span>
              )}
              {isFfeDisabled && form.component === 'ext_optativo' && (
                <span className="form-hint" style={{ color: 'var(--c-amber)', fontWeight: 500 }}>
                  ⚠️ FFE no aplica para semestres anteriores a 5º.
                </span>
              )}
            </div>
          </div>

          {/* Selector de Capacitación (solo si es Formación Laboral) */}
          {isLaboral && (
            <div className="form-group animate-fade-in">
              <label className="form-label form-label-required">
                Capacitación Laboral BGE (15 Opciones Oficiales del Estado de Puebla)
              </label>
              <select
                className="form-select"
                value={isManualInput && selectedSpecialty === 'manual_specialty' ? 'manual_specialty' : activeSpecialty}
                onChange={handleSpecialtyChange}
              >
                {specialties.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
                <option value="manual_specialty">➕ Otra capacitación (capturar manualmente)</option>
              </select>
            </div>
          )}

          {/* Selector de Nombre de la UAC */}
          <div className="form-group">
            <label className="form-label form-label-required">Nombre de la UAC</label>

            {loadingPrograms && filteredUacs.length === 0 ? (
              <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
                <div className="spinner spinner-dark" style={{ width: '16px', height: '16px' }} />
                <span>
                  {isLaboral ? 'Cargando UACs oficiales de la capacitación...' : 'Cargando UACs del catálogo oficial BGE...'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select
                  className="form-select"
                  value={
                    isManualInput || filteredUacs.length === 0
                      ? 'manual'
                      : (selectedCatalogUac?.id || (filteredUacs[0]?.id ?? 'manual'))
                  }
                  onChange={handleUacSelectChange}
                >
                  {filteredUacs.map((p) => {
                    const displayName = form.component === 'ampliado'
                      ? cleanSocioemotionalName(p.uac_name, form.semester)
                      : p.uac_name;
                    const suffix = isLaboral
                      ? ''
                      : form.component === 'ampliado'
                        ? ''
                        : p.curriculum_name ? ` (${p.curriculum_name})` : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {displayName}{suffix} ({p.total_hours || 54} hrs)
                      </option>
                    );
                  })}
                  <option value="manual">➕ Agregar otra UAC (capturar manualmente / subir PDF)</option>
                </select>

                {(isManualInput || (filteredUacs.length === 0 && !loadingPrograms)) && (
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
            <span className="form-hint">
              {isLaboral
                ? 'Selecciona una de las 2 UACs oficiales de la capacitación o captura manualmente.'
                : 'Selecciona una UAC del catálogo oficial o escribe el nombre exacto de tu programa.'}
            </span>
          </div>

          {/* Tarjeta de Resumen Curricular Precargado */}
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
                  {selectedCatalogUac.total_hours || 54} hrs totales ({Math.round((selectedCatalogUac.total_hours || 54) / 18)} h/semana)
                </div>
              </div>

              {isLaboral ? (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Resultado de Aprendizaje</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8' }}>
                      1 Resultado Oficial (SEP)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Actividades Clave</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                      3 Actividades Clave (18h c/u)
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nombre del currículo / capacitación</label>
            <input
              className="form-input"
              placeholder={isManualInput ? "Ej: Área de la Salud, Turismo, Administración..." : ""}
              value={form.curriculumName || ''}
              onChange={e => setForm({ ...form, curriculumName: e.target.value })}
              disabled={!isManualInput}
              style={!isManualInput ? { background: 'rgba(255,255,255,0.04)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)', cursor: 'not-allowed' } : {}}
            />
            <span className="form-hint">
              El nombre de la capacitación laboral o área a la que pertenece esta UAC (se autocompleta con el catálogo).
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
