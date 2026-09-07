'use client';

import { useState, useEffect } from 'react';
import type { ExtractedPdfData } from '@/types/planning';
import {
  FORMACIONES_LABORALES_BGE,
  CARRERAS_TECNICAS_OFICIALES,
  getUacNamesForCapacitacion,
  normalizeKey,
} from '@/lib/capacitaciones-data';

interface UACSelection {
  uacName: string;
  semester: number;
  component: string;
  subsystem?: string;
  curriculumName?: string;
}

interface Props {
  onNext: (data: UACSelection, initialData?: ExtractedPdfData) => void;
}

// Formación Laboral no aplica en 1° ni 2° semestre
const SEMESTERS_WITHOUT_LABORAL = [1, 2];

function cleanSocioemotionalName(name: string, semester: number): string {
  let clean = name.replace(/^Ámbito de la Formación Socioemocional:\s*/i, '');
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  const roman = romans[semester] || '';
  if (roman && !clean.endsWith(` ${roman}`)) {
    clean = `${clean} ${roman}`;
  }
  return clean;
}

export default function StepUAC({ onNext }: Props) {
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>('bge');
  const [form, setForm] = useState<UACSelection>({
    uacName: '',
    semester: 3,
    component: 'laboral',
    subsystem: 'bge',
    curriculumName: FORMACIONES_LABORALES_BGE[3], // 'Comunicación Gráfica' por defecto amigable
  });

  const [catalogPrograms, setCatalogPrograms] = useState<any[]>([]);
  const [selectedCatalogUac, setSelectedCatalogUac] = useState<any>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(FORMACIONES_LABORALES_BGE[3]);

  const isLaboralDisabled = SEMESTERS_WITHOUT_LABORAL.includes(form.semester);
  const isFfeDisabled = form.semester < 5;
  const isProgresionesModel = form.semester >= 5;

  const isBge = !selectedSubsystem || selectedSubsystem === 'bge';
  const isTec = ['tecnologico', 'cbtis', 'cbta', 'cecyte'].includes(selectedSubsystem);

  // Lista de especialidades / capacitaciones para el dropdown
  const specialties: string[] = form.component === 'laboral'
    ? (isBge
        ? [...FORMACIONES_LABORALES_BGE]
        : isTec
          ? Array.from(new Set([
              ...CARRERAS_TECNICAS_OFICIALES,
              ...catalogPrograms.map(p => p.curriculum_name).filter(Boolean)
            ]))
          : Array.from(new Set(catalogPrograms.map(p => p.curriculum_name).filter(Boolean))).sort() as string[])
    : [];

  // Filtrar UACs según el componente y la capacitación seleccionada
  const filteredUacs: any[] = form.component === 'laboral'
    ? (() => {
        if (!selectedSpecialty || selectedSpecialty === 'manual_specialty') {
          return catalogPrograms;
        }

        const normSpec = normalizeKey(selectedSpecialty);

        // 1. Coincidencia por curriculum_name en catalogPrograms
        let matches = catalogPrograms.filter(p => {
          const normCur = normalizeKey(p.curriculum_name);
          return normCur === normSpec || normCur.includes(normSpec) || normSpec.includes(normCur);
        });

        // 2. Para BGE, verificar contra los nombres oficiales de la capacitación en este semestre
        if (isBge) {
          const expectedNames = getUacNamesForCapacitacion(selectedSpecialty, form.semester);
          if (expectedNames.length > 0) {
            const foundByTitle = catalogPrograms.filter(p =>
              expectedNames.some(exp => normalizeKey(p.uac_name) === normalizeKey(exp))
            );
            if (foundByTitle.length > 0) {
              matches = foundByTitle;
            } else if (matches.length === 0) {
              // Si aún no han cargado o hay desfase de red, generar objetos virtuales oficiales
              matches = expectedNames.map((name, i) => ({
                id: `uac-oficial-${form.semester}-${i}`,
                uac_name: name,
                semester: form.semester,
                component: 'laboral',
                curriculum_name: selectedSpecialty,
                total_hours: 54,
                learning_outcome: `Desarrollar competencias formativas y laborales en ${name}`,
                activities: [{ order: 1, name: `Desarrollo de competencias en ${name}`, hours: 54 }],
                contenidos_formativos: [{ order: 1, proposito: name, hours: 54, contenidos: [name] }]
              }));
            }
          }
        }

        return matches;
      })()
    : catalogPrograms;

  // Carga de programas desde el catálogo oficial cuando cambia semestre, componente o subsistema
  useEffect(() => {
    const fetchPrograms = async () => {
      setLoadingPrograms(true);
      try {
        const subParam = selectedSubsystem ? `&subsystem=${selectedSubsystem}` : '';
        const res = await fetch(`/api/programs?semester=${form.semester}&component=${form.component}${subParam}`);
        const data = await res.json();

        if (data.programs) {
          let filteredPrograms = data.programs;
          if (form.component === 'ampliado') {
            if (form.semester === 1 || form.semester === 2) {
              filteredPrograms = data.programs.filter((p: any) =>
                p.uac_name.includes('Artísticas y Culturales') ||
                p.uac_name.includes('Físicas y Deportivas')
              );
            } else {
              filteredPrograms = data.programs.filter((p: any) =>
                !p.uac_name.includes('Artísticas y Culturales') &&
                !p.uac_name.includes('Físicas y Deportivas')
              );
            }
          }

          setCatalogPrograms(filteredPrograms);

          if (form.component === 'laboral') {
            const isBgeLocal = !selectedSubsystem || selectedSubsystem === 'bge';
            const isTecLocal = ['tecnologico', 'cbtis', 'cbta', 'cecyte'].includes(selectedSubsystem);
            const specs: string[] = isBgeLocal
              ? [...FORMACIONES_LABORALES_BGE]
              : isTecLocal
                ? Array.from(new Set([
                    ...CARRERAS_TECNICAS_OFICIALES,
                    ...filteredPrograms.map((p: any) => p.curriculum_name).filter(Boolean)
                  ]))
                : Array.from(new Set(filteredPrograms.map((p: any) => p.curriculum_name).filter(Boolean))).sort() as string[];

            // Determinar la especialidad activa
            let currentSpec = selectedSpecialty;
            if (!currentSpec || currentSpec === 'manual_specialty' || !specs.some(s => normalizeKey(s) === normalizeKey(currentSpec))) {
              currentSpec = specs.find(s => s === "Comunicación Gráfica") || specs[0] || '';
              setSelectedSpecialty(currentSpec);
            }

            if (currentSpec && currentSpec !== 'manual_specialty') {
              const normSpec = normalizeKey(currentSpec);
              let matches = filteredPrograms.filter((p: any) => {
                const normCur = normalizeKey(p.curriculum_name);
                return normCur === normSpec || normCur.includes(normSpec) || normSpec.includes(normCur);
              });

              if (isBgeLocal) {
                const expected = getUacNamesForCapacitacion(currentSpec, form.semester);
                if (expected.length > 0) {
                  const found = filteredPrograms.filter((p: any) =>
                    expected.some(exp => normalizeKey(p.uac_name) === normalizeKey(exp))
                  );
                  if (found.length > 0) matches = found;
                  else if (matches.length === 0) {
                    matches = expected.map((name, i) => ({
                      id: `uac-oficial-${form.semester}-${i}`,
                      uac_name: name,
                      semester: form.semester,
                      component: 'laboral',
                      curriculum_name: currentSpec,
                      total_hours: 54,
                      learning_outcome: `Desarrollar competencias en ${name}`,
                      activities: [{ order: 1, name, hours: 54 }],
                      contenidos_formativos: [{ order: 1, proposito: name, hours: 54, contenidos: [name] }]
                    }));
                  }
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
            if (filteredPrograms.length > 0) {
              const first = filteredPrograms[0];
              setSelectedCatalogUac(first);
              setForm(prev => ({
                ...prev,
                uacName: form.component === 'ampliado' ? cleanSocioemotionalName(first.uac_name, form.semester) : first.uac_name,
                curriculumName: first.curriculum_name || '',
                subsystem: selectedSubsystem,
              }));
              setIsManualInput(false);
              setSelectedSpecialty('');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching catalog programs:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchPrograms();
  }, [form.semester, form.component, selectedSubsystem]);

  // Manejador de cambio de semestre
  const handleSemesterChange = (newSemester: number) => {
    let nextComponent = form.component;
    if (SEMESTERS_WITHOUT_LABORAL.includes(newSemester) && form.component === 'laboral') {
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

  // Manejador de cambio de especialidad / capacitación
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

      const normVal = normalizeKey(val);
      let matches = catalogPrograms.filter(p => {
        const normCur = normalizeKey(p.curriculum_name);
        return normCur === normVal || normCur.includes(normVal) || normVal.includes(normCur);
      });

      if (isBge) {
        const expected = getUacNamesForCapacitacion(val, form.semester);
        if (expected.length > 0) {
          const found = catalogPrograms.filter(p =>
            expected.some(exp => normalizeKey(p.uac_name) === normalizeKey(exp))
          );
          if (found.length > 0) {
            matches = found;
          } else if (matches.length === 0) {
            matches = expected.map((name, i) => ({
              id: `uac-oficial-${form.semester}-${i}`,
              uac_name: name,
              semester: form.semester,
              component: 'laboral',
              curriculum_name: val,
              total_hours: 54,
              learning_outcome: `Desarrollar competencias en ${name}`,
              activities: [{ order: 1, name, hours: 54 }],
              contenidos_formativos: [{ order: 1, proposito: name, hours: 54, contenidos: [name] }]
            }));
          }
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

  // Manejador de cambio en el selector de UAC
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
          curriculumName: (form.component === 'laboral' && isBge)
            ? selectedSpecialty
            : (selected.curriculum_name || ''),
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
        totalHours: selectedCatalogUac.total_hours,
        activities: selectedCatalogUac.activities,
        evidences: selectedCatalogUac.evidences,
        parseConfidence: 'high',
        year: selectedCatalogUac.year,
        contenidosFormativos: selectedCatalogUac.contenidos_formativos,
      };
      onNext(form, initialData);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="card-title">Paso 1: Datos de la UAC y Modelo Curricular</h2>
          <p className="card-subtitle">
            Selecciona tu subsistema educativo y la Unidad de Aprendizaje Curricular oficial que vas a planear.
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

      {/* Alerta contextual sobre el modelo curricular oficial */}
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
            <strong>📌 Modelo de Transición Curricular Ciclo 2026-2027:</strong> Para 5.° y 6.° semestre, la planeación se estructura con <em>Progresiones de Aprendizaje MCCEMS</em>. (Este es el último ciclo de vigencia de progresiones).
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
                onChange={e => {
                  setSelectedSubsystem(e.target.value);
                  setForm(f => ({ ...f, subsystem: e.target.value }));
                }}
              >
                <option value="bge">Bachillerato General Estatal (BGE)</option>
                <option value="tecnologico">Bachillerato Tecnológico (General)</option>
                <option value="cbtis">CBTIS</option>
                <option value="cbta">CBTA</option>
                <option value="cecyte">CECyTE</option>
                <option value="digital">Bachillerato Digital</option>
                <option value="emsad">EMSAD</option>
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
              <label className="form-label form-label-required">Componente curricular</label>
              <select
                className="form-select"
                value={form.component}
                onChange={e => setForm({ ...form, component: e.target.value })}
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
                  ⚠️ Formación Laboral no aplica para 1° y 2° semestre.
                </span>
              )}
              {isFfeDisabled && form.component === 'ext_optativo' && (
                <span className="form-hint" style={{ color: 'var(--c-amber)', fontWeight: 500 }}>
                  ⚠️ F. Fundamental Extendida (FFE) no aplica para semestres anteriores a 5º.
                </span>
              )}
            </div>
          </div>

          {/* Selector de Especialidad / Capacitación (solo para componente laboral) */}
          {form.component === 'laboral' && (
            <div className="form-group animate-fade-in">
              <label className="form-label form-label-required">
                {isBge ? 'Especialidad / Capacitación (15 Opciones Oficiales)' : 'Especialidad / Carrera Técnica'}
              </label>
              <select
                className="form-select"
                value={isManualInput && selectedSpecialty === 'manual_specialty' ? 'manual_specialty' : selectedSpecialty}
                onChange={handleSpecialtyChange}
              >
                {specialties.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
                <option value="manual_specialty">➕ Otra especialidad / carrera (capturar manualmente)</option>
              </select>
            </div>
          )}

          {/* Selector de Nombre de la UAC */}
          <div className="form-group">
            <label className="form-label form-label-required">Nombre de la UAC</label>
            
            {loadingPrograms ? (
              <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
                <div className="spinner spinner-dark" style={{ width: '16px', height: '16px' }} />
                <span>Cargando UACs del catálogo oficial...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select
                  className="form-select"
                  value={isManualInput ? 'manual' : (selectedCatalogUac?.id || (filteredUacs[0]?.id ?? 'manual'))}
                  onChange={handleUacSelectChange}
                >
                  {filteredUacs.map((p) => {
                    const displayName = form.component === 'ampliado'
                      ? cleanSocioemotionalName(p.uac_name, form.semester)
                      : p.uac_name;
                    const suffix = form.component === 'laboral'
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

                {isManualInput && (
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
              {form.component === 'laboral'
                ? 'Selecciona una de las UACs oficiales de la capacitación o usa la opción para capturar manualmente.'
                : 'Selecciona una UAC del catálogo oficial o escribe el nombre exacto como aparece en tu programa de estudios.'}
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

          <div className="form-group">
            <label className="form-label">Nombre del currículo / especialidad</label>
            <input
              className="form-input"
              placeholder={isManualInput ? "Ej: Área de la Salud, Turismo, Administración..." : ""}
              value={form.curriculumName || ''}
              onChange={e => setForm({ ...form, curriculumName: e.target.value })}
              disabled={!isManualInput}
              style={!isManualInput ? { backgroundColor: '#f5f5f5', color: '#666', cursor: 'not-allowed' } : {}}
            />
            <span className="form-hint">
              El nombre de la especialidad o currículo al que pertenece esta UAC (se autocompleta con el catálogo).
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
