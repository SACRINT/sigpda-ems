'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PaecProject, CommunityContext, SchoolContext, PaecAuditResult, PaecAuditCriterion } from '@/types/paec';
import { clearAllWizardDrafts } from '@/hooks/useWizardPersistence';

const PAEC_DRAFT_KEY = 'didactica_paec_draft';

/** Reads the PAEC draft from localStorage (returns null if none) */
function readPaecDraft(): PaecFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PAEC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Saves PAEC form draft to localStorage */
function savePaecDraft(draft: PaecFormDraft) {
  try {
    window.localStorage.setItem(PAEC_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full or unavailable */ }
}

/** Clears PAEC form draft from localStorage */
function clearPaecDraft() {
  try { window.localStorage.removeItem(PAEC_DRAFT_KEY); } catch { /* ignore */ }
}

interface PaecFormDraft {
  projectName: string;
  problemStatement: string;
  cycleType: 'A' | 'B' | 'annual';
  community: CommunityContext;
  school: SchoolContext;
  selectedLaboral: string[];
  selectedFfe: string[];
  groupsCount: string;
  groupsConfig: string;
}

interface Props {
  locale: string;
  initialId: string | null;
}

const STEPS = [
  { num: 1, label: 'Diagnóstico Colectivo' },
  { num: 2, label: 'Justificación y Propósitos' },
  { num: 3, label: 'Mapeo de UACs' },
  { num: 4, label: 'Cronograma' },
  { num: 5, label: 'Detalle Curricular' },
  { num: 6, label: 'Plan Operativo' },
  { num: 7, label: 'Anexos Técnicos' },
];

const CYCLE_LABELS: Record<string, string> = {
  A: 'Semestre A (1°, 3° y 5°)',
  B: 'Semestre B (2°, 4° y 6°)',
  annual: 'Proyecto Completo (1° al 6°)',
};

const CAPACITACION_TITLES: Record<string, string> = {
  'Administracion': '💼 Administración',
  'Agricultura Sostenible de Traspatio': '🌱 Agricultura Sostenible de Traspatio',
  'Area de la Salud': '🩺 Área de la Salud',
  'Comunicacion Grafica': '🎨 Comunicación Gráfica',
  'Contabilidad': '📊 Contabilidad',
  'Domotica': '🏠 Domótica',
  'Instalaciones Residenciales': '🛠️ Instalaciones Residenciales',
  'Mecanica Dental': '🦷 Mecánica Dental',
  'Preparacion de Alimentos Artesanales': '🍯 Preparación de Alimentos Artesanales',
  'Procesos Culinarios y Reposteria': '🍰 Procesos Culinarios y Repostería',
  'Redes y Mantenimiento': '💻 Redes y Mantenimiento',
  'Servicios Ecosistemicos': '🌳 Servicios Ecosistémicos',
  'Sistemas Electricos': '⚡ Sistemas Eléctricos',
  'Tecnologia Informatica': '💾 Tecnología Informática',
  'Turismo': '✈️ Turismo',
};

const FFE_PAIRS = [
  { name5: 'Análisis de Fenómenos Físicos I (CNET)', name6: 'Análisis de Fenómenos Físicos II (CNET)', label: 'Análisis de Fenómenos Físicos (CNET)' },
  { name5: 'Análisis de Fenómenos Biológicos (CNET)', name6: 'Temas Selectos de Biología (CNET)', label: 'Ciencias Biológicas (CNET)' },
  { name5: 'Salud Integral I (CNET)', name6: 'Salud Integral II (CNET)', label: 'Salud Integral (CNET)' },
  { name5: 'Organización del Flujo de Materia I (CNET)', name6: 'Organización del Flujo de Materia II (CNET)', label: 'Organización del Flujo de Materia (CNET)' },
  { name5: 'Derecho y Sociedad I (CS)', name6: 'Derecho y Sociedad II (CS)', label: 'Derecho y Sociedad (CS)' },
  { name5: 'Fundamentos de Administración I (CS)', name6: 'Fundamentos de Administración II (CS)', label: 'Fundamentos de Administración (CS)' },
  { name5: 'Economía I (CS)', name6: 'Economía II (CS)', label: 'Economía (CS)' },
  { name5: 'Procesos Contables I (CS)', name6: 'Procesos Contables II (CS)', label: 'Procesos Contables (CS)' },
  { name5: 'Psicología I (HUM)', name6: 'Psicología II (HUM)', label: 'Psicología (HUM)' },
  { name5: 'Pensamiento Filosófico I (HUM)', name6: 'Pensamiento Filosófico II (HUM)', label: 'Pensamiento Filosófico (HUM)' },
  { name5: 'Arte y Cultura I', name6: 'Arte y Cultura II', label: 'Arte y Cultura' },
  { name5: 'Lógica y Pensamiento Crítico', name6: 'Experiencia Estética', label: 'Lógica y Estética' },
  { name5: 'Pensamiento Matemático Finanzas I (CS)', name6: 'Pensamiento Matemático Finanzas II (CS)', label: 'Pensamiento Matemático Finanzas (CS)' },
  { name5: 'Temas Selectos CS I (CS)', name6: 'Temas Selectos CS II (CS)', label: 'Temas Selectos Ciencias Sociales (CS)' },
  { name5: 'Comunicación y Sociedad I (Lengua)', name6: 'Comunicación y Sociedad II (Lengua)', label: 'Comunicación y Sociedad (Lengua)' },
  { name5: 'Inglés V (Lengua)', name6: 'Inglés VI (Lengua)', label: 'Inglés Avanzado (Lengua)' },
  { name5: 'Raíces etimológicas I (Lengua)', name6: 'Raíces etimológicas II (Lengua)', label: 'Raíces Etimológicas (Lengua)' },
  { name5: 'Taller Pensamiento Variacional I (PM)', name6: 'Taller Pensamiento Variacional II (PM)', label: 'Taller Pensamiento Variacional (PM)' },
  { name5: 'Dibujo Técnico I (PM)', name6: 'Dibujo Técnico II (PM)', label: 'Dibujo Técnico (PM)' },
  { name5: 'Probabilidad y Estadística I (PM)', name6: 'Probabilidad y Estadística II (PM)', label: 'Probabilidad y Estadística (PM)' },
];

export default function PaecWizardClient({ locale, initialId }: Props) {
  const router = useRouter();

  // Restore draft from localStorage if this is a fresh wizard (no project ID in URL)
  const savedDraft = !initialId ? readPaecDraft() : null;

  // Navigation / Loading States
  const [projectId, setProjectId] = useState<string | null>(initialId);
  const [project, setProject] = useState<PaecProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Form States (Paso 1: Datos Base) — initialized from saved draft if present
  const [projectName, setProjectName] = useState(savedDraft?.projectName ?? '');
  const [problemStatement, setProblemStatement] = useState(savedDraft?.problemStatement ?? '');
  const [cycleType, setCycleType] = useState<'A' | 'B' | 'annual'>(savedDraft?.cycleType ?? 'A');

  const [community, setCommunity] = useState<CommunityContext>(savedDraft?.community ?? {
    location: '',
    demographics: '',
    economy: '',
    traditions: '',
    security: '',
    environment: '',
  });

  const [school, setSchool] = useState<SchoolContext>(savedDraft?.school ?? {
    enrollment: '',
    teacherCount: '',
    indicators: '',
    previousPrograms: '',
    facilities: '',
  });

  // Catalogs and Selections
  const [laboralCatalog, setLaboralCatalog] = useState<{ uac_name: string; semester: number; curriculum_name: string }[]>([]);
  const [ffeCatalog, setFfeCatalog] = useState<{ uac_name: string; semester: number; component: string }[]>([]);
  const [selectedLaboral, setSelectedLaboral] = useState<string[]>(savedDraft?.selectedLaboral ?? []);
  const [selectedFfe, setSelectedFfe] = useState<string[]>(savedDraft?.selectedFfe ?? []);
  const [groupsCount, setGroupsCount] = useState(savedDraft?.groupsCount ?? '1');
  const [groupsConfig, setGroupsConfig] = useState(savedDraft?.groupsConfig ?? '');

  // Manual Edit States
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editPayload, setEditPayload] = useState<any>(null);

  // Quality Audit States (Step 7)
  const [auditResult, setAuditResult] = useState<PaecAuditResult | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'all' | 'deficient'>('deficient');

  // Auto-save form draft to localStorage whenever step-1 form fields change (only when no projectId)
  const isFirstRenderDraft = useRef(true);
  useEffect(() => {
    if (isFirstRenderDraft.current) { isFirstRenderDraft.current = false; return; }
    if (projectId) return; // project already in DB, no need to save draft
    savePaecDraft({ projectName, problemStatement, cycleType, community, school, selectedLaboral, selectedFfe, groupsCount, groupsConfig });
  }, [projectId, projectName, problemStatement, cycleType, community, school, selectedLaboral, selectedFfe, groupsCount, groupsConfig]);

  // Load UAC lists for select checklists
  useEffect(() => {
    async function fetchCatalog() {
      try {
        const resLab = await fetch(`/api/programs?component=laboral`);
        const dataLab = await resLab.json();
        if (dataLab.programs) {
          setLaboralCatalog(dataLab.programs);
        }

        const resFfe1 = await fetch(`/api/programs?component=ext_optativo`);
        const dataFfe1 = await resFfe1.json();
        const resFfe2 = await fetch(`/api/programs?component=ext_obligatorio`);
        const dataFfe2 = await resFfe2.json();
        
        const allFfe = [...(dataFfe1.programs || []), ...(dataFfe2.programs || [])];
        setFfeCatalog(allFfe);
      } catch (err) {
        console.error('Error fetching catalogs:', err);
      }
    }
    fetchCatalog();
  }, []);

  // Load project details if ID is present
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  async function loadProject(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/paec/${id}`);
      if (!res.ok) throw new Error('No se pudo cargar el proyecto.');
      const data = await res.json();
      
      const p = data.project as PaecProject;
      setProject(p);
      setProjectName(p.projectName);
      setProblemStatement(p.problemStatement);
      setCycleType(p.cycleType);
      if (p.communityContext) setCommunity(p.communityContext);
      if (p.schoolContext) {
        setSchool(p.schoolContext);
        setSelectedLaboral(p.schoolContext.activeLaboralUacs || []);
        setSelectedFfe(p.schoolContext.activeFfeUacs || []);
        setGroupsCount(p.schoolContext.groupsCount || '1');
        setGroupsConfig(p.schoolContext.groupsConfig || '');
      }

      // Set active step to the furthest generated step, or current step
      setActiveStep(p.currentStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos.');
    } finally {
      setLoading(false);
    }
  }

  // Fetch PAEC Quality Audit (Step 7)
  async function fetchAudit(pId: string) {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await fetch(`/api/paec/${pId}/audit`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al ejecutar la auditoría de calidad.');
      }
      const data = await res.json();
      if (data.audit) {
        setAuditResult(data.audit);
      }
    } catch (err) {
      console.error('Error fetching audit:', err);
      setAuditError(err instanceof Error ? err.message : 'Error al consultar la auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  }

  // Auto-fetch audit when loading or entering Step 7 with generated Annexes
  useEffect(() => {
    if (activeStep === 7 && projectId && project?.fase2Anexos) {
      fetchAudit(projectId);
    }
  }, [activeStep, projectId, !!project?.fase2Anexos]);

  // Handle Form Submission (Create Project)
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName || !problemStatement) {
      alert('Por favor completa los campos requeridos: Nombre del proyecto y Problemática.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/paec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          problemStatement,
          cycleType,
          communityContext: community,
          schoolContext: {
            ...school,
            activeLaboralUacs: selectedLaboral,
            activeFfeUacs: selectedFfe,
            groupsConfig,
            groupsCount,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar el proyecto.');
      }

      const data = await res.json();
      clearPaecDraft(); // Draft saved to DB — clear localStorage
      setProjectId(data.project.id);
      router.push(`/${locale}/paec/nuevo?id=${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error.');
      setLoading(false);
    }
  }

  // Handle Step Generation (Call Claude API)
  async function generateCurrentStep() {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/paec/${projectId}/generate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: activeStep }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al generar los contenidos con IA.');
      }

      const data = await res.json();
      setProject(data.project);
      if (activeStep === 7 && data.project?.id) {
        fetchAudit(data.project.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la comunicación con la IA.');
    } finally {
      setGenerating(false);
    }
  }

  // Get current step's generated JSON data
  function getCurrentStepData() {
    if (!project) return null;
    switch (activeStep) {
      case 1: return JSON.parse(JSON.stringify(project.fase1Diagnostico));
      case 2: return JSON.parse(JSON.stringify(project.fase2Justificacion));
      case 3: return JSON.parse(JSON.stringify(project.fase2Mapeo));
      case 4: return JSON.parse(JSON.stringify(project.fase2Cronograma));
      case 5: return JSON.parse(JSON.stringify(project.fase2DetalleCurricular));
      case 6: return JSON.parse(JSON.stringify(project.fase2PlanOperativo));
      case 7: return JSON.parse(JSON.stringify(project.fase2Anexos));
      default: return null;
    }
  }

  // Save manual modifications back to database
  async function saveStepEdits() {
    if (!projectId || !project || !editPayload) return;
    setLoading(true);
    setError(null);
    try {
      let fieldName = '';
      switch (activeStep) {
        case 1: fieldName = 'fase1_diagnostico'; break;
        case 2: fieldName = 'fase2_justificacion'; break;
        case 3: fieldName = 'fase2_mapeo'; break;
        case 4: fieldName = 'fase2_cronograma'; break;
        case 5: fieldName = 'fase2_detalle_curricular'; break;
        case 6: fieldName = 'fase2_plan_operativo'; break;
        case 7: fieldName = 'fase2_anexos'; break;
      }

      const res = await fetch(`/api/paec/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName,
          stepData: editPayload,
          step: project.currentStep,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar los cambios.');
      }

      const data = await res.json();
      setProject(data.project);
      setIsEditingContent(false);
      setEditPayload(null);
      if (activeStep === 7 && data.project?.id) {
        fetchAudit(data.project.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la edición.');
    } finally {
      setLoading(false);
    }
  }

  // Grouping helper for laboral UACs
  const groupedLaboral = laboralCatalog.reduce((acc, item) => {
    const cap = item.curriculum_name || 'General';
    if (!acc[cap]) acc[cap] = {};
    if (!acc[cap][item.semester]) acc[cap][item.semester] = [];
    acc[cap][item.semester].push(item);
    return acc;
  }, {} as Record<string, Record<number, typeof laboralCatalog>>);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--c-text-muted)' }}>
        <span className="spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--c-blue-pale)', borderTopColor: 'var(--c-blue-mid)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', fontSize: '16px' }}>Cargando proyecto...</p>
      </div>
    );
  }

  // Render Paso 0: Formulario de Creación
  if (!projectId) {
    return (
      <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href={`/${locale}/paec`} className="btn btn-ghost" style={{ padding: '8px 12px', color: 'rgba(240,244,255,0.7)' }}>
            ← Volver
          </Link>
          <div>
            <h1 style={{ fontSize: '28px', color: '#f0f4ff', margin: 0, fontWeight: 800, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", letterSpacing: '-0.5px' }}>Nuevo Proyecto PAEC-PEC</h1>
            <p style={{ color: 'rgba(240,244,255,0.6)', margin: '4px 0 0' }}>Completa los datos iniciales de tu plantel y comunidad para comenzar</p>
          </div>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Datos del Proyecto */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>1. Identificación del Proyecto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre Preliminar del Proyecto Escolar Comunitario *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Transformando el PET en Soluciones Comunitarias Ecológicas"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Problemática o Necesidad seleccionada por el Comité del Plantel *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: Alto índice de contaminación por residuos plásticos en los alrededores del plantel y falta de cultura de reciclaje en la comunidad."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#f0f4ff', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'rgba(240,244,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ciclo Semestral / Bloque de Relevo *</label>
                <select
                  value={cycleType}
                  onChange={(e) => setCycleType(e.target.value as any)}
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
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Ubicación Geográfica y Nombre de la Localidad</label>
                <input
                  type="text"
                  placeholder="Ej: San Antonio Tepetitlán, Municipio de Chignahuapan, Puebla"
                  value={community.location}
                  onChange={(e) => setCommunity({ ...community, location: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Situación Demográfica</label>
                <input
                  type="text"
                  placeholder="Ej: Población de 4,200 habitantes, mayoría joven menor de 25 años"
                  value={community.demographics}
                  onChange={(e) => setCommunity({ ...community, demographics: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Actividades Socioeconómicas Principales</label>
                <input
                  type="text"
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
          <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--c-border)', boxShadow: 'var(--shadow-card)' }}>
            <h2 style={{ fontSize: '18px', color: 'var(--c-navy-light)', borderBottom: '1px solid var(--c-border)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 600 }}>3. Ficha de Datos del Plantel</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Matrícula Escolar (Estudiantes)</label>
                <input
                  type="text"
                  placeholder="Ej: 280 alumnos inscritos en ambos semestres"
                  value={school.enrollment}
                  onChange={(e) => setSchool({ ...school, enrollment: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Plantilla Docente</label>
                <input
                  type="text"
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

          {/* Estructura de Grupos, Capacitaciones y FFE */}
          <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '18px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', fontWeight: 700 }}>4. Estructura de Grupos y Materias Específicas</h2>
            <p style={{ margin: '-10px 0 16px', fontSize: '13px', color: 'rgba(240,244,255,0.6)' }}>
              Configura los grupos y selecciona las capacitaciones o asignaturas del componente laboral y FFE activas en tu plantel.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Número de Grupos por Semestre</label>
                  <input
                    type="text"
                    placeholder="Ej: 3 grupos (A, B, C)"
                    value={groupsCount}
                    onChange={(e) => setGroupsCount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>Grupos específicos asignados a este proyecto</label>
                  <input
                    type="text"
                    placeholder="Ej: 1°A, 2°A, 3°A, 4°A (o Dejar vacío para todos)"
                    value={groupsConfig}
                    onChange={(e) => setGroupsConfig(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--c-border)' }}
                  />
                </div>
              </div>

              <div>
                <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                  El proyecto transversal cruzará únicamente las asignaturas seleccionadas a continuación para evitar sobrecargar los planes de los docentes.
                </p>
              </div>

              {/* Laboral Checklist */}
              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px', marginTop: '8px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px', fontSize: '15px', color: 'var(--c-navy)' }}>
                  Capacitaciones para el Trabajo (Formación Laboral) activas *
                </label>
                <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginBottom: '14px', marginTop: '-6px' }}>
                  Selecciona las capacitaciones de tu escuela. Cada capacitación contiene 8 asignaturas divididas de 3° a 6° semestre.
                </p>

                {laboralCatalog.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>Cargando catálogo laboral...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(8,12,24,0.5)' }}>
                    {Object.keys(CAPACITACION_TITLES).map((capKey) => {
                      const title = CAPACITACION_TITLES[capKey];
                      const semGroups = groupedLaboral[capKey] || {};
                      
                      const capUacs = Object.values(semGroups).flat();
                      const allSelected = capUacs.length > 0 && capUacs.every(u => selectedLaboral.includes(u.uac_name));

                      return (
                        <div key={capKey} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px', background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#818cf8' }}>{title}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const names = capUacs.map(u => u.uac_name);
                                if (allSelected) {
                                  setSelectedLaboral(prev => prev.filter(n => !names.includes(n)));
                                } else {
                                  setSelectedLaboral(prev => Array.from(new Set([...prev, ...names])));
                                }
                              }}
                              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600 }}
                            >
                              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            {[3, 4, 5, 6].map((sem) => {
                              const uacs = semGroups[sem] || [];
                              if (uacs.length === 0) return null;
                              return (
                                <div key={sem} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', marginBottom: '6px' }}>{sem}° Semestre</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {uacs.map((u) => {
                                      const isChecked = selectedLaboral.includes(u.uac_name);
                                      return (
                                        <label key={u.uac_name} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11.5px', cursor: 'pointer', lineHeight: 1.3 }}>
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              if (isChecked) {
                                                setSelectedLaboral(selectedLaboral.filter(n => n !== u.uac_name));
                                              } else {
                                                setSelectedLaboral([...selectedLaboral, u.uac_name]);
                                              }
                                            }}
                                            style={{ marginTop: '2px' }}
                                          />
                                          <span>{u.uac_name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FFE Checklist */}
              <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '16px', marginTop: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px', fontSize: '15px', color: 'var(--c-navy)' }}>
                  Formación Fundamental Extendida (FFE/FFEO) activas
                </label>
                <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginBottom: '14px', marginTop: '-6px' }}>
                  Selecciona las asignaturas de FFE. Dado que tienen continuidad obligatoria, al seleccionar la materia de 5° Semestre se vinculará automáticamente con su continuación en 6° Semestre.
                </p>

                {ffeCatalog.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>Cargando catálogo FFE...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(8,12,24,0.5)' }}>
                    {FFE_PAIRS.map((pair) => {
                      const isChecked5 = selectedFfe.includes(pair.name5);
                      const isChecked6 = selectedFfe.includes(pair.name6);

                      return (
                        <div key={pair.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', gap: '10px' }}>
                          <div style={{ minWidth: '220px', flex: '1' }}>
                            <strong style={{ fontSize: '13px', color: '#818cf8' }}>{pair.label}</strong>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked5}
                                onChange={() => {
                                  if (isChecked5) {
                                    setSelectedFfe(selectedFfe.filter(n => n !== pair.name5 && n !== pair.name6));
                                  } else {
                                    // Autoselect matching 6th semester FFE too
                                    setSelectedFfe(prev => Array.from(new Set([...prev, pair.name5, pair.name6])));
                                  }
                                }}
                              />
                              <span style={{ fontWeight: 500 }}>5° Sem:</span>
                              <span style={{ color: 'var(--c-text-muted)' }}>{pair.name5.split(' (')[0]}</span>
                            </label>

                            <span style={{ color: '#cbd5e1' }}>➔</span>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked6}
                                onChange={() => {
                                  if (isChecked6) {
                                    setSelectedFfe(selectedFfe.filter(n => n !== pair.name6 && n !== pair.name5));
                                  } else {
                                    // Autoselect matching 5th semester FFE too
                                    setSelectedFfe(prev => Array.from(new Set([...prev, pair.name5, pair.name6])));
                                  }
                                }}
                              />
                              <span style={{ fontWeight: 500 }}>6° Sem:</span>
                              <span style={{ color: 'var(--c-text-muted)' }}>{pair.name6.split(' (')[0]}</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '16px', background: 'linear-gradient(135deg, var(--c-navy) 0%, var(--c-navy-light) 100%)', border: 'none', cursor: 'pointer' }}>
              Guardar y Empezar Generación →
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Helper to determine if current active step is generated
  function isStepGenerated(s: number): boolean {
    if (!project) return false;
    switch (s) {
      case 1: return !!project.fase1Diagnostico;
      case 2: return !!project.fase2Justificacion;
      case 3: return !!project.fase2Mapeo;
      case 4: return !!project.fase2Cronograma;
      case 5: return !!project.fase2DetalleCurricular;
      case 6: return !!project.fase2PlanOperativo;
      case 7: return !!project.fase2Anexos;
      default: return false;
    }
  }

  const generated = isStepGenerated(activeStep);

  return (
    <div style={{ maxWidth: '1024px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <Link href={`/${locale}/paec`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
          ← Volver a Proyectos
        </Link>
        <h1 className="page-title" style={{ fontSize: '28px', color: 'var(--c-navy)' }}>{projectName}</h1>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '15px', margin: '4px 0 0' }}>
          Problemática: {problemStatement}
        </p>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge badge-semester" style={{ backgroundColor: 'var(--c-blue-mid)', color: '#fff' }}>
            {CYCLE_LABELS[cycleType]}
          </span>
          <span className="badge" style={{ backgroundColor: project?.status === 'completed' ? '#28a745' : '#ffc107', color: project?.status === 'completed' ? '#fff' : '#212529' }}>
            {project?.status === 'completed' ? 'Completado' : `Borrador — Paso ${project?.currentStep || 1} de 7`}
          </span>
          {project?.fase2Anexos && (
            <a href={`/api/docx/paec/${projectId}`} className="btn btn-amber btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--c-amber)', color: '#fff', marginLeft: 'auto' }}>
              <span>↓</span> Descargar PEC Completo (DOCX)
            </a>
          )}
        </div>
      </div>

      {/* Horizontal Step Indicator */}
      <div className="step-wizard" style={{ marginBottom: '32px' }}>
        {STEPS.map((s) => {
          const isDone = isStepGenerated(s.num);
          const isActive = s.num === activeStep;
          return (
            <button
              key={s.num}
              onClick={() => {
                // Allowed to click any step that has been generated or is the current step
                if (isDone || s.num <= (project?.currentStep || 1)) {
                  setActiveStep(s.num);
                  setError(null);
                }
              }}
              className={`step-item ${isDone ? 'done' : isActive ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: (isDone || s.num <= (project?.currentStep || 1)) ? 'pointer' : 'not-allowed', outline: 'none' }}
              disabled={!(isDone || s.num <= (project?.currentStep || 1))}
            >
              <div className="step-num">{isDone ? '✓' : s.num}</div>
              <span className="step-label" style={{ fontWeight: isActive ? 700 : 500 }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Panel Content */}
      <div className="card" style={{ padding: '24px', background: 'rgba(13,21,48,0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        
        {error && (
          <div style={{ backgroundColor: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* STATE A: NOT GENERATED YET */}
        {!generated && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🤖</div>
            <h2 style={{ color: 'var(--c-navy)', marginBottom: '12px', fontSize: '22px', fontWeight: 600 }}>Paso {activeStep}: {STEPS[activeStep - 1].label}</h2>
            <p style={{ color: 'var(--c-text-muted)', maxWidth: '520px', margin: '0 auto 24px', lineHeight: 1.6 }}>
              {activeStep === 1 && 'La Inteligencia Artificial recopilará los datos de la comunidad y del plantel para estructurar las 4 tablas oficiales de diagnóstico y realizar el análisis FODA del proyecto.'}
              {activeStep === 2 && 'Se redactará la justificación formal del proyecto, los 5 pilares estratégicos de viabilidad, los propósitos integrales (educativo, social y funcional) y las metas del PEC.'}
              {activeStep === 3 && 'La IA cruzará las asignaturas activas de tus semestres seleccionados (Modelo de Relevos) con la problemática común para detallar los temas prácticos de aprendizaje transversal.'}
              {activeStep === 4 && 'Estructuración del plan macro dividiendo las etapas del proyecto escolar en 6 fases bimestrales ordenadas cronológicamente con asignaturas responsables y justificación pedagógica.'}
              {activeStep === 5 && 'Matriz de Detalle Curricular por Semestre: fundamentación curricular inquebrantable (propósitos formativos o progresiones de aprendizaje NOM-MCCEMS) y vinculación con fases para cada UAC.'}
              {activeStep === 6 && 'Desglose detallado del plan operativo de actividades (semanas 1 a 16) con 8 columnas oficiales, metodologías activas y entrega de relevos semestral.'}
              {activeStep === 7 && 'Generación del sistema integral de anexos técnicos estructurados: minutas con firmas, seguimiento semanal semafórico, reporte mensual y cuestionarios Likert.'}
            </p>

            <button
              onClick={generateCurrentStep}
              disabled={generating}
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              {generating ? (
                <>
                  <span className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  Generando con Inteligencia Artificial (Toma unos segundos)...
                </>
              ) : (
                <>Generar Fase con IA ✨</>
              )}
            </button>
          </div>
        )}

        {/* STATE B: SUCCESSFULLY GENERATED CONTENT VIEW */}
        {generated && project && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)', paddingBottom: '14px', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', color: 'var(--c-navy)', margin: 0, fontWeight: 700 }}>
                {STEPS[activeStep - 1].label} {isEditingContent ? '(Modo Edición)' : '(Contenido Generado)'}
              </h2>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {isEditingContent ? (
                  <>
                    <button
                      onClick={saveStepEdits}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '13px', backgroundColor: '#28a745', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      <span>💾</span> Guardar Cambios
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingContent(false);
                        setEditPayload(null);
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '13px', color: '#dc3545', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditPayload(getCurrentStepData());
                        setIsEditingContent(true);
                      }}
                      className="btn btn-amber btn-sm"
                      style={{ fontSize: '13px', backgroundColor: 'var(--c-blue-mid)', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px' }}
                    >
                      <span>✏️</span> Editar Contenido
                    </button>
                    <button
                      onClick={generateCurrentStep}
                      disabled={generating}
                      className="btn btn-ghost"
                      style={{ fontSize: '13px', color: 'var(--c-navy-light)', textDecoration: 'underline' }}
                    >
                      {generating ? 'Regenerando...' : 'Regenerar esta fase 🔄'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Step 1 Visual Render */}
            {activeStep === 1 && project.fase1Diagnostico && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 1: Características de la comunidad (Contexto Externo)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla1 ? editPayload.tabla1 : project.fase1Diagnostico.tabla1).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.col2}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla1[i].col2 = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.col2
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 2: Características de la educación e institución (Contexto Interno)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto Escolar</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla2 ? editPayload.tabla2 : project.fase1Diagnostico.tabla2).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.col2}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla2[i].col2 = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.col2
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 3: Análisis FODA y Estrategia Maestra del PEC</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto FODA</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Análisis Estratégico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla3 ? editPayload.tabla3 : project.fase1Diagnostico.tabla3).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.aspect}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.analysis}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla3[i].analysis = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.analysis
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 4: Problemáticas o necesidades de la comunidad (Proceso de Selección)</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Etapa del Proceso</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(isEditingContent && editPayload?.tabla4 ? editPayload.tabla4 : project.fase1Diagnostico.tabla4).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                          <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                            {isEditingContent ? (
                              <textarea
                                value={r.col2}
                                onChange={(e) => {
                                  const copy = { ...editPayload };
                                  copy.tabla4[i].col2 = e.target.value;
                                  setEditPayload(copy);
                                }}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                              />
                            ) : (
                              r.col2
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 2 Visual Render */}
            {activeStep === 2 && project.fase2Justificacion && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', lineHeight: 1.6 }}>
                <div>
                  <strong>Nombre del Proyecto Definitivo:</strong>
                  {isEditingContent ? (
                    <input
                      type="text"
                      value={editPayload?.projectName || ''}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.projectName = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '8px', fontSize: '15px', fontWeight: 600, borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                    />
                  ) : (
                    <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-navy)' }}>{project.fase2Justificacion.projectName}</p>
                  )}
                </div>
                <div>
                  <strong>Introducción y Justificación Académica:</strong>
                  {isEditingContent ? (
                    <textarea
                      value={editPayload?.introduction || ''}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.introduction = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', minHeight: '140px', marginTop: '4px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    <p style={{ fontSize: '14px', whiteSpace: 'pre-line' }}>{project.fase2Justificacion.introduction}</p>
                  )}
                </div>
                <div>
                  <strong>Pilares Estratégicos de Viabilidad:</strong>
                  {isEditingContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {(editPayload?.pilares || []).map((pilar: string, i: number) => (
                        <input
                          key={i}
                          type="text"
                          value={pilar}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.pilares[i] = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul style={{ listStyleType: 'disc', paddingLeft: '20px', fontSize: '14px' }}>
                      {project.fase2Justificacion.pilares.map((pilar, i) => (
                        <li key={i} style={{ marginBottom: '8px' }}>{pilar}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <strong>Propósitos Integrales del PEC:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '8px' }}>
                    <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
                      <strong style={{ color: 'var(--c-navy)' }}>Propósito Educativo:</strong>
                      {isEditingContent ? (
                        <textarea
                          value={editPayload?.proposito?.educativo || ''}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.proposito.educativo = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.educativo}</p>
                      )}
                    </div>
                    <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
                      <strong style={{ color: 'var(--c-navy)' }}>Propósito Social:</strong>
                      {isEditingContent ? (
                        <textarea
                          value={editPayload?.proposito?.social || ''}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.proposito.social = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.social}</p>
                      )}
                    </div>
                    <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
                      <strong style={{ color: 'var(--c-navy)' }}>Propósito Funcional:</strong>
                      {isEditingContent ? (
                        <textarea
                          value={editPayload?.proposito?.funcional || ''}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.proposito.funcional = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.funcional}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <strong>Metas Cuantitativas:</strong>
                  {isEditingContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {(editPayload?.alcance?.metas || []).map((m: string, i: number) => (
                        <input
                          key={i}
                          type="text"
                          value={m}
                          onChange={(e) => {
                            const copy = { ...editPayload };
                            copy.alcance.metas[i] = e.target.value;
                            setEditPayload(copy);
                          }}
                          style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul style={{ listStyleType: 'decimal', paddingLeft: '20px', fontSize: '13px' }}>
                      {project.fase2Justificacion.alcance.metas.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 Visual Render */}
            {activeStep === 3 && project.fase2Mapeo && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '10%' }}>Sem</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Asignatura (UAC)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Actividad / Tema Práctico</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vinculación y Progresión Curricular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingContent && editPayload ? editPayload : project.fase2Mapeo).map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semester}°</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.uacName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {isEditingContent ? (
                            <input
                              type="text"
                              value={r.topic}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].topic = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                          ) : (
                            r.topic
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.linking}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].linking = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.linking
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Step 4 Visual Render */}
            {activeStep === 4 && project.fase2Cronograma && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '18%' }}>Fase Bimestral</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '22%' }}>Objetivo de la Etapa</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '24%' }}>Macro-Actividades del Proyecto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '24%' }}>Asignaturas Responsables y Justificación</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '12%' }}>Semestre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingContent && editPayload ? editPayload : project.fase2Cronograma).map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.phase}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.objective}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].objective = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.objective
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.macroActivities}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].macroActivities = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.macroActivities
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.responsibleSubjects || ''}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].responsibleSubjects = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.responsibleSubjects || 'Todas las asignaturas vinculadas'
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semesterInvolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Step 5 Visual Render: Detalle Curricular */}
            {activeStep === 5 && project.fase2DetalleCurricular && (
              <div>
                <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>
                  Matriz de Detalle Curricular por Semestre (Fundamentación y Progresiones / Propósitos NOM-MCCEMS)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '8%' }}>Sem</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '22%' }}>Asignatura (UAC)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Progresiones o Propósitos Formativos</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '15%' }}>Fase(s) del Proyecto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '30%' }}>Justificación Curricular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditingContent && editPayload ? editPayload : project.fase2DetalleCurricular).map((r: any, i: number) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semester}°</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.uacName}</td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.progressionsOrPurposes}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].progressionsOrPurposes = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.progressionsOrPurposes
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {isEditingContent ? (
                            <input
                              type="text"
                              value={r.projectPhases}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].projectPhases = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                          ) : (
                            r.projectPhases
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                          {isEditingContent ? (
                            <textarea
                              value={r.curricularJustification}
                              onChange={(e) => {
                                const copy = [...editPayload];
                                copy[i].curricularJustification = e.target.value;
                                setEditPayload(copy);
                              }}
                              style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                          ) : (
                            r.curricularJustification
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Step 6 Visual Render: Plan Operativo */}
            {activeStep === 6 && project.fase2PlanOperativo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {project.fase2PlanOperativo.semestreA && project.fase2PlanOperativo.semestreA.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Plan Operativo: Semestre A (1°, 3° y 5° Semestre)</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '10%' }}>Fase</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '22%' }}>Actividad Semanal</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '15%' }}>UAC</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '8%' }}>Progresión / Propósito</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '11%' }}>Estrategia</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '7%' }}>Semana</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '13%' }}>Responsables</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '14%' }}>Inst. Evaluación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isEditingContent && editPayload?.semestreA ? editPayload.semestreA : project.fase2PlanOperativo.semestreA).map((r: any, i: number) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                            <td style={{ padding: '6px 10px' }}>{r.phase}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <textarea
                                  value={r.activity}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreA[i].activity = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '50px', fontFamily: 'inherit' }}
                                />
                              ) : (
                                r.activity
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.uac}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.progression}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <input
                                  type="text"
                                  value={r.strategy}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreA[i].strategy = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                              ) : (
                                r.strategy
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{r.week}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <input
                                  type="text"
                                  value={r.responsibles}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreA[i].responsibles = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                              ) : (
                                r.responsibles
                              )}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <input
                                  type="text"
                                  value={r.evaluationInstrument || ''}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreA[i].evaluationInstrument = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                              ) : (
                                r.evaluationInstrument || 'Rúbrica'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {project.fase2PlanOperativo.semestreB && project.fase2PlanOperativo.semestreB.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Plan Operativo: Semestre B (2°, 4° y 6° Semestre)</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '10%' }}>Fase</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '22%' }}>Actividad Semanal</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '15%' }}>UAC</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '8%' }}>Progresión / Propósito</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '11%' }}>Estrategia</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '7%' }}>Semana</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '13%' }}>Responsables</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', width: '14%' }}>Inst. Evaluación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isEditingContent && editPayload?.semestreB ? editPayload.semestreB : project.fase2PlanOperativo.semestreB).map((r: any, i: number) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                            <td style={{ padding: '6px 10px' }}>{r.phase}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <textarea
                                  value={r.activity}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreB[i].activity = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '50px', fontFamily: 'inherit' }}
                                />
                              ) : (
                                r.activity
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.uac}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.progression}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <input
                                  type="text"
                                  value={r.strategy}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreB[i].strategy = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                              ) : (
                                r.strategy
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{r.week}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <input
                                  type="text"
                                  value={r.responsibles}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreB[i].responsibles = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                              ) : (
                                r.responsibles
                              )}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              {isEditingContent ? (
                                <input
                                  type="text"
                                  value={r.evaluationInstrument || ''}
                                  onChange={(e) => {
                                    const copy = { ...editPayload };
                                    copy.semestreB[i].evaluationInstrument = e.target.value;
                                    setEditPayload(copy);
                                  }}
                                  style={{ width: '100%', padding: '4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                              ) : (
                                r.evaluationInstrument || 'Rúbrica'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Step 7 Visual Render: Anexos Técnicos */}
            {activeStep === 7 && project.fase2Anexos && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'var(--c-gray)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy)', fontWeight: 600, marginBottom: '8px' }}>Anexo 1: Minuta de Instalación del Comité PAEC</h3>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                    {typeof project.fase2Anexos.anexo1Minuta === 'object'
                      ? JSON.stringify(project.fase2Anexos.anexo1Minuta, null, 2)
                      : (project.fase2Anexos.anexo1 || JSON.stringify(project.fase2Anexos, null, 2))}
                  </pre>
                </div>
                <div style={{ padding: '16px', background: 'var(--c-gray)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy)', fontWeight: 600, marginBottom: '8px' }}>Anexo 2: Cuadro de Seguimiento Semanal con Semáforo</h3>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                    {typeof project.fase2Anexos.anexo2Seguimiento === 'object'
                      ? JSON.stringify(project.fase2Anexos.anexo2Seguimiento, null, 2)
                      : (project.fase2Anexos.anexo2 || '')}
                  </pre>
                </div>
                <div style={{ padding: '16px', background: 'var(--c-gray)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy)', fontWeight: 600, marginBottom: '8px' }}>Anexo 3: Reporte Mensual de Avances</h3>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                    {typeof project.fase2Anexos.anexo3ReporteMensual === 'object'
                      ? JSON.stringify(project.fase2Anexos.anexo3ReporteMensual, null, 2)
                      : (project.fase2Anexos.anexo3 || '')}
                  </pre>
                </div>
                <div style={{ padding: '16px', background: 'var(--c-gray)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy)', fontWeight: 600, marginBottom: '8px' }}>Anexo 4: Cuestionario de Impacto Comunitario (Escala Likert 1-5)</h3>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                    {typeof project.fase2Anexos.anexo4ImpactoComunidad === 'object'
                      ? JSON.stringify(project.fase2Anexos.anexo4ImpactoComunidad, null, 2)
                      : (project.fase2Anexos.anexo4 || '')}
                  </pre>
                </div>
                <div style={{ padding: '16px', background: 'var(--c-gray)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy)', fontWeight: 600, marginBottom: '8px' }}>Anexo 5: Cuestionario de Autoevaluación de Estudiantes</h3>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                    {typeof project.fase2Anexos.anexo5AutoevaluacionEstudiantes === 'object'
                      ? JSON.stringify(project.fase2Anexos.anexo5AutoevaluacionEstudiantes, null, 2)
                      : (project.fase2Anexos.anexo5 || '')}
                  </pre>
                </div>
                <div style={{ padding: '16px', background: 'var(--c-gray)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '15px', color: 'var(--c-navy)', fontWeight: 600, marginBottom: '8px' }}>Anexo 6: Cuestionario de Evaluación para Docentes y Colegiado</h3>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                    {typeof project.fase2Anexos.anexo6EvaluacionColegiado === 'object'
                      ? JSON.stringify(project.fase2Anexos.anexo6EvaluacionColegiado, null, 2)
                      : (project.fase2Anexos.anexo6 || '')}
                  </pre>
                </div>

                {/* Tarjeta de Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM) */}
                <div style={{
                  marginTop: '16px',
                  padding: '24px',
                  borderRadius: '12px',
                  background: 'rgba(13,21,48,0.92)',
                  border: `1px solid ${
                    !auditResult ? 'rgba(255,255,255,0.15)' :
                    auditResult.percentage >= 90 ? 'rgba(16, 185, 129, 0.45)' :
                    auditResult.percentage >= 70 ? 'rgba(245, 158, 11, 0.45)' :
                    'rgba(239, 68, 68, 0.45)'
                  }`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                }}>
                  {/* Header de la Tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px' }}>📋</span>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>
                          Auditoría de Calidad Técnica PAEC (23 Criterios DBEPA/NEM)
                        </h3>
                      </div>
                      <p style={{ color: 'rgba(240,244,255,0.65)', fontSize: '13px', margin: '4px 0 0' }}>
                        Evaluación integral de rigor normativo, FODA, transversalidad UAC, cronograma macro, plan de relevos y anexos.
                      </p>
                    </div>

                    <button
                      onClick={() => projectId && fetchAudit(projectId)}
                      disabled={loadingAudit}
                      className="btn btn-ghost btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#f0f4ff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: loadingAudit ? 'not-allowed' : 'pointer'
                      }}
                      title="Volver a ejecutar auditoría de calidad"
                    >
                      {loadingAudit ? (
                        <>
                          <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          Auditando...
                        </>
                      ) : (
                        <>🔄 Re-auditar</>
                      )}
                    </button>
                  </div>

                  {/* Estado Cargando */}
                  {loadingAudit && !auditResult && (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(240,244,255,0.7)' }}>
                      <span className="spinner" style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <p style={{ marginTop: '12px', fontSize: '14px' }}>Ejecutando evaluación de los 23 criterios DBEPA/NEM...</p>
                    </div>
                  )}

                  {/* Estado Error */}
                  {auditError && !auditResult && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '8px', color: '#fca5a5' }}>
                      <div style={{ fontWeight: 600, marginBottom: '6px' }}>Error al obtener la auditoría:</div>
                      <div style={{ fontSize: '13px' }}>{auditError}</div>
                      <button
                        onClick={() => projectId && fetchAudit(projectId)}
                        className="btn btn-sm"
                        style={{ marginTop: '10px', background: '#ef4444', color: '#fff', border: 'none' }}
                      >
                        Reintentar Auditoría
                      </button>
                    </div>
                  )}

                  {/* Visualización de Resultados */}
                  {auditResult && (() => {
                    const scorePct = Math.round(auditResult.percentage);
                    const isGreen = scorePct >= 90;
                    const isYellow = scorePct >= 70 && scorePct < 90;
                    const isRed = scorePct < 70;

                    const semaforoColor = isGreen ? '#10b981' : isYellow ? '#f59e0b' : '#ef4444';
                    const semaforoBg = isGreen ? 'rgba(16, 185, 129, 0.12)' : isYellow ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                    const semaforoBorder = isGreen ? 'rgba(16, 185, 129, 0.4)' : isYellow ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';

                    const statusTitle = auditResult.status === 'aprobado_excelente'
                      ? 'Aprobado con Excelencia'
                      : auditResult.status === 'aprobado'
                      ? 'Aprobado'
                      : 'Requiere Ajustes';

                    const deficientCount = auditResult.summary.failedCount;
                    const warningCount = auditResult.summary.warningCount;
                    const attentionTotal = deficientCount + warningCount;

                    const criteriaToRender = auditFilter === 'deficient'
                      ? auditResult.criteria.filter(c => c.status === 'fail' || c.status === 'warning')
                      : auditResult.criteria;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Semáforo Visual & Bloque de Puntaje */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '16px',
                          alignItems: 'center',
                          background: semaforoBg,
                          border: `1px solid ${semaforoBorder}`,
                          padding: '20px',
                          borderRadius: '10px'
                        }}>
                          {/* Semáforo Físico & Puntaje Grande */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {/* Dispositivo de Semáforo con 3 luces */}
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              background: '#090d1a',
                              padding: '8px 10px',
                              borderRadius: '20px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
                            }}>
                              {/* Luz Verde */}
                              <div
                                title="Verde (≥90): Aprobado con Excelencia"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: isGreen ? '#10b981' : '#064e3b',
                                  boxShadow: isGreen ? '0 0 12px #10b981, 0 0 4px #10b981' : 'none',
                                  border: '1px solid rgba(0,0,0,0.5)',
                                  transition: 'all 0.3s ease'
                                }}
                              />
                              {/* Luz Amarilla */}
                              <div
                                title="Amarillo (70-89): Aprobado con Observaciones"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: isYellow ? '#f59e0b' : '#78350f',
                                  boxShadow: isYellow ? '0 0 12px #f59e0b, 0 0 4px #f59e0b' : 'none',
                                  border: '1px solid rgba(0,0,0,0.5)',
                                  transition: 'all 0.3s ease'
                                }}
                              />
                              {/* Luz Roja */}
                              <div
                                title="Rojo (<70): Requiere Ajustes"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: isRed ? '#ef4444' : '#7f1d1d',
                                  boxShadow: isRed ? '0 0 12px #ef4444, 0 0 4px #ef4444' : 'none',
                                  border: '1px solid rgba(0,0,0,0.5)',
                                  transition: 'all 0.3s ease'
                                }}
                              />
                            </div>

                            {/* Puntaje y Estatus */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '38px', fontWeight: 800, color: semaforoColor, lineHeight: 1 }}>
                                  {scorePct}%
                                </span>
                                <span style={{ fontSize: '14px', color: 'rgba(240,244,255,0.6)', fontWeight: 500 }}>
                                  ({auditResult.totalScore} / 92 pts)
                                </span>
                              </div>
                              <div style={{ marginTop: '6px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  background: semaforoColor,
                                  color: '#fff',
                                  letterSpacing: '0.3px',
                                  textTransform: 'uppercase'
                                }}>
                                  {isGreen ? '🟢 ' : isYellow ? '🟡 ' : '🔴 '}
                                  {statusTitle}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 3 Contadores de Criterios */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{auditResult.summary.passedCount}</div>
                              <div style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 600 }}>Pasados</div>
                            </div>
                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>{auditResult.summary.warningCount}</div>
                              <div style={{ fontSize: '11px', color: '#fcd34d', fontWeight: 600 }}>Advertencias</div>
                            </div>
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>{auditResult.summary.failedCount}</div>
                              <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>Fallidos</div>
                            </div>
                          </div>
                        </div>

                        {/* Botones de Control y Expansión */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {auditResult.status === 'requiere_ajustes' ? (
                              <button
                                onClick={() => {
                                  setShowAuditDetails(!showAuditDetails);
                                  setAuditFilter('deficient');
                                }}
                                className="btn btn-sm"
                                style={{
                                  backgroundColor: showAuditDetails && auditFilter === 'deficient' ? '#ef4444' : 'rgba(239,68,68,0.2)',
                                  color: '#fff',
                                  border: '1px solid rgba(239,68,68,0.5)',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                <span>{showAuditDetails && auditFilter === 'deficient' ? '▲ Ocultar criterios deficientes' : `⚠️ Ver criterios deficientes (${attentionTotal})`}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowAuditDetails(!showAuditDetails);
                                  if (!showAuditDetails) setAuditFilter('all');
                                }}
                                className="btn btn-sm"
                                style={{
                                  backgroundColor: showAuditDetails ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)',
                                  color: '#a5b4fc',
                                  border: '1px solid rgba(99,102,241,0.4)',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {showAuditDetails ? '▲ Ocultar desglose de criterios' : '🔍 Ver desglose de criterios'}
                              </button>
                            )}

                            {showAuditDetails && (
                              <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <button
                                  onClick={() => setAuditFilter('deficient')}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '11.5px',
                                    background: auditFilter === 'deficient' ? 'rgba(239,68,68,0.3)' : 'transparent',
                                    color: auditFilter === 'deficient' ? '#fca5a5' : 'rgba(240,244,255,0.6)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: auditFilter === 'deficient' ? 700 : 400
                                  }}
                                >
                                  Solo Deficientes / Advertencias ({attentionTotal})
                                </button>
                                <button
                                  onClick={() => setAuditFilter('all')}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '11.5px',
                                    background: auditFilter === 'all' ? 'rgba(99,102,241,0.3)' : 'transparent',
                                    color: auditFilter === 'all' ? '#a5b4fc' : 'rgba(240,244,255,0.6)',
                                    border: 'none',
                                    borderLeft: '1px solid rgba(255,255,255,0.15)',
                                    cursor: 'pointer',
                                    fontWeight: auditFilter === 'all' ? 700 : 400
                                  }}
                                >
                                  Todos los 23 Criterios
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)' }}>
                            {isGreen && '✓ El proyecto cumple plenamente los estándares pedagógicos DBEPA.'}
                            {isYellow && '⚠️ Se recomiendan ajustes menores antes de la difusión oficial.'}
                            {isRed && '❗ Se requiere subsanar los criterios en rojo para cumplir la normativa NEM.'}
                          </div>
                        </div>

                        {/* Listado Desplegable de Criterios */}
                        {showAuditDetails && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                            {criteriaToRender.length === 0 ? (
                              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', color: '#6ee7b7' }}>
                                🎉 ¡Excelente! No se encontraron criterios deficientes ni advertencias en este proyecto.
                              </div>
                            ) : (
                              criteriaToRender.map((c) => {
                                const isPass = c.status === 'pass';
                                const isWarn = c.status === 'warning';
                                const cardBorder = isPass ? 'rgba(16,185,129,0.3)' : isWarn ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
                                const cardBg = isPass ? 'rgba(16,185,129,0.05)' : isWarn ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)';
                                const badgeBg = isPass ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';

                                return (
                                  <div
                                    key={c.id}
                                    style={{
                                      padding: '12px 14px',
                                      borderRadius: '8px',
                                      background: cardBg,
                                      border: `1px solid ${cardBorder}`,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, color: '#f0f4ff', fontSize: '13px' }}>
                                          Criterio {c.id}: {c.name}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'rgba(240,244,255,0.5)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                          {c.dimension}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.7)' }}>
                                          Puntaje: <strong>{c.score}/4</strong> ({c.expectedLevel})
                                        </span>
                                        <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '10px', background: badgeBg, color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
                                          {isPass ? 'Cumple' : isWarn ? 'Advertencia' : 'Deficiente'}
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{ fontSize: '12.5px', color: 'rgba(240,244,255,0.85)', lineHeight: 1.4 }}>
                                      <strong style={{ color: isPass ? '#6ee7b7' : isWarn ? '#fde68a' : '#fca5a5' }}>Feedback: </strong>
                                      {c.feedback}
                                    </div>

                                    <div style={{ fontSize: '11.5px', color: 'rgba(240,244,255,0.5)', fontStyle: 'italic' }}>
                                      <strong>Evidencia encontrada: </strong>{c.evidenceFound}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Navigation / Next actions */}
            <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--c-border)', paddingTop: '16px' }}>
              {activeStep > 1 && (
                <button
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="btn btn-ghost"
                >
                  ← Fase Anterior
                </button>
              )}
              
              {activeStep < 7 ? (
                <button
                  onClick={() => {
                    setActiveStep(activeStep + 1);
                    setError(null);
                  }}
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
                  disabled={project.currentStep < activeStep + 1 && !isStepGenerated(activeStep + 1)}
                >
                  Siguiente Fase (Paso {activeStep + 1}) →
                </button>
              ) : (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: '#28a745', fontWeight: 600 }}>🎉 ¡Proyecto PAEC-PEC Completo!</span>
                  <a href={`/api/docx/paec/${projectId}`} className="btn btn-amber" style={{ backgroundColor: 'var(--c-amber)', color: '#fff' }}>
                    Descargar Proyecto Completo (Word)
                  </a>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
