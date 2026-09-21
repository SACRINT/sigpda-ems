'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string; label: string; provider: string; model_default: string | null;
  key_preview: string; is_active: boolean; priority: number;
  usage_count: number; error_count: number; last_used_at: string | null;
  last_error_at: string | null;
}
interface PlatformConfig { [key: string]: string; }
interface Stats {
  totals: { teachers: number; plannings: number; paec: number; pmc: number; todayActivity: number };
  activityByDay: { date: string; count: number; action: string }[];
  providerStats: { provider_used: string; model_used: string; count: number; successes: number; failures: number }[];
  topUsers: { teacher_email: string; total_actions: number }[];
}
interface Teacher {
  id: string; name: string; email: string; school_name: string;
  planning_count: number; paec_count: number; pmc_count: number;
  doc_count: number; last_active: string | null; last_seen_at?: string | null; is_blocked: boolean;
  role: string; is_premium: boolean;
}
interface Prompt { id: string; label: string; content: string; is_active: boolean; updated_at: string; updated_by: string | null; }
interface UserDoc { id: string; teacher_email: string; doc_type: string; label: string; uac_name: string | null; file_name: string | null; used_count: number; created_at: string; }
interface ActivityEntry { id: string; teacher_email: string; action: string; provider_used: string | null; model_used: string | null; success: boolean; error_msg: string | null; created_at: string; }
interface NormativaArticulo { id: string; numero: string; texto: string; aplicable_a: string[]; orden_en_doc: number; }
interface NormativaDoc { id: string; titulo: string; tipo: string; fuente: string | null; vigente: boolean; orden_display: number; created_at: string; articulos: NormativaArticulo[]; }
interface NormativaStats { total_documentos: number; total_articulos: number; arts_pmc: number; arts_paec: number; arts_pips: number; arts_planeacion: number; }

export interface ProgramItem {
  id: string;
  uac_name: string;
  semester: number;
  component: string;
  curriculum_name?: string | null;
  year?: number;
  total_hours: number;
  learning_outcome: string;
  activities: { name: string; hours: number; order?: number }[];
  evidences: string[];
  contenidos_formativos?: { proposito: string; contenidos: string[] }[];
  subsystem: string;
  model_type: string;
  created_at?: string;
}

export interface AuditItem {
  planning_id: string;
  teacher_id: string;
  uac_name: string;
  semester: number;
  component: string;
  curriculum_name?: string | null;
  planning_status: string;
  planning_created_at: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  school_name?: string | null;
  audit_id: string | null;
  overall_score: number | null;
  compliance_level: string | null;
  dimension_scores: {
    propositos_alineacion?: { score: number; weight: number; status: string; feedback: string };
    cobertura_contenidos?: { score: number; weight: number; status: string; feedback: string };
    secuenciacion_logica?: { score: number; weight: number; status: string; feedback: string };
    adecuacion_evidencias?: { score: number; weight: number; status: string; feedback: string };
  } | null;
  findings: {
    fortalezas?: string[];
    desalineaciones?: string[];
    omisiones_detectadas?: string[];
    propositos_cubiertos?: string[];
    propositos_omitidos?: string[];
  } | null;
  recommendations: {
    dimension?: string;
    severidad?: string;
    mensaje: string;
  }[] | null;
  audited_by?: string | null;
  audited_at?: string | null;
}

export interface AuditStats {
  total_plannings: number;
  total_audited: number;
  average_score: number;
  excelente_count: number;
  satisfactorio_count: number;
  requiere_mejora_count: number;
  no_alineado_count: number;
}

export interface ScheduleItem {
  id: string;
  teacher_id: string;
  title: string;
  school_name?: string | null;
  cct?: string | null;
  cycle_year?: string | null;
  period?: string | null;
  status: string;
  config: any;
  grupos: any[];
  docentes: any[];
  aulas: any[];
  cargas: any[];
  celdas: any[];
  metricas?: any;
  ai_optimization_log?: any[];
  created_at: string;
  updated_at: string;
}

const PROVIDERS = ['gemini', 'claude', 'openai', 'nvidia', 'qwen', 'mistral', 'openrouter'];

// Modelos disponibles por proveedor para USO ESTÁNDAR (cuota gratuita masiva 500 RPD / 15 RPM)
const STANDARD_MODELS: Record<string, { id: string; label: string }[]> = {
  gemini:  [
    { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite — 500 RPD / 15 RPM ✓' },
    { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite — 500 RPD / 15 RPM ✓' },
  ],
  claude:  [{ id: 'claude-haiku-4-5', label: 'claude-haiku-4-5 — 50 RPD (free tier)' }],
  openai:  [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini — Free tier limitado' },
    { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo — Free tier limitado' },
  ],
  nvidia:  [
    { id: 'meta/llama-3.1-70b-instruct', label: 'llama-3.1-70b — 40 RPM / 1000 RPD (free)' },
    { id: 'microsoft/phi-3-mini-4k-instruct', label: 'phi-3-mini — 40 RPM / 1000 RPD (free)' },
  ],
  qwen:    [{ id: 'qwen-turbo', label: 'qwen-turbo — Free tier' }],
  mistral: [{ id: 'mistral-small-latest', label: 'mistral-small-latest — Free tier' }],
  openrouter: [
    { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'llama-3.1-8b — Gratis (OpenRouter)' },
    { id: 'mistralai/mistral-7b-instruct:free', label: 'mistral-7b — Gratis (OpenRouter)' },
    { id: 'deepseek/deepseek-r1:free', label: 'deepseek-r1 — Gratis (OpenRouter)' },
  ],
};

// Modelos disponibles por proveedor para USO PREMIUM (APIs de paga / avanzadas)
const PREMIUM_MODELS: Record<string, { id: string; label: string }[]> = {
  gemini: [
    { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite — 500 RPD / 15 RPM (Autorizado)' },
    { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite — 500 RPD / 15 RPM (Autorizado)' },
  ],
  claude: [
    { id: 'claude-haiku-4-5',   label: 'claude-haiku-4-5 — 50 RPD (free) / ∞ con API key' },
    { id: 'claude-sonnet-4-5',  label: 'claude-sonnet-4-5 — API de paga' },
    { id: 'claude-opus-4-5',    label: 'claude-opus-4-5 — API de paga (más capaz)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini — API de paga (económico)' },
    { id: 'gpt-4o',      label: 'gpt-4o — API de paga (avanzado)' },
    { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo — API de paga (rápido)' },
  ],
  nvidia: [
    { id: 'meta/llama-3.1-70b-instruct',       label: 'llama-3.1-70b — 40 RPM / 1000 RPD (free)' },
    { id: 'microsoft/phi-3-mini-4k-instruct',  label: 'phi-3-mini — 40 RPM / 1000 RPD (free)' },
  ],
  qwen: [
    { id: 'qwen-turbo', label: 'qwen-turbo — Free tier' },
    { id: 'qwen-plus',  label: 'qwen-plus — API de paga' },
    { id: 'qwen-max',   label: 'qwen-max — API de paga (más capaz)' },
  ],
  mistral: [
    { id: 'mistral-small-latest', label: 'mistral-small-latest — Free tier' },
    { id: 'mistral-large-latest', label: 'mistral-large-latest — API de paga' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.1-8b-instruct:free',     label: 'llama-3.1-8b — Gratis' },
    { id: 'mistralai/mistral-7b-instruct:free',        label: 'mistral-7b — Gratis' },
    { id: 'deepseek/deepseek-r1:free',                 label: 'deepseek-r1 — Gratis' },
    { id: 'anthropic/claude-sonnet-4-5',               label: 'claude-sonnet-4-5 — De paga' },
    { id: 'openai/gpt-4o',                             label: 'gpt-4o — De paga' },
  ],
};

// Alias para formulario de agregar key
const MODELS = PREMIUM_MODELS;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A user is considered "active" only if they had activity in the last 30 minutes */
function isRecentlyActive(lastActive: string | null): boolean {
  if (!lastActive) return false;
  return (Date.now() - new Date(lastActive).getTime()) < 30 * 60 * 1000;
}

/** A user is considered "online" (connected right now) if heartbeat received in last 5 min */
function isUserOnline(lastSeenAt?: string | null): boolean {
  if (!lastSeenAt) return false;
  return (Date.now() - new Date(lastSeenAt).getTime()) < 5 * 60 * 1000;
}

function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Hace un momento';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
  return `Hace ${Math.floor(diff / 86400000)} días`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminClient({ locale, adminEmail }: { locale: string; adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<'keys' | 'config' | 'users' | 'stats' | 'prompts' | 'docs' | 'activity' | 'normativa' | 'curricula' | 'audits' | 'schedules'>('stats');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Data states
  const [keys, setKeys]       = useState<ApiKey[]>([]);
  const [config, setConfig]   = useState<PlatformConfig>({});
  const [stats, setStats]     = useState<Stats | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [adminDocs, setAdminDocs] = useState<UserDoc[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [normativaDocs, setNormativaDocs] = useState<NormativaDoc[]>([]);
  const [normativaStats, setNormativaStats] = useState<NormativaStats | null>(null);
  const [normativaSearch, setNormativaSearch] = useState('');
  const [normativaTypeFilter, setNormativaTypeFilter] = useState('todos');
  const [normativaVigenteFilter, setNormativaVigenteFilter] = useState<'todos' | 'vigentes' | 'no_vigentes'>('todos');
  const [normativaGenFilter, setNormativaGenFilter] = useState('todos');
  const [selectedNormativaDoc, setSelectedNormativaDoc] = useState<NormativaDoc | null>(null);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ titulo: '', tipo: 'ley_general', fuente: '', orden_display: 0, vigente: true });
  const [showNewArtModal, setShowNewArtModal] = useState(false);
  const [newArtForm, setNewArtForm] = useState<{ documento_id: string; numero: string; texto: string; aplicable_a: string[]; orden_en_doc: number }>({
    documento_id: '', numero: '', texto: '', aplicable_a: ['pmc', 'paec', 'pips', 'planeacion'], orden_en_doc: 0
  });
  const [editingArt, setEditingArt] = useState<NormativaArticulo | null>(null);
  const [artSearch, setArtSearch] = useState('');
  const [seedingNormativa, setSeedingNormativa] = useState(false);
  const [normativaDefaultInfo, setNormativaDefaultInfo] = useState<{ saved_at: string; vigentes: number; total: number } | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [resettingDefault, setResettingDefault] = useState(false);

  // ── Curricula & Programs states ──
  const [curriculaPrograms, setCurriculaPrograms] = useState<ProgramItem[]>([]);
  const [curriculaLoading, setCurriculaLoading] = useState(false);
  const [curriculaViewMode, setCurriculaViewMode] = useState<'malla' | 'tabla'>('malla');
  const [curriculaSubsystem, setCurriculaSubsystem] = useState('todos');
  const [curriculaSemester, setCurriculaSemester] = useState('todos');
  const [curriculaComponent, setCurriculaComponent] = useState('todos');
  const [curriculaSearch, setCurriculaSearch] = useState('');
  const [selectedProgramDetail, setSelectedProgramDetail] = useState<ProgramItem | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramItem | null>(null);
  const [programForm, setProgramForm] = useState<{
    id?: string;
    uac_name: string;
    semester: number;
    component: string;
    curriculum_name: string;
    total_hours: number;
    learning_outcome: string;
    subsystem: string;
    model_type: string;
    activities: { name: string; hours: number; order?: number }[];
    evidences: string[];
    contenidos_formativos: { proposito: string; contenidos: string[] }[];
  }>({
    uac_name: '',
    semester: 1,
    component: 'fundamental',
    curriculum_name: '',
    total_hours: 54,
    learning_outcome: '',
    subsystem: 'bge',
    model_type: 'propositos_contenidos',
    activities: [{ name: '', hours: 18, order: 1 }],
    evidences: [''],
    contenidos_formativos: [{ proposito: '', contenidos: [''] }]
  });

  // Extract PDF Modal
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractTargetProgram, setExtractTargetProgram] = useState<ProgramItem | null>(null);
  const [extractPdfFile, setExtractPdfFile] = useState<File | null>(null);
  const [extractSubsystem, setExtractSubsystem] = useState('bge');
  const [extractSemester, setExtractSemester] = useState(1);
  const [extractComponent, setExtractComponent] = useState('fundamental');
  const [extracting, setExtracting] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<any | null>(null);

  // ── Audits & Pedagogical Alignment states (Fase 2 + UX Fase 4) ──
  const [auditPlannings, setAuditPlannings] = useState<AuditItem[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditingPlanningId, setAuditingPlanningId] = useState<string | null>(null);
  const [selectedAuditScorecard, setSelectedAuditScorecard] = useState<AuditItem | null>(null);
  const [auditViewMode, setAuditViewMode] = useState<'tabla' | 'calendario' | 'comparativa'>('tabla');
  const [auditFilterCompliance, setAuditFilterCompliance] = useState<string>('todos');
  const [auditFilterSemester, setAuditFilterSemester] = useState<string>('todos');
  const [auditFilterTeacher, setAuditFilterTeacher] = useState<string>('todos');
  const [auditFilterComponent, setAuditFilterComponent] = useState<string>('todos');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [comparePlanning, setComparePlanning] = useState<AuditItem | null>(null);

  // ── Schedules & School Distribution states (Fase 4) ──
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [optimizingScheduleId, setOptimizingScheduleId] = useState<string | null>(null);
  const [selectedScheduleLog, setSelectedScheduleLog] = useState<ScheduleItem | null>(null);

  // Form states
  const [newKey, setNewKey] = useState({ label: '', provider: 'gemini', apiKey: '', modelDefault: '' });
  const [editPromptId, setEditPromptId] = useState<string | null>(null);
  const [editPromptContent, setEditPromptContent] = useState('');
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [seedingPrompts, setSeedingPrompts] = useState(false);

  // Key test states
  const [keyTestResults, setKeyTestResults] = useState<Record<string, { ok: boolean; latencyMs: number; message: string }>>({});
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [testingAll, setTestingAll] = useState(false);

  // ── Data fetchers ────────────────────────────────────────────────────────

  const showMsg = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  const loadKeys    = useCallback(() => fetch('/api/admin/api-keys').then(r => r.json()).then(d => setKeys(d.keys || [])), []);
  const loadConfig  = useCallback(() => fetch('/api/admin/config').then(r => r.json()).then(d => setConfig(d.config || {})), []);
  const loadStats   = useCallback(() => fetch('/api/admin/stats').then(r => r.json()).then(d => setStats(d)), []);
  const loadTeachers = useCallback(() => fetch('/api/admin/users').then(r => r.json()).then(d => setTeachers(d.teachers || [])), []);
  const loadPrompts = useCallback(() => fetch('/api/admin/prompts').then(r => r.json()).then(d => setPrompts(d.prompts || [])), []);
  const loadDocs    = useCallback(() => fetch('/api/admin/documents').then(r => r.json()).then(d => setAdminDocs(d.documents || [])), []);
  const loadActivity = useCallback(() => fetch('/api/admin/activity').then(r => r.json()).then(d => setActivity(d.activity || [])), []);
  const loadNormativa = useCallback(async () => {
    const r = await fetch('/api/admin/normativa');
    const d = await r.json();
    setNormativaDocs(d.documentos || []);
    setNormativaStats(d.stats || null);
    try {
      const rc = await fetch('/api/admin/normativa?action=get_default');
      const dc = await rc.json();
      if (dc.snapshot) {
        setNormativaDefaultInfo({
          saved_at: dc.snapshot.saved_at,
          vigentes: dc.snapshot.vigentes?.length || 0,
          total: dc.snapshot.total || 0,
        });
      } else {
        setNormativaDefaultInfo(null);
      }
    } catch { /* sin snapshot */ }
  }, []);

  const loadCurricula = useCallback(async () => {
    setCurriculaLoading(true);
    try {
      const r = await fetch('/api/admin/programs');
      const d = await r.json();
      setCurriculaPrograms(d.programs || []);
    } catch {
      showMsg('Error al cargar catálogo curricular', false);
    } finally {
      setCurriculaLoading(false);
    }
  }, []);

  const loadAudits = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditFilterCompliance !== 'todos') params.append('compliance', auditFilterCompliance);
      if (auditFilterSemester !== 'todos') params.append('semester', auditFilterSemester);
      if (auditSearch.trim()) params.append('search', auditSearch.trim());

      const r = await fetch(`/api/audit?${params.toString()}`);
      const d = await r.json();
      if (r.ok) {
        setAuditPlannings(d.plannings || []);
        setAuditStats(d.stats || null);
      } else {
        showMsg(d.error || 'Error al cargar auditorías', false);
      }
    } catch {
      showMsg('Error de red al cargar auditorías', false);
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilterCompliance, auditFilterSemester, auditSearch]);

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    try {
      const r = await fetch('/api/schedules');
      const d = await r.json();
      if (r.ok) {
        setSchedules(d.schedules || []);
      } else {
        showMsg(d.error || 'Error al cargar horarios escolares', false);
      }
    } catch {
      showMsg('Error de red al cargar horarios', false);
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  async function handleOptimizeSchedule(id: string) {
    setOptimizingScheduleId(id);
    try {
      const r = await fetch(`/api/schedules/${id}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPremium: true })
      });
      const d = await r.json();
      if (r.ok && d.schedule) {
        showMsg(`¡Horario optimizado con éxito! Conflicto residual: ${d.optimization?.conflictos_finales ?? 0}, Score: ${d.optimization?.score_calidad ?? 100}% ✓`);
        await loadSchedules();
      } else {
        showMsg(d.error || 'Error al optimizar horario con IA', false);
      }
    } catch {
      showMsg('Error de red al optimizar horario', false);
    } finally {
      setOptimizingScheduleId(null);
    }
  }

  async function handleDeleteSchedule(id: string, title: string) {
    if (!confirm(`¿Estás seguro de eliminar la plantilla de horario "${title}"?`)) return;
    try {
      const r = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (r.ok) {
        if (selectedScheduleLog?.id === id) setSelectedScheduleLog(null);
        loadSchedules();
        showMsg('Horario escolar eliminado ✓');
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al eliminar horario', false);
      }
    } catch {
      showMsg('Error de red al eliminar', false);
    }
  }

  async function handleRunAudit(planningId: string) {
    setAuditingPlanningId(planningId);
    try {
      const r = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId, isPremium: true })
      });
      const d = await r.json();
      if (r.ok && d.report) {
        showMsg(`¡Auditoría completada! Puntuación: ${d.report.overall_score}/100 (${d.report.compliance_level?.toUpperCase()}) ✓`);
        await loadAudits();
        // Mostrar scorecard de inmediato
        const target = auditPlannings.find(p => p.planning_id === planningId);
        setSelectedAuditScorecard({
          planning_id: planningId,
          teacher_id: target?.teacher_id || '',
          uac_name: d.report.uac_name || target?.uac_name || '',
          semester: d.report.semester || target?.semester || 1,
          component: d.report.component || target?.component || 'fundamental',
          curriculum_name: target?.curriculum_name,
          planning_status: target?.planning_status || 'completed',
          planning_created_at: target?.planning_created_at || new Date().toISOString(),
          teacher_name: target?.teacher_name,
          teacher_email: target?.teacher_email,
          school_name: target?.school_name,
          audit_id: d.report.id,
          overall_score: d.report.overall_score,
          compliance_level: d.report.compliance_level,
          dimension_scores: d.report.dimension_scores,
          findings: d.report.findings,
          recommendations: d.report.recommendations,
          audited_by: d.report.audited_by,
          audited_at: d.report.created_at || new Date().toISOString()
        });
      } else {
        showMsg(d.error || 'Error al ejecutar la auditoría con IA', false);
      }
    } catch {
      showMsg('Error de conexión al ejecutar auditoría', false);
    } finally {
      setAuditingPlanningId(null);
    }
  }

  async function handleDeleteAudit(auditId: string) {
    if (!confirm('¿Eliminar esta auditoría? Podrás volver a auditar la planeación cuando lo desees.')) return;
    try {
      const r = await fetch(`/api/audit/${auditId}`, { method: 'DELETE' });
      if (r.ok) {
        if (selectedAuditScorecard?.audit_id === auditId) setSelectedAuditScorecard(null);
        loadAudits();
        showMsg('Auditoría eliminada ✓');
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al eliminar auditoría', false);
      }
    } catch {
      showMsg('Error de red al eliminar', false);
    }
  }

  useEffect(() => {
    loadStats();
    loadConfig();
    loadKeys();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') { loadTeachers().then(() => setUsersLoaded(true)); }
    if (activeTab === 'prompts') loadPrompts();
    if (activeTab === 'docs') loadDocs();
    if (activeTab === 'activity') loadActivity();
    if (activeTab === 'normativa') loadNormativa();
    if (activeTab === 'curricula') loadCurricula();
    if (activeTab === 'audits') loadAudits();
    if (activeTab === 'schedules') loadSchedules();
  }, [activeTab, loadCurricula, loadAudits, loadSchedules]);

  // ── Acciones Catálogo Curricular (Malla y Programas) ───────────────────────
  function handleOpenNewProgramModal() {
    setEditingProgram(null);
    setProgramForm({
      uac_name: '',
      semester: 1,
      component: 'fundamental',
      curriculum_name: '',
      total_hours: 54,
      learning_outcome: '',
      subsystem: 'bge',
      model_type: 'propositos_contenidos',
      activities: [{ name: 'Propósito Formativo 1', hours: 18, order: 1 }],
      evidences: ['Evidencia de aprendizaje / Producto'],
      contenidos_formativos: [{ proposito: 'Propósito Formativo 1', contenidos: ['Tema o contenido formativo 1'] }]
    });
    setShowProgramModal(true);
  }

  function handleOpenEditProgramModal(p: ProgramItem) {
    setEditingProgram(p);
    setProgramForm({
      id: p.id,
      uac_name: p.uac_name,
      semester: p.semester,
      component: p.component,
      curriculum_name: p.curriculum_name || '',
      total_hours: p.total_hours,
      learning_outcome: p.learning_outcome || '',
      subsystem: p.subsystem || 'bge',
      model_type: p.model_type || (p.semester >= 5 ? 'progresiones' : 'propositos_contenidos'),
      activities: Array.isArray(p.activities) && p.activities.length > 0 ? p.activities : [{ name: '', hours: 18, order: 1 }],
      evidences: Array.isArray(p.evidences) && p.evidences.length > 0 ? p.evidences : [''],
      contenidos_formativos: Array.isArray(p.contenidos_formativos) && p.contenidos_formativos.length > 0
        ? p.contenidos_formativos
        : [{ proposito: '', contenidos: [''] }]
    });
    setShowProgramModal(true);
  }

  async function handleSaveProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!programForm.uac_name.trim()) return showMsg('El nombre de la UAC es obligatorio', false);
    setSaving(true);
    try {
      const method = editingProgram ? 'PUT' : 'POST';
      const body = editingProgram ? { ...programForm, id: editingProgram.id } : programForm;
      const r = await fetch('/api/admin/programs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        setShowProgramModal(false);
        loadCurricula();
        showMsg(editingProgram ? 'Programa actualizado correctamente ✓' : 'Nuevo programa registrado en el catálogo ✓');
      } else {
        showMsg(d.error || 'Error al guardar programa', false);
      }
    } catch {
      showMsg('Error de conexión al servidor', false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProgram(id: string, name: string) {
    if (!confirm(`¿Estás seguro de eliminar el programa "${name}" del catálogo?`)) return;
    try {
      const r = await fetch(`/api/admin/programs?id=${id}`, { method: 'DELETE' });
      if (r.ok) {
        loadCurricula();
        showMsg('Programa eliminado del catálogo ✓');
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al eliminar', false);
      }
    } catch {
      showMsg('Error de red', false);
    }
  }

  function handleOpenReplaceProgramModal(p: ProgramItem) {
    setExtractTargetProgram(p);
    setExtractSubsystem(p.subsystem || 'bge');
    setExtractSemester(p.semester || 1);
    setExtractComponent(p.component || 'fundamental');
    setExtractPdfFile(null);
    setExtractedPreview(null);
    setShowExtractModal(true);
  }

  async function handleExtractPdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!extractPdfFile) return showMsg('Selecciona un archivo PDF', false);
    setExtracting(true);
    setExtractedPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', extractPdfFile);
      fd.append('subsystem', extractSubsystem);
      fd.append('semester', String(extractSemester));
      fd.append('component', extractComponent);

      const r = await fetch('/api/admin/programs/extract', {
        method: 'POST',
        body: fd,
      });
      const d = await r.json();
      if (r.ok && d.extracted) {
        // If we are replacing an existing program, preserve its ID and target name
        if (extractTargetProgram) {
          d.extracted.id = extractTargetProgram.id;
          d.extracted.uac_name = extractTargetProgram.uac_name;
        }
        setExtractedPreview(d.extracted);
        showMsg('PDF analizado y estructurado con IA ✓ Revisa la vista previa y confirma el reemplazo.');
      } else {
        showMsg(d.error || 'No se pudo extraer la información del PDF', false);
      }
    } catch {
      showMsg('Error al comunicarse con el extractor de PDF', false);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveExtractedToCatalog() {
    if (!extractedPreview) return;
    setSaving(true);
    try {
      const isReplacing = !!extractTargetProgram;
      const method = isReplacing ? 'PUT' : 'POST';
      const payload = isReplacing
        ? { ...extractedPreview, id: extractTargetProgram.id, uac_name: extractTargetProgram.uac_name }
        : extractedPreview;

      const r = await fetch('/api/admin/programs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        setShowExtractModal(false);
        setExtractedPreview(null);
        setExtractPdfFile(null);
        setExtractTargetProgram(null);
        loadCurricula();
        showMsg(isReplacing ? `¡Programa "${payload.uac_name}" actualizado y reemplazado con el nuevo PDF! ✓` : '¡Programa oficial guardado exitosamente en el catálogo! ✓');
      } else {
        showMsg(d.error || 'Error al guardar el programa extraído', false);
      }
    } catch {
      showMsg('Error de red al guardar', false);
    } finally {
      setSaving(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function saveConfig(updates: Record<string, string>) {
    setSaving(true);
    const r = await fetch('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    setSaving(false);
    if (r.ok) { setConfig(c => ({ ...c, ...updates })); showMsg('Configuración guardada ✓'); }
    else showMsg('Error al guardar', false);
  }

  async function toggleUserPremium(teacherId: string, isPremium: boolean) {
    await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, isPremium }) });
    loadTeachers(); showMsg(isPremium ? '⭐ Acceso Premium activado' : '⚡ Revertido a Estándar');
  }

  async function addKey() {
    if (!newKey.label || !newKey.provider || !newKey.apiKey) return showMsg('Completa todos los campos', false);
    setSaving(true);
    const r = await fetch('/api/admin/api-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newKey.label, provider: newKey.provider, apiKey: newKey.apiKey, modelDefault: newKey.modelDefault }),
    });
    setSaving(false);
    if (r.ok) { setNewKey({ label: '', provider: 'gemini', apiKey: '', modelDefault: '' }); loadKeys(); showMsg('API Key agregada y cifrada ✓'); }
    else { const d = await r.json(); showMsg(d.error || 'Error', false); }
  }

  async function toggleKey(id: string, isActive: boolean) {
    await fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive }) });
    loadKeys();
  }

  async function deleteKey(id: string) {
    if (!confirm('¿Eliminar esta API Key?')) return;
    await fetch('/api/admin/api-keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadKeys(); showMsg('Key eliminada');
  }

  async function movePriority(id: string, dir: 'up' | 'down') {
    const sorted = [...keys].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(k => k.id === id);
    const swap = dir === 'up' ? sorted[idx - 1] : sorted[idx + 1];
    if (!swap) return;
    await Promise.all([
      fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, priority: swap.priority }) }),
      fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swap.id, priority: sorted[idx].priority }) }),
    ]);
    loadKeys();
  }

  async function testKey(id: string) {
    setTestingKeys(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/admin/api-keys/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setKeyTestResults(prev => ({ ...prev, [id]: { ok: data.ok, latencyMs: data.latencyMs, message: data.message } }));
    } catch {
      setKeyTestResults(prev => ({ ...prev, [id]: { ok: false, latencyMs: 0, message: 'Error de red' } }));
    } finally {
      setTestingKeys(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function testAllKeys() {
    setTestingAll(true);
    setKeyTestResults({});
    try {
      const res = await fetch('/api/admin/api-keys/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testAll: true }),
      });
      const data = await res.json();
      if (data.results) {
        const map: Record<string, { ok: boolean; latencyMs: number; message: string }> = {};
        for (const r of data.results) map[r.id] = { ok: r.ok, latencyMs: r.latencyMs, message: r.message };
        setKeyTestResults(map);
        const ok = data.results.filter((r: any) => r.ok).length;
        showMsg(`${ok}/${data.results.length} keys funcionando`, ok === data.results.length);
      }
    } catch {
      showMsg('Error al probar las keys', false);
    } finally {
      setTestingAll(false);
    }
  }

  async function toggleUser(teacherId: string, isBlocked: boolean) {
    const res = await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, isBlocked }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showMsg(d.error || 'Error al actualizar usuario', false);
      return;
    }
    loadTeachers();
    showMsg(isBlocked ? 'Usuario bloqueado' : 'Usuario reactivado');
  }

  async function changeUserRole(teacherId: string, role: string) {
    await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, role }) });
    loadTeachers(); showMsg('Rol de usuario actualizado ✓');
  }

  async function saveKeyLabel(id: string) {
    if (!editLabelValue.trim()) return;
    await fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, label: editLabelValue.trim() }) });
    setEditLabelId(null);
    loadKeys();
    showMsg('Etiqueta actualizada ✓');
  }

  async function seedPrompts() {
    setSeedingPrompts(true);
    try {
      const r = await fetch('/api/admin/prompts/seed', { method: 'POST' });
      const d = await r.json();
      if (r.ok) { loadPrompts(); showMsg(`${d.count} prompts sembrados ✓`); }
      else showMsg(d.error || 'Error al sembrar prompts', false);
    } catch { showMsg('Error de red', false); }
    setSeedingPrompts(false);
  }

  async function savePrompt() {
    if (!editPromptId) return;
    setSaving(true);
    const r = await fetch('/api/admin/prompts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editPromptId, content: editPromptContent }),
    });
    setSaving(false);
    if (r.ok) { setEditPromptId(null); loadPrompts(); showMsg('Prompt actualizado ✓'); }
    else showMsg('Error al guardar prompt', false);
  }

  async function deleteDoc(id: string) {
    if (!confirm('¿Eliminar este documento del usuario?')) return;
    await fetch('/api/admin/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadDocs(); showMsg('Documento eliminado');
  }

  // ── Acciones Catálogo Normativo ───────────────────────────────────────────
  async function toggleNormativaVigente(docId: string, currentVigente: boolean) {
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_vigente', id: docId, vigente: !currentVigente })
      });
      if (r.ok) {
        setNormativaDocs(prev => prev.map(d => d.id === docId ? { ...d, vigente: !currentVigente } : d));
        if (selectedNormativaDoc?.id === docId) {
          setSelectedNormativaDoc(prev => prev ? { ...prev, vigente: !currentVigente } : null);
        }
        showMsg(!currentVigente ? 'Documento activado (Vigente) ✓' : 'Documento desactivado');
        loadNormativa();
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al cambiar vigencia', false);
      }
    } catch {
      showMsg('Error de conexión', false);
    }
  }

  async function activateAllNormativa() {
    if (!confirm('¿Deseas activar TODOS los documentos normativos del catálogo como vigentes?')) return;
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate_all' })
      });
      if (r.ok) {
        loadNormativa();
        showMsg('Todos los documentos han sido activados ✓');
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al activar documentos', false);
      }
    } catch {
      showMsg('Error de red', false);
    }
  }

  async function saveDefaultNormativa() {
    if (!confirm('¿Guardar la configuración actual de documentos vigentes como PREDETERMINADA?\n\nEsto sobreescribirá cualquier configuración predeterminada anterior.')) return;
    setSavingDefault(true);
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_default' })
      });
      const d = await r.json();
      if (r.ok) {
        setNormativaDefaultInfo({
          saved_at: d.snapshot.saved_at,
          vigentes: d.snapshot.vigentes?.length || 0,
          total: d.snapshot.total || 0,
        });
        showMsg(`💾 Configuración predeterminada guardada ✓ (${d.snapshot.vigentes?.length || 0} vigentes)`);
      } else {
        showMsg(d.error || 'Error al guardar configuración', false);
      }
    } catch {
      showMsg('Error de red', false);
    } finally {
      setSavingDefault(false);
    }
  }

  async function resetToDefaultNormativa() {
    if (!normativaDefaultInfo) {
      return showMsg('No hay una configuración predeterminada guardada. Usa "💾 Guardar Predeterminado" primero.', false);
    }
    const savedDate = new Date(normativaDefaultInfo.saved_at).toLocaleString('es-MX');
    if (!confirm(`¿Restablecer la configuración guardada el ${savedDate}?\n\n• ${normativaDefaultInfo.vigentes} documentos quedarán vigentes\n• ${normativaDefaultInfo.total - normativaDefaultInfo.vigentes} documentos quedarán desactivados\n\nEsta acción sobrescribirá todos los cambios actuales.`)) return;
    setResettingDefault(true);
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_to_default' })
      });
      const d = await r.json();
      if (r.ok) {
        loadNormativa();
        showMsg(d.message || '🔄 Configuración restablecida al estado predeterminado ✓');
      } else {
        showMsg(d.error || 'Error al restablecer', false);
      }
    } catch {
      showMsg('Error de red', false);
    } finally {
      setResettingDefault(false);
    }
  }

  async function deleteNormativaDoc(docId: string, docTitle: string) {
    if (!confirm(`¿Eliminar el documento "${docTitle}" y TODOS sus artículos asociados?`)) return;
    try {
      const r = await fetch(`/api/admin/normativa?documento_id=${docId}`, { method: 'DELETE' });
      if (r.ok) {
        setNormativaDocs(prev => prev.filter(d => d.id !== docId));
        if (selectedNormativaDoc?.id === docId) setSelectedNormativaDoc(null);
        loadNormativa();
        showMsg('Documento y artículos eliminados ✓');
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al eliminar documento', false);
      }
    } catch {
      showMsg('Error de red', false);
    }
  }

  async function deleteNormativaArt(artId: string) {
    if (!confirm('¿Eliminar este artículo del documento?')) return;
    try {
      const r = await fetch(`/api/admin/normativa?articulo_id=${artId}`, { method: 'DELETE' });
      if (r.ok) {
        if (selectedNormativaDoc) {
          const updatedArts = selectedNormativaDoc.articulos.filter(a => a.id !== artId);
          setSelectedNormativaDoc({ ...selectedNormativaDoc, articulos: updatedArts });
          setNormativaDocs(prev => prev.map(d => d.id === selectedNormativaDoc.id ? { ...d, articulos: updatedArts } : d));
        }
        loadNormativa();
        showMsg('Artículo eliminado ✓');
      } else {
        const d = await r.json();
        showMsg(d.error || 'Error al eliminar artículo', false);
      }
    } catch {
      showMsg('Error de red', false);
    }
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!newDocForm.titulo.trim() || !newDocForm.tipo) {
      return showMsg('Título y tipo de documento son requeridos', false);
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_documento', ...newDocForm })
      });
      const d = await r.json();
      if (r.ok) {
        setShowNewDocModal(false);
        setNewDocForm({ titulo: '', tipo: 'ley_general', fuente: '', orden_display: 0, vigente: true });
        loadNormativa();
        showMsg('Documento normativo creado exitosamente ✓');
      } else {
        showMsg(d.error || 'Error al crear documento', false);
      }
    } catch {
      showMsg('Error de red', false);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateArt(e: React.FormEvent) {
    e.preventDefault();
    if (!newArtForm.documento_id || !newArtForm.numero.trim() || !newArtForm.texto.trim()) {
      return showMsg('Completa número y texto del artículo', false);
    }
    if (newArtForm.aplicable_a.length === 0) {
      return showMsg('Selecciona al menos un módulo aplicable (PMC, PAEC, PIPS o Planeación)', false);
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_articulo', ...newArtForm })
      });
      const d = await r.json();
      if (r.ok) {
        setShowNewArtModal(false);
        setNewArtForm({ documento_id: '', numero: '', texto: '', aplicable_a: ['pmc', 'paec', 'pips', 'planeacion'], orden_en_doc: 0 });
        loadNormativa();
        if (selectedNormativaDoc && selectedNormativaDoc.id === newArtForm.documento_id) {
          setSelectedNormativaDoc(prev => prev ? { ...prev, articulos: [...prev.articulos, d.articulo] } : null);
        }
        showMsg('Artículo normativo agregado ✓');
      } else {
        showMsg(d.error || 'Error al crear artículo', false);
      }
    } catch {
      showMsg('Error de red', false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateArt(e: React.FormEvent) {
    e.preventDefault();
    if (!editingArt) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/normativa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_articulo', ...editingArt })
      });
      const d = await r.json();
      if (r.ok) {
        if (selectedNormativaDoc) {
          const updatedArts = selectedNormativaDoc.articulos.map(a => a.id === editingArt.id ? editingArt : a);
          setSelectedNormativaDoc({ ...selectedNormativaDoc, articulos: updatedArts });
          setNormativaDocs(prev => prev.map(doc => doc.id === selectedNormativaDoc.id ? { ...doc, articulos: updatedArts } : doc));
        }
        setEditingArt(null);
        loadNormativa();
        showMsg('Artículo actualizado correctamente ✓');
      } else {
        showMsg(d.error || 'Error al actualizar artículo', false);
      }
    } catch {
      showMsg('Error de red', false);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTestResult('Probando conexión...');
    try {
      const r = await fetch('/api/admin/api-keys');
      if (r.ok) setTestResult('✅ Conexión exitosa con la base de datos');
      else setTestResult('❌ Error al conectar');
    } catch { setTestResult('❌ Error de red'); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const tabs: { id: typeof activeTab; label: string; icon: string }[] = [
    { id: 'stats',    label: 'Estadísticas',  icon: '📊' },
    { id: 'audits',   label: 'Auditoría Pedagógica', icon: '🛡️' },
    { id: 'schedules',label: 'Horarios Escolares', icon: '📅' },
    { id: 'curricula',label: 'Malla y Programas', icon: '📚' },
    { id: 'keys',     label: 'API Keys & IA', icon: '🔑' },
    { id: 'config',   label: 'Configuración', icon: '⚙️' },
    { id: 'normativa',label: 'Normativa',     icon: '🏛️' },
    { id: 'users',    label: 'Usuarios',      icon: '👥' },
    { id: 'prompts',  label: 'Prompts',       icon: '✏️' },
    { id: 'docs',     label: 'Documentos',    icon: '📁' },
    { id: 'activity', label: 'Actividad',     icon: '📜' },
  ];

  return (
    <div className="admin-panel">
      <style>{`
        .admin-panel { display: flex; gap: 0; min-height: 85vh; background: rgba(8,12,24,0.7); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset; backdrop-filter: blur(12px); }
        .admin-sidebar { width: 200px; flex-shrink: 0; background: rgba(255,255,255,0.025); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 0; }
        .admin-sidebar h2 { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; color: rgba(240,244,255,0.3); padding: 0 20px 16px; text-transform: uppercase; }
        .admin-tab-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 20px; font-size: 13px; color: rgba(240,244,255,0.5); background: none; border: none; border-left: 3px solid transparent; cursor: pointer; text-align: left; transition: all 0.18s ease; }
        .admin-tab-btn:hover { background: rgba(255,255,255,0.05); color: rgba(240,244,255,0.85); transform: translateX(2px); }
        .admin-tab-btn.active { background: rgba(99,102,241,0.12); color: #818cf8; border-left-color: #6366f1; font-weight: 600; }
        .admin-content { flex: 1; padding: 32px; overflow-y: auto; max-height: 85vh; }
        .admin-content h1 { font-size: 20px; font-weight: 800; color: #f0f4ff; margin-bottom: 24px; letter-spacing: -0.4px; display: flex; align-items: center; gap: 10px; }
        .admin-content h1::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(99,102,241,0.3), transparent); }
        .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 28px; }
        .stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px 16px; text-align: center; position: relative; overflow: hidden; transition: all 0.2s ease; }
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent); }
        .stat-card:hover { border-color: rgba(99,102,241,0.25); transform: translateY(-2px); background: rgba(99,102,241,0.06); }
        .stat-card .num { font-size: 30px; font-weight: 800; color: #818cf8; letter-spacing: -1px; }
        .stat-card .lbl { font-size: 11px; color: rgba(240,244,255,0.4); margin-top: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .admin-table th { text-align: left; padding: 10px 12px; color: rgba(240,244,255,0.35); font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .admin-table td { padding: 10px 12px; color: rgba(240,244,255,0.75); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .admin-table tr:hover td { background: rgba(255,255,200,0.025); }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-green  { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
        .badge-red    { background: rgba(244,63,94,0.12);  color: #fb7185; border: 1px solid rgba(244,63,94,0.2); }
        .badge-yellow { background: rgba(245,158,11,0.12); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }
        .badge-blue   { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.2); padding: 2px 8px; }
        .badge-purple { background: rgba(168,85,247,0.12); color: #c084fc; border: 1px solid rgba(168,85,247,0.2); }
        .btn-sm { padding: 5px 12px; border-radius: 8px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.18s ease; }
        .btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; box-shadow: 0 2px 8px rgba(99,102,241,0.35); }
        .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-danger  { background: rgba(244,63,94,0.12); color: #fb7185; border: 1px solid rgba(244,63,94,0.2); }
        .btn-danger:hover  { background: rgba(244,63,94,0.22); }
        .btn-ghost   { background: rgba(255,255,255,0.05); color: rgba(240,244,255,0.6); border: 1px solid rgba(255,255,255,0.08); }
        .btn-ghost:hover   { background: rgba(255,255,255,0.09); color: rgba(240,244,255,0.9); }
        .form-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
        .form-group label { font-size: 10px; color: rgba(240,244,255,0.4); font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
        .form-group input, .form-group select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #f0f4ff; font-size: 13px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .form-group input:focus, .form-group select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
        .form-group textarea { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 12px; color: #f0f4ff; font-size: 13px; outline: none; font-family: monospace; resize: vertical; min-height: 300px; width: 100%; transition: border-color 0.2s; }
        .form-group textarea:focus { border-color: #6366f1; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 9999; animation: toastIn 0.3s ease; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .toast-ok  { background: rgba(16,185,129,0.9); color: #fff; border: 1px solid rgba(16,185,129,0.4); }
        .toast-err { background: rgba(244,63,94,0.9);  color: #fff; border: 1px solid rgba(244,63,94,0.4); }
        @keyframes toastIn { from { transform: translateY(16px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 24px 0; }
        .provider-card { background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 20px; cursor: pointer; transition: all 0.2s; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        .provider-card.selected { border-color: #6366f1; background: rgba(99,102,241,0.1); }
        .provider-card:hover { border-color: rgba(99,102,241,0.4); }
        .prompt-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 18px; margin-bottom: 10px; transition: border-color 0.2s; }
        .prompt-item:hover { border-color: rgba(99,102,241,0.25); }
        .prompt-item .prompt-label { font-weight: 600; color: #f0f4ff; font-size: 14px; margin-bottom: 4px; }
        .prompt-item .prompt-meta  { font-size: 11px; color: rgba(255,255,255,0.35); }
        .empty-state { text-align: center; padding: 48px; color: rgba(240,244,255,0.25); font-size: 14px; }
        @keyframes adminFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .admin-content > * { animation: adminFadeIn 0.25s ease forwards; }
      `}</style>

      {/* Sidebar */}
      <div className="admin-sidebar">
        <h2>Admin Panel</h2>
        {tabs.map(t => (
          <button key={t.id} className={`admin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
        <div style={{ margin: '16px 12px 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          <Link
            href={`/${locale}/admin/health`}
            className="admin-tab-btn"
            style={{ textDecoration: 'none', color: '#34d399' }}
          >
            <span>🩺</span> Salud del Sistema
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="admin-content">

        {/* ── STATS ── */}
        {activeTab === 'stats' && (
          <>
            <h1>📊 Estadísticas de la Plataforma</h1>
            {stats ? (
              <>
                <div className="admin-grid">
                  <div className="stat-card"><div className="num">{stats.totals.plannings}</div><div className="lbl">Planeaciones</div></div>
                  <div className="stat-card"><div className="num">{stats.totals.paec}</div><div className="lbl">Proyectos PAEC</div></div>
                  <div className="stat-card"><div className="num">{stats.totals.pmc}</div><div className="lbl">Planes PMC</div></div>
                  <div className="stat-card"><div className="num">{stats.totals.teachers}</div><div className="lbl">Docentes</div></div>
                  <div className="stat-card"><div className="num">{stats.totals.todayActivity}</div><div className="lbl">Acciones hoy</div></div>
                </div>
                {stats.providerStats.length > 0 && (
                  <>
                    <h3 style={{ color: '#818cf8', fontSize: 14, marginBottom: 12 }}>Uso por Proveedor</h3>
                    <table className="admin-table" style={{ marginBottom: 24 }}>
                      <thead><tr><th>Proveedor</th><th>Modelo</th><th>Usos</th><th>Exitosos</th><th>Errores</th></tr></thead>
                      <tbody>
                        {stats.providerStats.map((p, i) => (
                          <tr key={i}>
                            <td><span className="badge badge-blue">{p.provider_used}</span></td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.model_used}</td>
                            <td>{p.count}</td>
                            <td style={{ color: '#4ade80' }}>{p.successes}</td>
                            <td style={{ color: '#f87171' }}>{p.failures}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {stats.topUsers.length > 0 && (
                  <>
                    <h3 style={{ color: '#818cf8', fontSize: 14, marginBottom: 12 }}>Top Docentes (últimos 30 días)</h3>
                    <table className="admin-table">
                      <thead><tr><th>#</th><th>Email</th><th>Acciones</th></tr></thead>
                      <tbody>
                        {stats.topUsers.map((u, i) => (
                          <tr key={u.teacher_email}>
                            <td style={{ color: '#818cf8' }}>#{i + 1}</td>
                            <td>{u.teacher_email}</td>
                            <td>{u.total_actions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {stats.providerStats.length === 0 && stats.topUsers.length === 0 && (
                  <div className="empty-state">🚀 Aún no hay actividad registrada.<br/>Las estadísticas aparecerán cuando los docentes empiecen a generar contenido.</div>
                )}
              </>
            ) : <div className="empty-state">Cargando estadísticas...</div>}
          </>
        )}

        {/* ── AUDITORÍA PEDAGÓGICA (FASE 2) ── */}
        {activeTab === 'audits' && (
          <>
            <div className="section-header">
              <div>
                <h1 style={{ margin: 0, paddingBottom: 4 }}>🛡️ Motor de Auditoría y Alineación Pedagógica Inteligente</h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '6px 0 0 0' }}>
                  Audita y califica automáticamente la congruencia entre las planeaciones docentes y los 449 programas oficiales de estudio en 4 dimensiones formativas.
                </p>
              </div>
              <button
                className="btn-sm btn-ghost"
                onClick={loadAudits}
                disabled={auditLoading}
                style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>🔄</span> {auditLoading ? 'Actualizando...' : 'Refrescar'}
              </button>
            </div>

            {/* KPIs de Auditoría */}
            <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 24 }}>
              <div className="stat-card" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
                <div className="num" style={{ color: '#818cf8' }}>{auditStats?.total_plannings || 0}</div>
                <div className="lbl">Total Planeaciones</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
                <div className="num" style={{ color: '#60a5fa' }}>{auditStats?.total_audited || 0}</div>
                <div className="lbl">Auditadas ({auditStats && auditStats.total_plannings > 0 ? Math.round((auditStats.total_audited / auditStats.total_plannings) * 100) : 0}%)</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                <div className="num" style={{ color: '#34d399' }}>{auditStats?.average_score || 0}<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>/100</span></div>
                <div className="lbl">Alineación Media</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                <div className="num" style={{ color: '#10b981' }}>{auditStats?.excelente_count || 0}</div>
                <div className="lbl">🟢 Excelente (90-100)</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                <div className="num" style={{ color: '#fbbf24' }}>{auditStats?.satisfactorio_count || 0}</div>
                <div className="lbl">🟡 Satisfactorio (75-89)</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(244,63,94,0.2)' }}>
                <div className="num" style={{ color: '#fb7185' }}>{(auditStats?.requiere_mejora_count || 0) + (auditStats?.no_alineado_count || 0)}</div>
                <div className="lbl">🟠 Requiere Ajuste (&lt;75)</div>
              </div>
            </div>

            {/* Selector de Modo de Vista y Filtros (Paso 2 UX) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                {/* Switcher: Tabla | Calendario | Comparativa */}
                <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setAuditViewMode('tabla')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: auditViewMode === 'tabla' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                      color: auditViewMode === 'tabla' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>📋</span> Tabla Detallada
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditViewMode('calendario')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: auditViewMode === 'calendario' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                      color: auditViewMode === 'calendario' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>📅</span> Calendario por Cortes
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditViewMode('comparativa')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: auditViewMode === 'comparativa' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                      color: auditViewMode === 'comparativa' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>⚖️</span> Comparativa Antes/Después
                  </button>
                </div>

                <div style={{ fontSize: 13, color: 'rgba(240,244,255,0.6)' }}>
                  Mostrando <strong style={{ color: '#818cf8' }}>
                    {auditPlannings.filter(p => {
                      if (auditFilterTeacher !== 'todos' && (p.teacher_email !== auditFilterTeacher && p.teacher_id !== auditFilterTeacher)) return false;
                      if (auditFilterComponent !== 'todos' && p.component !== auditFilterComponent) return false;
                      return true;
                    }).length}
                  </strong> de {auditPlannings.length} planeaciones
                </div>
              </div>

              {/* Filtros Avanzados */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar por Asignatura, Docente o Correo..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  style={{ flex: '1 1 240px', background: '#131324', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, outline: 'none' }}
                />

                <select
                  value={auditFilterCompliance}
                  onChange={e => setAuditFilterCompliance(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, outline: 'none' }}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pendiente">⚪ Pendiente de Auditoría</option>
                  <option value="excelente">🟢 Excelente (90-100 pts)</option>
                  <option value="satisfactorio">🟡 Satisfactorio (75-89 pts)</option>
                  <option value="requiere_mejora">🟠 Requiere Mejora (60-74 pts)</option>
                  <option value="no_alineado">🔴 No Alineado (&lt;60 pts)</option>
                </select>

                <select
                  value={auditFilterSemester}
                  onChange={e => setAuditFilterSemester(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, outline: 'none' }}
                >
                  <option value="todos">Todos los Semestres</option>
                  <option value="1">1.° Semestre</option>
                  <option value="2">2.° Semestre</option>
                  <option value="3">3.° Semestre</option>
                  <option value="4">4.° Semestre</option>
                  <option value="5">5.° Semestre</option>
                  <option value="6">6.° Semestre</option>
                </select>

                <select
                  value={auditFilterComponent}
                  onChange={e => setAuditFilterComponent(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, outline: 'none' }}
                >
                  <option value="todos">Todos los Componentes</option>
                  <option value="fundamental">Fundamental</option>
                  <option value="laboral">Laboral / Capacitación</option>
                  <option value="ampliado">Ampliado / Socioemocional</option>
                  <option value="ext_obligatorio">Ext. Obligatoria (FFEO)</option>
                  <option value="ext_optativo">Ext. Optativa (FFE)</option>
                </select>

                <select
                  value={auditFilterTeacher}
                  onChange={e => setAuditFilterTeacher(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, outline: 'none' }}
                >
                  <option value="todos">Todos los Docentes</option>
                  {Array.from(new Set(auditPlannings.map(p => p.teacher_email).filter(Boolean))).map((email: any) => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>

                {(auditFilterCompliance !== 'todos' || auditFilterSemester !== 'todos' || auditFilterComponent !== 'todos' || auditFilterTeacher !== 'todos' || auditSearch.trim()) && (
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    onClick={() => {
                      setAuditFilterCompliance('todos');
                      setAuditFilterSemester('todos');
                      setAuditFilterComponent('todos');
                      setAuditFilterTeacher('todos');
                      setAuditSearch('');
                    }}
                    style={{ fontSize: 12 }}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* CONTENIDO PRINCIPAL: TABLA vs CALENDARIO vs COMPARATIVA */}
            {auditLoading && auditPlannings.length === 0 ? (
              <div className="empty-state">⏳ Cargando panel de auditoría pedagógica...</div>
            ) : auditPlannings.length === 0 ? (
              <div className="empty-state">No se encontraron planeaciones con los filtros seleccionados.</div>
            ) : auditViewMode === 'tabla' ? (
              /* ── VISTA 1: TABLA DETALLADA ── */
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Asignatura / UAC</th>
                    <th>Docente & Escuela</th>
                    <th style={{ textAlign: 'center' }}>Semestre</th>
                    <th>Estado de Auditoría</th>
                    <th>Scorecard 4D</th>
                    <th style={{ textAlign: 'right' }}>Acciones & Exportación</th>
                  </tr>
                </thead>
                <tbody>
                  {auditPlannings
                    .filter(p => {
                      if (auditFilterTeacher !== 'todos' && p.teacher_email !== auditFilterTeacher && p.teacher_id !== auditFilterTeacher) return false;
                      if (auditFilterComponent !== 'todos' && p.component !== auditFilterComponent) return false;
                      return true;
                    })
                    .map(p => {
                      const isAudited = !!p.audit_id && p.overall_score !== null;
                      const isAuditing = auditingPlanningId === p.planning_id;
                      const score = p.overall_score || 0;
                      const compLevel = p.compliance_level || 'pendiente';
                      const dims = p.dimension_scores;

                      return (
                        <tr key={p.planning_id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#f0f4ff', fontSize: 14 }}>
                              {p.uac_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {p.curriculum_name || 'Programa Oficial'} · Creada: {new Date(p.planning_created_at).toLocaleDateString('es-MX')}
                            </div>
                          </td>

                          <td>
                            <div style={{ color: '#e0e7ff', fontWeight: 500, fontSize: 13 }}>
                              {p.teacher_name || p.teacher_email || 'Docente'}
                            </div>
                            <div style={{ fontSize: 11, color: '#818cf8' }}>
                              {p.school_name || p.teacher_email}
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', fontSize: 11 }}>
                              {p.semester}.°
                            </span>
                          </td>

                          <td>
                            {isAuditing ? (
                              <span className="badge badge-purple" style={{ animation: 'pulse 1.5s infinite' }}>
                                ⏳ Auditando con IA...
                              </span>
                            ) : isAudited ? (
                              <div>
                                <span
                                  className="badge"
                                  style={{
                                    background: score >= 90 ? 'rgba(16,185,129,0.15)' : score >= 75 ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                                    color: score >= 90 ? '#34d399' : score >= 75 ? '#fbbf24' : '#fb7185',
                                    border: `1px solid ${score >= 90 ? 'rgba(16,185,129,0.3)' : score >= 75 ? 'rgba(245,158,11,0.3)' : 'rgba(244,63,94,0.3)'}`,
                                    fontSize: 12,
                                    fontWeight: 700
                                  }}
                                >
                                  {score >= 90 ? '🟢' : score >= 75 ? '🟡' : '🔴'} {score} pts · {compLevel.toUpperCase()}
                                </span>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                                  Auditada {relativeTime(p.audited_at)}
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-ghost" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                                ⚪ Sin Auditar
                              </span>
                            )}
                          </td>

                          <td>
                            {isAudited && dims ? (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span className="badge" style={{ fontSize: 10, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }} title="Alineación de Propósitos">
                                  🎯 {dims.propositos_alineacion?.score || 0}%
                                </span>
                                <span className="badge" style={{ fontSize: 10, background: 'rgba(16,185,129,0.1)', color: '#6ee7b7' }} title="Cobertura de Contenidos">
                                  📚 {dims.cobertura_contenidos?.score || 0}%
                                </span>
                                <span className="badge" style={{ fontSize: 10, background: 'rgba(234,179,8,0.1)', color: '#fde047' }} title="Secuenciación Lógica">
                                  ⏳ {dims.secuenciacion_logica?.score || 0}%
                                </span>
                                <span className="badge" style={{ fontSize: 10, background: 'rgba(236,72,153,0.1)', color: '#f472b6' }} title="Adecuación de Evidencias">
                                  📝 {dims.adecuacion_evidencias?.score || 0}%
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>—</span>
                            )}
                          </td>

                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {/* Descarga 1-Click DOCX Institucional */}
                            <a
                              href={`/api/docx/${p.planning_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-sm btn-ghost"
                              style={{ marginRight: 6, color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', textDecoration: 'none' }}
                              title="Descargar Planeación Institucional en Word (DOCX)"
                            >
                              📥 DOCX
                            </a>
                            {isAudited && (
                              <>
                                <button
                                  className="btn-sm btn-ghost"
                                  onClick={() => setSelectedAuditScorecard(p)}
                                  style={{ marginRight: 6, color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                                  title="Ver Reporte y Scorecard Detallado"
                                >
                                  📊 Scorecard
                                </button>
                                <button
                                  className="btn-sm btn-ghost"
                                  onClick={() => {
                                    setComparePlanning(p);
                                    setAuditViewMode('comparativa');
                                  }}
                                  style={{ marginRight: 6, color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                                  title="Comparar frente a Requisitos Oficiales SEP"
                                >
                                  ⚖️ Comparar
                                </button>
                              </>
                            )}
                            <button
                              className="btn-sm btn-primary"
                              onClick={() => handleRunAudit(p.planning_id)}
                              disabled={isAuditing}
                              style={{ marginRight: 6 }}
                            >
                              {isAuditing ? '⏳ Auditando...' : isAudited ? '🔄 Re-auditar' : '⚡ Auditar con IA'}
                            </button>
                            {isAudited && p.audit_id && (
                              <button
                                className="btn-sm btn-danger"
                                onClick={() => handleDeleteAudit(p.audit_id!)}
                                title="Eliminar registro de auditoría"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : auditViewMode === 'calendario' ? (
              /* ── VISTA 2: CALENDARIO POR CORTES EVALUATIVOS ── */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {[
                    { corte: 1, titulo: '1.° Corte Evaluativo (Parcial 1)', semanas: 'Semanas 1 a 6', icono: '🌱' },
                    { corte: 2, titulo: '2.° Corte Evaluativo (Parcial 2)', semanas: 'Semanas 7 a 12', icono: '⚡' },
                    { corte: 3, titulo: '3.° Corte Evaluativo (Parcial 3)', semanas: 'Semanas 13 a 18', icono: '🎓' },
                  ].map(block => {
                    const blockPlannings = auditPlannings.filter(p => {
                      if (auditFilterTeacher !== 'todos' && p.teacher_email !== auditFilterTeacher && p.teacher_id !== auditFilterTeacher) return false;
                      if (auditFilterComponent !== 'todos' && p.component !== auditFilterComponent) return false;
                      return true;
                    });

                    return (
                      <div
                        key={block.corte}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 14,
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{block.icono}</span> {block.titulo}
                            </div>
                            <div style={{ fontSize: 11, color: '#818cf8', marginTop: 2 }}>{block.semanas}</div>
                          </div>
                          <span className="badge badge-blue" style={{ fontSize: 11 }}>
                            {blockPlannings.length} planes
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '65vh', overflowY: 'auto' }}>
                          {blockPlannings.map(p => {
                            const isAudited = !!p.audit_id && p.overall_score !== null;
                            const score = p.overall_score || 0;

                            return (
                              <div
                                key={p.planning_id}
                                style={{
                                  background: 'rgba(0,0,0,0.3)',
                                  border: `1px solid ${isAudited ? (score >= 90 ? 'rgba(16,185,129,0.25)' : score >= 75 ? 'rgba(245,158,11,0.25)' : 'rgba(244,63,94,0.25)') : 'rgba(255,255,255,0.08)'}`,
                                  borderRadius: 10,
                                  padding: 12
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                  <div style={{ fontWeight: 700, color: '#f0f4ff', fontSize: 13 }}>
                                    {p.uac_name}
                                  </div>
                                  <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', fontSize: 10 }}>
                                    {p.semester}.° Sem
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                                  👤 {p.teacher_name || p.teacher_email}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                                  {isAudited ? (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: score >= 90 ? '#34d399' : score >= 75 ? '#fbbf24' : '#fb7185' }}>
                                      {score >= 90 ? '🟢' : score >= 75 ? '🟡' : '🔴'} {score}/100 pts
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>⚪ Sin auditar</span>
                                  )}

                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <a
                                      href={`/api/docx/${p.planning_id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-sm btn-ghost"
                                      style={{ padding: '3px 8px', fontSize: 11, textDecoration: 'none' }}
                                    >
                                      📥 DOCX
                                    </a>
                                    <button
                                      className="btn-sm btn-primary"
                                      onClick={() => handleRunAudit(p.planning_id)}
                                      style={{ padding: '3px 8px', fontSize: 11 }}
                                    >
                                      ⚡
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ── VISTA 3: COMPARATIVA ANTES / DESPUÉS (SEP OFICIAL VS PLANEACIÓN) ── */
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 17, fontWeight: 700 }}>
                      ⚖️ Matriz Comparativa de Alineación Curricular y Mejora Pedagógica
                    </h3>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                      Contrasta los propósitos oficiales extraídos del catálogo SEP con la planeación generada y sus hallazgos de auditoría.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: '#94a3b8' }}>Seleccionar Planeación:</label>
                    <select
                      value={comparePlanning?.planning_id || ''}
                      onChange={e => {
                        const target = auditPlannings.find(p => p.planning_id === e.target.value);
                        setComparePlanning(target || null);
                      }}
                      style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}
                    >
                      <option value="">— Elige una planeación auditada —</option>
                      {auditPlannings.filter(p => p.audit_id).map(p => (
                        <option key={p.planning_id} value={p.planning_id}>
                          {p.uac_name} ({p.semester}.° Sem) · {p.teacher_email} — Score: {p.overall_score}/100
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {comparePlanning ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
                    {/* Columna Izquierda: Requisitos Oficiales del Programa */}
                    <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 20 }}>🏛️</span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#c7d2fe', fontSize: 14 }}>Requisitos Oficiales del Programa SEP</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Catálogo oficial de 449 programas auténticos</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10, fontSize: 12 }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8 }}>
                          <strong style={{ color: '#818cf8' }}>Asignatura / UAC:</strong> {comparePlanning.uac_name}
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8 }}>
                          <strong style={{ color: '#818cf8' }}>Semestre y Componente:</strong> {comparePlanning.semester}.° Semestre · {comparePlanning.component?.toUpperCase()}
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8 }}>
                          <strong style={{ color: '#818cf8' }}>Propósitos Oficiales Exigidos:</strong>
                          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                            {(comparePlanning.findings?.propositos_cubiertos || ['Propósitos formativos oficiales del catálogo SEP']).map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Columna Derecha: Planeación Docente y Auditoría 4D */}
                    <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>📊</span>
                          <div>
                            <div style={{ fontWeight: 700, color: '#6ee7b7', fontSize: 14 }}>Diagnóstico y Auditoría Pedagógica</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Alineación en 4 Dimensiones Clave</div>
                          </div>
                        </div>
                        <span className="badge" style={{ background: (comparePlanning.overall_score || 0) >= 90 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: (comparePlanning.overall_score || 0) >= 90 ? '#34d399' : '#fbbf24', fontSize: 13, fontWeight: 700 }}>
                          {comparePlanning.overall_score}/100 pts
                        </span>
                      </div>

                      <div style={{ display: 'grid', gap: 10, fontSize: 12 }}>
                        {comparePlanning.dimension_scores && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8 }}>
                              <div style={{ color: '#a5b4fc', fontSize: 11 }}>🎯 Propósitos</div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{comparePlanning.dimension_scores.propositos_alineacion?.score || 0}%</div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8 }}>
                              <div style={{ color: '#6ee7b7', fontSize: 11 }}>📚 Contenidos</div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{comparePlanning.dimension_scores.cobertura_contenidos?.score || 0}%</div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8 }}>
                              <div style={{ color: '#fde047', fontSize: 11 }}>⏳ Secuenciación</div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{comparePlanning.dimension_scores.secuenciacion_logica?.score || 0}%</div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8 }}>
                              <div style={{ color: '#f472b6', fontSize: 11 }}>📝 Evidencias</div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{comparePlanning.dimension_scores.adecuacion_evidencias?.score || 0}%</div>
                            </div>
                          </div>
                        )}

                        {comparePlanning.recommendations && comparePlanning.recommendations.length > 0 && (
                          <div style={{ background: 'rgba(245,158,11,0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                            <strong style={{ color: '#fbbf24' }}>💡 Acciones de Alineación Sugeridas:</strong>
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#fef3c7', lineHeight: 1.4 }}>
                              {comparePlanning.recommendations.slice(0, 3).map((r, i) => (
                                <li key={i}>{r.mensaje}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <a
                            href={`/api/docx/${comparePlanning.planning_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-sm btn-ghost"
                            style={{ flex: 1, textAlign: 'center', textDecoration: 'none', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}
                          >
                            📥 Descargar Word DOCX
                          </a>
                          <button
                            className="btn-sm btn-primary"
                            onClick={() => handleRunAudit(comparePlanning.planning_id)}
                            disabled={auditingPlanningId === comparePlanning.planning_id}
                          >
                            {auditingPlanningId === comparePlanning.planning_id ? '⏳ Auditando...' : '⚡ Re-auditar con IA'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                    👆 Selecciona una planeación auditada arriba para visualizar la matriz comparativa de requisitos SEP vs planeación docente.
                  </div>
                )}
              </div>
            )}

            {/* Modal: Scorecard Pedagógico 4D Detallado */}
            {selectedAuditScorecard && selectedAuditScorecard.dimension_scores && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#0d1322', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: 30, width: '100%', maxWidth: 880, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 80px rgba(0,0,0,0.9)' }}>
                  
                  {/* Header Scorecard */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 18, marginBottom: 20 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="badge badge-purple" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                          Auditoría Oficial MCCEMS
                        </span>
                        <span className="badge badge-blue" style={{ fontSize: 11 }}>
                          {selectedAuditScorecard.semester}.° Semestre
                        </span>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#f0f4ff', fontSize: 11 }}>
                          {selectedAuditScorecard.component?.toUpperCase()}
                        </span>
                      </div>
                      <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 22, fontWeight: 800 }}>
                        {selectedAuditScorecard.uac_name}
                      </h2>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                        Docente: <strong>{selectedAuditScorecard.teacher_name || selectedAuditScorecard.teacher_email}</strong> · Escuela: {selectedAuditScorecard.school_name || 'Plantel Oficial'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <button className="btn-sm btn-ghost" onClick={() => setSelectedAuditScorecard(null)} style={{ fontSize: 14 }}>
                        ✕ Cerrar
                      </button>
                      <div style={{ background: (selectedAuditScorecard.overall_score || 0) >= 90 ? 'rgba(16,185,129,0.15)' : (selectedAuditScorecard.overall_score || 0) >= 75 ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)', border: `1px solid ${(selectedAuditScorecard.overall_score || 0) >= 90 ? 'rgba(16,185,129,0.4)' : (selectedAuditScorecard.overall_score || 0) >= 75 ? 'rgba(245,158,11,0.4)' : 'rgba(244,63,94,0.4)'}`, borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: (selectedAuditScorecard.overall_score || 0) >= 90 ? '#34d399' : (selectedAuditScorecard.overall_score || 0) >= 75 ? '#fbbf24' : '#fb7185', lineHeight: 1 }}>
                          {selectedAuditScorecard.overall_score}<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>/100</span>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                          {selectedAuditScorecard.compliance_level?.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4 Dimensiones Formativas */}
                  <h3 style={{ fontSize: 15, color: '#c7d2fe', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📊</span> Evaluación en las 4 Dimensiones Pedagógicas Clave
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, marginBottom: 24 }}>
                    
                    {/* Dimensión 1: Propósitos */}
                    {selectedAuditScorecard.dimension_scores.propositos_alineacion && (
                      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#e0e7ff', fontSize: 13 }}>
                            🎯 1. Alineación de Propósitos (30%)
                          </div>
                          <span className="badge badge-blue" style={{ fontSize: 12, fontWeight: 700 }}>
                            {selectedAuditScorecard.dimension_scores.propositos_alineacion.score} / 100
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ width: `${selectedAuditScorecard.dimension_scores.propositos_alineacion.score}%`, height: '100%', background: '#6366f1', borderRadius: 4 }} />
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.45 }}>
                          {selectedAuditScorecard.dimension_scores.propositos_alineacion.feedback}
                        </p>
                      </div>
                    )}

                    {/* Dimensión 2: Contenidos */}
                    {selectedAuditScorecard.dimension_scores.cobertura_contenidos && (
                      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#d1fae5', fontSize: 13 }}>
                            📚 2. Cobertura de Contenidos (25%)
                          </div>
                          <span className="badge badge-green" style={{ fontSize: 12, fontWeight: 700 }}>
                            {selectedAuditScorecard.dimension_scores.cobertura_contenidos.score} / 100
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ width: `${selectedAuditScorecard.dimension_scores.cobertura_contenidos.score}%`, height: '100%', background: '#10b981', borderRadius: 4 }} />
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.45 }}>
                          {selectedAuditScorecard.dimension_scores.cobertura_contenidos.feedback}
                        </p>
                      </div>
                    )}

                    {/* Dimensión 3: Secuenciación */}
                    {selectedAuditScorecard.dimension_scores.secuenciacion_logica && (
                      <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#fef3c7', fontSize: 13 }}>
                            ⏳ 3. Secuenciación Lógica (25%)
                          </div>
                          <span className="badge badge-yellow" style={{ fontSize: 12, fontWeight: 700 }}>
                            {selectedAuditScorecard.dimension_scores.secuenciacion_logica.score} / 100
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ width: `${selectedAuditScorecard.dimension_scores.secuenciacion_logica.score}%`, height: '100%', background: '#eab308', borderRadius: 4 }} />
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.45 }}>
                          {selectedAuditScorecard.dimension_scores.secuenciacion_logica.feedback}
                        </p>
                      </div>
                    )}

                    {/* Dimensión 4: Evidencias */}
                    {selectedAuditScorecard.dimension_scores.adecuacion_evidencias && (
                      <div style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#fce7f3', fontSize: 13 }}>
                            📝 4. Evidencias e Instrumentos (20%)
                          </div>
                          <span className="badge badge-purple" style={{ fontSize: 12, fontWeight: 700 }}>
                            {selectedAuditScorecard.dimension_scores.adecuacion_evidencias.score} / 100
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ width: `${selectedAuditScorecard.dimension_scores.adecuacion_evidencias.score}%`, height: '100%', background: '#ec4899', borderRadius: 4 }} />
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.45 }}>
                          {selectedAuditScorecard.dimension_scores.adecuacion_evidencias.feedback}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Hallazgos y Fortalezas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginBottom: 20 }}>
                    
                    {/* Fortalezas */}
                    <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 18 }}>
                      <h4 style={{ color: '#34d399', fontSize: 14, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🌟</span> Fortalezas Pedagógicas
                      </h4>
                      {selectedAuditScorecard.findings?.fortalezas && selectedAuditScorecard.findings.fortalezas.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#f0f4ff', lineHeight: 1.6 }}>
                          {selectedAuditScorecard.findings.fortalezas.map((f, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>{f}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>No se registraron fortalezas destacadas.</p>
                      )}
                    </div>

                    {/* Desalineaciones / Omisiones */}
                    <div style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: 18 }}>
                      <h4 style={{ color: '#fb7185', fontSize: 14, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>⚠️</span> Desalineaciones u Omisiones Detectadas
                      </h4>
                      {((selectedAuditScorecard.findings?.desalineaciones?.length || 0) > 0 || (selectedAuditScorecard.findings?.omisiones_detectadas?.length || 0) > 0) ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#fecdd3', lineHeight: 1.6 }}>
                          {(selectedAuditScorecard.findings?.desalineaciones || []).map((d, i) => (
                            <li key={`d-${i}`} style={{ marginBottom: 6 }}>{d}</li>
                          ))}
                          {(selectedAuditScorecard.findings?.omisiones_detectadas || []).map((o, i) => (
                            <li key={`o-${i}`} style={{ marginBottom: 6 }}>{o}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontSize: 12 }}>
                          <span>✓</span> Sin desalineaciones críticas detectadas frente al programa oficial.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Propósitos Oficiales Cubiertos */}
                  {selectedAuditScorecard.findings?.propositos_cubiertos && selectedAuditScorecard.findings.propositos_cubiertos.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                      <h4 style={{ color: '#a5b4fc', fontSize: 14, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📌</span> Propósitos / Progresiones Oficiales Validados ({selectedAuditScorecard.findings.propositos_cubiertos.length})
                      </h4>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {selectedAuditScorecard.findings.propositos_cubiertos.map((p, i) => (
                          <div key={i} style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f0f4ff', display: 'flex', gap: 8 }}>
                            <span style={{ color: '#10b981' }}>✓</span>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recomendaciones de Mejora */}
                  {selectedAuditScorecard.recommendations && selectedAuditScorecard.recommendations.length > 0 && (
                    <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                      <h4 style={{ color: '#fcd34d', fontSize: 14, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>💡</span> Recomendaciones Pedagógicas para el Docente
                      </h4>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedAuditScorecard.recommendations.map((rec, i) => (
                          <div key={i} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#fef3c7', lineHeight: 1.45 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: '#fbbf24' }}>
                                Dimensión: {rec.dimension?.replace('_', ' ')}
                              </span>
                              <span className="badge" style={{ background: 'rgba(245,158,11,0.2)', color: '#fde047', fontSize: 10 }}>
                                Severidad {rec.severidad}
                              </span>
                            </div>
                            {rec.mensaje}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer del Modal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                    <button
                      className="btn-sm btn-primary"
                      onClick={() => handleRunAudit(selectedAuditScorecard.planning_id)}
                      disabled={auditingPlanningId === selectedAuditScorecard.planning_id}
                      style={{ padding: '8px 16px' }}
                    >
                      {auditingPlanningId === selectedAuditScorecard.planning_id ? '⏳ Re-auditando con IA...' : '⚡ Re-auditar Planeación'}
                    </button>

                    <button
                      className="btn-sm btn-ghost"
                      onClick={() => setSelectedAuditScorecard(null)}
                      style={{ padding: '8px 18px' }}
                    >
                      Cerrar Reporte
                    </button>
                  </div>

                </div>
              </div>
            )}
          </>
        )}

        {/* ── HORARIOS ESCOLARES (FASE 4) ── */}
        {activeTab === 'schedules' && (
          <>
            <div className="section-header">
              <div>
                <h1 style={{ margin: 0, paddingBottom: 4 }}>📅 Módulo de Horarios Inteligente & Plantillas</h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '6px 0 0 0' }}>
                  Generación algorítmica Min-Conflicts y optimización pedagógica con IA (balance de jornadas, reducción de horas muertas y restricciones de docentes).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <a
                  href={`/${locale}/horarios`}
                  className="btn-sm btn-primary"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 600 }}
                >
                  <span>✨</span> Nuevo Horario / Asistente
                </a>
                <button
                  className="btn-sm btn-ghost"
                  onClick={loadSchedules}
                  disabled={schedulesLoading}
                  style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>🔄</span> {schedulesLoading ? 'Cargando...' : 'Refrescar'}
                </button>
              </div>
            </div>

            {/* KPIs de Horarios */}
            <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
              <div className="stat-card" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
                <div className="num" style={{ color: '#818cf8' }}>{schedules.length}</div>
                <div className="lbl">Plantillas de Horarios</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                <div className="num" style={{ color: '#34d399' }}>
                  {schedules.filter(s => s.status === 'published').length}
                </div>
                <div className="lbl">Publicados / Oficiales</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
                <div className="num" style={{ color: '#fbbf24' }}>
                  {schedules.filter(s => s.status === 'draft').length}
                </div>
                <div className="lbl">Borradores en Diseño</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
                <div className="num" style={{ color: '#60a5fa' }}>
                  {schedules.reduce((acc, s) => acc + (s.grupos?.length || 0), 0)}
                </div>
                <div className="lbl">Grupos Gestionados</div>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(168,85,247,0.3)' }}>
                <div className="num" style={{ color: '#c084fc' }}>
                  {schedules.reduce((acc, s) => acc + (s.docentes?.length || 0), 0)}
                </div>
                <div className="lbl">Docentes Asignados</div>
              </div>
            </div>

            {/* Listado de Horarios */}
            {schedulesLoading && schedules.length === 0 ? (
              <div className="empty-state">⏳ Cargando horarios escolares...</div>
            ) : schedules.length === 0 ? (
              <div className="empty-state" style={{ background: 'rgba(255,255,255,0.02)', padding: 48, borderRadius: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff', marginBottom: 8 }}>Aún no hay plantillas de horarios creadas</div>
                <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 460, margin: '0 auto 20px', fontSize: 13 }}>
                  Crea una nueva plantilla para organizar las asignaturas, salones, docentes y grupos de tu plantel con el asistente inteligente.
                </p>
                <a
                  href={`/${locale}/horarios`}
                  className="btn-sm btn-primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 14 }}
                >
                  🚀 Abrir Generador de Horarios
                </a>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {schedules.map(sch => {
                  const isOptimizing = optimizingScheduleId === sch.id;
                  const totalGrupos = sch.grupos?.length || 0;
                  const totalDocentes = sch.docentes?.length || 0;
                  const totalAulas = sch.aulas?.length || 0;
                  const totalCeldas = sch.celdas?.length || 0;
                  const lastLog = sch.ai_optimization_log && sch.ai_optimization_log.length > 0
                    ? sch.ai_optimization_log[sch.ai_optimization_log.length - 1]
                    : null;
                  const scoreCalidad = lastLog?.score_calidad ?? sch.metricas?.score_calidad ?? 100;
                  const conflictos = lastLog?.conflictos_finales ?? sch.metricas?.conflictos_finales ?? 0;

                  return (
                    <div
                      key={sch.id}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span className={`badge ${sch.status === 'published' ? 'badge-green' : 'badge-yellow'}`}>
                              {sch.status === 'published' ? '✓ Publicado Oficial' : '📝 Borrador'}
                            </span>
                            {sch.cycle_year && (
                              <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', fontSize: 11 }}>
                                Ciclo: {sch.cycle_year} {sch.period ? `(${sch.period})` : ''}
                              </span>
                            )}
                            {sch.cct && (
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 11 }}>
                                CCT: {sch.cct}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                              Actualizado {relativeTime(sch.updated_at || sch.created_at)}
                            </span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                            {sch.title}
                          </h3>
                          {sch.school_name && (
                            <div style={{ fontSize: 12, color: '#818cf8', marginTop: 3 }}>
                              🏫 {sch.school_name}
                            </div>
                          )}
                        </div>

                        {/* Badges de Métricas */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Grupos</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>{totalGrupos}</div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Docentes</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{totalDocentes}</div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Aulas</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fcd34d' }}>{totalAulas}</div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Sesiones</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>{totalCeldas}</div>
                          </div>
                          <div style={{
                            background: conflictos === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                            border: `1px solid ${conflictos === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                            borderRadius: 10,
                            padding: '6px 12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: 10, color: conflictos === 0 ? '#34d399' : '#fb7185', textTransform: 'uppercase' }}>Conflictos</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: conflictos === 0 ? '#34d399' : '#fb7185' }}>
                              {conflictos === 0 ? '0 ✓' : `${conflictos} ⚠️`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Diagnóstico Pedagógico y Sugerencias Rápidas */}
                      {lastLog?.analisis_pedagogico && (
                        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'rgba(240,244,255,0.9)' }}>
                          <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🤖</span> Diagnóstico IA de Balance Curricular y Carga Docente:
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                            {lastLog.analisis_pedagogico.balance_jornada && (
                              <div style={{ fontSize: 11 }}>
                                <strong>Jornada:</strong> {lastLog.analisis_pedagogico.balance_jornada}
                              </div>
                            )}
                            {lastLog.analisis_pedagogico.horas_muertas_evaluacion && (
                              <div style={{ fontSize: 11 }}>
                                <strong>Horas Muertas:</strong> {lastLog.analisis_pedagogico.horas_muertas_evaluacion}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Barra de Acciones del Horario */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="btn-sm btn-primary"
                            onClick={() => handleOptimizeSchedule(sch.id)}
                            disabled={isOptimizing}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            {isOptimizing ? '⏳ Optimizando CSP & IA...' : '⚡ Optimizar con IA'}
                          </button>
                          {sch.ai_optimization_log && sch.ai_optimization_log.length > 0 && (
                            <button
                              className="btn-sm btn-ghost"
                              onClick={() => setSelectedScheduleLog(sch)}
                              style={{ border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                            >
                              📊 Historial IA ({sch.ai_optimization_log.length})
                            </button>
                          )}
                          <a
                            href={`/${locale}/horarios`}
                            className="btn-sm btn-ghost"
                            style={{ textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
                          >
                            👁️ Abrir en Diseñador
                          </a>
                        </div>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleDeleteSchedule(sch.id, sch.title)}
                          title="Eliminar Horario"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal: Historial y Log de Optimización IA de Horario */}
            {selectedScheduleLog && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 780, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 70px rgba(0,0,0,0.8)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>
                        📊 Diagnóstico y Registro de Optimización con IA
                      </h3>
                      <div style={{ fontSize: 12, color: '#818cf8', marginTop: 4 }}>
                        {selectedScheduleLog.title} · {selectedScheduleLog.school_name || 'Plantel'}
                      </div>
                    </div>
                    <button className="btn-sm btn-ghost" onClick={() => setSelectedScheduleLog(null)}>✕ Cerrar</button>
                  </div>

                  <div style={{ display: 'grid', gap: 16 }}>
                    {(selectedScheduleLog.ai_optimization_log || []).slice().reverse().map((log: any, idx: number) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <span className="badge badge-blue" style={{ fontSize: 11 }}>
                            Ejecución #{selectedScheduleLog.ai_optimization_log!.length - idx} · {new Date(log.timestamp).toLocaleString('es-MX')}
                          </span>
                          <span className="badge badge-green" style={{ fontSize: 11 }}>
                            Score: {log.score_calidad ?? 100}% · Conflictos: {log.conflictos_finales ?? 0}
                          </span>
                        </div>

                        {log.analisis_pedagogico && (
                          <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: 12 }}>
                            {log.analisis_pedagogico.diagnostico_general && (
                              <div style={{ color: 'rgba(240,244,255,0.9)', lineHeight: 1.5 }}>
                                <strong>Diagnóstico:</strong> {log.analisis_pedagogico.diagnostico_general}
                              </div>
                            )}
                            {log.analisis_pedagogico.alertas_sobrecarga?.length > 0 && (
                              <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', padding: '8px 12px', borderRadius: 8, color: '#fecdd3' }}>
                                <strong>⚠️ Alertas de sobrecarga o descanso:</strong>
                                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                                  {log.analisis_pedagogico.alertas_sobrecarga.map((a: string, aIdx: number) => (
                                    <li key={aIdx}>{a}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {log.analisis_pedagogico.sugerencias_mejora?.length > 0 && (
                              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 12px', borderRadius: 8, color: '#fef3c7' }}>
                                <strong>💡 Recomendaciones pedagógicas:</strong>
                                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                                  {log.analisis_pedagogico.sugerencias_mejora.map((s: string, sIdx: number) => (
                                    <li key={sIdx}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 20, textAlign: 'right' }}>
                    <button className="btn-sm btn-ghost" onClick={() => setSelectedScheduleLog(null)}>
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── API KEYS & IA ── */}
        {activeTab === 'keys' && (
          <>
            <h1>🔑 Gestión de API Keys y Proveedor de IA</h1>
            
            {/* ── Modelos Activos por Perfil ── */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff', margin: '0 0 4px 0' }}>🎛️ Modelos Activos por Perfil</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 20px 0' }}>
                Configura el proveedor y modelo para cada perfil de usuario. Los cambios aplican inmediatamente a todas las generaciones.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

                {/* Tarjeta Estándar */}
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>⚡</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#c7d2fe', fontSize: 13 }}>Uso Estándar (Docentes)</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Cuota gratuita · 500 RPD / 15 RPM</div>
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: '0 0 10px 0' }}>
                    <label>Proveedor</label>
                    <select
                      value={config['active_provider'] || 'gemini'}
                      onChange={e => setConfig(c => ({ ...c, active_provider: e.target.value, active_model: (STANDARD_MODELS[e.target.value] || [])[0]?.id || '' }))}
                      style={{ background: '#131324', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' }}
                    >
                      {PROVIDERS.map(p => <option key={p} value={p} style={{ background: '#131324', color: '#f0f4ff' }}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Modelo</label>
                    <select
                      value={config['active_model'] || 'gemini-3.5-flash-lite'}
                      onChange={e => setConfig(c => ({ ...c, active_model: e.target.value }))}
                      style={{ background: '#131324', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' }}
                    >
                      {(STANDARD_MODELS[config['active_provider'] || 'gemini'] || []).map(m => (
                        <option key={m.id} value={m.id} style={{ background: '#131324', color: '#f0f4ff' }}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tarjeta Premium */}
                <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>⭐</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fde68a', fontSize: 13 }}>Uso Premium (Admin + Usuarios Autorizados)</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Modelos avanzados / APIs de paga</div>
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: '0 0 10px 0' }}>
                    <label>Proveedor</label>
                    <select
                      value={config['admin_provider'] || 'gemini'}
                      onChange={e => setConfig(c => ({ ...c, admin_provider: e.target.value, admin_model: (PREMIUM_MODELS[e.target.value] || [])[0]?.id || '' }))}
                      style={{ background: '#131324', color: '#fde68a', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' }}
                    >
                      {PROVIDERS.map(p => <option key={p} value={p} style={{ background: '#131324', color: '#f0f4ff' }}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Modelo</label>
                    <select
                      value={config['admin_model'] || 'gemini-3.5-flash-lite'}
                      onChange={e => setConfig(c => ({ ...c, admin_model: e.target.value }))}
                      style={{ background: '#131324', color: '#fde68a', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' }}
                    >
                      {(PREMIUM_MODELS[config['admin_provider'] || 'gemini'] || []).map(m => (
                        <option key={m.id} value={m.id} style={{ background: '#131324', color: '#f0f4ff' }}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Guardar Configuración */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {testResult && (
                  <span style={{ fontSize: 12, color: testResult.includes('✅') ? '#4ade80' : '#f87171' }}>
                    {testResult}
                  </span>
                )}
                <button className="btn-sm btn-ghost" onClick={testConnection} style={{ border: '1px solid rgba(255,255,255,0.1)', height: 38 }}>
                  Probar conexión a BD
                </button>
                <button
                  className="btn-sm btn-primary"
                  disabled={saving}
                  style={{ height: 38, padding: '0 20px', fontWeight: 700 }}
                  onClick={() => saveConfig({
                    active_provider: config['active_provider'] || 'gemini',
                    active_model:    config['active_model']    || 'gemini-3.5-flash-lite',
                    admin_provider:  config['admin_provider']  || 'gemini',
                    admin_model:     config['admin_model']     || 'gemini-3.5-flash-lite',
                  })}
                >
                  {saving ? 'Guardando...' : '💾 Guardar Configuración de Modelos'}
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>
              🔐 Las API Keys se almacenan cifradas con AES-256. Nadie puede ver su valor real desde la interfaz.
            </div>

            {/* Add form */}
            <h3 style={{ fontSize: 14, color: '#818cf8', marginBottom: 16 }}>Agregar Nueva Key</h3>
            <div className="form-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                <label>Etiqueta</label>
                <input placeholder="Ej: Gemini cuenta 2" value={newKey.label} onChange={e => setNewKey(k => ({ ...k, label: e.target.value }))} />
              </div>
              <div className="form-group" style={{ width: 140 }}>
                <label>Proveedor</label>
                <select
                  value={newKey.provider}
                  onChange={e => setNewKey(k => ({ ...k, provider: e.target.value }))}
                  style={{ background: '#131324', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  {PROVIDERS.map(p => <option key={p} value={p} style={{ background: '#131324', color: '#f0f4ff' }}>{p}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2, minWidth: 220 }}>
                <label>API Key</label>
                <input type="password" placeholder="Pega tu API Key aquí" value={newKey.apiKey} onChange={e => setNewKey(k => ({ ...k, apiKey: e.target.value }))} />
              </div>
              <div className="form-group" style={{ width: 200 }}>
                <label>Modelo por defecto (opcional)</label>
                <select
                  value={newKey.modelDefault}
                  onChange={e => setNewKey(k => ({ ...k, modelDefault: e.target.value }))}
                  style={{ background: '#131324', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <option value="" style={{ background: '#131324', color: '#f0f4ff' }}>— Usar modelo activo —</option>
                  {(MODELS[newKey.provider] || []).map(m => (
                    <option key={m.id} value={m.id} style={{ background: '#131324', color: '#f0f4ff' }}>{m.label}</option>
                  ))}
                </select>
              </div>
              <button className="btn-sm btn-primary" onClick={addKey} disabled={saving} style={{ height: 38, alignSelf: 'flex-end', minWidth: 100 }}>
                {saving ? '...' : '+ Agregar'}
              </button>
            </div>

            <div className="divider" />

            {/* Keys table */}
            {keys.length === 0 ? (
              <div className="empty-state">No hay API Keys configuradas.<br/>Agrega tu primera key arriba.</div>
            ) : (
              <>
                {/* Header bar with Test All button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    🔑 {keys.length} {keys.length === 1 ? 'key registrada' : 'keys registradas'}
                  </span>
                  <button
                    className="btn-sm btn-primary"
                    onClick={testAllKeys}
                    disabled={testingAll}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13 }}
                  >
                    {testingAll ? (
                      <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Probando todas...</>
                    ) : (
                      <>🔬 Probar Todas las Llaves</>
                    )}
                  </button>
                </div>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Prioridad</th><th>Proveedor</th><th>Etiqueta</th><th>Key</th>
                      <th>Estado</th><th>Usos</th><th>Errores</th><th>Último uso</th>
                      <th>Resultado Prueba</th><th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...keys].sort((a, b) => a.priority - b.priority).map((k, idx) => {
                      const testRes = keyTestResults[k.id];
                      const isTesting = testingKeys.has(k.id);
                      return (
                        <tr key={k.id}>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-sm btn-ghost" onClick={() => movePriority(k.id, 'up')} disabled={idx === 0}>↑</button>
                              <span style={{ color: '#818cf8', fontWeight: 700 }}>#{k.priority}</span>
                              <button className="btn-sm btn-ghost" onClick={() => movePriority(k.id, 'down')} disabled={idx === keys.length - 1}>↓</button>
                            </div>
                          </td>
                          <td><span className="badge badge-blue">{k.provider}</span></td>
                          <td>
                            {editLabelId === k.id ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  value={editLabelValue}
                                  onChange={e => setEditLabelValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveKeyLabel(k.id); if (e.key === 'Escape') setEditLabelId(null); }}
                                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #6366f1', borderRadius: 6, padding: '4px 8px', color: '#f0f4ff', fontSize: 12, width: 180 }}
                                  autoFocus
                                />
                                <button className="btn-sm btn-primary" onClick={() => saveKeyLabel(k.id)}>✓</button>
                                <button className="btn-sm btn-ghost" onClick={() => setEditLabelId(null)}>✗</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span>{k.label}</span>
                                <button className="btn-sm btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}
                                  onClick={() => { setEditLabelId(k.id); setEditLabelValue(k.label); }}>✏️</button>
                              </div>
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace', color: '#facc15' }}>{k.key_preview}</td>
                          <td>
                            <span className={`badge ${k.is_active ? 'badge-green' : 'badge-yellow'}`}>
                              {k.is_active ? '✓ Activa' : '⏸ Inactiva'}
                            </span>
                          </td>
                          <td>{k.usage_count}</td>
                          <td style={{ color: k.error_count > 0 ? '#f87171' : 'inherit' }}>{k.error_count}</td>
                          <td style={{ fontSize: 11 }}>{relativeTime(k.last_used_at)}</td>

                          {/* Test result cell */}
                          <td style={{ minWidth: 130 }}>
                            {isTesting ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                Probando...
                              </span>
                            ) : testRes ? (
                              <div>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: testRes.ok ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                                  border: `1px solid ${testRes.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                                  borderRadius: 6, padding: '3px 8px', fontSize: 12,
                                  color: testRes.ok ? '#4ade80' : '#f87171',
                                }}>
                                  {testRes.ok ? '✅' : '❌'}
                                  {testRes.ok ? ` ${testRes.latencyMs}ms` : ''}
                                </span>
                                {!testRes.ok && (
                                  <div style={{ fontSize: 10, color: '#f87171', marginTop: 3, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={testRes.message}>{testRes.message}</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-sm btn-ghost"
                                onClick={() => testKey(k.id)}
                                disabled={isTesting || testingAll}
                                style={{ color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
                                title="Probar esta API Key"
                              >
                                {isTesting ? '...' : '🔬 Probar'}
                              </button>
                              <button className="btn-sm btn-ghost" onClick={() => toggleKey(k.id, !k.is_active)}>
                                {k.is_active ? 'Pausar' : 'Activar'}
                              </button>
                              <button className="btn-sm btn-danger" onClick={() => deleteKey(k.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {/* ── CONFIG ── */}
        {activeTab === 'config' && (
          <>
            <h1>⚙️ Configuración de la Plataforma</h1>
            <div style={{ display: 'grid', gap: 20, maxWidth: 560 }}>
              <div className="form-group">
                <label>Ciclo Escolar Activo</label>
                <input value={config['school_year'] || ''} onChange={e => setConfig(c => ({ ...c, school_year: e.target.value }))}
                  onBlur={() => saveConfig({ school_year: config['school_year'] || '' })} placeholder="2026-2027" />
              </div>
              <div className="form-group">
                <label>Máximo de Planeaciones por Docente por Día</label>
                <input type="number" min="1" max="100" value={config['max_daily_plannings'] || '10'}
                  onChange={e => setConfig(c => ({ ...c, max_daily_plannings: e.target.value }))}
                  onBlur={() => saveConfig({ max_daily_plannings: config['max_daily_plannings'] || '10' })} />
              </div>
              <div className="form-group">
                <label>Mensaje de bienvenida (visible en el dashboard del docente)</label>
                <input value={config['welcome_message'] || ''}
                  onChange={e => setConfig(c => ({ ...c, welcome_message: e.target.value }))}
                  onBlur={() => saveConfig({ welcome_message: config['welcome_message'] || '' })}
                  placeholder="Ej: ¡Bienvenido al ciclo 2026-2027!" />
              </div>
              <div className="divider" />
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 12 }}>
                  Modo Mantenimiento
                  <div style={{ position: 'relative' }}>
                    <input type="checkbox" id="maint" checked={config['maintenance_mode'] === 'true'}
                      onChange={e => saveConfig({ maintenance_mode: e.target.checked ? 'true' : 'false' })}
                      style={{ width: 20, height: 20, accentColor: '#6366f1' }} />
                  </div>
                  {config['maintenance_mode'] === 'true' && <span className="badge badge-yellow">⚠️ Activo</span>}
                </label>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                  Cuando está activo, los docentes ven un mensaje de mantenimiento en lugar de la plataforma.
                </p>
              </div>
              {config['maintenance_mode'] === 'true' && (
                <div className="form-group">
                  <label>Mensaje de mantenimiento</label>
                  <input value={config['maintenance_message'] || ''}
                    onChange={e => setConfig(c => ({ ...c, maintenance_message: e.target.value }))}
                    onBlur={() => saveConfig({ maintenance_message: config['maintenance_message'] || '' })} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <>
            <div className="section-header">
              <h1>👥 Gestión de Docentes</h1>
              <button className="btn-sm btn-ghost" onClick={() => { setUsersLoaded(false); loadTeachers().then(() => setUsersLoaded(true)); }}>↺ Actualizar</button>
            </div>
            {!usersLoaded ? (
              <div className="empty-state">Cargando docentes...</div>
            ) : teachers.length === 0 ? (
              <div className="empty-state">
                No hay docentes registrados aún.<br/>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Los docentes aparecen aquí cuando inician sesión por primera vez.</span>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr><th>Nombre</th><th>Email</th><th>Escuela</th><th>Rol</th><th>Acceso IA</th><th>Planes</th><th>PAEC</th><th>PMC</th><th>Docs</th><th>Última actividad</th><th>Estado</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t.email}</td>
                      <td style={{ fontSize: 12 }}>{t.school_name || '—'}</td>
                      <td>
                        <select
                          value={t.role || 'docente'}
                          onChange={e => changeUserRole(t.id, e.target.value)}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 8px', color: '#f0f4ff', fontSize: '12px', outline: 'none' }}
                        >
                          <option value="administrador">Administrador</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="atp">ATP</option>
                          <option value="director">Director</option>
                          <option value="docente">Docente</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleUserPremium(t.id, !t.is_premium)}
                          title={t.is_premium ? 'Haz clic para revertir a Estándar' : 'Haz clic para dar acceso Premium'}
                          style={{
                            background: t.is_premium ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
                            border: t.is_premium ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                            color: t.is_premium ? '#fde68a' : 'rgba(255,255,255,0.5)',
                            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                          }}
                        >
                          {t.is_premium ? '⭐ Premium' : '⚡ Estándar'}
                        </button>
                      </td>
                      <td><span className="badge badge-blue">{t.planning_count}</span></td>
                      <td><span className="badge badge-blue">{t.paec_count}</span></td>
                      <td><span className="badge badge-blue">{t.pmc_count}</span></td>
                      <td>{t.doc_count}</td>
                      <td style={{ fontSize: 11 }}>
                        {relativeTime(t.last_active)}
                        {isUserOnline(t.last_seen_at) ? (
                          <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', borderRadius: 12, padding: '2px 6px', fontSize: 10, fontWeight: 600 }} title="Conectado en este momento">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} /> En línea
                          </span>
                        ) : isRecentlyActive(t.last_active) ? (
                          <span style={{ marginLeft: 6, display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', opacity: 0.8, verticalAlign: 'middle' }} title="Reciente (últimos 30 min)" />
                        ) : null}
                      </td>
                      <td><span className={`badge ${t.is_blocked ? 'badge-red' : 'badge-green'}`}>{t.is_blocked ? 'Bloqueado' : 'Habilitado'}</span></td>
                      <td>
                        <button className={`btn-sm ${t.is_blocked ? 'btn-primary' : 'btn-danger'}`}
                          onClick={() => toggleUser(t.id, !t.is_blocked)}>
                          {t.is_blocked ? 'Reactivar' : 'Bloquear'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── PROMPTS ── */}
        {activeTab === 'prompts' && (
          <>
            <h1>✏️ Editor de Prompts del Sistema</h1>
            <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>
              ⚠️ Modificar un prompt afecta TODAS las generaciones futuras. Edita con cuidado.
            </div>
            {editPromptId ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#818cf8', fontSize: 16 }}>
                    Editando: {prompts.find(p => p.id === editPromptId)?.label}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-sm btn-ghost" onClick={() => setEditPromptId(null)}>Cancelar</button>
                    <button className="btn-sm btn-primary" onClick={savePrompt} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
                  </div>
                </div>
                <div className="form-group">
                  <textarea value={editPromptContent} onChange={e => setEditPromptContent(e.target.value)} style={{ minHeight: 450 }} />
                </div>
              </div>
            ) : prompts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✏️</div>
                <h3 style={{ color: '#f0f4ff', marginBottom: 8 }}>No hay prompts en la base de datos</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>
                  Haz clic en el botón para cargar los prompts del sistema en la base de datos.
                </p>
                <button className="btn-sm btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}
                  onClick={seedPrompts} disabled={seedingPrompts}>
                  {seedingPrompts ? 'Cargando prompts...' : '🌱 Cargar Prompts del Sistema'}
                </button>
              </div>
            ) : (
              prompts.map(p => (
                <div key={p.id} className="prompt-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="prompt-label">{p.label}</div>
                      <div className="prompt-meta">
                        ID: {p.id} · {p.content.length.toLocaleString()} caracteres
                        {p.updated_by && ` · Editado por ${p.updated_by}`}
                        {p.updated_at && ` · ${new Date(p.updated_at).toLocaleDateString('es-MX')}`}
                      </div>
                    </div>
                    <button className="btn-sm btn-ghost" onClick={() => { setEditPromptId(p.id); setEditPromptContent(p.content); }}>
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── NORMATIVA ── */}
        {activeTab === 'normativa' && (
          <>
            <h1>🏛️ Catálogo Normativo (Base de Datos)</h1>

            {normativaStats && (
              <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="stat-card"><div className="num">{normativaStats.total_documentos}</div><div className="lbl">Documentos</div></div>
                <div className="stat-card"><div className="num">{normativaStats.total_articulos}</div><div className="lbl">Artículos Totales</div></div>
                <div className="stat-card"><div className="num">{normativaStats.arts_pmc}</div><div className="lbl">Para PMC</div></div>
                <div className="stat-card"><div className="num">{normativaStats.arts_paec}</div><div className="lbl">Para PAEC</div></div>
                <div className="stat-card"><div className="num">{normativaStats.arts_pips}</div><div className="lbl">Para PIPS</div></div>
              </div>
            )}

            {/* Toolbar */}
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn-sm btn-primary" onClick={() => setShowNewDocModal(true)}>+ Nuevo Documento</button>
              <button className="btn-sm" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                onClick={activateAllNormativa}>✅ Activar Todos</button>
              <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', display: 'inline-block', margin: '0 4px' }} />
              <button
                className="btn-sm"
                style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}
                onClick={saveDefaultNormativa}
                disabled={savingDefault}
                title="Guarda el estado actual como configuración predeterminada"
              >
                {savingDefault ? '💾 Guardando...' : '💾 Guardar Predeterminado'}
              </button>
              <button
                className="btn-sm"
                style={{
                  background: normativaDefaultInfo ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${normativaDefaultInfo ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.12)'}`,
                  color: normativaDefaultInfo ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                  cursor: normativaDefaultInfo ? 'pointer' : 'not-allowed',
                }}
                onClick={resetToDefaultNormativa}
                disabled={resettingDefault || !normativaDefaultInfo}
                title={normativaDefaultInfo
                  ? `Restablecer al estado guardado el ${new Date(normativaDefaultInfo.saved_at).toLocaleString('es-MX')}`
                  : 'Primero guarda una configuración predeterminada'}
              >
                {resettingDefault ? '🔄 Restableciendo...' : '🔄 Restablecer Predeterminado'}
              </button>
              <button className="btn-sm btn-ghost" onClick={loadNormativa} style={{ marginLeft: 'auto' }}>↺ Actualizar</button>
            </div>
            {/* Indicador de configuración predeterminada guardada */}
            {normativaDefaultInfo ? (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 12, color: 'rgba(165,180,252,0.85)' }}>
                <span>📌</span>
                <span>
                  <strong>Predeterminado guardado:</strong>{' '}
                  {normativaDefaultInfo.vigentes} de {normativaDefaultInfo.total} documentos vigentes
                  {' · '}Guardado el {new Date(normativaDefaultInfo.saved_at).toLocaleString('es-MX')}
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: 14, padding: '7px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: 8, fontSize: 12, color: 'rgba(251,191,36,0.7)' }}>
                ⚠️ Aún no hay configuración predeterminada guardada. Usa <strong>💾 Guardar Predeterminado</strong> para crear una.
              </div>
            )}

            {/* Filtros */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                placeholder="🔍 Buscar por título o fuente..."
                value={normativaSearch}
                onChange={e => setNormativaSearch(e.target.value)}
                style={{ flex: '1 1 240px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}
              />
              <select value={normativaTypeFilter} onChange={e => setNormativaTypeFilter(e.target.value)}
                style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}>
                <option value="todos">Todos los tipos</option>
                <option value="ley_general">Ley General</option>
                <option value="ley_local">Ley Local</option>
                <option value="ley_federal">Ley Federal</option>
                <option value="reglamento">Reglamento</option>
                <option value="acuerdo">Acuerdo</option>
                <option value="circular">Circular</option>
                <option value="constitucion">Constitución</option>
                <option value="manual">Manual</option>
                <option value="otro">Otro</option>
              </select>
              <select value={normativaVigenteFilter} onChange={e => setNormativaVigenteFilter(e.target.value as any)}
                style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}>
                <option value="todos">Todos los estados</option>
                <option value="vigentes">Solo Vigentes</option>
                <option value="no_vigentes">Solo No Vigentes</option>
              </select>
            </div>

            {/* Vista detalle de documento seleccionado */}
            {selectedNormativaDoc ? (
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                  <button className="btn-sm btn-ghost" onClick={() => setSelectedNormativaDoc(null)}>← Volver</button>
                  <h3 style={{ color: '#818cf8', fontSize: 14, margin: 0, flex: 1 }}>{selectedNormativaDoc.titulo}</h3>
                  <button
                    className="btn-sm"
                    style={{ background: selectedNormativaDoc.vigente ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)', border: `1px solid ${selectedNormativaDoc.vigente ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`, color: selectedNormativaDoc.vigente ? '#fbbf24' : '#4ade80' }}
                    onClick={() => toggleNormativaVigente(selectedNormativaDoc.id, selectedNormativaDoc.vigente)}
                  >{selectedNormativaDoc.vigente ? 'Desactivar' : 'Activar'}</button>
                  <button className="btn-sm btn-primary" onClick={() => { setNewArtForm(f => ({ ...f, documento_id: selectedNormativaDoc.id })); setShowNewArtModal(true); }}>+ Artículo</button>
                  <button className="btn-sm btn-danger" onClick={() => deleteNormativaDoc(selectedNormativaDoc.id, selectedNormativaDoc.titulo)}>🗑️ Eliminar doc</button>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                  {selectedNormativaDoc.articulos?.length || 0} artículo(s) · Tipo: {selectedNormativaDoc.tipo} · Fuente: {selectedNormativaDoc.fuente || '—'}
                </div>
                <input
                  placeholder="🔍 Buscar artículo..."
                  value={artSearch}
                  onChange={e => setArtSearch(e.target.value)}
                  style={{ width: '100%', marginBottom: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, boxSizing: 'border-box' }}
                />
                {(selectedNormativaDoc.articulos || []).filter(a => !artSearch || a.numero.toLowerCase().includes(artSearch.toLowerCase()) || a.texto.toLowerCase().includes(artSearch.toLowerCase())).map(art => (
                  <div key={art.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
                    {editingArt?.id === art.id ? (
                      <form onSubmit={handleUpdateArt}>
                        <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                          <input value={editingArt.numero} onChange={e => setEditingArt(a => a ? { ...a, numero: e.target.value } : null)}
                            placeholder="Número (ej: Art. 3°)" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 10px', color: '#f0f4ff', fontSize: 13 }} />
                          <textarea value={editingArt.texto} onChange={e => setEditingArt(a => a ? { ...a, texto: e.target.value } : null)}
                            rows={3} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 10px', color: '#f0f4ff', fontSize: 13, resize: 'vertical' }} />
                          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                            {(['pmc', 'paec', 'pips', 'planeacion'] as const).map(m => (
                              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                <input type="checkbox" checked={editingArt.aplicable_a.includes(m)}
                                  onChange={e => setEditingArt(a => a ? { ...a, aplicable_a: e.target.checked ? [...a.aplicable_a, m] : a.aplicable_a.filter(x => x !== m) } : null)} />
                                {m.toUpperCase()}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" className="btn-sm btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                          <button type="button" className="btn-sm btn-ghost" onClick={() => setEditingArt(null)}>Cancelar</button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#818cf8', marginBottom: 4 }}>{art.numero}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{art.texto}</div>
                          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(art.aplicable_a || []).map(m => (
                              <span key={m} className="badge badge-blue" style={{ fontSize: 10, padding: '2px 6px' }}>{m.toUpperCase()}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="btn-sm btn-ghost" onClick={() => setEditingArt(art)}>✏️</button>
                          <button className="btn-sm btn-danger" onClick={() => deleteNormativaArt(art.id)}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(selectedNormativaDoc.articulos?.length || 0) === 0 && <div className="empty-state">Este documento no tiene artículos cargados.</div>}
              </div>
            ) : (() => {
              const filtered = normativaDocs.filter(doc => {
                const q = normativaSearch.toLowerCase();
                const matchSearch = !q || doc.titulo.toLowerCase().includes(q) || (doc.fuente || '').toLowerCase().includes(q);
                const matchType = normativaTypeFilter === 'todos' || doc.tipo === normativaTypeFilter;
                const matchV = normativaVigenteFilter === 'todos' || (normativaVigenteFilter === 'vigentes' ? doc.vigente : !doc.vigente);
                return matchSearch && matchType && matchV;
              });
              return filtered.length === 0 ? (
                <div className="empty-state">
                  {normativaDocs.length === 0 ? 'No hay normativa cargada. Ejecuta el seeder para inicializarla.' : 'No se encontraron documentos con los filtros aplicados.'}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Mostrando {filtered.length} de {normativaDocs.length} documento(s)</div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '45%' }}>Documento</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Artículos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(doc => (
                        <tr key={doc.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{doc.titulo}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{doc.fuente || 'Sin fuente'}</div>
                          </td>
                          <td><span className="badge badge-blue">{doc.tipo}</span></td>
                          <td>
                            <button onClick={() => toggleNormativaVigente(doc.id, doc.vigente)} title={doc.vigente ? 'Clic para desactivar' : 'Clic para activar'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              {doc.vigente ? <span className="badge badge-green">Vigente ✓</span> : <span className="badge badge-yellow">No vigente</span>}
                            </button>
                          </td>
                          <td><span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>{doc.articulos?.length || 0} arts</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-sm" style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8' }} onClick={() => setSelectedNormativaDoc(doc)}>Ver artículos</button>
                              <button className="btn-sm btn-danger" onClick={() => deleteNormativaDoc(doc.id, doc.titulo)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}

            {/* Modal: Nuevo Documento */}
            {showNewDocModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 520 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ color: '#818cf8', margin: 0 }}>Nuevo Documento Normativo</h3>
                    <button className="btn-sm btn-ghost" onClick={() => setShowNewDocModal(false)}>✕ Cerrar</button>
                  </div>
                  <form onSubmit={handleCreateDoc} style={{ display: 'grid', gap: 14 }}>
                    <div className="form-group"><label>Título *</label><input value={newDocForm.titulo} onChange={e => setNewDocForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Ley General de Educación" required /></div>
                    <div className="form-group">
                      <label>Tipo *</label>
                      <select value={newDocForm.tipo} onChange={e => setNewDocForm(f => ({ ...f, tipo: e.target.value }))} style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, width: '100%' }}>
                        <option value="ley_general">Ley General</option><option value="ley_local">Ley Local</option><option value="ley_federal">Ley Federal</option>
                        <option value="reglamento">Reglamento</option><option value="acuerdo">Acuerdo</option><option value="circular">Circular</option>
                        <option value="constitucion">Constitución</option><option value="manual">Manual</option><option value="otro">Otro</option>
                      </select>
                    </div>
                    <div className="form-group"><label>Fuente / DOF</label><input value={newDocForm.fuente} onChange={e => setNewDocForm(f => ({ ...f, fuente: e.target.value }))} placeholder="Ej: DOF 30-09-2019" /></div>
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={newDocForm.vigente} onChange={e => setNewDocForm(f => ({ ...f, vigente: e.target.checked }))} style={{ accentColor: '#6366f1' }} />
                      Marcar como vigente
                    </label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="submit" className="btn-sm btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Creando...' : 'Crear Documento'}</button>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => setShowNewDocModal(false)}>Cancelar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Nuevo Artículo */}
            {showNewArtModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ color: '#818cf8', margin: 0 }}>Nuevo Artículo</h3>
                    <button className="btn-sm btn-ghost" onClick={() => setShowNewArtModal(false)}>✕ Cerrar</button>
                  </div>
                  <form onSubmit={handleCreateArt} style={{ display: 'grid', gap: 14 }}>
                    <div className="form-group">
                      <label>Documento</label>
                      <select value={newArtForm.documento_id} onChange={e => setNewArtForm(f => ({ ...f, documento_id: e.target.value }))} required
                        style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13, width: '100%' }}>
                        <option value="">— Selecciona un documento —</option>
                        {normativaDocs.map(d => <option key={d.id} value={d.id}>{d.titulo}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Número del artículo *</label><input value={newArtForm.numero} onChange={e => setNewArtForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ej: Art. 3°" required /></div>
                    <div className="form-group"><label>Texto del artículo *</label><textarea value={newArtForm.texto} onChange={e => setNewArtForm(f => ({ ...f, texto: e.target.value }))} rows={5} placeholder="Texto completo del artículo..." required style={{ minHeight: 120 }} /></div>
                    <div>
                      <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 8 }}>Aplicable a módulos:</label>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {(['pmc', 'paec', 'pips', 'planeacion'] as const).map(m => (
                          <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={newArtForm.aplicable_a.includes(m)}
                              onChange={e => setNewArtForm(f => ({ ...f, aplicable_a: e.target.checked ? [...f.aplicable_a, m] : f.aplicable_a.filter(x => x !== m) }))}
                              style={{ accentColor: '#6366f1' }} />
                            {m.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button type="submit" className="btn-sm btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Agregando...' : 'Agregar Artículo'}</button>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => setShowNewArtModal(false)}>Cancelar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MALLA Y PROGRAMAS (CURRÍCULA) ── */}
        {activeTab === 'curricula' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ margin: 0 }}>📚 Malla Curricular y Programas de Estudio</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(240,244,255,0.5)' }}>
                  Gestión oficial de UACs, Propósitos, Contenidos Formativos y Progresiones para Bachillerato General y Tecnológico
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-sm btn-ghost" onClick={loadCurricula} title="Recargar catálogo">
                  🔄 Actualizar
                </button>
                <button className="btn-sm" onClick={() => setShowExtractModal(true)}
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', fontWeight: 600 }}>
                  📄 Subir Programa Oficial (PDF con IA)
                </button>
                <button className="btn-sm btn-primary" onClick={handleOpenNewProgramModal}>
                  ➕ Nueva UAC Manual
                </button>
              </div>
            </div>

            {/* Tarjetas de Estadísticas Curriculares Globales */}
            <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 20 }}>
              <div className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(30,27,75,0.6), rgba(15,23,42,0.8))', border: '1px solid rgba(129,140,248,0.2)' }}>
                <div className="num" style={{ color: '#818cf8' }}>{curriculaPrograms.length}</div>
                <div className="lbl">Total UACs en Catálogo Oficial</div>
              </div>
              <div className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(6,78,59,0.4), rgba(15,23,42,0.8))', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="num" style={{ color: '#10b981' }}>
                  {curriculaPrograms.filter(p => p.model_type === 'propositos_contenidos' || p.semester < 5).length}
                </div>
                <div className="lbl">Propósitos y Contenidos (1.° a 4.°)</div>
              </div>
              <div className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(88,28,135,0.4), rgba(15,23,42,0.8))', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div className="num" style={{ color: '#a855f7' }}>
                  {curriculaPrograms.filter(p => p.model_type === 'progresiones' || p.semester >= 5).length}
                </div>
                <div className="lbl">Progresiones (5.° y 6.° Vigentes 26-27)</div>
              </div>
              <div className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(12,74,110,0.4), rgba(15,23,42,0.8))', border: '1px solid rgba(56,189,248,0.2)' }}>
                <div className="num" style={{ color: '#38bdf8' }}>
                  {curriculaPrograms.filter(p => p.subsystem === 'bge' || p.subsystem === 'all' || !p.subsystem).length}
                </div>
                <div className="lbl">Bachillerato General Estatal (BGE)</div>
              </div>
              <div className="stat-card" style={{ background: 'linear-gradient(145deg, rgba(120,53,15,0.4), rgba(15,23,42,0.8))', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="num" style={{ color: '#f59e0b' }}>
                  {curriculaPrograms.filter(p => p.subsystem !== 'bge' && p.subsystem !== 'all' && p.subsystem).length}
                </div>
                <div className="lbl">Bachilleratos Tecnológicos / Otros</div>
              </div>
            </div>

            {/* Selector de Modo de Vista y Filtros */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20, background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                {/* Switcher Malla vs Tabla */}
                <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setCurriculaViewMode('malla')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: curriculaViewMode === 'malla' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                      color: curriculaViewMode === 'malla' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>🗺️</span> Mapa Curricular Semestral
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurriculaViewMode('tabla')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: curriculaViewMode === 'tabla' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
                      color: curriculaViewMode === 'tabla' ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>📋</span> Catálogo y Listado Detallado
                  </button>
                </div>

                <div style={{ fontSize: 13, color: 'rgba(240,244,255,0.6)' }}>
                  Mostrando <strong style={{ color: '#818cf8' }}>
                    {curriculaPrograms.filter(p => {
                      if (curriculaSubsystem !== 'todos' && p.subsystem !== curriculaSubsystem && p.subsystem !== 'all' && p.subsystem) return false;
                      if (curriculaSemester !== 'todos' && p.semester !== parseInt(curriculaSemester, 10)) return false;
                      if (curriculaComponent !== 'todos' && p.component !== curriculaComponent) return false;
                      if (curriculaSearch.trim()) {
                        const q = curriculaSearch.toLowerCase();
                        const matchName = p.uac_name.toLowerCase().includes(q);
                        const matchCurr = (p.curriculum_name || '').toLowerCase().includes(q);
                        if (!matchName && !matchCurr) return false;
                      }
                      return true;
                    }).length}
                  </strong> de {curriculaPrograms.length} UACs
                </div>
              </div>

              {/* Filtros */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  placeholder="🔍 Buscar por nombre de UAC o especialidad..."
                  value={curriculaSearch}
                  onChange={e => setCurriculaSearch(e.target.value)}
                  style={{ flex: '1 1 240px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}
                />
                <select
                  value={curriculaSubsystem}
                  onChange={e => setCurriculaSubsystem(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}
                >
                  <option value="todos">Todos los Subsistemas</option>
                  <option value="bge">Bachillerato General Estatal (BGE)</option>
                  <option value="tecnologico">Bachillerato Tecnológico</option>
                  <option value="cbtis">CBTIS</option>
                  <option value="cbta">CBTA</option>
                  <option value="cecyte">CECyTE</option>
                  <option value="digital">Bachillerato Digital</option>
                  <option value="emsad">EMSAD</option>
                </select>
                <select
                  value={curriculaSemester}
                  onChange={e => setCurriculaSemester(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}
                >
                  <option value="todos">Todos los Semestres</option>
                  <option value="1">1.° Semestre</option>
                  <option value="2">2.° Semestre</option>
                  <option value="3">3.° Semestre</option>
                  <option value="4">4.° Semestre</option>
                  <option value="5">5.° Semestre</option>
                  <option value="6">6.° Semestre</option>
                </select>
                <select
                  value={curriculaComponent}
                  onChange={e => setCurriculaComponent(e.target.value)}
                  style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', fontSize: 13 }}
                >
                  <option value="todos">Todos los Componentes</option>
                  <option value="fundamental">Currículum Fundamental</option>
                  <option value="laboral">Formación Laboral / Profesional</option>
                  <option value="ampliado">Currículum Ampliado</option>
                  <option value="ext_obligatorio">Formación Extendida Obligatoria (FFEO)</option>
                  <option value="ext_optativo">Formación Extendida Optativa</option>
                </select>
                {(curriculaSubsystem !== 'todos' || curriculaSemester !== 'todos' || curriculaComponent !== 'todos' || curriculaSearch.trim()) && (
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    onClick={() => {
                      setCurriculaSubsystem('todos');
                      setCurriculaSemester('todos');
                      setCurriculaComponent('todos');
                      setCurriculaSearch('');
                    }}
                    style={{ fontSize: 12 }}
                  >
                    ✕ Limpiar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* CONTENIDO PRINCIPAL: VISTA MALLA vs VISTA TABLA */}
            {curriculaLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.6)' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
                <div>Cargando catálogo curricular oficial...</div>
              </div>
            ) : curriculaPrograms.length === 0 ? (
              <div className="empty-state" style={{ padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 14 }}>
                <p style={{ fontSize: 15 }}>No se encontraron programas de estudio en la base de datos.</p>
                <button className="btn-sm btn-primary" onClick={handleOpenNewProgramModal} style={{ marginTop: 10 }}>
                  ➕ Agregar Primer Programa
                </button>
              </div>
            ) : curriculaViewMode === 'malla' ? (
              /* ── VISTA 1: MALLA CURRICULAR INTERACTIVA (MAPA SEMESTRAL 1.° A 6.°) ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
                {[1, 2, 3, 4, 5, 6]
                  .filter(sem => curriculaSemester === 'todos' || sem === parseInt(curriculaSemester, 10))
                  .map(sem => {
                    const semPrograms = curriculaPrograms.filter(p => {
                      if (p.semester !== sem) return false;
                      if (curriculaSubsystem !== 'todos' && p.subsystem !== curriculaSubsystem && p.subsystem !== 'all' && p.subsystem) return false;
                      if (curriculaComponent !== 'todos') {
                        if (curriculaComponent === 'ext_obligatorio' || curriculaComponent === 'ffeo') {
                          if (p.component !== 'ext_obligatorio' && p.component !== 'ffeo') return false;
                        } else if (curriculaComponent === 'ext_optativo' || curriculaComponent === 'ffe_optativa') {
                          if (p.component !== 'ext_optativo' && p.component !== 'ffe_optativa') return false;
                        } else if (p.component !== curriculaComponent) {
                          return false;
                        }
                      }
                      if (curriculaSearch.trim()) {
                        const q = curriculaSearch.toLowerCase();
                        const matchName = p.uac_name.toLowerCase().includes(q);
                        const matchCurr = (p.curriculum_name || '').toLowerCase().includes(q);
                        if (!matchName && !matchCurr) return false;
                      }
                      return true;
                    });

                    const totalSemHours = semPrograms.reduce((acc, p) => acc + (p.total_hours || 0), 0);
                    const weeklySemHours = semPrograms.reduce((acc, p) => acc + Math.round((p.total_hours || 54) / 18), 0);
                    const isProgresionesModel = sem >= 5;

                    return (
                      <div
                        key={sem}
                        style={{
                          background: 'rgba(15,23,42,0.7)',
                          border: sem <= 4 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(168,85,247,0.3)',
                          borderRadius: 14,
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                        }}
                      >
                        {/* Cabecera del Semestre */}
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: '#f0f4ff', fontWeight: 700 }}>
                              {sem}.° Semestre
                            </h3>
                            <span
                              className={`badge ${isProgresionesModel ? 'badge-purple' : 'badge-green'}`}
                              style={{ fontSize: 10, textTransform: 'uppercase' }}
                            >
                              {isProgresionesModel ? '🟣 Progresiones (26-27)' : '🟢 Propósitos y Contenidos'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                            <span>{semPrograms.length} asignaturas</span>
                            <span>{weeklySemHours} h/sem · {totalSemHours} hrs total</span>
                          </div>
                        </div>

                        {/* Tarjetas de Asignaturas del Semestre */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {semPrograms.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 10px', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                              Sin UACs con los filtros actuales
                            </div>
                          ) : (
                            semPrograms.map(p => {
                              const isFfeo = p.component === 'ffeo' || p.component === 'ext_obligatorio';
                              const isOptativa = p.component === 'ext_optativo' || p.component === 'ffe_optativa';
                              const weeklyLoad = Math.round((p.total_hours || 54) / 18);
                              const compColor =
                                p.component === 'laboral' ? '#f59e0b' :
                                p.component === 'ampliado' ? '#10b981' :
                                isFfeo ? '#ec4899' :
                                isOptativa ? '#8b5cf6' : '#3b82f6';

                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    background: 'rgba(30,41,59,0.7)',
                                    borderLeft: `4px solid ${compColor}`,
                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                    borderRight: '1px solid rgba(255,255,255,0.08)',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 10,
                                    padding: '12px',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)')}
                                  onMouseLeave={e => (e.currentTarget.style.transform = 'none', e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)')}
                                >
                                  {/* Encabezado: Badge de Subsistema, Componente y Horas */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          background: p.subsystem === 'bge' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
                                          color: p.subsystem === 'bge' ? '#93c5fd' : '#d8b4fe',
                                          border: `1px solid ${p.subsystem === 'bge' ? 'rgba(59,130,246,0.4)' : 'rgba(168,85,247,0.4)'}`,
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                          textTransform: 'uppercase'
                                        }}
                                      >
                                        {p.subsystem || 'BGE'}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 600,
                                          color: compColor,
                                          background: `${compColor}15`,
                                          border: `1px solid ${compColor}40`,
                                          padding: '1px 6px',
                                          borderRadius: 4
                                        }}
                                      >
                                        {p.component === 'laboral' ? '💼 Laboral' :
                                         p.component === 'ampliado' ? '🌱 Ampliado' :
                                         isFfeo ? '⭐ FFEO' :
                                         isOptativa ? '🎯 Optativa' : '📘 Fundamental'}
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        background: 'rgba(255,255,255,0.08)',
                                        color: '#cbd5e1',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {weeklyLoad} h/sem · {p.total_hours || 54}h
                                    </span>
                                  </div>

                                  {/* Nombre de la UAC y Especialidad */}
                                  <div>
                                    <div
                                      onClick={() => setSelectedProgramDetail(p)}
                                      style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13, lineHeight: 1.35, cursor: 'pointer' }}
                                      title="Hacer clic para ver el programa oficial completo"
                                    >
                                      {p.uac_name}
                                    </div>
                                    {p.curriculum_name && (
                                      <div style={{ fontSize: 11, color: '#a5b4fc', marginTop: 2, fontWeight: 500 }}>
                                        {p.curriculum_name}
                                      </div>
                                    )}
                                  </div>

                                  {/* Estructura Pedagógica Registrada */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                                    {p.component === 'laboral' ? (
                                      <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        💼 3 Actividades Clave (18h c/u)
                                      </span>
                                    ) : isProgresionesModel ? (
                                      <span style={{ color: '#c084fc', fontSize: 10, fontWeight: 600 }}>
                                        🟣 {p.activities?.length || 0} Progresiones
                                      </span>
                                    ) : (
                                      <span style={{ color: '#34d399', fontSize: 10, fontWeight: 600 }}>
                                        🟢 {p.activities?.length || 0} Propósitos {p.contenidos_formativos && p.contenidos_formativos.length > 0 ? `· ${p.contenidos_formativos.reduce((acc, c) => acc + (c.contenidos?.length || 0), 0)} temas` : ''}
                                      </span>
                                    )}
                                  </div>

                                  {/* Botones de Acción Directa en la Tarjeta (CRUD y Reemplazo) */}
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between', alignItems: 'center', marginTop: 2, background: 'rgba(0,0,0,0.3)', padding: '4px 6px', borderRadius: 6 }}>
                                    <button
                                      type="button"
                                      className="btn-sm btn-ghost"
                                      onClick={(e) => { e.stopPropagation(); setSelectedProgramDetail(p); }}
                                      title="Ver / Inspeccionar Programa Oficial"
                                      style={{ padding: '3px 8px', fontSize: 11, color: '#93c5fd' }}
                                    >
                                      👁️ Ver
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-sm btn-ghost"
                                      onClick={(e) => { e.stopPropagation(); handleOpenEditProgramModal(p); }}
                                      title="Editar Datos de la UAC"
                                      style={{ padding: '3px 8px', fontSize: 11, color: '#fcd34d' }}
                                    >
                                      ✏️ Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-sm btn-ghost"
                                      onClick={(e) => { e.stopPropagation(); handleOpenReplaceProgramModal(p); }}
                                      title="Reemplazar Programa con nuevo PDF (IA)"
                                      style={{ padding: '3px 8px', fontSize: 11, color: '#a7f3d0' }}
                                    >
                                      📄 Reemplazar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-sm btn-danger"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteProgram(p.id, p.uac_name); }}
                                      title="Eliminar UAC del Catálogo"
                                      style={{ padding: '3px 8px', fontSize: 11 }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* ── VISTA 2: TABLA Y LISTADO DETALLADO ── */
              <div style={{ overflowX: 'auto', background: 'rgba(15,23,42,0.6)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>UAC / Asignatura Oficial</th>
                      <th>Subsistema</th>
                      <th style={{ textAlign: 'center' }}>Sem.</th>
                      <th>Componente</th>
                      <th>Carga Horaria</th>
                      <th>Modelo Pedagógico</th>
                      <th>Estructura Registrada</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curriculaPrograms
                      .filter(p => {
                        if (curriculaSubsystem !== 'todos' && p.subsystem !== curriculaSubsystem && p.subsystem !== 'all' && p.subsystem) return false;
                        if (curriculaSemester !== 'todos' && p.semester !== parseInt(curriculaSemester, 10)) return false;
                        if (curriculaComponent !== 'todos') {
                          if (curriculaComponent === 'ext_obligatorio' || curriculaComponent === 'ffeo') {
                            if (p.component !== 'ext_obligatorio' && p.component !== 'ffeo') return false;
                          } else if (curriculaComponent === 'ext_optativo' || curriculaComponent === 'ffe_optativa') {
                            if (p.component !== 'ext_optativo' && p.component !== 'ffe_optativa') return false;
                          } else if (p.component !== curriculaComponent) {
                            return false;
                          }
                        }
                        if (curriculaSearch.trim()) {
                          const q = curriculaSearch.toLowerCase();
                          const matchName = p.uac_name.toLowerCase().includes(q);
                          const matchCurr = (p.curriculum_name || '').toLowerCase().includes(q);
                          if (!matchName && !matchCurr) return false;
                        }
                        return true;
                      })
                      .map(p => {
                        const isProgresiones = p.model_type === 'progresiones' || (p.semester >= 5 && p.component !== 'laboral');
                        const isLaboral = p.component === 'laboral';
                        const isFfeo = p.component === 'ffeo' || p.component === 'ext_obligatorio';
                        const isOptativa = p.component === 'ext_optativo' || p.component === 'ffe_optativa';
                        const weeklyLoad = Math.round((p.total_hours || 54) / 18);
                        return (
                          <tr key={p.id}>
                            <td>
                              <div
                                style={{ fontWeight: 600, color: '#f0f4ff', cursor: 'pointer' }}
                                onClick={() => setSelectedProgramDetail(p)}
                              >
                                {p.uac_name}
                              </div>
                              {p.curriculum_name && (
                                <div style={{ fontSize: 11, color: '#818cf8', marginTop: 2 }}>{p.curriculum_name}</div>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${p.subsystem === 'tecnologico' || p.subsystem === 'cecyte' || p.subsystem === 'cbtis' ? 'badge-purple' : 'badge-blue'}`} style={{ textTransform: 'uppercase', fontSize: 11 }}>
                                {p.subsystem || 'BGE'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, textAlign: 'center' }}>{p.semester}°</td>
                            <td>
                              <span className="badge" style={{ background: isLaboral ? 'rgba(245,158,11,0.15)' : p.component === 'ampliado' ? 'rgba(16,185,129,0.15)' : isFfeo ? 'rgba(236,72,153,0.15)' : isOptativa ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: isLaboral ? '#fbbf24' : p.component === 'ampliado' ? '#34d399' : isFfeo ? '#f472b6' : isOptativa ? '#a78bfa' : '#60a5fa', fontSize: 11 }}>
                                {isLaboral ? 'Laboral' : p.component === 'ampliado' ? 'Ampliado' : isFfeo ? 'FFEO' : isOptativa ? 'Optativo' : 'Fundamental'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: 12 }}>{p.total_hours} hrs ({weeklyLoad} h/sem)</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{weeklyLoad * 6} hrs / corte</div>
                            </td>
                            <td>
                              {isLaboral ? (
                                <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', fontSize: 10 }}>
                                  💼 3 Actividades Clave
                                </span>
                              ) : isProgresiones ? (
                                <span className="badge badge-purple" style={{ fontSize: 10 }}>
                                  🟣 Progresiones (26-27)
                                </span>
                              ) : (
                                <span className="badge badge-green" style={{ fontSize: 10 }}>
                                  🟢 Propósitos y Contenidos
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                              {isLaboral ? (
                                <div>
                                  <div style={{ color: '#fbbf24', fontWeight: 600 }}>3 Actividades Clave (18h c/u)</div>
                                  {p.contenidos_formativos && p.contenidos_formativos.length > 0 && (
                                    <div style={{ fontSize: 10, color: '#10b981' }}>✓ {p.contenidos_formativos.reduce((acc, c) => acc + (c.contenidos?.length || 0), 0)} contenidos de desempeño</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div>{p.activities?.length || 0} {isProgresiones ? 'progresiones' : 'propósitos'}</div>
                                  {p.contenidos_formativos && p.contenidos_formativos.length > 0 && (
                                    <div style={{ fontSize: 10, color: '#10b981' }}>✓ {p.contenidos_formativos.reduce((acc, c) => acc + (c.contenidos?.length || 0), 0)} contenidos temáticos</div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button className="btn-sm btn-ghost" onClick={() => setSelectedProgramDetail(p)} title="Ver Programa Completo" style={{ marginRight: 4, fontSize: 11 }}>
                                👁️ Ver
                              </button>
                              <button className="btn-sm btn-ghost" onClick={() => handleOpenEditProgramModal(p)} title="Editar UAC" style={{ marginRight: 4, fontSize: 11 }}>
                                ✏️
                              </button>
                              <button className="btn-sm btn-ghost" onClick={() => handleOpenReplaceProgramModal(p)} title="Reemplazar Programa con PDF (IA)" style={{ marginRight: 4, fontSize: 11, color: '#a7f3d0' }}>
                                📄 Reemplazar
                              </button>
                              <button className="btn-sm btn-danger" onClick={() => handleDeleteProgram(p.id, p.uac_name)} title="Eliminar UAC">
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal: Inspector de Programa Oficial Completo */}
            {selectedProgramDetail && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 840, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 70px rgba(0,0,0,0.8)' }}>
                  {/* Header del Modal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-blue" style={{ textTransform: 'uppercase', fontSize: 11 }}>
                          {selectedProgramDetail.subsystem || 'BGE'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 11 }}>
                          {selectedProgramDetail.semester}.° Semestre
                        </span>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 11 }}>
                          {selectedProgramDetail.component === 'laboral' ? '💼 Formación Laboral (Capacitación)' :
                           selectedProgramDetail.component === 'ampliado' ? '🌱 Currículum Ampliado (Socioemocional)' :
                           (selectedProgramDetail.component === 'ffeo' || selectedProgramDetail.component === 'ext_obligatorio') ? '⭐ FFEO' :
                           (selectedProgramDetail.component === 'ext_optativo' || selectedProgramDetail.component === 'ffe_optativa') ? '🎯 Optativa / FFE' : '📘 Currículum Fundamental'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: 11 }}>
                          {selectedProgramDetail.total_hours} hrs ({Math.round((selectedProgramDetail.total_hours || 54) / 18)} h/sem)
                        </span>
                      </div>
                      <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 20, fontWeight: 700 }}>
                        {selectedProgramDetail.uac_name}
                      </h2>
                      {selectedProgramDetail.curriculum_name && (
                        <div style={{ fontSize: 13, color: '#818cf8', marginTop: 3, fontWeight: 500 }}>
                          Capacitación / Especialidad: {selectedProgramDetail.curriculum_name}
                        </div>
                      )}
                    </div>
                    <button className="btn-sm btn-ghost" onClick={() => setSelectedProgramDetail(null)} style={{ fontSize: 14 }}>
                      ✕ Cerrar
                    </button>
                  </div>

                  {/* Banner del Modelo Pedagógico */}
                  {selectedProgramDetail.component === 'laboral' ? (
                    <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>💼</span>
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <strong>Formación Laboral (Capacitación para el Trabajo)</strong>: Desarrollada mediante <strong>estrictamente 3 Actividades Clave</strong> (1 por cada corte de evaluación / parcial, 18 horas cada una).
                      </div>
                    </div>
                  ) : selectedProgramDetail.component === 'ampliado' ? (
                    <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>🌱</span>
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <strong>Currículum Ampliado (Formación Socioemocional / PAEC)</strong>: Recursos socioemocionales, ámbitos de bienestar y proyectos de práctica ciudadana.
                      </div>
                    </div>
                  ) : selectedProgramDetail.semester >= 5 ? (
                    <div style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>🟣</span>
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <strong>Modelo de Transición (Progresiones de Aprendizaje)</strong>: Vigente durante el ciclo escolar 2026-2027 para 5.° y 6.° semestre.
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>🟢</span>
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <strong>Modelo Oficial Actualizado (Propósitos y Contenidos Formativos)</strong>: Vigente para el ciclo 2025-2028 estructurado con propósitos formativos y temario oficial.
                      </div>
                    </div>
                  )}

                  {/* Meta Educativa / Intencionalidad */}
                  {selectedProgramDetail.learning_outcome && (
                    <div style={{ marginBottom: 18, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#93c5fd', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        🎯 Meta Educativa / Intencionalidad Formativa
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'rgba(240,244,255,0.85)', lineHeight: 1.6 }}>
                        {selectedProgramDetail.learning_outcome}
                      </p>
                    </div>
                  )}

                  {/* Propósitos Formativos / Actividades Clave y Contenidos Temáticos */}
                  <div style={{ marginBottom: 18 }}>
                    <h4 style={{ margin: '0 0 10px', color: '#a5b4fc', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {selectedProgramDetail.component === 'laboral' ? '💼 3 Actividades Clave y Contenidos de Desempeño Laboral' :
                       selectedProgramDetail.semester >= 5 ? '🟣 Progresiones de Aprendizaje Oficiales' :
                       '📋 Propósitos Formativos y Contenidos de Estudio'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(selectedProgramDetail.activities || []).map((act, idx) => {
                        const matchingCf = (selectedProgramDetail.contenidos_formativos || [])[idx];
                        const isLab = selectedProgramDetail.component === 'laboral';
                        return (
                          <div
                            key={idx}
                            style={{
                              background: 'rgba(0,0,0,0.3)',
                              border: `1px solid ${isLab ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}`,
                              borderRadius: 10,
                              padding: 14
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontWeight: 700, color: isLab ? '#fbbf24' : '#818cf8', fontSize: 13 }}>
                                {isLab
                                  ? `Actividad Clave #${idx + 1} (Parcial ${idx + 1}) · ${act.name}`
                                  : `#${idx + 1} · ${act.name || `Propósito Formativo ${idx + 1}`}`}
                              </span>
                              <span className="badge" style={{ background: isLab ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: isLab ? '#fbbf24' : '#93c5fd', fontSize: 10 }}>
                                {act.hours || 18} horas {isLab ? `(Corte ${idx + 1})` : ''}
                              </span>
                            </div>

                            {/* Contenidos Temáticos Específicos */}
                            {matchingCf && matchingCf.contenidos && matchingCf.contenidos.length > 0 && (
                              <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${isLab ? 'rgba(245,158,11,0.4)' : 'rgba(129,140,248,0.3)'}` }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                                  {isLab ? 'Contenidos técnicos y criterios de desempeño:' : 'Contenidos y temas oficiales:'}
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                                  {matchingCf.contenidos.map((tema, tIdx) => (
                                    <li key={tIdx}>{tema}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Evidencias de Aprendizaje */}
                  {selectedProgramDetail.evidences && selectedProgramDetail.evidences.length > 0 && (
                    <div style={{ marginBottom: 20, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h4 style={{ margin: '0 0 8px', color: '#fcd34d', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        📝 Evidencias y Productos Sugeridos
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedProgramDetail.evidences.map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            style={{
                              background: 'rgba(245,158,11,0.1)',
                              border: '1px solid rgba(245,158,11,0.3)',
                              color: '#fbbf24',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 12
                            }}
                          >
                            ✓ {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer de Acciones del Inspector */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => {
                          const p = selectedProgramDetail;
                          setSelectedProgramDetail(null);
                          handleOpenEditProgramModal(p);
                        }}
                      >
                        ✏️ Editar Manualmente
                      </button>
                      <button
                        className="btn-sm"
                        style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}
                        onClick={() => {
                          const p = selectedProgramDetail;
                          setSelectedProgramDetail(null);
                          handleOpenReplaceProgramModal(p);
                        }}
                      >
                        📄 Reemplazar con PDF Oficial (IA)
                      </button>
                      <button
                        className="btn-sm btn-ghost"
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedProgramDetail, null, 2));
                          const downloadAnchor = document.createElement('a');
                          downloadAnchor.setAttribute("href", dataStr);
                          downloadAnchor.setAttribute("download", `programa_${selectedProgramDetail.uac_name.replace(/\s+/g, '_').toLowerCase()}.json`);
                          document.body.appendChild(downloadAnchor);
                          downloadAnchor.click();
                          downloadAnchor.remove();
                        }}
                      >
                        📥 Descargar JSON
                      </button>
                    </div>
                    <button className="btn-sm btn-ghost" onClick={() => setSelectedProgramDetail(null)}>
                      ✕ Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Crear / Editar UAC Manualmente */}
            {showProgramModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                    <h3 style={{ color: '#818cf8', margin: 0, fontSize: 18 }}>
                      {editingProgram ? `✏️ Editar / Reemplazar: ${editingProgram.uac_name}` : '➕ Nueva UAC / Programa de Estudio'}
                    </h3>
                    <button className="btn-sm btn-ghost" onClick={() => setShowProgramModal(false)}>✕ Cerrar</button>
                  </div>

                  <form onSubmit={handleSaveProgram} style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                      <div className="form-group">
                        <label>Nombre oficial de la UAC *</label>
                        <input
                          value={programForm.uac_name}
                          onChange={e => setProgramForm(f => ({ ...f, uac_name: e.target.value }))}
                          placeholder="Ej: Pensamiento Matemático I"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Subsistema *</label>
                        <select
                          value={programForm.subsystem}
                          onChange={e => setProgramForm(f => ({ ...f, subsystem: e.target.value }))}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}
                        >
                          <option value="bge">Bachillerato General Estatal (BGE)</option>
                          <option value="tecnologico">Bachillerato Tecnológico</option>
                          <option value="cbtis">CBTIS</option>
                          <option value="cbta">CBTA</option>
                          <option value="cecyte">CECyTE</option>
                          <option value="digital">Bachillerato Digital</option>
                          <option value="emsad">EMSAD</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                      <div className="form-group">
                        <label>Semestre *</label>
                        <select
                          value={programForm.semester}
                          onChange={e => {
                            const sem = parseInt(e.target.value, 10);
                            setProgramForm(f => ({
                              ...f,
                              semester: sem,
                              model_type: sem >= 5 ? 'progresiones' : 'propositos_contenidos'
                            }));
                          }}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}
                        >
                          <option value={1}>1.° Semestre</option>
                          <option value={2}>2.° Semestre</option>
                          <option value={3}>3.° Semestre</option>
                          <option value={4}>4.° Semestre</option>
                          <option value={5}>5.° Semestre</option>
                          <option value={6}>6.° Semestre</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Componente *</label>
                        <select
                          value={programForm.component}
                          onChange={e => setProgramForm(f => ({ ...f, component: e.target.value }))}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}
                        >
                          <option value="fundamental">Currículum Fundamental</option>
                          <option value="ampliado">Currículum Ampliado (Socioemocional / PAEC)</option>
                          <option value="laboral">Formación Laboral / Profesional (Capacitación)</option>
                          <option value="ext_obligatorio">Formación Fundamental Extendida Obligatoria (FFEO)</option>
                          <option value="ext_optativo">Formación Fundamental Extendida (Optativas / FFE)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Horas Totales Semestre *</label>
                        <input
                          type="number"
                          value={programForm.total_hours}
                          onChange={e => setProgramForm(f => ({ ...f, total_hours: parseInt(e.target.value, 10) || 54 }))}
                          placeholder="54 o 72"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Modelo Curricular</label>
                        <select
                          value={programForm.model_type}
                          onChange={e => setProgramForm(f => ({ ...f, model_type: e.target.value }))}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}
                        >
                          <option value="propositos_contenidos">Propósitos y Contenidos (1°-4° y 2027+)</option>
                          <option value="progresiones">Progresiones MCCEMS (5°-6° 2026-2027)</option>
                          <option value="actividades_clave">Actividades Clave (Formación Laboral)</option>
                        </select>
                      </div>
                    </div>

                    {programForm.component === 'laboral' && (
                      <div className="form-group">
                        <label>Especialidad / Capacitación de Formación Laboral</label>
                        <input
                          value={programForm.curriculum_name}
                          onChange={e => setProgramForm(f => ({ ...f, curriculum_name: e.target.value }))}
                          placeholder="Ej: Administración, Tecnologías de la Información, Turismo"
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>Resultado de Aprendizaje / Intencionalidad</label>
                      <textarea
                        value={programForm.learning_outcome}
                        onChange={e => setProgramForm(f => ({ ...f, learning_outcome: e.target.value }))}
                        rows={2}
                        placeholder="Descripción del resultado de aprendizaje esperado..."
                      />
                    </div>

                    {/* Editor de Propósitos / Actividades Clave con Contenidos Formativos */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <label style={{ fontWeight: 600, color: '#818cf8', margin: 0 }}>
                          {programForm.component === 'laboral'
                            ? '💼 3 Actividades Clave (18 horas por corte / parcial)'
                            : programForm.model_type === 'progresiones'
                            ? 'Progresiones de Aprendizaje'
                            : 'Propósitos y Contenidos Formativos (Temas Oficiales)'}
                        </label>
                        {programForm.component !== 'laboral' && (
                          <button
                            type="button"
                            className="btn-sm btn-ghost"
                            onClick={() => {
                              const newIdx = programForm.activities.length + 1;
                              setProgramForm(f => ({
                                ...f,
                                activities: [...f.activities, { name: `Propósito Formativo ${newIdx}`, hours: 18, order: newIdx }],
                                contenidos_formativos: [...f.contenidos_formativos, { proposito: `Propósito Formativo ${newIdx}`, contenidos: [''] }]
                              }));
                            }}
                          >
                            ➕ Agregar Propósito / Progresión
                          </button>
                        )}
                      </div>

                      {programForm.activities.map((act, actIdx) => (
                        <div key={actIdx} style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, marginBottom: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>
                              {programForm.component === 'laboral' ? `Actividad Clave #${actIdx + 1}` : `#${actIdx + 1}`}
                            </span>
                            <input
                              style={{ flex: 1 }}
                              value={act.name}
                              onChange={e => {
                                const val = e.target.value;
                                setProgramForm(f => {
                                  const acts = [...f.activities];
                                  acts[actIdx] = { ...acts[actIdx], name: val };
                                  const cfs = [...f.contenidos_formativos];
                                  if (cfs[actIdx]) cfs[actIdx].proposito = val;
                                  return { ...f, activities: acts, contenidos_formativos: cfs };
                                });
                              }}
                              placeholder={
                                programForm.component === 'laboral'
                                  ? `Descripción técnica de la Actividad Clave #${actIdx + 1}...`
                                  : programForm.model_type === 'progresiones'
                                  ? 'Texto de la Progresión X...'
                                  : 'Nombre del Propósito Formativo X...'
                              }
                            />
                            <input
                              type="number"
                              style={{ width: 80 }}
                              value={act.hours}
                              onChange={e => {
                                const hrs = parseInt(e.target.value, 10) || 18;
                                setProgramForm(f => {
                                  const acts = [...f.activities];
                                  acts[actIdx] = { ...acts[actIdx], hours: hrs };
                                  return { ...f, activities: acts };
                                });
                              }}
                              title="Horas asignadas"
                            />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>hrs</span>
                            {programForm.component !== 'laboral' && programForm.activities.length > 1 && (
                              <button
                                type="button"
                                className="btn-sm btn-danger"
                                onClick={() => {
                                  setProgramForm(f => ({
                                    ...f,
                                    activities: f.activities.filter((_, i) => i !== actIdx),
                                    contenidos_formativos: f.contenidos_formativos.filter((_, i) => i !== actIdx)
                                  }));
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Temas / Contenidos formativos si es modelo nuevo o laboral */}
                          {programForm.model_type !== 'progresiones' && (
                            <div style={{ paddingLeft: 24, marginTop: 6 }}>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                                {programForm.component === 'laboral'
                                  ? '📋 Criterios de Desempeño y Contenidos Técnicos:'
                                  : '📋 Contenidos Formativos / Temas de estudio para este propósito:'}
                              </div>
                              {(programForm.contenidos_formativos[actIdx]?.contenidos || ['']).map((tema, tIdx) => (
                                <div key={tIdx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                  <input
                                    style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
                                    value={tema}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setProgramForm(f => {
                                        const cfs = [...f.contenidos_formativos];
                                        if (!cfs[actIdx]) cfs[actIdx] = { proposito: act.name, contenidos: [] };
                                        cfs[actIdx].contenidos[tIdx] = val;
                                        return { ...f, contenidos_formativos: cfs };
                                      });
                                    }}
                                    placeholder={programForm.component === 'laboral' ? `Criterio o contenido técnico ${tIdx + 1}...` : `Tema o contenido ${tIdx + 1}...`}
                                  />
                                  <button
                                    type="button"
                                    className="btn-sm btn-ghost"
                                    style={{ padding: '2px 8px' }}
                                    onClick={() => {
                                      setProgramForm(f => {
                                        const cfs = [...f.contenidos_formativos];
                                        if (!cfs[actIdx]) return f;
                                        cfs[actIdx].contenidos = cfs[actIdx].contenidos.filter((_, i) => i !== tIdx);
                                        return { ...f, contenidos_formativos: cfs };
                                      });
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="btn-sm btn-ghost"
                                style={{ fontSize: 11, padding: '2px 8px', marginTop: 2 }}
                                onClick={() => {
                                  setProgramForm(f => {
                                    const cfs = [...f.contenidos_formativos];
                                    if (!cfs[actIdx]) cfs[actIdx] = { proposito: act.name, contenidos: [''] };
                                    else cfs[actIdx].contenidos.push('');
                                    return { ...f, contenidos_formativos: cfs };
                                  });
                                }}
                              >
                                ➕ Añadir tema
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                      <button type="submit" className="btn-sm btn-primary" disabled={saving} style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}>
                        {saving ? 'Guardando...' : editingProgram ? '💾 Guardar Cambios y Actualizar BD' : '➕ Registrar en Catálogo'}
                      </button>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => setShowProgramModal(false)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Subir y Extraer PDF Oficial con IA */}
            {showExtractModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 30, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ color: '#818cf8', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📄</span> {extractTargetProgram ? `Reemplazar Programa: ${extractTargetProgram.uac_name}` : 'Cargar / Reemplazar Programa con IA (PDF Oficial)'}
                    </h3>
                    <button className="btn-sm btn-ghost" onClick={() => setShowExtractModal(false)}>✕ Cerrar</button>
                  </div>

                  {extractTargetProgram && (
                    <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🔄</span>
                      <div style={{ fontSize: 13, color: '#e0e7ff', lineHeight: 1.4 }}>
                        <strong>Reemplazo Directo Activado:</strong> Al procesar y guardar este nuevo PDF, se actualizarán los datos oficiales de <strong>"{extractTargetProgram.uac_name}"</strong> ({extractTargetProgram.subsystem?.toUpperCase()}, {extractTargetProgram.semester}° Semestre).
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 18 }}>
                    Sube el documento PDF del programa de estudios emitido por la SEP/SEMS. La IA extraerá automáticamente la UAC, carga horaria, propósitos, contenidos formativos y evidencias para guardarlos o reemplazar la versión anterior en la base de datos.
                  </p>

                  <form onSubmit={handleExtractPdfSubmit} style={{ display: 'grid', gap: 14 }}>
                    <div className="form-group">
                      <label>Archivo PDF oficial del programa *</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={e => setExtractPdfFile(e.target.files?.[0] || null)}
                        required
                        style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#f0f4ff', width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <div className="form-group">
                        <label>Subsistema de Destino</label>
                        <select value={extractSubsystem} onChange={e => setExtractSubsystem(e.target.value)}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}>
                          <option value="bge">Bachillerato General Estatal (BGE)</option>
                          <option value="tecnologico">Bachillerato Tecnológico</option>
                          <option value="cbtis">CBTIS</option>
                          <option value="cbta">CBTA</option>
                          <option value="cecyte">CECyTE</option>
                          <option value="digital">Bachillerato Digital</option>
                          <option value="emsad">EMSAD</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Semestre</label>
                        <select value={extractSemester} onChange={e => setExtractSemester(parseInt(e.target.value, 10))}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}>
                          <option value={1}>1.° Semestre</option>
                          <option value={2}>2.° Semestre</option>
                          <option value={3}>3.° Semestre</option>
                          <option value={4}>4.° Semestre</option>
                          <option value={5}>5.° Semestre</option>
                          <option value={6}>6.° Semestre</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Componente</label>
                        <select value={extractComponent} onChange={e => setExtractComponent(e.target.value)}
                          style={{ background: '#131324', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#f0f4ff', width: '100%' }}>
                          <option value="fundamental">Currículum Fundamental</option>
                          <option value="ampliado">Currículum Ampliado</option>
                          <option value="laboral">Formación Laboral / Profesional</option>
                          <option value="ext_obligatorio">Formación Extendida Obligatoria (FFEO)</option>
                          <option value="ext_optativo">Formación Extendida Optativa (FFE)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn-sm btn-primary"
                      disabled={extracting || !extractPdfFile}
                      style={{ padding: '12px 16px', fontWeight: 600, marginTop: 8 }}
                    >
                      {extracting ? '⏳ Analizando y estructurando PDF con Gemini IA...' : '⚡ Extraer Estructura con IA'}
                    </button>
                  </form>

                  {/* Vista Previa de Extracción */}
                  {extractedPreview && (
                    <div style={{ marginTop: 20, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h4 style={{ color: '#10b981', margin: 0, fontSize: 15 }}>✓ Datos extraídos del programa:</h4>
                        <span className="badge badge-green">Listo para guardar</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#f0f4ff', marginBottom: 6 }}>
                        <strong>UAC:</strong> {extractedPreview.uac_name}
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                        <strong>Carga horaria:</strong> {extractedPreview.total_hours} horas totales ({Math.round(extractedPreview.total_hours / 18)} h/sem)
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
                        <strong>Propósitos / Progresiones detectadas:</strong> {extractedPreview.activities?.length || 0}
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          className="btn-sm"
                          onClick={handleSaveExtractedToCatalog}
                          disabled={saving}
                          style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, padding: '10px 16px' }}
                        >
                          {saving ? 'Guardando en BD...' : '💾 Confirmar y Guardar en Catálogo'}
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-ghost"
                          onClick={() => setExtractedPreview(null)}
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === 'docs' && (
          <>
            <h1>📁 Documentos de Usuarios</h1>
            {adminDocs.length === 0 ? (
              <div className="empty-state">No hay documentos guardados todavía.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr><th>Docente</th><th>Tipo</th><th>Etiqueta</th><th>UAC</th><th>Archivo</th><th>Usos</th><th>Guardado</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {adminDocs.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontSize: 12 }}>{d.teacher_email}</td>
                      <td><span className="badge badge-blue">{d.doc_type}</span></td>
                      <td>{d.label}</td>
                      <td style={{ fontSize: 12 }}>{d.uac_name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{d.file_name || '—'}</td>
                      <td>{d.used_count}</td>
                      <td style={{ fontSize: 11 }}>{new Date(d.created_at).toLocaleDateString('es-MX')}</td>
                      <td><button className="btn-sm btn-danger" onClick={() => deleteDoc(d.id)}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === 'activity' && (
          <>
            <h1>📋 Registro de Actividad</h1>
            {activity.length === 0 ? (
              <div className="empty-state">No hay actividad registrada todavía.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr><th>Fecha</th><th>Docente</th><th>Acción</th><th>Proveedor</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {activity.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('es-MX')}</td>
                      <td style={{ fontSize: 12 }}>{a.teacher_email}</td>
                      <td><span className="badge badge-blue">{a.action}</span></td>
                      <td style={{ fontSize: 12 }}>{a.provider_used ? `${a.provider_used} / ${a.model_used}` : '—'}</td>
                      <td>
                        {a.success
                          ? <span className="badge badge-green">✓ Éxito</span>
                          : <span className="badge badge-red" title={a.error_msg || ''}>✗ Error</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

      </div>

      {/* Toast */}
      {msg && <div className={`toast ${msg.ok ? 'toast-ok' : 'toast-err'}`}>{msg.text}</div>}
    </div>
  );
}
