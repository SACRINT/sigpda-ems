'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearAllWizardDrafts } from '@/hooks/useWizardPersistence';
import type { SchoolZoneContextResponse } from '@/lib/zone-sync-service';

const PMC_DRAFT_KEY = 'didactica_pmc_draft';

interface PmcFormDraft {
  schoolName: string;
  schoolCct: string;
  municipality: string;
  locality: string;
  schoolZone: string;
  directorName: string;
  supervisorName: string;
  cicloEscolar: string;
  subsystem: string;
}

function readPmcDraft(): PmcFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PMC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePmcDraft(draft: PmcFormDraft) {
  try { window.localStorage.setItem(PMC_DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}

function clearPmcDraft() {
  try { window.localStorage.removeItem(PMC_DRAFT_KEY); } catch { /* ignore */ }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  nombre: string;
  cargo: string;
  meta_individual?: string;
}

interface IndicadoresAcademicos {
  matricula?: number;
  aprobacion_ant?: number;
  aprobacion_meta?: number;
  reprobacion_ant?: number;
  reprobacion_meta?: number;
  abandono_ant?: number;
  abandono_meta?: number;
  et_ant?: number;
  et_meta?: number;
}

interface Foda {
  fortalezas: string;
  oportunidades: string;
  debilidades: string;
  amenazas: string;
}

interface MetaInstitucional {
  categoria: string;
  nombre_categoria: string;
  tema: string;
  meta: string;
  estrategia: string;
  linea_base: string;
  personal_designado: string;
  entregable: string;
  periodo_inicio: string;
  periodo_fin: string;
  diagnostico_meta: string;
}

interface MetaPersonal {
  nombre: string;
  cargo: string;
  meta_individual: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

interface PlanAccion {
  metas_institucionales: MetaInstitucional[];
  metas_personales: MetaPersonal[];
}

interface DiagnosticoGenerado {
  presentacion: string;
  contexto: string;
  analisis_indicadores: string;
  sintesis_foda: string;
  priorizacion: string;
}

interface PmcProject {
  id?: string;
  school_name?: string;
  school_cct?: string;
  municipality?: string;
  locality?: string;
  school_zone?: string;
  director_name?: string;
  supervisor_name?: string;
  ciclo_escolar?: string;
  subsystem?: string;
  total_staff?: number;
  staff_data?: StaffMember[];
  indicadores_academicos?: IndicadoresAcademicos;
  foda?: Foda;
  categorias_priorizadas?: CategoriaPriorizada[];
  diagnostico_comunidad?: string;
  normativa?: Record<string, string>;
  diagnostico_generado?: DiagnosticoGenerado;
  plan_accion?: PlanAccion;
  current_step?: number;
  status?: string;
}

interface Props {
  locale: string;
  teacherId: string;
  teacherName: string;
  teacherSchool?: string;
  teacherMunicipality?: string;
  existingProject: PmcProject | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

interface CategoriaPriorizada {
  id: string;
  nombre: string;
  temas: string[];
}

const CATEGORIAS_OFICIALES = [
  {
    id: '1',
    nombre: 'Categoría 1: Desarrollo académico y aprendizaje',
    color: '#1a4a7a',
    temas: [
      'Formación y actualización docente',
      'Propuestas pedagógicas',
      'Trabajo colegiado',
      'Proyecto Escolar Comunitario (PEC)',
      'Movimiento Nacional por la Alfabetización y la Educación (MONAE)',
      'Clubes de lectura',
      'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
      'Orientación y Tutoría',
      'Planeación didáctica',
      'Otras actividades académicas (proyectos escolares)',
    ],
  },
  {
    id: '2',
    nombre: 'Categoría 2: Gestión y administración escolar',
    color: '#2d6a2d',
    temas: [
      'Vinculación con instituciones educativas',
      'Vinculación con empresas, fundaciones e instituciones públicas',
      'Gestión y administración de recursos, equipamiento y servicios',
      'Seguimiento al desempeño docente en el aula',
      'Seguimiento de egresados',
    ],
  },
  {
    id: '3',
    nombre: 'Categoría 3: Desarrollo socioemocional y prevención de la violencia',
    color: '#7a1a1a',
    temas: [
      'Ámbitos de formación socioemocional (Currículum Ampliado)',
      'Estrategias, programas y/o proyectos sobre violencia',
      'Orientación educativa',
    ],
  },
];

const CARGOS_COMUNES = [
  'Director(a)',
  'Subdirector(a)',
  'Secretario(a) académico(a)',
  'Orientador(a) educativo(a)',
  'Docente de tiempo completo',
  'Docente por horas',
  'Auxiliar administrativo(a)',
  'Prefecto(a)',
  'Trabajador(a) social',
  'Personal de intendencia',
  'Personal de mantenimiento',
  'Otro',
];

const SUBSISTEMAS = ['BGE', 'Bachillerato Tecnológico', 'TBC', 'CBTA', 'CECyTE', 'COBACH', 'Preparatoria federal', 'Otro'];

const STEPS = [
  { n: 1, label: 'Datos institucionales' },
  { n: 2, label: 'Personal' },
  { n: 3, label: 'Diagnóstico' },
  { n: 4, label: 'Generación IA' },
  { n: 5, label: 'Revisión y exportar' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function PmcWizardClient({ locale, teacherId, teacherName, teacherSchool, teacherMunicipality, existingProject }: Props) {
  const router = useRouter();

  // Restore draft from localStorage if this is a fresh PMC wizard (no existing project)
  const savedDraft = !existingProject ? readPmcDraft() : null;

  // Initialize state from existing project or from saved localStorage draft or defaults
  const [projectId, setProjectId] = useState<string | null>(existingProject?.id || null);
  const [activeStep, setActiveStep] = useState<number>(existingProject?.current_step || 1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<number | null>(null);
  const [editingPersonal, setEditingPersonal] = useState<number | null>(null);

  // Step 1: Institutional data — restored from draft if no existing project in DB
  const [schoolName, setSchoolName] = useState(existingProject?.school_name || savedDraft?.schoolName || teacherSchool || '');
  const [schoolCct, setSchoolCct] = useState(existingProject?.school_cct || savedDraft?.schoolCct || '');
  const [municipality, setMunicipality] = useState(existingProject?.municipality || savedDraft?.municipality || teacherMunicipality || '');
  const [locality, setLocality] = useState(existingProject?.locality || savedDraft?.locality || '');
  const [schoolZone, setSchoolZone] = useState(existingProject?.school_zone || savedDraft?.schoolZone || '');
  const [directorName, setDirectorName] = useState(existingProject?.director_name || savedDraft?.directorName || '');
  const [supervisorName, setSupervisorName] = useState(existingProject?.supervisor_name || savedDraft?.supervisorName || '');
  const [cicloEscolar, setCicloEscolar] = useState(existingProject?.ciclo_escolar || savedDraft?.cicloEscolar || '2025-2026');
  const [subsystem, setSubsystem] = useState(existingProject?.subsystem || savedDraft?.subsystem || 'BGE');

  // Step 2: Staff
  const [totalStaff, setTotalStaff] = useState(existingProject?.total_staff || 1);
  const [staffData, setStaffData] = useState<StaffMember[]>(
    existingProject?.staff_data || [{ nombre: '', cargo: 'Director(a)', meta_individual: '' }]
  );

  // Step 3: Diagnosis
  const [diagnosticoComunidad, setDiagnosticoComunidad] = useState(existingProject?.diagnostico_comunidad || '');
  const [indicadores, setIndicadores] = useState<IndicadoresAcademicos>(
    existingProject?.indicadores_academicos || {
      matricula: undefined,
      aprobacion_ant: undefined, aprobacion_meta: undefined,
      reprobacion_ant: undefined, reprobacion_meta: undefined,
      abandono_ant: undefined, abandono_meta: undefined,
      et_ant: undefined, et_meta: undefined,
    }
  );
  const [foda, setFoda] = useState<Foda>(
    existingProject?.foda || { fortalezas: '', oportunidades: '', debilidades: '', amenazas: '' }
  );
  const [categoriasPriorizadas, setCategoriasPriorizadas] = useState<CategoriaPriorizada[]>(
    existingProject?.categorias_priorizadas || []
  );

  // Step 4: Generated content
  const [diagnosticoGenerado, setDiagnosticoGenerado] = useState<DiagnosticoGenerado | null>(
    existingProject?.diagnostico_generado || null
  );
  const [planAccion, setPlanAccion] = useState<PlanAccion | null>(
    existingProject?.plan_accion || null
  );

  // Zona Context Bridge (Fase 9)
  const [zonaData, setZonaData] = useState<SchoolZoneContextResponse | null>(null);
  const [showZonaModal, setShowZonaModal] = useState(false);
  const [loadingZona, setLoadingZona] = useState(false);
  const [zonaFeedback, setZonaFeedback] = useState<string | null>(null);

  const handleConsultarZona = useCallback(async () => {
    const targetCct = schoolCct.trim();
    if (!targetCct) {
      setError('Por favor ingresa primero la Clave de Centro de Trabajo (CCT).');
      return;
    }
    setLoadingZona(true);
    setZonaFeedback(null);
    try {
      const res = await fetch(`/api/pmc/zona-context?cct=${encodeURIComponent(targetCct)}`);
      const data: SchoolZoneContextResponse = await res.json();
      if (!res.ok || !data.found) {
        setZonaFeedback('No se encontró Cartografía de Zona activa para este CCT escolar.');
      } else {
        setZonaData(data);
        setShowZonaModal(true);
      }
    } catch {
      setZonaFeedback('Error al consultar la Cartografía de Zona.');
    } finally {
      setLoadingZona(false);
    }
  }, [schoolCct]);

  const handleAplicarSugerenciasZona = () => {
    if (!zonaData || !zonaData.zona) return;
    const { zona, plantel } = zonaData;

    if (zona.identificacion.zonaNumero && !schoolZone) {
      setSchoolZone(`Zona ${zona.identificacion.zonaNumero}`);
    }
    if (zona.identificacion.supervisorName && !supervisorName) {
      setSupervisorName(zona.identificacion.supervisorName);
    }

    if (plantel) {
      setIndicadores(prev => ({
        ...prev,
        matricula: prev.matricula ?? plantel.matricula,
        abandono_ant: prev.abandono_ant ?? plantel.abandono,
        et_ant: prev.et_ant ?? plantel.eficienciaTerminal,
        reprobacion_ant: prev.reprobacion_ant ?? plantel.reprobacion,
      }));
    }

    if (zona.momento3Territorio?.descripcionTerritorial && !diagnosticoComunidad.trim()) {
      setDiagnosticoComunidad(zona.momento3Territorio.descripcionTerritorial);
    }

    setShowZonaModal(false);
    setZonaFeedback('✅ Datos y sugerencias de la Cartografía de Zona aplicados exitosamente a tu PMC.');
    setTimeout(() => setZonaFeedback(null), 4000);
  };

  // Auto-save step-1 form fields to localStorage (only when no project in DB yet)
  const isFirstRenderDraft = useRef(true);
  useEffect(() => {
    if (isFirstRenderDraft.current) { isFirstRenderDraft.current = false; return; }
    if (projectId) return; // project already saved in DB
    savePmcDraft({ schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem });
  }, [projectId, schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem]);

  const saveProject = useCallback(async (data: Partial<PmcProject>, goToStep?: number): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...data };
      if (goToStep !== undefined) payload.current_step = goToStep;

      if (!projectId) {
        // Create new
        const res = await fetch('/api/pmc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_name: schoolName, school_cct: schoolCct, municipality,
            locality, school_zone: schoolZone, director_name: directorName,
            supervisor_name: supervisorName, ciclo_escolar: cicloEscolar, subsystem,
            ...payload,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        clearPmcDraft(); // Draft saved to DB — clear localStorage
        setProjectId(created.id);
        router.replace(`/${locale}/pmc/nuevo?id=${created.id}`);
        return created.id;
      } else {
        // Update existing
        const res = await fetch(`/api/pmc/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        return projectId;
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al guardar');
      return null;
    } finally {
      setSaving(false);
    }
  }, [projectId, schoolName, schoolCct, municipality, locality, schoolZone, directorName, supervisorName, cicloEscolar, subsystem, locale, router]);

  const generateStep = useCallback(async (step: string): Promise<void> => {
    if (!projectId) return;
    setGenerating(step);
    setError(null);
    try {
      const res = await fetch(`/api/pmc/${projectId}/generate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Error al generar');
      }
      const data = await res.json();
      if (step === 'diagnostico' && data.diagnostico_generado) {
        setDiagnosticoGenerado(data.diagnostico_generado);
      }
      if (step === 'plan_accion' && data.plan_accion) {
        setPlanAccion(data.plan_accion);
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al generar contenido');
    } finally {
      setGenerating(null);
    }
  }, [projectId]);

  const adjustStaffCount = (newCount: number) => {
    const n = Math.max(1, Math.min(100, newCount));
    setTotalStaff(n);
    setStaffData(prev => {
      if (n > prev.length) {
        const toAdd = Array.from({ length: n - prev.length }, () => ({ nombre: '', cargo: 'Docente de tiempo completo', meta_individual: '' }));
        return [...prev, ...toAdd];
      }
      return prev.slice(0, n);
    });
  };

  // Toggle categoria (activa/desactiva la categoría completa)
  const toggleCategoria = (cat: typeof CATEGORIAS_OFICIALES[0]) => {
    setCategoriasPriorizadas(prev => {
      const exists = prev.find(c => c.id === cat.id);
      if (exists) return prev.filter(c => c.id !== cat.id);
      return [...prev, { id: cat.id, nombre: cat.nombre, temas: [] }];
    });
  };

  // Toggle tema dentro de una categoría
  const toggleTema = (catId: string, tema: string) => {
    setCategoriasPriorizadas(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const temas = c.temas.includes(tema)
        ? c.temas.filter(t => t !== tema)
        : [...c.temas, tema];
      return { ...c, temas };
    }));
  };

  const isCatSelected = (id: string) => categoriasPriorizadas.some(c => c.id === id);
  const isTemaSelected = (catId: string, tema: string) =>
    categoriasPriorizadas.find(c => c.id === catId)?.temas.includes(tema) ?? false;
  const totalTemasSeleccionados = categoriasPriorizadas.reduce((sum, c) => sum + c.temas.length, 0);

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleNext = async () => {
    setError(null);
    let idToUse = projectId;

    if (activeStep === 1) {
      if (!schoolName.trim() || !schoolCct.trim() || !directorName.trim()) {
        setError('Por favor completa: nombre del plantel, CCT y nombre del director.');
        return;
      }
      idToUse = await saveProject({
        school_name: schoolName, school_cct: schoolCct, municipality, locality,
        school_zone: schoolZone, director_name: directorName, supervisor_name: supervisorName,
        ciclo_escolar: cicloEscolar, subsystem, current_step: 2,
      });
    } else if (activeStep === 2) {
      const incomplete = staffData.some(s => !s.nombre.trim() || !s.cargo.trim());
      if (incomplete) {
        setError('Por favor completa el nombre y cargo de todos los miembros del personal.');
        return;
      }
      idToUse = await saveProject({ total_staff: totalStaff, staff_data: staffData, current_step: 3 });
    } else if (activeStep === 3) {
      if (!diagnosticoComunidad.trim()) {
        setError('Por favor describe el contexto de la comunidad.');
        return;
      }
      if (categoriasPriorizadas.length === 0 || totalTemasSeleccionados === 0) {
        setError('Selecciona al menos una categoría y al menos un tema a priorizar.');
        return;
      }
      idToUse = await saveProject({
        diagnostico_comunidad: diagnosticoComunidad,
        indicadores_academicos: indicadores,
        foda, categorias_priorizadas: categoriasPriorizadas,
        current_step: 4,
      });
    } else if (activeStep === 4) {
      if (!diagnosticoGenerado || !planAccion) {
        setError('Debes generar tanto el diagnóstico como el plan de acción con IA antes de continuar.');
        return;
      }
      idToUse = await saveProject({
        diagnostico_generado: diagnosticoGenerado,
        plan_accion: planAccion,
        status: 'completed',
        current_step: 5,
      });
    }

    if (idToUse) {
      setActiveStep(s => Math.min(s + 1, 5));
    }
  };

  const handleBack = () => setActiveStep(s => Math.max(s - 1, 1));

  // ── Render ────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.14)', fontSize: '14px',
    fontFamily: 'inherit',
    background: 'rgba(255,255,255,0.07)',
    color: '#f0f4ff',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 600, fontSize: '12px',
    color: 'rgba(240,244,255,0.6)', marginBottom: '4px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };
  const sectionCard: React.CSSProperties = {
    background: 'rgba(13,21,48,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '20px', marginBottom: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'rgba(6,10,20,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#f0f4ff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📈</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.3px', background: 'linear-gradient(135deg,#e0e7ff,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Plan de Mejora Continua</div>
            <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)' }}>Lineamientos DBEPA {cicloEscolar}</div>
          </div>
        </div>
        <Link href={`/${locale}/pmc`} style={{ color: 'rgba(240,244,255,0.6)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          ← Volver
        </Link>
      </header>

      {/* Progress steps */}
      <div style={{ background: 'rgba(8,12,24,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 0, maxWidth: '900px', margin: '0 auto' }}>
          {STEPS.map(step => (
            <div key={step.n} style={{
              flex: 1, padding: '14px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600,
              borderBottom: `3px solid ${activeStep === step.n ? '#6366f1' : activeStep > step.n ? '#10b981' : 'transparent'}`,
              color: activeStep === step.n ? '#818cf8' : activeStep > step.n ? '#34d399' : 'rgba(240,244,255,0.4)',
              cursor: activeStep > step.n ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }} onClick={() => activeStep > step.n && setActiveStep(step.n)}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>
                {activeStep > step.n ? '✓' : step.n}
              </div>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(244,63,94,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── STEP 1: Datos Institucionales ─────────────────────────── */}
        {activeStep === 1 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 1: Datos Institucionales
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Ingresa los datos generales del plantel educativo. Esta información aparecerá en la portada del PMC.
            </p>

            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>🏫 Datos del Plantel</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Nombre oficial del plantel *</label>
                  <input style={inputStyle} value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ej: Bachillerato General Oficial 'Lázaro Cárdenas'" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={labelStyle}>Clave de Centro de Trabajo (CCT) *</label>
                    <button
                      type="button"
                      onClick={handleConsultarZona}
                      disabled={loadingZona || !schoolCct.trim()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: schoolCct.trim() ? '#818cf8' : 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        cursor: schoolCct.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        marginBottom: '4px',
                      }}
                    >
                      {loadingZona ? '🔍 Consultando...' : '✨ Consultar Datos de Zona'}
                    </button>
                  </div>
                  <input style={inputStyle} value={schoolCct} onChange={e => setSchoolCct(e.target.value.toUpperCase())} placeholder="Ej: 21EBH0000A" maxLength={12} />
                  <small style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>Formato: 21EBH0000X (10 caracteres)</small>
                </div>
                <div>
                  <label style={labelStyle}>Subsistema</label>
                  <select style={inputStyle} value={subsystem} onChange={e => setSubsystem(e.target.value)}>
                    {SUBSISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Municipio *</label>
                  <input style={inputStyle} value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="Ej: Zacapoaxtla" />
                </div>
                <div>
                  <label style={labelStyle}>Localidad / Comunidad *</label>
                  <input style={inputStyle} value={locality} onChange={e => setLocality(e.target.value)} placeholder="Ej: San Marcos Tlacoyalco" />
                </div>
                <div>
                  <label style={labelStyle}>Zona Escolar</label>
                  <input style={inputStyle} value={schoolZone} onChange={e => setSchoolZone(e.target.value)} placeholder="Ej: Zona 004" />
                </div>
                <div>
                  <label style={labelStyle}>Ciclo escolar</label>
                  <input style={inputStyle} value={cicloEscolar} onChange={e => setCicloEscolar(e.target.value)} placeholder="2025-2026" />
                </div>
              </div>
            </div>

            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>👤 Autoridades</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Nombre del Director(a) *</label>
                  <input style={inputStyle} value={directorName} onChange={e => setDirectorName(e.target.value)} placeholder="Nombre completo del director(a)" />
                </div>
                <div>
                  <label style={labelStyle}>Nombre del Supervisor(a) de Zona</label>
                  <input style={inputStyle} value={supervisorName} onChange={e => setSupervisorName(e.target.value)} placeholder="Nombre completo del supervisor(a)" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Personal ────────────────────────────────────────── */}
        {activeStep === 2 && (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <strong style={{ fontSize: '14px', color: '#818cf8' }}>
                      {member.nombre || `Trabajador ${idx + 1}`}
                    </strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Nombre completo *</label>
                      <input
                        style={inputStyle}
                        value={member.nombre}
                        onChange={e => {
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], nombre: e.target.value };
                          setStaffData(copy);
                        }}
                        placeholder="Nombre del trabajador"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cargo / Función *</label>
                      <select
                        style={inputStyle}
                        value={member.cargo}
                        onChange={e => {
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], cargo: e.target.value };
                          setStaffData(copy);
                        }}
                      >
                        {CARGOS_COMUNES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Meta individual para el ciclo {cicloEscolar} (opcional — si no la defines la IA la generará)</label>
                      <textarea
                        style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                        value={member.meta_individual || ''}
                        onChange={e => {
                          const copy = [...staffData];
                          copy[idx] = { ...copy[idx], meta_individual: e.target.value };
                          setStaffData(copy);
                        }}
                        placeholder="Ej: Reducir mi índice de reprobación del 15% al 5% implementando estrategias de recuperación bimestral..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Diagnóstico ─────────────────────────────────────── */}
        {activeStep === 3 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 3: Diagnóstico Socioeducativo
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Proporciona los datos del contexto comunitario, los indicadores académicos del ciclo anterior
              y el análisis FODA. La IA usará esta información para redactar el diagnóstico oficial.
            </p>

            {/* Banner Asistente de Cartografía de Zona */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.28)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <div>
                <strong style={{ color: '#c7d2fe', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🗺️ Sincronización con Cartografía de Zona
                </strong>
                <p style={{ margin: '2px 0 0', color: 'rgba(240, 244, 255, 0.6)', fontSize: '12px' }}>
                  Puedes heredar los indicadores oficiales 911/F11 y el diagnóstico territorial aprobados por tu supervisión escolar.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConsultarZona}
                disabled={loadingZona || !schoolCct.trim()}
                style={{
                  padding: '7px 14px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: schoolCct.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {loadingZona ? 'Consultando...' : '✨ Consultar Datos de Zona'}
              </button>
            </div>

            {zonaFeedback && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#6ee7b7',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {zonaFeedback}
              </div>
            )}

            {/* Contexto Comunitario */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>🌍 Contexto de la Comunidad</h3>
              <label style={labelStyle}>Descripción del contexto socioeducativo de la comunidad *</label>
              <textarea
                style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
                value={diagnosticoComunidad}
                onChange={e => setDiagnosticoComunidad(e.target.value)}
                placeholder="Describe la comunidad donde se ubica el plantel: ubicación geográfica, número de habitantes, condiciones socioeconómicas, acceso a servicios, problemáticas sociales relevantes (migración, marginación, violencia), acceso a internet y tecnología, distancia a centros urbanos, principales fuentes de empleo, etc."
              />
              <small style={{ color: 'var(--c-text-muted)', fontSize: '11px' }}>
                Incluye datos cuantitativos si los tienes (número de habitantes, % de marginación, etc.)
              </small>
            </div>

            {/* Indicadores académicos */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>📊 Indicadores Académicos</h3>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '16px' }}>
                Ingresa los datos del ciclo anterior y tus metas para el ciclo {cicloEscolar}. Estos datos son obligatorios para el diagnóstico cuantitativo.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '30%' }}>Indicador</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>% Ciclo Anterior</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>% Meta {cicloEscolar}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Aprobación', antKey: 'aprobacion_ant' as const, metaKey: 'aprobacion_meta' as const },
                      { label: 'Reprobación', antKey: 'reprobacion_ant' as const, metaKey: 'reprobacion_meta' as const },
                      { label: 'Abandono escolar / Deserción', antKey: 'abandono_ant' as const, metaKey: 'abandono_meta' as const },
                      { label: 'Eficiencia terminal', antKey: 'et_ant' as const, metaKey: 'et_meta' as const },
                    ].map((row, i) => (
                      <tr key={row.label} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.06)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.label}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <input
                              type="number" min={0} max={100} step={0.1}
                              style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--c-border)', textAlign: 'center' }}
                              value={indicadores[row.antKey] ?? ''}
                              onChange={e => setIndicadores(p => ({ ...p, [row.antKey]: parseFloat(e.target.value) || undefined }))}
                              placeholder="0"
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <input
                              type="number" min={0} max={100} step={0.1}
                              style={{ width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.3)', textAlign: 'center', background: 'rgba(99,102,241,0.1)', color: '#f0f4ff' }}
                              value={indicadores[row.metaKey] ?? ''}
                              onChange={e => setIndicadores(p => ({ ...p, [row.metaKey]: parseFloat(e.target.value) || undefined }))}
                              placeholder="0"
                            />
                            <span>%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>Matrícula total del plantel (alumnos)</label>
                <input
                  type="number" min={1}
                  style={{ ...inputStyle, width: '160px' }}
                  value={indicadores.matricula ?? ''}
                  onChange={e => setIndicadores(p => ({ ...p, matricula: parseInt(e.target.value) || undefined }))}
                  placeholder="Número de alumnos"
                />
              </div>
            </div>

            {/* FODA */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>📋 Análisis FODA del Plantel</h3>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.55)', marginBottom: '16px' }}>
                Realizado de manera colegiada con todo el personal del plantel.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { key: 'fortalezas' as const, label: '💪 Fortalezas', hint: 'Recursos, capacidades y ventajas internas del plantel', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', color: '#34d399' },
                  { key: 'oportunidades' as const, label: '🌟 Oportunidades', hint: 'Factores externos favorables que puede aprovechar el plantel', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.25)', color: '#38bdf8' },
                  { key: 'debilidades' as const, label: '⚠️ Debilidades', hint: 'Limitaciones internas y áreas de oportunidad del plantel', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', color: '#fcd34d' },
                  { key: 'amenazas' as const, label: '🔴 Amenazas', hint: 'Factores externos que pueden afectar negativamente al plantel', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.25)', color: '#fb7185' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ ...labelStyle, color: field.color }}>{field.label}</label>
                    <small style={{ display: 'block', color: 'rgba(240,244,255,0.45)', fontSize: '11px', marginBottom: '6px' }}>{field.hint}</small>
                    <textarea
                      style={{ ...inputStyle, minHeight: '100px', background: field.bg, border: `1px solid ${field.border}`, resize: 'vertical' }}
                      value={foda[field.key]}
                      onChange={e => setFoda(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Lista los principales ${field.label.split(' ')[1].toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Categorías y Temas Priorizados */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>🎯 Categorías y Temas a Priorizar *</h3>
              <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.55)', marginBottom: '8px' }}>
                Según los <strong>Lineamientos DBEPA 2025-2026</strong>, el PMC se organiza en <strong>3 categorías oficiales</strong>. Selecciona la(s) categoría(s) y marca los <strong>temas específicos</strong> que tu plantel abordará. La IA generará metas SMART (con Diagnóstico → Meta → Estrategia → Producto) para cada tema seleccionado.
              </p>
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#a5b4fc' }}>
                <strong>📐 Metodología SMART:</strong> Cada meta que genere la IA será: <em>Específica · Medible · Alcanzable · Relevante · Temporal</em> — siguiendo la estructura: <strong>Diagnóstico → Meta → Estrategia → Producto</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {CATEGORIAS_OFICIALES.map(cat => {
                  const selected = isCatSelected(cat.id);
                  const temasSeleccionados = categoriasPriorizadas.find(c => c.id === cat.id)?.temas ?? [];
                  return (
                    <div key={cat.id} style={{ border: `2px solid ${selected ? cat.color : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', overflow: 'hidden', transition: 'all 0.2s' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: selected ? `${cat.color}22` : 'rgba(255,255,255,0.03)', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCategoria(cat)}
                          style={{ width: '18px', height: '18px', accentColor: cat.color, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: selected ? cat.color : '#f0f4ff' }}>{cat.nombre}</span>
                          {selected && temasSeleccionados.length > 0 && (
                            <span style={{ marginLeft: '10px', fontSize: '11px', background: cat.color, color: '#fff', borderRadius: '20px', padding: '2px 8px' }}>
                              {temasSeleccionados.length} tema(s)
                            </span>
                          )}
                        </div>
                      </label>
                      {selected && (
                        <div style={{ padding: '8px 16px 14px 48px', background: 'rgba(8,12,24,0.6)', borderTop: `1px solid ${cat.color}40` }}>
                          <p style={{ fontSize: '11px', color: 'rgba(240,244,255,0.4)', marginBottom: '8px', fontStyle: 'italic' }}>
                            Selecciona los temas específicos que trabajará tu plantel en esta categoría:
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {cat.temas.map(tema => (
                              <label key={tema} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isTemaSelected(cat.id, tema) ? cat.color : 'rgba(240,244,255,0.75)', fontWeight: isTemaSelected(cat.id, tema) ? 600 : 400 }}>
                                <input
                                  type="checkbox"
                                  checked={isTemaSelected(cat.id, tema)}
                                  onChange={() => toggleTema(cat.id, tema)}
                                  style={{ width: '14px', height: '14px', marginTop: '2px', accentColor: cat.color, flexShrink: 0 }}
                                />
                                {tema}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {totalTemasSeleccionados > 0 && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', fontSize: '13px', color: '#34d399', fontWeight: 600 }}>
                  ✅ {categoriasPriorizadas.length} categoría(s) · {totalTemasSeleccionados} tema(s) seleccionado(s) — la IA generará una meta SMART por cada tema
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Generación IA ───────────────────────────────────── */}
        {activeStep === 4 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 4: Generación con Inteligencia Artificial
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              La IA redactará el diagnóstico oficial y el plan de acción con metas SMART para tu plantel.
              Puedes editar cualquier sección después de generarla.
            </p>

            {/* Generate Diagnóstico */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    📄 Diagnóstico Socioeducativo
                    {diagnosticoGenerado && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ Generado</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Presentación, contexto, análisis de indicadores, FODA y priorización de categorías
                  </p>
                </div>
                <button
                  onClick={() => generateStep('diagnostico')}
                  disabled={generating !== null}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: generating === 'diagnostico' ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 600, cursor: generating !== null ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}
                >
                  {generating === 'diagnostico' ? '⏳ Generando...' : diagnosticoGenerado ? '🔄 Regenerar' : '✨ Generar Diagnóstico'}
                </button>
              </div>
              {diagnosticoGenerado && (
                <div style={{ background: 'rgba(8,12,24,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.7 }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Presentación:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6', color: 'rgba(240,244,255,0.85)' }}>{diagnosticoGenerado.presentacion}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Contexto Socioeducativo:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.contexto}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Análisis de Indicadores Académicos:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.analisis_indicadores}</p>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#818cf8' }}>Síntesis FODA:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.sintesis_foda}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#818cf8' }}>Priorización de Categorías:</strong>
                    <p style={{ marginTop: '4px', lineHeight: '1.6' }}>{diagnosticoGenerado.priorizacion}</p>
                  </div>
                </div>
              )}
              {!diagnosticoGenerado && generating !== 'diagnostico' && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(240,244,255,0.45)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '13px' }}>
                  Haz clic en &quot;Generar Diagnóstico&quot; para que la IA redacte el diagnóstico oficial del PMC
                </div>
              )}
              {generating === 'diagnostico' && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontWeight: 600, color: '#818cf8' }}>Generando diagnóstico...</p>
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)' }}>La IA está analizando el contexto y los indicadores del plantel</p>
                </div>
              )}
            </div>

            {/* Generate Plan de Acción */}
            <div style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                    🎯 Plan de Acción con Metas SMART
                    {planAccion && <span style={{ marginLeft: '8px', color: '#34d399', fontSize: '13px' }}>✓ Generado</span>}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)', margin: '4px 0 0' }}>
                    Metas institucionales por categoría + metas individuales para los {totalStaff} trabajadores
                  </p>
                </div>
                <button
                  onClick={() => generateStep('plan_accion')}
                  disabled={generating !== null || !diagnosticoGenerado}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: generating === 'plan_accion' ? 'rgba(255,255,255,0.1)' : !diagnosticoGenerado ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 600, cursor: (generating !== null || !diagnosticoGenerado) ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: !diagnosticoGenerado ? 0.5 : 1 }}
                >
                  {generating === 'plan_accion' ? '⏳ Generando...' : planAccion ? '🔄 Regenerar' : '✨ Generar Plan de Acción'}
                </button>
              </div>
              {!diagnosticoGenerado && <p style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>⚠️ Primero genera el diagnóstico para poder generar el plan de acción.</p>}

              {planAccion && (
                <div>
                  {/* Metas institucionales */}
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>
                    Metas Institucionales ({planAccion.metas_institucionales.length})
                  </h4>
                  {planAccion.metas_institucionales.map((meta, i) => (
                    <div key={i} style={{ marginBottom: '12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)', overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(99,102,241,0.25)', color: '#f0f4ff', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>
                          {meta.nombre_categoria} — {meta.tema}
                        </span>
                        <button
                          onClick={() => setEditingMeta(editingMeta === i ? null : i)}
                          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          {editingMeta === i ? 'Cerrar' : '✏️ Editar'}
                        </button>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'rgba(8,12,24,0.5)', fontSize: '13px', color: '#f0f4ff', lineHeight: 1.6 }}>
                        {editingMeta === i ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                              { key: 'meta', label: 'Meta SMART', multi: true },
                              { key: 'estrategia', label: 'Estrategia de implementación', multi: true },
                              { key: 'personal_designado', label: 'Personal designado', multi: false },
                              { key: 'entregable', label: 'Entregable / Evidencia', multi: true },
                              { key: 'periodo_inicio', label: 'Período inicio (MM/YYYY)', multi: false },
                              { key: 'periodo_fin', label: 'Período fin (MM/YYYY)', multi: false },
                            ].map(f => (
                              <div key={f.key}>
                                <label style={{ ...labelStyle, fontSize: '12px' }}>{f.label}</label>
                                {f.multi ? (
                                  <textarea
                                    value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_institucionales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_institucionales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, minHeight: '70px', fontSize: '13px' }}
                                  />
                                ) : (
                                  <input
                                    value={((meta as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_institucionales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_institucionales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, fontSize: '13px' }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ gridColumn: '1/-1' }}><strong>Meta:</strong> {meta.meta}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong>Estrategia:</strong> {meta.estrategia}</div>
                            <div><strong>Responsable:</strong> {meta.personal_designado}</div>
                            <div><strong>Período:</strong> {meta.periodo_inicio} — {meta.periodo_fin}</div>
                            <div style={{ gridColumn: '1/-1' }}><strong>Entregable:</strong> {meta.entregable}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Metas personales */}
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', margin: '20px 0 12px' }}>
                    Metas Individuales del Personal ({planAccion.metas_personales.length} personas)
                  </h4>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {planAccion.metas_personales.map((mp, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '10px', padding: '10px', background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.07)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: '200px' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#818cf8' }}>{mp.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)' }}>{mp.cargo}</div>
                        </div>
                        <div style={{ flex: 1, fontSize: '12px' }}>
                          {editingPersonal === i ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {[
                                { key: 'meta_individual', label: 'Meta individual' },
                                { key: 'entregable', label: 'Entregable' },
                                { key: 'periodo', label: 'Período' },
                              ].map(f => (
                                <div key={f.key}>
                                  <label style={{ ...labelStyle, fontSize: '11px' }}>{f.label}</label>
                                  <textarea
                                    value={((mp as unknown) as Record<string, string>)[f.key] || ''}
                                    onChange={e => {
                                      const copy = { ...planAccion };
                                      const arr = [...copy.metas_personales];
                                      arr[i] = { ...arr[i], [f.key]: e.target.value };
                                      copy.metas_personales = arr;
                                      setPlanAccion(copy);
                                    }}
                                    style={{ ...inputStyle, minHeight: '50px', fontSize: '12px' }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div>
                              <div><strong>Meta:</strong> {mp.meta_individual}</div>
                              <div style={{ marginTop: '4px' }}><strong>Entregable:</strong> {mp.entregable}</div>
                              <div style={{ marginTop: '4px', color: 'var(--c-text-muted)' }}>Período: {mp.periodo}</div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingPersonal(editingPersonal === i ? null : i)}
                          style={{ background: 'rgba(99,102,241,0.3)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', alignSelf: 'flex-start', flexShrink: 0 }}
                        >
                          {editingPersonal === i ? '✓ OK' : '✏️'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={async () => {
                      if (!projectId) return;
                      setSaving(true);
                      await fetch(`/api/pmc/${projectId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plan_accion: planAccion }),
                      });
                      setSaving(false);
                    }}
                    style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    disabled={saving}
                  >
                    {saving ? 'Guardando...' : '💾 Guardar cambios del plan'}
                  </button>
                </div>
              )}
              {generating === 'plan_accion' && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontWeight: 600, color: '#818cf8' }}>Generando plan de acción...</p>
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)' }}>La IA está creando metas SMART para {totalStaff} trabajadores y {categoriasPriorizadas.length} categorías</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 5: Revisión y exportar ───────────────────────────── */}
        {activeStep === 5 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f4ff', marginBottom: '8px', letterSpacing: '-0.4px', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
              Paso 5: Revisión Final y Exportación
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', marginBottom: '20px' }}>
              Tu PMC está completo. Descarga los documentos oficiales para su entrega a la supervisión.
            </p>

            {/* Summary card */}
            <div style={{ ...sectionCard, background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0.2) 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>✅ PMC Completado</h3>
              <p style={{ fontSize: '14px', opacity: 0.85, margin: '0 0 16px' }}>
                {schoolName} · CCT: {schoolCct} · Ciclo {cicloEscolar}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Trabajadores con meta', value: planAccion?.metas_personales.length || 0 },
                  { label: 'Metas institucionales', value: planAccion?.metas_institucionales.length || 0 },
                  { label: 'Categorías priorizadas', value: categoriasPriorizadas.length },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Download buttons */}
            <div style={sectionCard}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#818cf8', marginBottom: '16px' }}>📥 Documentos para descargar</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>📕 PMC Oficial en PDF (Formato SEP Puebla)</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.7)' }}>Documento PDF inmutable con membrete oficial del Gobierno de Puebla, escudos SEP/DBEPA, matriz FODA, metas y bloque de 3 firmas listo para impresión o firma electrónica.</div>
                  </div>
                  <a
                    href={`/api/pdf/pmc/${projectId}`}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, backgroundColor: '#c0392b', borderColor: '#c0392b', color: '#fff', fontWeight: 600, textDecoration: 'none' }}
                  >
                    ↓ Descargar PDF Oficial
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>📄 PMC Completo (Word Editable)</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>Documento Word (.docx) editable con todas las secciones para realizar ajustes manuales si se requieren.</div>
                  </div>
                  <a
                    href={`/api/docx/pmc/${projectId}`}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)', textDecoration: 'none' }}
                  >
                    ↓ Descargar Word
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>📋 Plantilla: Informe Parcial de Avance</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
                      Formato personalizado para el seguimiento a mitad de ciclo. Incluye las metas de tu PMC con espacios para registrar los avances y evidencias reales.
                    </div>
                    <div style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-block' }}>
                      ⚠️ Este documento lo debe completar el personal con evidencias reales — NO es generado por IA
                    </div>
                  </div>
                  <a
                    href={`/api/docx/pmc/${projectId}/informe-parcial`}
                    className="btn btn-sm"
                    style={{ flexShrink: 0, background: 'rgba(14,165,233,0.25)', border: '1px solid rgba(14,165,233,0.4)', color: '#38bdf8', textDecoration: 'none' }}
                  >
                    ↓ Informe Parcial
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>📋 Plantilla: Informe Final</div>
                    <div style={{ fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
                      Formato para el informe anual al cierre del ciclo escolar. Incluye todas las metas institucionales e individuales con espacios para evidencias y conclusiones.
                    </div>
                    <div style={{ fontSize: '12px', color: '#fcd34d', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-block' }}>
                      ⚠️ Este documento lo debe completar el personal con evidencias reales — NO es generado por IA
                    </div>
                  </div>
                  <a
                    href={`/api/docx/pmc/${projectId}/informe-final`}
                    className="btn btn-sm"
                    style={{ flexShrink: 0, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', textDecoration: 'none' }}
                  >
                    ↓ Informe Final
                  </a>
                </div>
              </div>
            </div>

            <div style={{ ...sectionCard, background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fcd34d', marginBottom: '8px' }}>📌 Instrucciones para los Informes</h3>
              <ul style={{ fontSize: '13px', color: 'rgba(240,244,255,0.75)', paddingLeft: '18px', margin: 0, lineHeight: '1.8' }}>
                <li>El <strong>Informe Parcial</strong> se entrega aproximadamente a mitad del ciclo escolar (enero-febrero 2026)</li>
                <li>El <strong>Informe Final</strong> se entrega al cierre del ciclo escolar (junio-julio 2026)</li>
                <li>Cada trabajador debe registrar sus avances con <strong>evidencias documentales reales</strong> (no fotografías solas)</li>
                <li>El director(a) consolida los informes individuales y elabora el informe institucional final</li>
                <li>Los informes deben ser firmados por el director y validados por el supervisor de zona</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--c-border)', paddingTop: '16px' }}>
          {activeStep > 1 ? (
            <button onClick={handleBack} disabled={saving} className="btn btn-secondary">
              ← Anterior
            </button>
          ) : (
            <Link href={`/${locale}/pmc`} className="btn btn-secondary">← Cancelar</Link>
          )}

          {activeStep < 5 && (
            <button onClick={handleNext} disabled={saving || generating !== null} className="btn btn-primary">
              {saving ? 'Guardando...' : activeStep === 4 ? '✓ Finalizar PMC' : 'Siguiente →'}
            </button>
          )}
          {activeStep === 5 && (
            <Link href={`/${locale}/pmc`} className="btn btn-primary">
              Ir a mis PMC →
            </Link>
          )}
        </div>

        {/* MODAL DE CONSULTA DE CARTOGRAFÍA DE ZONA */}
        {showZonaModal && zonaData?.zona && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                    🗺️ Cartografía de Zona {zonaData.zona.identificacion.zonaNumero}
                  </h3>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Supervisor(a): <strong style={{ color: '#e2e8f0' }}>{zonaData.zona.identificacion.supervisorName}</strong> · Clave: {zonaData.zona.identificacion.zonaClave}
                  </span>
                </div>
                <button
                  onClick={() => setShowZonaModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Metas CREAA */}
              {zonaData.zona.momento5Metas?.metaGeneralZona && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                    🎯 Meta Estratégica de Zona (Fórmula CREAA):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#e0e7ff', lineHeight: 1.4 }}>
                    {zonaData.zona.momento5Metas.metaGeneralZona}
                  </p>
                </div>
              )}

              {/* Indicadores 911/F11 del Plantel */}
              {zonaData.plantel && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                    📊 Línea Base 911/F11 Registrada para tu Plantel:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Matrícula</span>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>{zonaData.plantel.matricula}</strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Abandono</span>
                      <strong style={{ fontSize: '14px', color: '#fbbf24' }}>{zonaData.plantel.abandono}%</strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Efic. Terminal</span>
                      <strong style={{ fontSize: '14px', color: '#34d399' }}>{zonaData.plantel.eficienciaTerminal}%</strong>
                    </div>
                    <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Reprobación</span>
                      <strong style={{ fontSize: '14px', color: '#f87171' }}>{zonaData.plantel.reprobacion}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnóstico Territorial */}
              {zonaData.zona.momento3Territorio?.descripcionTerritorial && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>
                    📍 Diagnóstico Territorial Sugerido (Momento 3):
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {zonaData.zona.momento3Territorio.descripcionTerritorial}
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowZonaModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cerrar sin aplicar
                </button>
                <button
                  type="button"
                  onClick={handleAplicarSugerenciasZona}
                  style={{
                    padding: '8px 18px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✨ Aplicar sugerencias de zona a mi PMC
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
