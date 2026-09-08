'use client';

import { useState, useRef, useEffect } from 'react';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import { CATALOGO_METODOLOGIAS_ACTIVAS, type MetodologiaActiva } from '@/lib/catalogo-metodologias';
import { recomendarMetodologia } from '@/lib/recomendador-metodologia';

interface Props {
  extractedData: ExtractedPdfData;
  onNext: (ctx: TeacherContext) => void;
  onBack: () => void;
}

const SUBSYSTEMS = [
  { value: 'bge',     label: 'Bachillerato General Estatal (BGE)' },
  { value: 'bachillerato_tecnologico', label: 'Bachillerato Tecnológico' },
  { value: 'digital', label: 'Bachillerato Digital' },
  { value: 'emsad',   label: 'EMSAD' },
  { value: 'cecyte',  label: 'CECyTE' },
  { value: 'cbtis',   label: 'CBTIS' },
  { value: 'cbta',    label: 'CBTA' },
  { value: 'conalep', label: 'CONALEP' },
  { value: 'dgb',     label: 'Preparatoria Federal / DGB' },
  { value: 'telebachillerato', label: 'Telebachillerato' },
  { value: 'otro',    label: 'Otro subsistema' },
];

export default function StepContext({ extractedData, onNext, onBack }: Props) {
  const [form, setForm] = useState<TeacherContext>({
    teacherName: '',
    schoolName: '',
    municipality: '',
    state: 'Puebla',
    region: '',
    subsystem: 'bge',
    groupInfo: '',
    applicationPeriod: '',
    paecProjectName: '',
    paecObjective: '',
    paecProblem: '',
    schoolResources: '',
    studentContext: '',
    metodologiaActiva: undefined,
  });

  const [paecLoading, setPaecLoading] = useState(false);
  const [paecSuccess, setPaecSuccess] = useState(false);
  const [paecError, setPaecError] = useState<string | null>(null);
  const paecInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sugerencia automática de metodología según UAC/materia
  const uacName = (extractedData as { uacName?: string })?.uacName || '';
  const component = (extractedData as { component?: string })?.component || '';
  useEffect(() => {
    if (uacName && !form.metodologiaActiva) {
      const sugeridaId = recomendarMetodologia(uacName, component);
      if (sugeridaId) {
        setForm(f => ({ ...f, metodologiaActiva: sugeridaId }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uacName]);

  const handlePaecUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setPaecError('Solo se aceptan archivos PDF.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setPaecError('El archivo no puede superar 10 MB.');
      return;
    }

    setPaecLoading(true);
    setPaecSuccess(false);
    setPaecError(null);

    try {
      const fd = new FormData();
      fd.append('pdf', f);
      const res = await fetch('/api/pdf/parse-paec', { method: 'POST', body: fd });
      const result = await res.json();

      if (res.ok && result.data) {
        setForm(prev => ({
          ...prev,
          paecProjectName: result.data.projectName || prev.paecProjectName,
          paecObjective: result.data.objective || prev.paecObjective,
          paecProblem: result.data.problem || prev.paecProblem,
          studentContext: result.data.studentContext || prev.studentContext,
        }));
        setPaecSuccess(true);
      } else {
        setPaecError(result.error || 'No se pudieron extraer los datos automáticamente.');
      }
    } catch {
      setPaecError('Error de red al procesar el PDF del PAEC.');
    } finally {
      setPaecLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.teacherName.trim()) e.teacherName = 'Requerido';
    if (!form.schoolName.trim()) e.schoolName = 'Requerido';
    if (!form.municipality.trim()) e.municipality = 'Requerido';
    if (!form.paecProjectName?.trim()) e.paecProjectName = 'El nombre del proyecto PAEC es requerido';
    if (!form.paecProblem.trim())
      e.paecProblem = 'La problemática comunitaria es requerida para contextualizar las actividades';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext(form);
  };

  const set = (field: Partial<TeacherContext>) => setForm(f => ({ ...f, ...field }));

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── SECCIÓN 1: Datos del plantel ─────────────────────────── */}
        <div className="card">
          <h2 className="card-title">Paso 3: Contexto escolar y PAEC</h2>
          <p className="card-subtitle">
            Esta información personaliza las actividades al contexto real de tus estudiantes y su
            comunidad. Entre más detallada sea la información, mejor será la planeación generada.
          </p>

          <div className="section-card" style={{ marginTop: '16px' }}>
            <div className="section-card-header">
              <span style={{ fontSize: '18px' }}>🏫</span>
              <span className="section-card-title">Datos del plantel</span>
            </div>
            <div className="section-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div className="form-group">
                  <label className="form-label form-label-required">Nombre del(a) docente</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Dra. María López Hernández"
                    value={form.teacherName}
                    onChange={e => set({ teacherName: e.target.value })}
                  />
                  {errors.teacherName && <span className="form-error">{errors.teacherName}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label form-label-required">Nombre del plantel</label>
                    <input
                      className="form-input"
                      placeholder="Ej: EMSAD 03 Héroes de la Patria"
                      value={form.schoolName}
                      onChange={e => set({ schoolName: e.target.value })}
                    />
                    {errors.schoolName && <span className="form-error">{errors.schoolName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-required">Municipio</label>
                    <input
                      className="form-input"
                      placeholder="Ej: Izúcar de Matamoros"
                      value={form.municipality}
                      onChange={e => set({ municipality: e.target.value })}
                    />
                    {errors.municipality && <span className="form-error">{errors.municipality}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <input
                      className="form-input"
                      placeholder="Ej: Puebla"
                      value={form.state}
                      onChange={e => set({ state: e.target.value })}
                    />
                    <span className="form-hint">Por defecto: Puebla. Modifica si aplica en otro estado.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Región</label>
                    <input
                      className="form-input"
                      placeholder="Ej: Sierra Norte, Mixteca, Angelópolis..."
                      value={form.region}
                      onChange={e => set({ region: e.target.value })}
                    />
                    <span className="form-hint">Escribe la region tal como la conocen en tu zona.</span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Subsistema / Modalidad</label>
                    <select
                      className="form-select"
                      value={form.subsystem}
                      onChange={e => set({ subsystem: e.target.value })}
                    >
                      {SUBSYSTEMS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Período de aplicación</label>
                    <input
                      className="form-input"
                      placeholder="Ej: Agosto – Diciembre 2026"
                      value={form.applicationPeriod || ''}
                      onChange={e => set({ applicationPeriod: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Grupos y número de estudiantes</label>
                  <input
                    className="form-input"
                    placeholder="Ej: 3°A (32 estudiantes), 3°B (30 estudiantes)"
                    value={form.groupInfo}
                    onChange={e => set({ groupInfo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Recursos disponibles en el plantel</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Proyector, internet básico, laboratorio de enfermería, sin computadoras para alumnos"
                    value={form.schoolResources || ''}
                    onChange={e => set({ schoolResources: e.target.value })}
                  />
                  <span className="form-hint">
                    Indica los recursos tecnológicos, espacios y materiales disponibles.
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 2: Proyecto PAEC/PEC ─────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="section-card" style={{ margin: 0 }}>
            <div className="section-card-header">
              <span style={{ fontSize: '18px' }}>🌎</span>
              <span className="section-card-title">Proyecto PAEC / PEC y contexto comunitario</span>
            </div>
            <div className="section-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* PAEC Upload Helper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>¿Tienes el documento del PAEC-PEC en PDF?</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => paecInputRef.current?.click()}
                      disabled={paecLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {paecLoading && <div className="spinner spinner-dark" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />}
                      <span>{paecLoading ? 'Extrayendo problemática...' : '📁 Cargar PAEC-PEC en PDF'}</span>
                    </button>
                    <input
                      ref={paecInputRef}
                      type="file"
                      accept=".pdf"
                      style={{ display: 'none' }}
                      onChange={handlePaecUpload}
                    />
                    <span className="form-hint" style={{ margin: 0 }}>
                      {paecLoading ? 'Procesando el documento...' : 'Extrae el nombre, objetivo y problemática de forma automática.'}
                    </span>
                  </div>
                  {paecSuccess && (
                    <div className="alert alert-success" style={{ margin: '8px 0 0 0', padding: '8px 12px', fontSize: '13px' }}>
                      ✓ Datos del PAEC extraídos correctamente e integrados en el formulario. Por favor, revísalos.
                    </div>
                  )}
                  {paecError && (
                    <div className="alert alert-warning" style={{ margin: '8px 0 0 0', padding: '8px 12px', fontSize: '13px' }}>
                      ⚠️ {paecError}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: 'var(--c-blue-pale)',
                    border: '1px solid var(--c-blue-mid)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    color: 'var(--c-navy)',
                  }}
                >
                  💡 El proyecto PAEC es el hilo conductor que vincula TODAS las actividades didácticas.
                  La planeación generada integrará este proyecto en cada actividad clave.
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required">
                    Nombre del proyecto PAEC/PEC
                  </label>
                  <input
                    className="form-input"
                    placeholder='Ej: "Salud Integral: Prevención de Enfermedades Crónicas en nuestra Comunidad"'
                    value={form.paecProjectName || ''}
                    onChange={e => set({ paecProjectName: e.target.value })}
                  />
                  {errors.paecProjectName && <span className="form-error">{errors.paecProjectName}</span>}
                  <span className="form-hint">
                    Copia el título del proyecto tal como aparece en tu documento PAEC o PEC.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Objetivo general del proyecto</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Ej: Desarrollar en los estudiantes habilidades para identificar, prevenir y orientar sobre enfermedades crónicas comunes en su comunidad."
                    value={form.paecObjective || ''}
                    onChange={e => set({ paecObjective: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required">
                    Problemática comunitaria detectada en el PAEC
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe la problemática social, ambiental o de salud que afecta a la comunidad. Ej: 'Alta incidencia de diabetes tipo 2 y obesidad en adultos mayores del municipio de Izúcar de Matamoros, agravada por el consumo de alimentos ultraprocesados y automedicación.'"
                    value={form.paecProblem}
                    onChange={e => set({ paecProblem: e.target.value })}
                  />
                  {errors.paecProblem && <span className="form-error">{errors.paecProblem}</span>}
                  <span className="form-hint" style={{ color: 'var(--c-navy-light)', fontWeight: 500 }}>
                    Esta problemática aparecerá en la Sección II y guiará las actividades de la Sección IV.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Caracterización de los estudiantes</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Ej: 30 estudiantes de comunidades rurales. Zona de alta marginación. Algunos hablan náhuatl. Tienen celular pero sin internet en casa. Varios trabajan en farmacias o en el campo."
                    value={form.studentContext}
                    onChange={e => set({ studentContext: e.target.value })}
                  />
                  <span className="form-hint">
                    ¿Zona rural o urbana? ¿Hablan lengua indígena? ¿Trabajan? ¿Acceso a internet?
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 3: Metodología Activa ────────────────────────── */}
        <div className="card">
          <div className="section-card" style={{ margin: 0 }}>
            <div className="section-card-header">
              <span style={{ fontSize: '18px' }}>🧪</span>
              <span className="section-card-title">Metodología Activa</span>
            </div>
            <div className="section-card-body">
              <p style={{ marginBottom: '12px', color: 'var(--c-gray-600)', fontSize: '14px' }}>
                Elige la metodología con la que diseñarás las actividades. La IA adaptará la
                secuencia didáctica a sus fases.
                {uacName && (
                  <span style={{ marginLeft: '6px', fontWeight: 600, color: 'var(--c-navy)' }}>
                    (Sugerencia basada en &ldquo;{uacName}&rdquo;)
                  </span>
                )}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '10px',
                }}
              >
                {CATALOGO_METODOLOGIAS_ACTIVAS.map((m: MetodologiaActiva) => {
                  const isSelected = form.metodologiaActiva === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set({ metodologiaActiva: m.id })}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: isSelected
                          ? '1px solid rgba(245,158,11,0.5)'
                          : '1px solid var(--c-border)',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(245,158,11,0.12)' : 'var(--c-bg-surface)',
                        color: 'var(--c-text)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 0 0 3px rgba(245,158,11,0.15)' : 'none',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '4px', color: isSelected ? 'var(--c-amber)' : 'var(--c-text)' }}>
                        🧪 {m.nombreCorto}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--c-text-muted)',
                          lineHeight: '1.3',
                        }}
                      >
                        {m.definicion.slice(0, 80)}{m.definicion.length > 80 ? '...' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
              {form.metodologiaActiva && (() => {
                const sel = CATALOGO_METODOLOGIAS_ACTIVAS.find((m: MetodologiaActiva) => m.id === form.metodologiaActiva);
                return sel ? (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '12px',
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--c-text)',
                    }}
                  >
                    <strong style={{ color: '#34d399' }}>✅ {sel.nombre} seleccionada.</strong>{' '}
                    <span style={{ color: 'var(--c-text-muted)' }}>
                      Fases: {sel.fases.map((f: string) => f.split('.').slice(1).join('.').trim() || f).join(' → ')}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Atrás</button>
        <button type="submit" className="btn btn-amber">
          Generar planeación →
        </button>
      </div>
    </form>
  );
}
