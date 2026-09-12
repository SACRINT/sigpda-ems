'use client';

import { useState, useRef, useEffect } from 'react';
import type { ExtractedPdfData, TeacherContext, PaecOperationalActivity } from '@/types/planning';
import { CATALOGO_METODOLOGIAS_ACTIVAS, type MetodologiaActiva } from '@/lib/catalogo-metodologias';
import { recomendarMetodologia } from '@/lib/recomendador-metodologia';

interface Props {
  extractedData: ExtractedPdfData;
  initialContext?: TeacherContext | null;
  onNext: (ctx: TeacherContext) => void;
  onBack: () => void;
  isSubmitting?: boolean;
  submissionError?: string | null;
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

/**
 * Función de coincidencia difusa para emparejar la UAC seleccionada con
 * las asignaturas listadas en el Plan Operativo del PAEC
 */
function matchSubject(targetUac: string, paecSubject: string): boolean {
  if (!targetUac || !paecSubject) return false;
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const tNorm = clean(targetUac);
  const pNorm = clean(paecSubject);

  if (tNorm === pNorm) return true;
  if (tNorm.includes(pNorm) || pNorm.includes(tNorm)) return true;

  // Normalizar números romanos y arábigos: ' i' <-> ' 1', ' ii' <-> ' 2', ' iii' <-> ' 3', etc.
  const toArabic = (s: string) =>
    s
      .replace(/\bvi\b/g, '6')
      .replace(/\bv\b/g, '5')
      .replace(/\biv\b/g, '4')
      .replace(/\biii\b/g, '3')
      .replace(/\bii\b/g, '2')
      .replace(/\bi\b/g, '1');

  const tArabic = toArabic(tNorm);
  const pArabic = toArabic(pNorm);

  if (tArabic === pArabic) return true;
  if (tArabic.includes(pArabic) || pArabic.includes(tArabic)) return true;

  // Comparación por palabras clave significativas (ej: "pensamiento matematico", "materia interacciones")
  const tWords = tArabic.split(' ').filter(w => w.length > 3);
  const pWords = pArabic.split(' ').filter(w => w.length > 3);
  if (tWords.length > 0 && pWords.length > 0) {
    const common = tWords.filter(w => pWords.includes(w));
    if (common.length >= Math.min(2, tWords.length)) return true;
  }

  return false;
}

export default function StepContext({
  extractedData,
  initialContext,
  onNext,
  onBack,
  isSubmitting = false,
  submissionError = null,
}: Props) {
  const [form, setForm] = useState<TeacherContext>(() => ({
    teacherName: initialContext?.teacherName || '',
    schoolName: initialContext?.schoolName || '',
    municipality: initialContext?.municipality || '',
    state: initialContext?.state || 'Puebla',
    region: initialContext?.region || '',
    subsystem: initialContext?.subsystem || 'bge',
    groupInfo: initialContext?.groupInfo || '',
    applicationPeriod: initialContext?.applicationPeriod || '',
    paecProjectName: initialContext?.paecProjectName || '',
    paecObjective: initialContext?.paecObjective || '',
    paecProblem: initialContext?.paecProblem || '',
    paecOperationalActivity: initialContext?.paecOperationalActivity || null,
    usePaecActivity: initialContext?.usePaecActivity !== false,
    schoolResources: initialContext?.schoolResources || '',
    studentContext: initialContext?.studentContext || '',
    metodologiaActiva: initialContext?.metodologiaActiva,
  }));

  const [paecLoading, setPaecLoading] = useState(false);
  const [paecSuccess, setPaecSuccess] = useState(false);
  const [paecError, setPaecError] = useState<string | null>(null);
  const [isSuggestedProblem, setIsSuggestedProblem] = useState<boolean | null>(null);
  const [detectedPaecActivity, setDetectedPaecActivity] = useState<PaecOperationalActivity | null>(
    () => initialContext?.paecOperationalActivity || null
  );
  const [hasPlanOperativoScan, setHasPlanOperativoScan] = useState<boolean>(
    () => Boolean(initialContext?.paecOperationalActivity)
  );
  const [showManualPaecEntry, setShowManualPaecEntry] = useState<boolean>(false);
  const paecInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar automáticamente el perfil del docente autenticado si los campos están vacíos
  useEffect(() => {
    async function loadTeacherProfile() {
      try {
        const res = await fetch('/api/teacher-profile');
        if (res.ok) {
          const profile = await res.json();
          setForm(prev => ({
            ...prev,
            teacherName: prev.teacherName || profile.name || '',
            schoolName: prev.schoolName || profile.school_name || '',
            municipality: prev.municipality || profile.municipality || '',
            subsystem: prev.subsystem && prev.subsystem !== 'bge' ? prev.subsystem : (profile.subsystem || 'bge'),
          }));
        }
      } catch (err) {
        console.warn('[StepContext] Error al cargar perfil del docente:', err);
      }
    }
    loadTeacherProfile();
  }, []);

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
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.txt')) {
      setPaecError('Solo se aceptan archivos PDF, Word (.docx) o texto (.txt).');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setPaecError('El archivo no puede superar 20 MB.');
      return;
    }

    setPaecLoading(true);
    setPaecSuccess(false);
    setPaecError(null);
    setIsSuggestedProblem(null);

    try {
      const fd = new FormData();
      fd.append('pdf', f);
      const res = await fetch('/api/pdf/parse-paec', { method: 'POST', body: fd });
      const result = await res.json();

      if (res.ok && result.data) {
        // Emparejamiento automático con el Plan Operativo del PAEC
        let matchedAct: PaecOperationalActivity | null = null;
        if (Array.isArray(result.data.planOperativo) && result.data.planOperativo.length > 0) {
          matchedAct = result.data.planOperativo.find((item: PaecOperationalActivity) =>
            matchSubject(uacName, item.asignatura)
          ) || null;
        }

        if (matchedAct) {
          setDetectedPaecActivity(matchedAct);
          setShowManualPaecEntry(false);
        } else {
          setDetectedPaecActivity(null);
        }
        setHasPlanOperativoScan(true);

        setForm(prev => ({
          ...prev,
          paecProjectName: result.data.projectName || prev.paecProjectName,
          paecObjective: result.data.objective || prev.paecObjective,
          paecProblem: result.data.problem || prev.paecProblem,
          studentContext: result.data.studentContext || prev.studentContext,
          schoolName: prev.schoolName || result.data.schoolName || prev.schoolName,
          municipality: prev.municipality || result.data.municipality || prev.municipality,
          paecOperationalActivity: matchedAct || prev.paecOperationalActivity || null,
          usePaecActivity: matchedAct ? true : prev.usePaecActivity,
        }));

        if (typeof result.data.isSuggestedProblem === 'boolean') {
          setIsSuggestedProblem(result.data.isSuggestedProblem);
        }
        // Limpiar error de validación en campos que ahora tienen valor
        setErrors(prev => {
          const copy = { ...prev };
          if (result.data.problem) delete copy.paecProblem;
          if (result.data.projectName) delete copy.paecProjectName;
          if (result.data.schoolName) delete copy.schoolName;
          if (result.data.municipality) delete copy.municipality;
          return copy;
        });
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
    if (!form.teacherName.trim()) e.teacherName = 'El nombre del docente es obligatorio';
    if (!form.schoolName.trim()) e.schoolName = 'El nombre del plantel es obligatorio';
    if (!form.municipality.trim()) e.municipality = 'El municipio es obligatorio';
    if (!form.paecProjectName?.trim()) e.paecProjectName = 'El nombre del proyecto PAEC es obligatorio';
    if (!form.paecProblem.trim())
      e.paecProblem = 'La problemática comunitaria es obligatoria para contextualizar las actividades';
    
    setErrors(e);

    const errorKeys = Object.keys(e);
    if (errorKeys.length > 0) {
      // Auto-desplazar la pantalla suavemente hacia el primer campo que falta
      const firstKey = errorKeys[0];
      setTimeout(() => {
        const el = document.getElementById(`input-${firstKey}`) || document.querySelector(`[name="${firstKey}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (el as HTMLElement).focus();
        }
      }, 50);
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onNext(form);
  };

  const set = (field: Partial<TeacherContext>) => {
    setForm(f => ({ ...f, ...field }));
    // Limpiar error del campo modificado si ya tiene valor
    const key = Object.keys(field)[0];
    if (key && errors[key]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
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
                    id="input-teacherName"
                    name="teacherName"
                    className="form-input"
                    autoComplete="off"
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
                      id="input-schoolName"
                      name="schoolName"
                      className="form-input"
                      autoComplete="off"
                      placeholder="Ej: EMSAD 03 Héroes de la Patria"
                      value={form.schoolName}
                      onChange={e => set({ schoolName: e.target.value })}
                    />
                    {errors.schoolName && <span className="form-error">{errors.schoolName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-required">Municipio</label>
                    <input
                      id="input-municipality"
                      name="municipality"
                      className="form-input"
                      autoComplete="off"
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
                      autoComplete="off"
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
                      autoComplete="off"
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
                      autoComplete="off"
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
                    autoComplete="off"
                    placeholder="Ej: 3°A (32 estudiantes), 3°B (30 estudiantes)"
                    value={form.groupInfo}
                    onChange={e => set({ groupInfo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Recursos disponibles en el plantel</label>
                  <input
                    className="form-input"
                    autoComplete="off"
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--c-border)', paddingBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>¿Tienes el documento del PAEC-PEC (PDF o Word .docx)?</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => paecInputRef.current?.click()}
                      disabled={paecLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {paecLoading && <div className="spinner spinner-dark" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />}
                      <span>{paecLoading ? 'Extrayendo problemática...' : '📁 Cargar PAEC-PEC (PDF o Word)'}</span>
                    </button>
                    <input
                      ref={paecInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
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
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    color: 'var(--c-text)',
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
                    id="input-paecProjectName"
                    name="paecProjectName"
                    className="form-input"
                    autoComplete="off"
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
                    id="input-paecObjective"
                    name="paecObjective"
                    className="form-textarea"
                    rows={2}
                    placeholder="Ej: Desarrollar en los estudiantes habilidades para identificar, prevenir y orientar sobre enfermedades crónicas comunes en su comunidad."
                    value={form.paecObjective || ''}
                    onChange={e => set({ paecObjective: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                    <label className="form-label form-label-required" style={{ margin: 0 }}>
                      Problemática comunitaria detectada en el PAEC
                    </label>
                    {isSuggestedProblem === false && (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}>
                        ✓ Detectada en el PAEC
                      </span>
                    )}
                    {isSuggestedProblem === true && (
                      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                        💡 Sugerida a partir del proyecto (editable)
                      </span>
                    )}
                  </div>
                  {isSuggestedProblem === false && (
                    <div className="alert alert-success" style={{ margin: '0 0 8px 0', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>✓</span>
                      <span>Problemática detectada en el PAEC e integrada al formulario.</span>
                    </div>
                  )}
                  {isSuggestedProblem === true && (
                    <div className="alert alert-warning" style={{ margin: '0 0 8px 0', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                      <span>💡</span>
                      <span>Problemática sugerida a partir del contexto del proyecto. Puedes personalizarla o editarla libremente.</span>
                    </div>
                  )}
                  <textarea
                    id="input-paecProblem"
                    name="paecProblem"
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe la problemática social, ambiental o de salud que afecta a la comunidad. Ej: 'Alta incidencia de diabetes tipo 2 y obesidad en adultos mayores del municipio de Izúcar de Matamoros, agravada por el consumo de alimentos ultraprocesados y automedicación.'"
                    value={form.paecProblem}
                    onChange={e => {
                      set({ paecProblem: e.target.value });
                      if (errors.paecProblem) {
                        setErrors(prev => {
                          const copy = { ...prev };
                          delete copy.paecProblem;
                          return copy;
                        });
                      }
                    }}
                  />
                  {errors.paecProblem && <span className="form-error">{errors.paecProblem}</span>}
                  <span className="form-hint" style={{ color: 'var(--c-navy-light)', fontWeight: 500 }}>
                    Esta problemática aparecerá en la Sección II y guiará las actividades de la Sección IV.
                  </span>
                </div>

                {/* ── SUB-SECCIÓN: Plan Operativo del PAEC (Actividad por Asignatura) ── */}
                <div
                  style={{
                    border: detectedPaecActivity
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : hasPlanOperativoScan
                        ? '1px solid rgba(59, 130, 246, 0.3)'
                        : '1px solid var(--c-border)',
                    background: detectedPaecActivity
                      ? 'rgba(16, 185, 129, 0.05)'
                      : hasPlanOperativoScan
                        ? 'rgba(59, 130, 246, 0.03)'
                        : 'var(--c-surface-card, rgba(255,255,255,0.02))',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📋</span>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--c-text)' }}>
                        Plan Operativo del PAEC — Vinculación de {uacName || 'tu Asignatura'}
                      </span>
                    </div>
                    {detectedPaecActivity && (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}>
                        ✓ Actividad Oficial Detectada en PAEC
                      </span>
                    )}
                  </div>

                  {/* Escenario A: Actividad Oficial Detectada en el PAEC */}
                  {detectedPaecActivity ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--c-text-secondary)' }}>
                        El colectivo escolar del plantel acordó colegiadamente en el PAEC la siguiente actividad para <strong>{detectedPaecActivity.asignatura}</strong>:
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Actividad oficial programada (puedes complementarla o editarla):</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={form.paecOperationalActivity?.actividad || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setForm(prev => ({
                              ...prev,
                              paecOperationalActivity: prev.paecOperationalActivity
                                ? { ...prev.paecOperationalActivity, actividad: val }
                                : { asignatura: uacName, actividad: val, isPrescheduled: true }
                            }));
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '12px', background: 'rgba(0,0,0,0.06)', padding: '10px 12px', borderRadius: '6px' }}>
                        {detectedPaecActivity.semana && (
                          <div>
                            <span style={{ color: 'var(--c-text-muted)', display: 'block' }}>Semana / Fase:</span>
                            <strong>{detectedPaecActivity.semana} {detectedPaecActivity.fase ? `(${detectedPaecActivity.fase})` : ''}</strong>
                          </div>
                        )}
                        {detectedPaecActivity.estrategiaDidactica && (
                          <div>
                            <span style={{ color: 'var(--c-text-muted)', display: 'block' }}>Estrategia Didáctica:</span>
                            <strong>{detectedPaecActivity.estrategiaDidactica}</strong>
                          </div>
                        )}
                        {(detectedPaecActivity.propositoFormativo || detectedPaecActivity.progresion) && (
                          <div>
                            <span style={{ color: 'var(--c-text-muted)', display: 'block' }}>Propósito / Progresión:</span>
                            <strong>{detectedPaecActivity.propositoFormativo || detectedPaecActivity.progresion}</strong>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <input
                          type="checkbox"
                          id="chk-use-paec-activity"
                          checked={form.usePaecActivity !== false}
                          onChange={e => setForm(prev => ({ ...prev, usePaecActivity: e.target.checked }))}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="chk-use-paec-activity" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: 500, color: 'var(--c-text)' }}>
                          Respetar e integrar formalmente esta actividad oficial en mi planeación didáctica (Sección III y IV)
                        </label>
                      </div>
                    </div>
                  ) : (
                    /* Escenario B y C: No detectada o Fallback manual */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {hasPlanOperativoScan && (
                        <div className="alert alert-info" style={{ margin: 0, padding: '10px 12px', fontSize: '13px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--c-text)' }}>
                          ℹ️ <strong>Asignatura sin actividad preasignada en el Plan Operativo:</strong> El documento PAEC no contempla una fila específica para <em>{uacName || 'esta materia'}</em>. La plataforma propondrá automáticamente actividades de vinculación transversal en la Sección III y IV orientadas a la problemática comunitaria.
                        </div>
                      )}

                      {!showManualPaecEntry && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--c-text-secondary)' }}>
                            ¿Tu colectivo escolar acordó una actividad para tu materia o deseas capturarla de forma manual?
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setShowManualPaecEntry(true);
                              setForm(prev => ({
                                ...prev,
                                usePaecActivity: true,
                                paecOperationalActivity: prev.paecOperationalActivity || {
                                  asignatura: uacName,
                                  actividad: '',
                                  isPrescheduled: false,
                                }
                              }));
                            }}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            ✏️ Capturar actividad manualmente
                          </button>
                        </div>
                      )}

                      {showManualPaecEntry && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px', borderTop: '1px dashed var(--c-border)', paddingTop: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                              Actividad acordada para {uacName || 'tu asignatura'} en el PAEC:
                            </label>
                            <textarea
                              className="form-textarea"
                              rows={2}
                              placeholder="Ej: Taller 'El Veneno en la Etiqueta' para medir pH y calcular concentración de azúcares..."
                              value={form.paecOperationalActivity?.actividad || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(prev => ({
                                  ...prev,
                                  paecOperationalActivity: {
                                    ...(prev.paecOperationalActivity || { asignatura: uacName, isPrescheduled: false }),
                                    actividad: val,
                                  }
                                }));
                              }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '11px' }}>Estrategia didáctica sugerida (opcional):</label>
                              <input
                                className="form-input"
                                placeholder="Ej: Taller experimental, debate, infografía..."
                                value={form.paecOperationalActivity?.estrategiaDidactica || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setForm(prev => ({
                                    ...prev,
                                    paecOperationalActivity: {
                                      ...(prev.paecOperationalActivity || { asignatura: uacName, actividad: '', isPrescheduled: false }),
                                      estrategiaDidactica: val,
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '11px' }}>Semana o Fase de aplicación (opcional):</label>
                              <input
                                className="form-input"
                                placeholder="Ej: Semana 5 (Fase 2)"
                                value={form.paecOperationalActivity?.semana || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setForm(prev => ({
                                    ...prev,
                                    paecOperationalActivity: {
                                      ...(prev.paecOperationalActivity || { asignatura: uacName, actividad: '', isPrescheduled: false }),
                                      semana: val,
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                id="chk-use-manual-paec"
                                checked={form.usePaecActivity !== false}
                                onChange={e => setForm(prev => ({ ...prev, usePaecActivity: e.target.checked }))}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <label htmlFor="chk-use-manual-paec" style={{ fontSize: '12px', cursor: 'pointer', color: 'var(--c-text)' }}>
                                Integrar esta actividad manual en la planeación (Sección III y IV)
                              </label>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setShowManualPaecEntry(false);
                                setForm(prev => ({
                                  ...prev,
                                  paecOperationalActivity: null,
                                  usePaecActivity: false,
                                }));
                              }}
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                            >
                              Cancelar captura manual
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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

      {/* Resumen de errores de validación o error de creación */}
      {(Object.keys(errors).length > 0 || submissionError) && (
        <div
          role="alert"
          style={{
            marginTop: '20px',
            padding: '14px 18px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '13.5px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>
              {submissionError
                ? submissionError
                : 'No se puede generar la planeación porque faltan campos obligatorios:'}
            </span>
          </div>
          {!submissionError && Object.keys(errors).length > 0 && (
            <ul style={{ margin: '8px 0 0 24px', padding: 0, listStyleType: 'disc', lineHeight: 1.6 }}>
              {errors.teacherName && <li>Nombre del(a) docente</li>}
              {errors.schoolName && <li>Nombre del plantel</li>}
              {errors.municipality && <li>Municipio</li>}
              {errors.paecProjectName && <li>Nombre del proyecto PAEC / PEC</li>}
              {errors.paecProblem && <li>Problemática comunitaria detectada</li>}
            </ul>
          )}
          {!submissionError && (
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              Hemos desplazado la pantalla automáticamente hacia el primer campo pendiente para que puedas completarlo.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={isSubmitting}>
          ← Atrás
        </button>
        <button
          type="submit"
          className="btn btn-amber"
          disabled={isSubmitting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '180px', justifyContent: 'center' }}
        >
          {isSubmitting ? (
            <>
              <div className="spinner spinner-dark" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
              <span>Preparando planeación...</span>
            </>
          ) : (
            <span>Generar planeación →</span>
          )}
        </button>
      </div>
    </form>
  );
}
