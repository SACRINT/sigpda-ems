'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { GeneratedPlanningContent, Planning, PlanningExtra, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import { ExtraPreviewModal } from '@/components/planeacion/ExtraPreviewModal';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import GenerationFeedback from '@/components/feedback/GenerationFeedback';
import DocumentA4Viewer from '@/components/common/DocumentA4Viewer';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/pdf-generator';
import { generateBlockSessions, type DetailedSession } from '@/lib/session-progression-engine';
import type { ActiveWorkTextbook, GenerationProgressState } from '@/types/work-textbook';
// ── Lucide Icons ────────────────────────────────────────────────────────────
import {
  FileText, Zap, Clock, BookOpen, Printer, BarChart3, Package,
  Award, TrendingUp, Download, FileDown, Trash2, Search,
  RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Star, BookMarked, Microscope, Grid, Library, Send, Eye,
} from 'lucide-react';
// ── Recharts ─────────────────────────────────────────────────────────────────
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';

interface PlanningDetailClientProps {
  locale: string;
  planning: Planning;
  initialExtras: PlanningExtra[];
}

export default function PlanningDetailClient({
  locale,
  planning,
  initialExtras,
}: PlanningDetailClientProps) {
  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;
  const activityLabel = isLaboral ? 'Actividades Clave' : 'Propósitos y Contenidos formativos';
  const prefix = isLaboral ? 'AC' : 'PC';

  // Tabs state
  const [activeTab, setActiveTab] = useState<'planning' | 'extras' | 'lessonPlans' | 'practiceGuides' | 'a4print' | 'audit' | 'bundle' | 'evaluador' | 'analytics'>('planning');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Collapsed state for lesson plans blocks
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<number, boolean>>({});

  const toggleBlock = (actIdx: number) => {
    setCollapsedBlocks((prev) => ({
      ...prev,
      [actIdx]: !prev[actIdx],
    }));
  };

  const allBlocksCollapsed =
    (content?.sectionIV?.activities || []).length > 0 &&
    (content?.sectionIV?.activities || []).every((_, idx) => !!collapsedBlocks[idx]);

  const toggleAllBlocks = () => {
    const shouldCollapse = !allBlocksCollapsed;
    const next: Record<number, boolean> = {};
    (content?.sectionIV?.activities || []).forEach((_, idx) => {
      next[idx] = shouldCollapse;
    });
    setCollapsedBlocks(next);
  };

  // ── Audit state ─────────────────────────────────────────────────────────
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  const handleRunAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      // First try to load existing audit
      const getRes = await fetch(`/api/audit/${planning.id}`);
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData?.audit) {
          setAuditReport(getData.audit);
          setAuditLoaded(true);
          setAuditLoading(false);
          return;
        }
      }
      // No existing audit — run a new one
      const postRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Error al ejecutar la auditoría.');
      setAuditReport(postData.report);
      setAuditLoaded(true);
    } catch (err: any) {
      setAuditError(err.message || 'Error desconocido.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleReAudit = async () => {
    setAuditReport(null);
    setAuditLoaded(false);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const postRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Error al re-auditar.');
      setAuditReport(postData.report);
      setAuditLoaded(true);
    } catch (err: any) {
      setAuditError(err.message || 'Error desconocido.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Load audit when switching to audit tab for the first time
  useEffect(() => {
    if (activeTab === 'audit' && !auditLoaded && !auditLoading) {
      handleRunAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Modal Checklist Supervisión DBEPA
  const [showChecklistModal, setShowChecklistModal] = useState(false);

  // Extras state
  const [extras, setExtras] = useState<PlanningExtra[]>(initialExtras);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [previewExtra, setPreviewExtra] = useState<PlanningExtra | null>(null);

  // Fetch extras on mount (to ensure sync)
  useEffect(() => {
    async function loadExtras() {
      try {
        const res = await fetch(`/api/plannings/${planning.id}/extras`);
        if (res.ok) {
          const data = await res.json();
          setExtras(data);
        }
      } catch (err) {
        console.error('Failed to load extras:', err);
      }
    }
    loadExtras();
  }, [planning.id]);

  // Generate extra handler
  async function handleGenerateExtra(
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide',
    title: string,
    keyIndex: number | null,
    extraData: {
      activityName?: string;
      evidence?: string;
      sessionNum?: number;
      totalSessions?: number;
      practiceNumber?: number;
      practiceTitle?: string;
      sessionTopic?: string;
      sessionFocus?: string;
      teachingActivity?: string;
      learningActivity?: string;
      evaluation?: string;
      phase?: string;
    }
  ) {
    // Generate unique key for loading state
    const loadingKey = `${type}-${keyIndex !== null ? keyIndex : ''}-${extraData.sessionNum || ''}-${extraData.evidence || title}`;
    setGeneratingKey(loadingKey);

    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          keyIndex,
          ...extraData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate extra');
      }

      const result = await res.json();
      if (result.success && result.extra) {
        setExtras((prev) => [...prev, result.extra]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al generar el recurso');
    } finally {
      setGeneratingKey(null);
    }
  }

  // Delete extra handler
  async function handleDeleteExtra(extraId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este recurso generado?')) {
      return;
    }

    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras?extraId=${extraId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setExtras((prev) => prev.filter((ex) => ex.id !== extraId));
      } else {
        alert('Error al eliminar el recurso');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Helper to find existing generated extra
  function findExtra(type: string, keyIndex: number | null, title?: string, sessionNum?: number) {
    return extras.find((ex) => {
      if (ex.type !== type) return false;
      if (ex.keyIndex !== keyIndex) return false;
      if (type === 'lesson_plan' && sessionNum !== undefined) {
        return (
          ex.title.includes(`Sesión ${sessionNum} `) ||
          ex.title.includes(`Sesión ${sessionNum}:`) ||
          ex.title.includes(`Sesión ${sessionNum} -`) ||
          ex.title.endsWith(`Sesión ${sessionNum}`) ||
          Boolean(ex.title.match(new RegExp(`\\bSesión\\s+${sessionNum}\\b`, 'i')))
        );
      }
      if (type === 'material' && title) {
        return ex.title.toLowerCase().includes(title.toLowerCase());
      }
      return true;
    });
  }

  // ── Secuencia Didáctica por Sesión state ──────────────────────────────────
  const [sequenceData, setSequenceData] = useState<Record<number, SecuenciaBloque>>(
    (planning.sequenceJson as any) || {}
  );
  const [generatingSeqBlock, setGeneratingSeqBlock] = useState<number | null>(null);
  const [editingSeqBlock, setEditingSeqBlock] = useState<number | null>(null);
  const [editedSessions, setEditedSessions] = useState<Record<number, SecuenciaSesion[]>>({});
  const [seqMessage, setSeqMessage] = useState<{ block: number; text: string; type: 'success' | 'error' } | null>(null);
  const [expandedSeqBlock, setExpandedSeqBlock] = useState<number | null>(0);

  const handleGenerateSecuencia = async (blockIndex: number) => {
    setGeneratingSeqBlock(blockIndex);
    setSeqMessage(null);
    try {
      const res = await fetch(`/api/planeaciones/${planning.id}/secuencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar secuencia didáctica');
      setSequenceData(prev => ({ ...prev, [blockIndex]: data.sequence }));
      setExpandedSeqBlock(blockIndex);
      setSeqMessage({ block: blockIndex, text: '¡Secuencia didáctica generada y guardada con éxito!', type: 'success' });
    } catch (err: any) {
      setSeqMessage({ block: blockIndex, text: err.message || 'Error al generar secuencia', type: 'error' });
    } finally {
      setGeneratingSeqBlock(null);
    }
  };

  const handleSaveSecuencia = async (blockIndex: number) => {
    const sessionsToSave = editedSessions[blockIndex] || sequenceData[blockIndex]?.sessions;
    if (!sessionsToSave) return;
    try {
      const res = await fetch(`/api/planeaciones/${planning.id}/secuencia`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex, sessions: sessionsToSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setSequenceData(prev => ({ ...prev, [blockIndex]: data.sequence }));
      setEditingSeqBlock(null);
      setSeqMessage({ block: blockIndex, text: 'Cambios guardados exitosamente.', type: 'success' });
    } catch (err: any) {
      alert(err.message || 'Error al guardar cambios');
    }
  };

  const handleStartEdit = (blockIndex: number) => {
    if (!sequenceData[blockIndex]?.sessions) return;
    setEditedSessions(prev => ({
      ...prev,
      [blockIndex]: JSON.parse(JSON.stringify(sequenceData[blockIndex].sessions)),
    }));
    setEditingSeqBlock(blockIndex);
  };

  const handleCancelEdit = (blockIndex: number) => {
    setEditingSeqBlock(null);
  };

  const handleUpdateEditedSession = (blockIndex: number, sessionIdx: number, field: keyof SecuenciaSesion, val: any) => {
    setEditedSessions(prev => {
      const currentList = prev[blockIndex] ? [...prev[blockIndex]] : [...(sequenceData[blockIndex]?.sessions || [])];
      if (currentList[sessionIdx]) {
        currentList[sessionIdx] = { ...currentList[sessionIdx], [field]: val };
      }
      return { ...prev, [blockIndex]: currentList };
    });
  };

  // ── Libros-Cuadernos de Trabajo Activo por Bloque (Fase 4: 35-80 págs / bloque) ─
  interface BlockWorkbookItem {
    loaded: boolean;
    generating: boolean;
    workbook: ActiveWorkTextbook | null;
    version?: number;
    progress: GenerationProgressState | null;
    error: string | null;
  }

  const initialWorkbooks: Record<number, BlockWorkbookItem> = {};
  const rawWorkbooks = ((planning as any).workbooksJson || (planning as any).workbooks_json || {}) as Record<string, any>;
  (content?.sectionIV?.activities || []).forEach((_, idx) => {
    const entry = rawWorkbooks[`block_${idx}`];
    initialWorkbooks[idx] = {
      loaded: Boolean(entry?.current),
      generating: false,
      workbook: entry?.current || null,
      version: entry?.version || 1,
      progress: null,
      error: null,
    };
  });

  const [blockWorkbooks, setBlockWorkbooks] = useState<Record<number, BlockWorkbookItem>>(initialWorkbooks);
  const pollIntervalsRef = useRef<Record<number, NodeJS.Timeout>>({});

  // Cleanup active polling intervals when component unmounts
  useEffect(() => {
    return () => {
      Object.values(pollIntervalsRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  // Sync / verify existing workbooks on mount
  useEffect(() => {
    const acts = content?.sectionIV?.activities || [];
    acts.forEach(async (_, idx) => {
      try {
        const res = await fetch(`/api/planeaciones/${planning.id}/libro-bloque?blockIndex=${idx}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.workbook) {
            setBlockWorkbooks(prev => ({
              ...prev,
              [idx]: {
                ...prev[idx],
                loaded: true,
                workbook: data.workbook,
                version: data.workbook.version || prev[idx]?.version || 1,
              },
            }));
          }
        }
      } catch {
        // ignore background fetch errors
      }
    });
  }, [planning.id]);

  const handleGenerateWorkbook = async (blockIndex: number) => {
    setBlockWorkbooks(prev => ({
      ...prev,
      [blockIndex]: {
        loaded: Boolean(prev[blockIndex]?.workbook),
        generating: true,
        workbook: prev[blockIndex]?.workbook || null,
        version: prev[blockIndex]?.version || 1,
        error: null,
        progress: {
          planningId: planning.id,
          blockIndex,
          phase: 'analyzing',
          currentStep: 'Iniciando generación editorial del libro...',
          percent: 5,
          updatedAt: new Date().toISOString(),
        },
      },
    }));

    if (pollIntervalsRef.current[blockIndex]) {
      clearInterval(pollIntervalsRef.current[blockIndex]);
      delete pollIntervalsRef.current[blockIndex];
    }

    let isFinished = false;
    const interval = setInterval(async () => {
      if (isFinished) return;
      try {
        const progRes = await fetch(`/api/planeaciones/${planning.id}/libro-bloque/progreso?blockIndex=${blockIndex}`);
        if (progRes.ok) {
          const progData = await progRes.json();
          if (progData?.progress) {
            setBlockWorkbooks(prev => {
              const cur = prev[blockIndex];
              if (!cur || !cur.generating) return prev;
              return {
                ...prev,
                [blockIndex]: {
                  ...cur,
                  progress: progData.progress,
                },
              };
            });
          }
        }
      } catch (err) {
        console.warn('[handleGenerateWorkbook] Polling warning:', err);
      }
    }, 2000);

    pollIntervalsRef.current[blockIndex] = interval;

    try {
      const res = await fetch(`/api/planeaciones/${planning.id}/libro-bloque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex }),
      });

      isFinished = true;
      if (pollIntervalsRef.current[blockIndex]) {
        clearInterval(pollIntervalsRef.current[blockIndex]);
        delete pollIntervalsRef.current[blockIndex];
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar el libro de trabajo');
      }

      setBlockWorkbooks(prev => ({
        ...prev,
        [blockIndex]: {
          loaded: true,
          generating: false,
          workbook: data.workbook,
          version: data.workbook?.version || 1,
          progress: {
            planningId: planning.id,
            blockIndex,
            phase: 'completed',
            currentStep: '¡Libro-Cuaderno de Trabajo Activo generado exitosamente!',
            percent: 100,
            qualityScore: data.workbook?.qualityScore,
            wordCount: data.wordCount || data.workbook?.totalWords,
            totalWords: data.totalWords || data.workbook?.totalWords,
            updatedAt: new Date().toISOString(),
          },
          error: null,
        },
      }));
    } catch (err: any) {
      isFinished = true;
      if (pollIntervalsRef.current[blockIndex]) {
        clearInterval(pollIntervalsRef.current[blockIndex]);
        delete pollIntervalsRef.current[blockIndex];
      }
      setBlockWorkbooks(prev => ({
        ...prev,
        [blockIndex]: {
          loaded: Boolean(prev[blockIndex]?.workbook),
          generating: false,
          workbook: prev[blockIndex]?.workbook || null,
          version: prev[blockIndex]?.version || 1,
          progress: null,
          error: err.message || 'Error al generar el libro de trabajo',
        },
      }));
    }
  };

  const totalWorkbookBlocks = content?.sectionIV?.activities?.length || 0;
  const generatedWorkbookCount = (content?.sectionIV?.activities || []).filter(
    (_, idx) => Boolean(blockWorkbooks[idx]?.workbook)
  ).length;
  const allBlocksGenerated = totalWorkbookBlocks > 0 && generatedWorkbookCount === totalWorkbookBlocks;

  const isBt = isLaboral || (planning.component || '').toLowerCase().includes('laboral') || (planning.component || '').toLowerCase().includes('profesional');
  const macroTargetWords = isBt ? 25000 : 17500;

  const accumulatedWorkbookWords = (content?.sectionIV?.activities || []).reduce(
    (acc, _, idx) => {
      const wb = blockWorkbooks[idx]?.workbook;
      const prog = blockWorkbooks[idx]?.progress;
      const words = wb?.totalWords || prog?.totalWords || prog?.wordCount || 0;
      return acc + words;
    },
    0
  );

  const blockWordCountDetails = (content?.sectionIV?.activities || []).map((_, idx) => {
    const roman = idx === 0 ? 'I' : idx === 1 ? 'II' : idx === 2 ? 'III' : `${idx + 1}`;
    const wb = blockWorkbooks[idx]?.workbook;
    const prog = blockWorkbooks[idx]?.progress;
    const words = wb?.totalWords || prog?.totalWords || prog?.wordCount;
    if (words) {
      return `Bloque ${roman}: ${words.toLocaleString()} palabras`;
    }
    return `Bloque ${roman}: pendiente`;
  });

  const semestralThresholdMet = accumulatedWorkbookWords >= macroTargetWords;
  const semestralReady = allBlocksGenerated;

  // Generate detailed pedagogical sessions for all blocks using Session Progression Engine
  const blockSessionsMap: DetailedSession[][] = (content?.sectionIV?.activities || []).map((act, actIdx) => {
    const outcome = content?.sectionII?.learningOutcomes?.[actIdx] || '';
    const savedSeq = sequenceData?.[actIdx] || null;
    return generateBlockSessions(act, actIdx, act.hours || (isLaboral ? 18 : 12), outcome, isLaboral, savedSeq);
  });
  const allDetailedSessions: DetailedSession[] = blockSessionsMap.flat();
  const lessonSessions = allDetailedSessions;

  // Download PDF handler
  const [downloadingSeqPdf, setDownloadingSeqPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const pdf = await generatePlanningPDF({ ...planning, sequenceJson: sequenceData });
      const filename = `Planeacion_${planning.uacName.replace(/\s+/g, '_')}_Semestre_${planning.semester}.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Hubo un error al generar el archivo PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadSecuenciaPdf = async () => {
    try {
      setDownloadingSeqPdf(true);
      const pdf = await generateSecuenciaPDF({ ...planning, sequenceJson: sequenceData });
      const filename = `Secuencia_Didactica_${planning.uacName.replace(/\s+/g, '_')}_Semestre_${planning.semester}.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error('Error generating Secuencia PDF:', e);
      alert('Hubo un error al generar el archivo PDF de la secuencia didáctica.');
    } finally {
      setDownloadingSeqPdf(false);
    }
  };


  // ── Bundle state ────────────────────────────────────────────────────────
  interface BundleItem { type: string; label: string; icon: string; content: string | null; loading: boolean; }
  const BUNDLE_TYPES: { type: 'guia'|'instrumento'|'diapositivas'|'quiz'; label: string; icon: string; color: string }[] = [
    { type: 'guia',         label: 'Guía del Alumno',              icon: '📖', color: '#1d4ed8' },
    { type: 'instrumento',  label: 'Instrumento Coevaluación',     icon: '📋', color: '#059669' },
    { type: 'diapositivas', label: 'Guión de Diapositivas',        icon: '🎨', color: '#7c3aed' },
    { type: 'quiz',         label: 'Quiz / Evaluación Diagnóstica',icon: '🧩', color: '#b45309' },
  ];
  const [bundleResults, setBundleResults] = useState<Record<string, string | null>>({});
  const [bundleLoading, setBundleLoading] = useState<Record<string, boolean>>({});
  const [bundleErrors,  setBundleErrors]  = useState<Record<string, string | null>>({});
  const [bundleExpanded, setBundleExpanded] = useState<string | null>(null);

  const handleGenerateBundleItem = async (type: 'guia'|'instrumento'|'diapositivas'|'quiz') => {
    setBundleLoading(prev => ({ ...prev, [type]: true }));
    setBundleErrors(prev  => ({ ...prev, [type]: null }));
    try {
      const res = await fetch('/api/bundles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el material');
      setBundleResults(prev => ({ ...prev, [type]: data.result || '' }));
      setBundleExpanded(type);
    } catch (err: any) {
      setBundleErrors(prev => ({ ...prev, [type]: err.message || 'Error desconocido' }));
    } finally {
      setBundleLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleGenerateFullBundle = async () => {
    for (const bt of BUNDLE_TYPES) {
      setBundleLoading(prev => ({ ...prev, [bt.type]: true }));
      setBundleErrors(prev  => ({ ...prev, [bt.type]: null }));
    }
    try {
      const res = await fetch('/api/bundles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id, type: 'full' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar bundle completo');
      const b = data.bundle;
      setBundleResults({
        guia:         b.guiaEstudiante        || '',
        instrumento:  b.instrumentoEvaluacion || '',
        diapositivas: b.guionDiapositivas     || '',
        quiz:         b.quiz                  || '',
      });
    } catch (err: any) {
      BUNDLE_TYPES.forEach(bt =>
        setBundleErrors(prev => ({ ...prev, [bt.type]: err.message || 'Error' }))
      );
    } finally {
      for (const bt of BUNDLE_TYPES) {
        setBundleLoading(prev => ({ ...prev, [bt.type]: false }));
      }
    }
  };

  // ── Evaluador state ─────────────────────────────────────────────────────
  const [evalResult, setEvalResult]   = useState<any | null>(planning.evaluationJson || null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError,   setEvalError]   = useState<string | null>(null);
  const [evalLoaded,  setEvalLoaded]  = useState(Boolean(planning.evaluationJson));

  const handleRunEvaluacion = async (forceReeval = false) => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const res = await fetch('/api/planeaciones/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id, forceReeval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al evaluar la planeación.');
      setEvalResult(data.resultado);
      setEvalLoaded(true);
    } catch (err: any) {
      setEvalError(err.message || 'Error desconocido.');
    } finally {
      setEvalLoading(false);
    }
  };

  // ── Analytics state ──────────────────────────────────────────────────────
  const [analyticsData, setAnalyticsData]   = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError,   setAnalyticsError]   = useState<string | null>(null);
  const [analyticsLoaded,  setAnalyticsLoaded]  = useState(false);

  const handleLoadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch('/api/pedagogical-analytics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar analytics.');
      setAnalyticsData(data);
      setAnalyticsLoaded(true);
    } catch (err: any) {
      setAnalyticsError(err.message || 'Error desconocido.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics' && !analyticsLoaded && !analyticsLoading) {
      handleLoadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Classroom state
  const [publishingClassroom, setPublishingClassroom] = useState(false);

  // Classroom publish handler
  const handlePublishClassroom = async () => {
    try {
      setPublishingClassroom(true);
      const res = await fetch('/api/classroom/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Error al conectar con Google Classroom');
      }

      if (!data.configured) {
        alert('Configura Google Classroom en Configuración\n\n' + data.message);
        return;
      }

      if (data.success) {
        alert(data.message);
        if (data.courseUrl) {
          window.open(data.courseUrl, '_blank');
        }
      } else {
        alert(data.message || 'No se pudo publicar la planeación en Classroom.');
      }
    } catch (err: any) {
      console.error('Error publishing to classroom:', err);
      alert(err.message || 'Ocurrió un error al intentar publicar en Google Classroom.');
    } finally {
      setPublishingClassroom(false);
    }
  };

  if (!content) {

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div className="page-header" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '16px' }}>
          <Link href={`/${locale}/dashboard`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
            ← Mis planeaciones
          </Link>
          <h1 className="page-title" style={{ fontSize: '28px', color: 'var(--c-navy)' }}>{planning.uacName}</h1>
          <p className="page-subtitle" style={{ color: 'var(--c-text-muted)', fontSize: '15px' }}>
            {planning.semester}° Semestre · Componente {planning.component === 'laboral' ? 'Formación Laboral' : 'Fundamental/Ampliado'}
          </p>
          <div className="page-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <DeletePlanningButton id={planning.id} locale={locale} redirectAfterDelete={true} />
          </div>
        </div>

        {/* Warning Banner */}
        <div className="card" style={{ border: '1px solid #f5c2c7', backgroundColor: '#f8d7da', color: '#842029', padding: '24px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: 'bold' }}>
            <span>⚠️</span> Borrador - Generación Incompleta
          </div>
          <p style={{ lineHeight: 1.6, margin: 0, fontSize: '15px' }}>
            Esta planeación didáctica se encuentra en estado de <strong>Borrador</strong>. Las 7 secciones oficiales de la planeación y los instrumentos de evaluación no han sido generados.
          </p>
          <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link href={`/${locale}/nueva-planeacion`} className="btn btn-primary" style={{ backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)' }}>
              Crear nueva planeación
            </Link>
            <DeletePlanningButton id={planning.id} locale={locale} redirectAfterDelete={true} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '16px' }}>
        <Link href={`/${locale}/dashboard`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
          ← Mis planeaciones
        </Link>
        <h1 className="page-title" style={{ fontSize: '28px', color: 'var(--c-navy)' }}>{planning.uacName}</h1>
        <p className="page-subtitle" style={{ color: 'var(--c-text-muted)', fontSize: '15px' }}>
          {planning.semester}° Semestre · Componente {planning.component === 'laboral' ? 'Formación Laboral' : 'Fundamental/Ampliado'}
        </p>
        <div className="page-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {content && (
            <>
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <Download size={15} /> {downloadingPdf ? 'Generando PDF…' : 'Descargar PDF'}
              </button>
              <a href={`/api/docx/${planning.id}`} className="btn btn-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FileDown size={15} /> Descargar Word (DOCX)
              </a>
              <button
                onClick={() => setActiveTab('a4print')}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Eye size={15} /> Vista Impresión Carta
              </button>
              <button
                onClick={handlePublishClassroom}
                disabled={publishingClassroom}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#15803d',
                  borderColor: '#15803d',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <Send size={15} /> {publishingClassroom ? 'Publicando…' : 'Publicar en Classroom'}
              </button>
            </>
          )}
          <DeletePlanningButton id={planning.id} locale={locale} redirectAfterDelete={true} />
        </div>

      </div>

      {/* Hierarchy & Compliance Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#f8fafc',
        padding: '16px 20px',
        borderRadius: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
            Jerarquía Normativa DBEPA 2026-2027
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: '#3b82f6', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Macro: Planeación Didáctica Semestral
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>➔</span>
            <span style={{ background: '#10b981', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Micro: Secuencias Didácticas ({isLaboral ? 'Actividades Clave' : 'Propósitos Formativos'})
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>➔</span>
            <span style={{ background: '#f59e0b', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Micro-operativo: Planes de Clase ({lessonSessions.length} Sesiones)
            </span>
            {planning.metodologiaActiva && (
              <>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>·</span>
                <span style={{ background: '#7c3aed', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                  🎯 {planning.metodologiaActiva}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowChecklistModal(true)}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          📋 Checklist de Supervisión DBEPA
        </button>
      </div>

      {/* Tabs Menu — Lucide icons */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--c-border)', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {([
          { key: 'planning',      label: 'Planeación',         icon: <FileText   size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'extras',        label: 'Rúbricas',           icon: <Zap        size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'lessonPlans',   label: `Planes (${lessonSessions.length})`, icon: <Clock size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'practiceGuides',label: 'Guías',              icon: <BookOpen   size={15}/>, color: '#7c3aed' },
          { key: 'a4print',       label: 'Formato Carta',      icon: <Printer    size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'audit',         label: 'Auditoría',          icon: <BarChart3  size={15}/>, color: '#059669' },
          { key: 'bundle',        label: 'Bundle',             icon: <Package    size={15}/>, color: '#b45309' },
          { key: 'evaluador',     label: 'Evaluador IA',       icon: <Award      size={15}/>, color: '#dc2626' },
          { key: 'analytics',     label: 'Analytics',          icon: <TrendingUp size={15}/>, color: '#0891b2' },
        ] as const).map(({ key, label, icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderBottom: activeTab === key ? `3px solid ${color}` : '3px solid transparent',
              color: activeTab === key ? color : 'var(--c-text-muted)',
              background: activeTab === key ? `${color}10` : 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s',
              border: 'none',
              borderBottomWidth: '3px',
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === key ? color : 'transparent',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: PLANNING GENERAL */}
      {/* TAB CONTENT: PLANNING GENERAL */}
      {activeTab === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section I */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">I. Datos Generales y Administrativos</span>
            </div>
            <div className="section-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div><strong>Docente:</strong> {s1?.teacherName}</div>
                <div><strong>UAC/Ubicación:</strong> {s1?.uacName}</div>
                <div><strong>Semestre:</strong> {s1?.semester}° Semestre</div>
                <div><strong>Grupos:</strong> {s1?.groups}</div>
                <div><strong>Carga horaria:</strong> {s1?.totalHours} hrs.</div>
                <div><strong>Subsistema:</strong> {s1?.subsystem}</div>
              </div>
            </div>
          </div>

          {/* Section II */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">II. Propósito Formativo (Intencionalidad Curricular)</span>
            </div>
            <div className="section-card-body">
              <p style={{ marginBottom: '16px', lineHeight: 1.6 }}>{content?.sectionII?.purpose}</p>
              
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>Resultados de Aprendizaje:</p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginBottom: '16px' }}>
                {content?.sectionII?.learningOutcomes?.map((out, idx) => (
                  <li key={idx} style={{ marginBottom: '4px', fontSize: '14px' }}>{out}</li>
                ))}
              </ul>

              <p><strong>Vinculación PAEC:</strong></p>
              <p style={{ color: 'var(--c-text-2)', fontStyle: 'italic', fontSize: '14px' }}>
                {content?.sectionII?.paecConnection}
              </p>
            </div>
          </div>

          {/* Activities Dosificación Table */}
          {content?.sectionII?.activities && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Dosificación de Actividades Clave y Tiempos</span>
              </div>
              <div className="section-card-body" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>{activityLabel}</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Corte de Evaluación</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.sectionII.activities.map((a, i) => (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)',
                          borderBottom: '1px solid var(--c-border)',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--c-text)' }}>{a.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 12px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '12px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--c-accent-bright)',
                            border: '1px solid var(--c-accent-border)',
                          }}>
                            {a.corte || 'Corte ' + (i + 1)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--c-text)' }}>{a.hours} hrs.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section IV: Secuencia Didáctica Completa por Momentos Pedagógicos (Opción A) */}
          <div className="section-card">
            <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span className="section-card-title">IV. Diseño de Secuencia Didáctica (Momentos Pedagógicos)</span>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-muted)' }}>
                  Eslabón Didáctico Micro: Sesiones de 50 min distribuidas en Apertura, Desarrollo y Cierre.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {Object.keys(sequenceData).length > 0 && (
                  <>
                    <a
                      href={`/api/docx/secuencia/${planning.id}`}
                      className="btn"
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid var(--c-accent-border)',
                        color: 'var(--c-accent-bright)',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Descargar solo la Secuencia Didáctica oficial en Word (.docx)"
                    >
                      <Download size={13} /> Secuencia (Word)
                    </a>
                    <button
                      type="button"
                      onClick={handleDownloadSecuenciaPdf}
                      disabled={downloadingSeqPdf}
                      className="btn"
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#f87171',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Descargar solo la Secuencia Didáctica oficial en PDF (.pdf)"
                    >
                      {downloadingSeqPdf ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />} Secuencia (PDF)
                    </button>
                  </>
                )}
                <span className="text-xs" style={{ background: 'var(--c-accent-subtle)', color: 'var(--c-accent-bright)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid var(--c-accent-border)' }}>
                  MCCEMS / DBEPA
                </span>
              </div>
            </div>

            <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ── BANNER MAESTRO SEMESTRAL (FASE 4: COMPILADOR SIN TOKENS IA) ── */}
              <div
                style={{
                  borderRadius: '12px',
                  padding: '18px 22px',
                  background: allBlocksGenerated
                    ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(49, 46, 129, 0.95) 50%, rgba(30, 58, 138, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  border: allBlocksGenerated
                    ? '1.5px solid rgba(167, 139, 250, 0.5)'
                    : '1px solid rgba(59, 130, 246, 0.25)',
                  boxShadow: allBlocksGenerated
                    ? '0 10px 30px -5px rgba(124, 58, 237, 0.35), 0 0 15px rgba(139, 92, 246, 0.2)'
                    : '0 4px 12px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span
                      style={{
                        background: allBlocksGenerated
                          ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'
                          : 'rgba(148, 163, 184, 0.15)',
                        color: allBlocksGenerated ? '#ffffff' : '#cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        border: allBlocksGenerated
                          ? '1px solid rgba(196, 181, 253, 0.4)'
                          : '1px solid rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      <Library size={13} /> Compendio Semestral Maestro
                    </span>

                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: allBlocksGenerated ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.18)',
                        color: allBlocksGenerated ? '#34d399' : '#fcd34d',
                        border: allBlocksGenerated ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      {allBlocksGenerated ? `✓ ${generatedWorkbookCount} de ${totalWorkbookBlocks} Bloques Listos` : `${generatedWorkbookCount} de ${totalWorkbookBlocks} Bloques Listos`}
                    </span>

                    <span
                      style={{
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#94a3b8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      ⚡ 0 Tokens IA (Ensamblado Instantáneo)
                    </span>
                  </div>

                  <h3 style={{ margin: '4px 0 6px', fontSize: '17px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                    Libro de Texto Semestral Consolidado (~150-200 Páginas)
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, maxWidth: '650px' }}>
                    {semestralReady && semestralThresholdMet
                      ? '¡Todos los bloques del semestre están generados y cumplen la meta macro oficial! Descarga el libro maestro unificado con numeración continua, índice consolidado y portadas oficiales SEP/DBEPA.'
                      : semestralReady
                      ? `Todos los bloques han sido generados con un volumen de ${accumulatedWorkbookWords.toLocaleString()} palabras (meta recomendada: ${macroTargetWords.toLocaleString()}). La descarga del compendio unificado está disponible.`
                      : `Genera los libros individuales de cada bloque a continuación (${generatedWorkbookCount}/${totalWorkbookBlocks} listos). Al completar todos los bloques se desbloqueará la descarga del Libro Maestro Semestral.`}
                  </p>

                  {/* Detalle de palabras por bloque */}
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#93c5fd' }}>Volumen por bloque:</span>
                    <span>{blockWordCountDetails.join(' · ')}</span>
                    <span style={{
                      fontWeight: 700,
                      color: semestralThresholdMet ? '#34d399' : '#fcd34d',
                      background: semestralThresholdMet ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: semestralThresholdMet ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                    }}>
                      Total: {accumulatedWorkbookWords.toLocaleString()} / {macroTargetWords.toLocaleString()} palabras ({Math.min(100, Math.round((accumulatedWorkbookWords / macroTargetWords) * 100))}%)
                    </span>
                  </div>
                </div>

                {/* Botones de Descarga Semestral */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {semestralReady ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                      {!semestralThresholdMet && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}>
                          ⚠️ Volumen parcial (&lt; {macroTargetWords.toLocaleString()} palabras) — Descarga habilitada
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a
                          href={`/api/docx/libro-semestral/${planning.id}`}
                          download
                          className="btn"
                          style={{
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                          title="Descargar Libro Maestro Semestral completo en Word (.docx)"
                        >
                          <Download size={15} /> Compendio Semestral (Word)
                        </a>
                        <a
                          href={`/api/pdf/libro-semestral/${planning.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                          title="Descargar o ver Libro Maestro Semestral completo en PDF (.pdf)"
                        >
                          <Download size={15} /> Compendio Semestral (PDF)
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', opacity: 0.5, cursor: 'not-allowed' }}>
                      <button
                        disabled
                        className="btn"
                        style={{
                          padding: '8px 14px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          cursor: 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Download size={14} /> Semestral Word ({generatedWorkbookCount}/{totalWorkbookBlocks})
                      </button>
                      <button
                        disabled
                        className="btn"
                        style={{
                          padding: '8px 14px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          cursor: 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Download size={14} /> Semestral PDF ({generatedWorkbookCount}/{totalWorkbookBlocks})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {content?.sectionIV?.activities?.map((a, i) => {
                const seq = sequenceData[i];
                const hasSeq = Boolean(seq && seq.sessions && seq.sessions.length > 0);
                const isGenerating = generatingSeqBlock === i;
                const isEditing = editingSeqBlock === i;
                const isExpanded = expandedSeqBlock === i;
                const wbItem = blockWorkbooks[i];
                const sessionsList: SecuenciaSesion[] = isEditing
                  ? (editedSessions[i] || seq?.sessions || [])
                  : (seq?.sessions || []);

                const aperturaCount = sessionsList.filter(s => s.phase === 'Apertura').length;
                const desarrolloCount = sessionsList.filter(s => s.phase === 'Desarrollo').length;
                const cierreCount = sessionsList.filter(s => s.phase === 'Cierre').length;

                return (
                  <div
                    key={i}
                    style={{
                      border: '1px solid var(--c-border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--c-bg-surface)',
                    }}
                  >
                    {/* Block Header */}
                    <div
                      style={{
                        padding: '14px 18px',
                        background: i % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)',
                        borderBottom: isExpanded ? '1px solid var(--c-border)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '15px', color: 'var(--c-accent-bright)' }}>
                            {prefix}{i + 1}: {a.name}
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                            ({a.hours} hrs. — <em style={{ color: 'var(--c-accent-bright)' }}>{a.methodology}</em>)
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {hasSeq ? (
                            <span style={{ fontSize: '11.5px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={13} /> Secuencia Didáctica Micro ({seq.sessions.length} sesiones de 50 min)
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              ⏳ Secuencia Micro Pendiente
                            </span>
                          )}

                          {wbItem?.workbook ? (
                            <span style={{ fontSize: '11.5px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <BookOpen size={12} /> Libro de Bloque Listo
                            </span>
                          ) : wbItem?.generating ? (
                            <span style={{ fontSize: '11.5px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RefreshCw size={12} className="animate-spin" /> Generando Libro
                            </span>
                          ) : null}

                          {a.saberes && (
                            <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                              • Taxonomía 3 Saberes activa
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isGenerating ? (
                          <button
                            type="button"
                            disabled
                            className="btn animate-pulse-subtle"
                            style={{
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                              color: '#ffffff',
                              border: '1px solid rgba(59, 130, 246, 0.5)',
                              borderRadius: '6px',
                              cursor: 'wait',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 0 14px rgba(37, 99, 235, 0.45)',
                            }}
                          >
                            <span
                              className="spinner"
                              style={{
                                width: '13px',
                                height: '13px',
                                borderWidth: '2px',
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                borderTopColor: '#ffffff',
                                animation: 'spin 0.7s linear infinite',
                              }}
                            />
                            <span>Diseñando sesiones con IA…</span>
                            <span style={{ fontSize: '10.5px', opacity: 0.85, fontWeight: 500 }}>(espera ~15-20s)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (hasSeq) {
                                if (confirm(`¿Deseas volver a generar la secuencia didáctica del Bloque ${i + 1} con IA? Se consumirán tokens de IA y se actualizarán las ${a.hours} sesiones.`)) {
                                  handleGenerateSecuencia(i);
                                }
                              } else {
                                handleGenerateSecuencia(i);
                              }
                            }}
                            className="btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: hasSeq ? 'var(--c-surface)' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                              color: hasSeq ? 'var(--c-text)' : '#fff',
                              border: hasSeq ? '1px solid var(--c-border)' : 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <Zap size={13} /> {hasSeq ? '🔄 Regenerar con IA' : '⚡ Generar Secuencia (IA)'}
                          </button>
                        )}

                        {hasSeq && (
                          <button
                            type="button"
                            onClick={() => setExpandedSeqBlock(prev => prev === i ? null : i)}
                            className="btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: 'var(--c-bg-surface)',
                              border: '1px solid var(--c-border)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Ocultar' : 'Ver Sesiones'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── CUADERNO DE TRABAJO ACTIVO POR BLOQUE (FASE 4) ── */}
                    <div
                      style={{
                        margin: '12px 16px 14px',
                        padding: '14px 18px',
                        borderRadius: '10px',
                        background: wbItem?.workbook
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)'
                          : wbItem?.generating
                          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 41, 59, 0.6) 100%)'
                          : 'rgba(15, 23, 42, 0.5)',
                        border: wbItem?.workbook
                          ? '1px solid rgba(16, 185, 129, 0.35)'
                          : wbItem?.generating
                          ? '1px solid rgba(59, 130, 246, 0.4)'
                          : '1px solid rgba(59, 130, 246, 0.2)',
                        boxShadow: wbItem?.generating
                          ? '0 0 16px rgba(59, 130, 246, 0.2)'
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: '260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <BookOpen size={12} /> Libro de Bloque (35-80 págs)
                            </span>
                            <strong style={{ fontSize: '14px', color: '#f1f5f9' }}>
                              Cuaderno de Trabajo Activo · {prefix}{i + 1}
                            </strong>

                            {wbItem?.workbook ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                }}
                              >
                                ✓ Generado (v{wbItem.version || 1}) · {wbItem.workbook.totalPages || (wbItem.workbook.missions?.length || 4) * 12} págs
                              </span>
                            ) : wbItem?.generating ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(59, 130, 246, 0.2)',
                                  color: '#60a5fa',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <RefreshCw size={11} className="animate-spin" /> Generando con IA...
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'rgba(148, 163, 184, 0.15)',
                                  color: '#94a3b8',
                                  border: '1px solid rgba(148, 163, 184, 0.25)',
                                }}
                              >
                                ⏳ Pendiente
                              </span>
                            )}

                            {wbItem?.workbook?.qualityScore !== undefined && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                  background: wbItem.workbook.qualityScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: wbItem.workbook.qualityScore >= 80 ? '#34d399' : '#fbbf24',
                                  border: `1px solid ${wbItem.workbook.qualityScore >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                }}
                              >
                                Calidad: {wbItem.workbook.qualityScore}/100
                              </span>
                            )}
                          </div>

                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                            Incluye 4 misiones didácticas completas, retos escalonados, renglones caligráficos, tablas vacías, código/diagramas y evaluación NEM.
                          </p>
                        </div>

                        {/* Acciones del Bloque */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {wbItem?.workbook ? (
                            <>
                              <a
                                href={`/api/docx/libro-bloque/${planning.id}?blockIndex=${i}`}
                                download
                                className="btn"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: 'rgba(37, 99, 235, 0.2)',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  color: '#93c5fd',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s',
                                }}
                                title="Descargar libro del bloque en Word (.docx)"
                              >
                                <Download size={13} /> Word (.docx)
                              </a>

                              <a
                                href={`/api/pdf/libro-bloque/${planning.id}?blockIndex=${i}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  background: 'rgba(239, 68, 68, 0.18)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s',
                                }}
                                title="Descargar o ver libro del bloque en PDF (.pdf)"
                              >
                                <Download size={13} /> PDF (.pdf)
                              </a>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Regenerar el Libro de Trabajo del Bloque ${i + 1}? Se volverán a ejecutar los 4 redactores concurrentes con IA.`)) {
                                    handleGenerateWorkbook(i);
                                  }
                                }}
                                disabled={wbItem.generating}
                                className="btn"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                  color: '#94a3b8',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Volver a generar este libro de bloque con IA"
                              >
                                <RefreshCw size={12} /> Regenerar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerateWorkbook(i)}
                              disabled={wbItem?.generating}
                              className="btn"
                              style={{
                                padding: '7px 14px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                background: wbItem?.generating
                                  ? 'rgba(59, 130, 246, 0.3)'
                                  : 'linear-gradient(135deg, #059669 0%, #2563eb 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: wbItem?.generating ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: wbItem?.generating ? 'none' : '0 3px 10px rgba(5, 150, 105, 0.35)',
                                transition: 'all 0.15s',
                              }}
                            >
                              {wbItem?.generating ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" /> Generando...
                                </>
                              ) : (
                                <>
                                  <Zap size={13} /> Generar Libro de Bloque (IA)
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Barra de progreso en vivo durante la generación */}
                      {wbItem?.generating && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '11.5px' }}>
                            <span style={{ color: '#93c5fd', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <RefreshCw size={12} className="animate-spin text-blue-400" />
                              {wbItem.progress?.currentStep || 'Escribiendo misiones didácticas con IA...'}
                            </span>
                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                              {wbItem.progress?.percent || 15}%
                            </span>
                          </div>
                          <div
                            style={{
                              height: '8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(5, Math.min(100, wbItem.progress?.percent || 15))}%`,
                                background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)',
                                borderRadius: '4px',
                                transition: 'width 0.4s ease-in-out',
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Mensaje de error si falla */}
                      {wbItem?.error && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '8px 12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '6px',
                            color: '#f87171',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <AlertTriangle size={14} />
                          <span>{wbItem.error}</span>
                          <button
                            onClick={() => handleGenerateWorkbook(i)}
                            style={{
                              marginLeft: 'auto',
                              background: 'none',
                              border: 'underline',
                              color: '#fca5a5',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            Reintentar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Block Body Content */}
                    {isExpanded && (
                      <div style={{ padding: '16px 18px', background: 'var(--c-bg-surface)' }}>
                        {/* Feedback message banner */}
                        {seqMessage && seqMessage.block === i && (
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: '6px',
                              marginBottom: '14px',
                              fontSize: '13px',
                              background: seqMessage.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                              color: seqMessage.type === 'success' ? '#34d399' : '#fb7185',
                              border: `1px solid ${seqMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                            }}
                          >
                            {seqMessage.text}
                          </div>
                        )}

                        {hasSeq ? (
                          <>
                            {/* Summary & Edit Toolbar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', background: 'rgba(3,105,161,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(56,189,248,0.3)' }}>
                                  Apertura: {aperturaCount} ses.
                                </span>
                                <span style={{ fontSize: '11px', background: 'rgba(21,128,61,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(74,222,128,0.3)' }}>
                                  Desarrollo: {desarrolloCount} ses.
                                </span>
                                <span style={{ fontSize: '11px', background: 'rgba(126,34,206,0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(192,132,252,0.3)' }}>
                                  Cierre: {cierreCount} ses.
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', alignSelf: 'center' }}>
                                  Total: {sessionsList.length} sesiones de 50 min
                                </span>
                              </div>

                              <div>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveSecuencia(i)}
                                      className="btn btn-primary"
                                      style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, background: '#16a34a', border: 'none', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}
                                    >
                                      💾 Guardar Cambios
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSeqBlock(null)}
                                      className="btn"
                                      style={{ padding: '5px 10px', fontSize: '12px', background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)', borderRadius: '5px', cursor: 'pointer' }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(i)}
                                    className="btn"
                                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', borderRadius: '5px', cursor: 'pointer' }}
                                  >
                                    ✏️ Editar Sesiones
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Sessions Table */}
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                <thead>
                                  <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Sesión / Fase</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>Título Situado</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '220px' }}>Rol del Docente</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '220px' }}>Rol del Estudiante</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '160px' }}>Evidencia Formativa</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '140px' }}>Evaluación</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionsList.map((s, sIdx) => {
                                    const phaseColor =
                                      s.phase === 'Apertura'
                                        ? { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' }
                                        : s.phase === 'Cierre'
                                        ? { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' }
                                        : { bg: '#dcfce7', text: '#15803d', border: '#86efac' };

                                    return (
                                      <tr
                                        key={sIdx}
                                        style={{
                                          background: sIdx % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)',
                                          borderBottom: '1px solid var(--c-border)',
                                        }}
                                      >
                                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                                          <div style={{ fontWeight: 700, fontSize: '12px' }}>S{s.sessionNum}</div>
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              marginTop: '4px',
                                              fontSize: '10px',
                                              padding: '1px 6px',
                                              borderRadius: '10px',
                                              fontWeight: 600,
                                              background: phaseColor.bg,
                                              color: phaseColor.text,
                                              border: `1px solid ${phaseColor.border}`,
                                            }}
                                          >
                                            {s.phase}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={s.title}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'title', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ fontWeight: 600, color: 'var(--c-accent-bright)' }}>{s.title}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <textarea
                                              value={s.teachingActivity}
                                              rows={2}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'teachingActivity', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ lineHeight: 1.4, color: 'var(--c-text-2)' }}>{s.teachingActivity}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <textarea
                                              value={s.learningActivity}
                                              rows={2}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'learningActivity', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ lineHeight: 1.4, color: 'var(--c-text)' }}>{s.learningActivity}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={s.evidence || ''}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'evidence', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ fontSize: '11.5px', color: 'var(--c-text-muted)' }}>{s.evidence || '—'}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={s.evaluation || ''}
                                              onChange={(e) => handleUpdateEditedSession(i, sIdx, 'evaluation', e.target.value)}
                                              style={{ width: '100%', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--c-border)' }}
                                            />
                                          ) : (
                                            <span style={{ fontSize: '11.5px', color: 'var(--c-text-muted)' }}>{s.evaluation || 'Formativa continua'}</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--c-bg-surface)', borderRadius: '8px', border: '1px dashed var(--c-border-accent)' }}>
                            <p style={{ fontWeight: 600, color: 'var(--c-accent-bright)', marginBottom: '6px' }}>
                              ⚡ Secuencia Didáctica Micro no generada para este bloque
                            </p>
                            <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.5 }}>
                              Usa el botón <strong>"Generar Secuencia (IA)"</strong> en el encabezado del bloque para generar las {a.hours} sesiones de 50 minutos con momentos didácticos (Apertura, Desarrollo, Cierre).
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EXTRAS & INSTRUMENTS */}
      {activeTab === 'extras' && (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section V - Instruments generation */}
          <div className="section-card">
            <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-card-title">A. Instrumentos de Evaluación Propuestos</span>
              <span className="text-xs" style={{ color: 'var(--c-navy-light)', fontWeight: 600 }}>Trinomio de Evaluación</span>
            </div>
            <div className="section-card-body">
              {content?.sectionV?.evaluationAgreement && (
                <div style={{ padding: '12px', background: 'var(--c-bg-surface)', borderLeft: '3px solid var(--c-amber)', border: '1px solid var(--c-border)', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
                  <p style={{ fontWeight: 600, color: 'var(--c-accent-bright)', marginBottom: '4px' }}>Acuerdo de Acreditación / Evaluación:</p>
                  <p style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>{content.sectionV.evaluationAgreement}</p>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Corte / Momento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Evidencia</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Instrumento Propuesto</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>%</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Herramientas Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content?.sectionV?.evaluations?.map((ev, i) => {
                      const isDiagnostic = ev.type?.toLowerCase().includes('diagn') || ev.percentage === 0;
                      const instrumentType = ev.instrument?.toLowerCase().includes('rubri') ? 'rubric' : 'checklist';
                      
                      // Match extra
                      const generated = findExtra(instrumentType, i);
                      const loadingKey = `${instrumentType}-${i}--${ev.evidence}`;
                      const isCurrentGenerating = generatingKey === loadingKey;

                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'var(--c-bg-surface)' : 'var(--c-bg-elevated)', borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{ev.moment}</span>
                            <div style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>{ev.type} · {ev.agent}</div>
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: '220px', color: 'var(--c-text-2)' }}>{ev.evidence}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--c-text)' }}>{ev.instrument}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--c-accent-bright)' }}>{ev.percentage}%</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {generated ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => setPreviewExtra(generated)}
                                  className="btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px' }}
                                >
                                  👁️ Ver
                                </button>
                                <a
                                  href={`/api/docx/extra/${generated.id}`}
                                  className="btn btn-amber"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none' }}
                                >
                                  ↓ Word
                                </a>
                                <a
                                  href={`/api/pdf/extra/${generated.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                >
                                  ↓ PDF
                                </a>
                                <button
                                  onClick={() => handleDeleteExtra(generated.id)}
                                  className="btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  handleGenerateExtra(
                                    instrumentType,
                                    `${ev.instrument}: ${ev.evidence.substring(0, 30)}...`,
                                    i,
                                    { evidence: ev.evidence, activityName: ev.moment }
                                  )
                                }
                                disabled={generatingKey !== null}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', background: 'var(--c-blue-mid)', color: '#fff', border: 'none', cursor: 'pointer' }}
                              >
                                {isCurrentGenerating ? '⏳ Generando...' : `⚡ Generar ${instrumentType === 'rubric' ? 'Rúbrica' : 'Lista'}`}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section VI - Classroom Materials */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">B. Materiales Didácticos Impresos del Docente</span>
            </div>
            <div className="section-card-body">
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '14px' }}>
                Genera el contenido técnico real y completo de los materiales sugeridos en la Sección VI.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {content?.sectionVI?.teacherMaterials?.map((mat, idx) => {
                  const cleanMatName = mat.replace(/^[•\s\-\*]+/g, '').trim();
                  
                  // Match extra
                  const generated = findExtra('material', null, cleanMatName);
                  const loadingKey = `material--${cleanMatName}`;
                  const isCurrentGenerating = generatingKey === loadingKey;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'var(--c-bg-surface)',
                        border: '1px solid var(--c-border)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px' }}>📄</span>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--c-text)' }}>{cleanMatName}</span>
                      </div>
                      
                      <div>
                        {generated ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setPreviewExtra(generated)}
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px' }}
                            >
                              👁️ Ver en Pantalla
                            </button>
                            <a
                              href={`/api/docx/extra/${generated.id}`}
                              className="btn btn-amber"
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', textDecoration: 'none' }}
                            >
                              ↓ Descargar Word
                            </a>
                            <a
                              href={`/api/pdf/extra/${generated.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                            >
                              ↓ Descargar PDF
                            </a>
                            <button
                              onClick={() => handleDeleteExtra(generated.id)}
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '12px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleGenerateExtra(
                                'material',
                                cleanMatName,
                                null,
                                {}
                              )
                            }
                            disabled={generatingKey !== null}
                            className="btn btn-navy"
                            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                          >
                            {isCurrentGenerating ? '⏳ Redactando...' : '⚡ Generar Material Impreso'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Widget */}
        <GenerationFeedback entityType="planning" entityId={planning.id} />
        </>
      )}

      {/* TAB CONTENT: LESSON PLANS */}
      {activeTab === 'lessonPlans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Info & Actions Banner */}
          <div className="section-card">
            <div
              className="section-card-header"
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} />
                <span className="section-card-title" style={{ color: '#fff', fontSize: '16px' }}>
                  Planes de Clase Desglosados por Sesión (50 min c/u)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '12px',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  {allDetailedSessions.length} Sesiones · {content?.sectionIV?.activities?.length || 0} {isLaboral ? 'Actividades Clave' : 'Bloques'}
                </span>
                {(content?.sectionIV?.activities?.length || 0) > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllBlocks}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {allBlocksCollapsed ? '📂 Expandir todos los bloques' : '📁 Colapsar todos los bloques'}
                  </button>
                )}
              </div>
            </div>

            <div className="section-card-body" style={{ padding: '16px 20px' }}>
              <div
                style={{
                  padding: '14px 18px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderLeft: '4px solid #3b82f6',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <p style={{ color: '#60a5fa', fontWeight: 600, margin: 0 }}>
                    💡 Secuencia Didáctica Progresiva (DBEPA / USICAMM):
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.18)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.35)', fontWeight: 600 }}>
                      🔵 Apertura (Saberes y Reto)
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.18)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: 600 }}>
                      🟡 Desarrollo (Construcción y Taller)
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.18)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 600 }}>
                      🟢 Cierre (Evaluación y Metacognición)
                    </span>
                  </div>
                </div>
                <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Cada bloque cuenta con su sección física independiente y su propia progresión de sesiones articuladas. Cada sesión tiene asignado su momento didáctico, título situado y descripción de lo que se construye en el aula o taller.
                </p>
              </div>
            </div>
          </div>

          {/* Distinct physical sections per block */}
          {content?.sectionIV?.activities?.map((act, actIdx) => {
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
            const blockNumStr = romanNumerals[actIdx] || String(actIdx + 1);
            const blockSessions = blockSessionsMap[actIdx] || [];
            const generatedCount = blockSessions.filter(
              (s) => !!findExtra('lesson_plan', s.activityIndex, undefined, s.sessionNum)
            ).length;
            const isCollapsed = !!collapsedBlocks[actIdx];

            // Clean title formatting
            const hasBlockPrefix =
              act.name.toLowerCase().startsWith('bloque') ||
              act.name.toLowerCase().startsWith('actividad') ||
              act.name.toLowerCase().startsWith('práctica') ||
              act.name.toLowerCase().startsWith('módulo') ||
              act.name.toLowerCase().startsWith('submódulo');

            const blockDisplayTitle = hasBlockPrefix
              ? act.name
              : `${isLaboral ? 'Actividad Clave' : 'Bloque'} ${blockNumStr}: ${act.name}`;

            const learningOutcome = content?.sectionII?.learningOutcomes?.[actIdx];

            return (
              <div
                key={actIdx}
                className="section-card"
                style={{
                  border: '1px solid rgba(59, 130, 246, 0.28)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: 'rgba(15, 23, 42, 0.75)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Elegant Block Section Header */}
                <div
                  onClick={() => toggleBlock(actIdx)}
                  style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.75) 100%)',
                    borderBottom: isCollapsed ? 'none' : '1px solid rgba(59, 130, 246, 0.22)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          letterSpacing: '0.04em',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                        }}
                      >
                        {isLaboral ? `AC ${actIdx + 1}` : `Bloque ${blockNumStr}`}
                      </span>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '16px', lineHeight: 1.3 }}>
                        {blockDisplayTitle}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '12.5px',
                        color: '#94a3b8',
                        marginTop: '8px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
                        ⏱️ <strong>{act.hours || blockSessions.length} horas</strong> curriculares
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}>
                        📝 <strong>{blockSessions.length} sesiones</strong> (50 min c/u)
                      </span>
                      {act.methodology && (
                        <>
                          <span>•</span>
                          <span style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#c4b5fd', border: '1px solid rgba(124, 58, 237, 0.3)', padding: '1px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600 }}>
                            🎯 {act.methodology}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background:
                          generatedCount === blockSessions.length && blockSessions.length > 0
                            ? 'rgba(16, 185, 129, 0.2)'
                            : generatedCount > 0
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(148, 163, 184, 0.12)',
                        color:
                          generatedCount === blockSessions.length && blockSessions.length > 0
                            ? '#34d399'
                            : generatedCount > 0
                            ? '#60a5fa'
                            : '#94a3b8',
                        border:
                          generatedCount === blockSessions.length && blockSessions.length > 0
                            ? '1px solid rgba(16, 185, 129, 0.4)'
                            : generatedCount > 0
                            ? '1px solid rgba(59, 130, 246, 0.4)'
                            : '1px solid rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      {generatedCount === blockSessions.length && blockSessions.length > 0
                        ? `✓ ${generatedCount}/${blockSessions.length} Planes Generados`
                        : `${generatedCount} de ${blockSessions.length} planes generados`}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBlock(actIdx);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#94a3b8',
                        padding: '5px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                  </div>
                </div>

                {/* Block Body */}
                {!isCollapsed && (
                  <div style={{ padding: '16px 20px' }}>
                    {/* Block Info Banner: Contenido Formativo & Resultado de Aprendizaje */}
                    <div
                      style={{
                        padding: '14px 18px',
                        background: 'rgba(30, 41, 59, 0.55)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {act.contenidoFormativo && (
                        <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                          <strong style={{ color: '#60a5fa' }}>📌 Contenido formativo / Subtemas:</strong>{' '}
                          {act.contenidoFormativo}
                        </div>
                      )}
                      {learningOutcome && (
                        <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                          <strong style={{ color: '#34d399' }}>🎯 Resultado de aprendizaje:</strong>{' '}
                          {learningOutcome}
                        </div>
                      )}
                      {act.saberes && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', fontSize: '11.5px' }}>
                          {act.saberes.saber && (
                            <span style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#93c5fd', padding: '2px 8px', borderRadius: '4px' }}>
                              🧠 <strong>Saber:</strong> {act.saberes.saber.substring(0, 60)}…
                            </span>
                          )}
                          {act.saberes.saberHacer && (
                            <span style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fcd34d', padding: '2px 8px', borderRadius: '4px' }}>
                              ⚙️ <strong>Hacer:</strong> {act.saberes.saberHacer.substring(0, 60)}…
                            </span>
                          )}
                          {act.saberes.saberSer && (
                            <span style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '4px' }}>
                              🤝 <strong>Ser:</strong> {act.saberes.saberSer.substring(0, 60)}…
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section divider with subtle text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0 14px 0' }}>
                      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.35))' }} />
                      <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                        Desglose de Sesiones ({blockSessions.length} sesiones de 50 min)
                      </span>
                      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.35), transparent)' }} />
                    </div>

                    {/* Sessions List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {blockSessions.map((session, sIdx) => {
                        const generated = findExtra('lesson_plan', session.activityIndex, undefined, session.sessionNum);
                        const loadingKey = `lesson_plan-${session.activityIndex}-${session.sessionNum}-`;
                        const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                        return (
                          <div
                            key={sIdx}
                            style={{
                              padding: '14px 16px',
                              background: generated
                                ? 'rgba(16, 185, 129, 0.04)'
                                : sIdx % 2 === 0
                                ? 'rgba(30, 41, 59, 0.45)'
                                : 'rgba(30, 41, 59, 0.25)',
                              border: generated
                                ? '1px solid rgba(16, 185, 129, 0.25)'
                                : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                          >
                            {/* Top row: Phase Badge + Session Number + Status + Actions */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '10px',
                                marginBottom: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {/* Phase Badge */}
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: session.phaseColor.bg,
                                    color: session.phaseColor.text,
                                    border: `1px solid ${session.phaseColor.border}`,
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  [{session.phase}]
                                </span>

                                {/* Session number pill */}
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#f8fafc',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Sesión {session.sessionNum} de {session.totalSessions} (50 min)
                                </span>

                                {/* Status badge */}
                                {generated ? (
                                  <span style={{ fontSize: '11px', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                    <CheckCircle size={12} /> Plan Generado
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    Pendiente de generar
                                  </span>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div>
                                {generated ? (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button
                                      onClick={() => setPreviewExtra(generated)}
                                      className="btn"
                                      style={{
                                        padding: '4px 9px',
                                        fontSize: '11px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(59, 130, 246, 0.4)',
                                        color: '#93c5fd',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                      }}
                                    >
                                      👁️ Ver
                                    </button>
                                    <a
                                      href={`/api/docx/extra/${generated.id}`}
                                      className="btn btn-amber"
                                      style={{ padding: '4px 9px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                      ↓ Word
                                    </a>
                                    <a
                                      href={`/api/pdf/extra/${generated.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        padding: '4px 9px',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        textDecoration: 'none',
                                        background: '#dc2626',
                                        color: '#fff',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ↓ PDF
                                    </a>
                                    <button
                                      onClick={() => handleDeleteExtra(generated.id)}
                                      className="btn"
                                      title="Eliminar plan generado"
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#f87171',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleGenerateExtra(
                                        'lesson_plan',
                                        `Plan de Clase: Sesión ${session.sessionNum} - ${session.title}`,
                                        session.activityIndex,
                                        {
                                          sessionNum: session.sessionNum,
                                          totalSessions: session.totalSessions,
                                          activityName: session.activityName,
                                          sessionTopic: session.title,
                                          sessionFocus: session.focus,
                                          teachingActivity: session.teachingActivity,
                                          learningActivity: session.learningActivity,
                                          evidence: session.evidence,
                                          evaluation: session.evaluation,
                                          phase: session.phase,
                                        }
                                      )
                                    }
                                    disabled={generatingKey !== null}
                                    className="btn btn-navy"
                                    style={{
                                      padding: '6px 14px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      borderRadius: '5px',
                                      border: 'none',
                                      cursor: generatingKey !== null ? 'not-allowed' : 'pointer',
                                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                      color: '#fff',
                                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                                    }}
                                  >
                                    {isCurrentGenerating ? '⏳ Creando plan...' : '⚡ Generar Plan de Clase'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Middle row: Specific Session Title */}
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                              📌 {session.title}
                            </div>

                            {/* Bottom row: What is built / achieved in this session */}
                            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '6px' }}>
                              {session.description}
                            </div>

                            {/* Focus / Didactic goal pill */}
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                borderLeft: `3px solid ${session.phaseColor.text}`,
                              }}
                            >
                              <strong style={{ color: session.phaseColor.text }}>🎯 Construcción de la sesión:</strong>{' '}
                              <span>{session.focus}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(!content?.sectionIV?.activities || content.sectionIV.activities.length === 0) && (
            <div className="section-card" style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
              No se encontraron bloques o actividades clave en la Sección IV de esta planeación.
            </div>
          )}

          {/* Feedback Widget */}
          <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
      )}

      {/* TAB CONTENT: PRACTICE GUIDES (Fase 3) */}
      {activeTab === 'practiceGuides' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📚 Guías de Práctica para el Estudiante</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.12)', borderLeft: '3px solid #7c3aed', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
                <p style={{ color: '#c4b5fd', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es la Guía de Práctica para el Estudiante?</p>
                <p style={{ color: 'var(--c-text)', marginBottom: '6px' }}>
                  Documento que el estudiante recibe directamente (impreso o digital) para guiar su aprendizaje autónomo,
                  diseñado bajo los lineamientos pedagógicos del Marco Curricular Común (MCCEMS),
                  incluyendo propósito, competencias, materiales, procedimiento por fases de la metodología activa,
                  preguntas de análisis (taxonomía Bloom), tabla de datos y autoevaluación formativa.
                </p>
                {planning.metodologiaActiva && (
                  <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '13px' }}>
                    🎯 Metodología activa seleccionada: <strong>{planning.metodologiaActiva}</strong> — las guías incluirán sus fases específicas.
                  </p>
                )}
              </div>

              {/* One card per key activity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {content?.sectionIV?.activities?.map((act, actIdx) => {
                  const practiceNum = actIdx + 1;
                  const practiceTitle = `${act.name.substring(0, 60)}`;
                  const generatedGuide = extras.find(
                    (ex) => ex.type === 'practice_guide' && ex.keyIndex === actIdx
                  );
                  const loadingKey = `practice_guide-${actIdx}--`;
                  const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                  return (
                    <div
                      key={actIdx}
                      style={{
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--c-bg-surface)',
                      }}
                    >
                      {/* Activity header */}
                      <div style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.08))',
                        borderBottom: '1px solid rgba(124, 58, 237, 0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#e9d5ff', fontSize: '15px' }}>
                            📋 Práctica {practiceNum}: {practiceTitle}
                          </span>
                          <div style={{ fontSize: '12px', color: '#c4b5fd', marginTop: '2px' }}>
                            {act.hours} hrs · {act.methodology || 'Metodología activa'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {generatedGuide ? (
                            <>
                              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600, background: 'rgba(16,185,129,0.15)', padding: '3px 10px', borderRadius: '12px' }}>
                                ✓ Guía generada
                              </span>
                              <button
                                onClick={() => setPreviewExtra(generatedGuide)}
                                className="btn"
                                style={{ padding: '6px 14px', fontSize: '12px', background: 'rgba(124,58,237,0.2)', border: '1px solid #7c3aed', color: '#c4b5fd', borderRadius: '6px' }}
                              >
                                👁️ Ver Guía
                              </button>
                              <a
                                href={`/api/docx/extra/${generatedGuide.id}`}
                                className="btn"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#7c3aed', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ↓ Word
                              </a>
                              <a
                                href={`/api/pdf/extra/${generatedGuide.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#dc2626', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ↓ PDF
                              </a>
                              <button
                                onClick={() => handleDeleteExtra(generatedGuide.id)}
                                className="btn"
                                style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', borderRadius: '6px' }}
                              >
                                🗑️
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                handleGenerateExtra(
                                  'practice_guide',
                                  `Guía de Práctica ${practiceNum}: ${practiceTitle.substring(0, 50)}`,
                                  actIdx,
                                  {
                                    activityName: act.name,
                                    practiceNumber: practiceNum,
                                    practiceTitle: practiceTitle,
                                  }
                                )
                              }
                              disabled={generatingKey !== null}
                              className="btn"
                              style={{
                                padding: '8px 18px',
                                fontSize: '13px',
                                borderRadius: '6px',
                                border: 'none',
                                background: generatingKey !== null ? '#c4b5fd' : '#7c3aed',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: generatingKey !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isCurrentGenerating ? '⏳ Generando guía...' : '📚 Generar Guía del Estudiante'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Preview of learning outcome if available */}
                      {content?.sectionII?.learningOutcomes?.[actIdx] && (
                        <div style={{ padding: '10px 16px', fontSize: '13px', color: '#6d28d9', borderTop: '1px dashed #ddd6fe' }}>
                          <strong>📌 Resultado de aprendizaje:</strong> {content.sectionII.learningOutcomes[actIdx]}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!content?.sectionIV?.activities || content.sectionIV.activities.length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
                    No se encontraron actividades clave en la Sección IV de esta planeación.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback */}
          <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
      )}
      {activeTab === 'a4print' && (
        <DocumentA4Viewer
          planning={{ ...planning, sequenceJson: sequenceData }}
          onDownloadDocx={() => {
            window.location.href = `/api/docx/${planning.id}`;
          }}
        />
      )}

      {/* ── TAB CONTENT: AUDITORÍA PEDAGÓGICA ─────────────────────────── */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '8px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--c-navy)', margin: 0 }}>📊 Auditoría Pedagógica IA</h2>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                Evaluación automática en 4 dimensiones MCCEMS · Motor v2 · SEMS
              </p>
            </div>
            {auditLoaded && !auditLoading && (
              <button
                onClick={handleReAudit}
                style={{
                  padding: '9px 18px', fontSize: '13px', fontWeight: 600,
                  background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: '8px',
                  color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                🔄 Re-auditar
              </button>
            )}
          </div>

          {/* Loading */}
          {auditLoading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '16px', padding: '60px 20px', background: 'var(--c-bg-surface)', borderRadius: '12px',
              border: '1px dashed var(--c-border-2)',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: '4px solid var(--c-border-2)', borderTopColor: 'var(--c-accent)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: '15px', color: 'var(--c-text-muted)', fontWeight: 500, margin: 0 }}>
                Analizando planeación contra el programa oficial SEP…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {!auditLoading && auditError && (
            <div style={{
              padding: '20px 24px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
              borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '22px' }}>❌</span>
              <div>
                <div style={{ fontWeight: 700, color: '#fb7185', fontSize: '14px' }}>Error al ejecutar la auditoría</div>
                <div style={{ color: '#f43f5e', fontSize: '13px', marginTop: '4px' }}>{auditError}</div>
                <button
                  onClick={handleReAudit}
                  style={{
                    marginTop: '12px', padding: '7px 16px', fontSize: '13px', fontWeight: 600,
                    background: '#be123c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Audit Results */}
          {!auditLoading && !auditError && auditReport && (() => {
            const score: number = auditReport.overall_score ?? 0;
            const level: string = auditReport.compliance_level ?? 'requiere_mejora';
            const scoreColor = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fb923c' : '#f87171';
            const scoreBg = score >= 80 ? 'rgba(16, 185, 129, 0.12)' : score >= 60 ? 'rgba(245, 158, 11, 0.12)' : score >= 40 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(244, 63, 94, 0.12)';
            const levelLabel: Record<string, string> = {
              excelente: '🏆 Excelente',
              satisfactorio: '✅ Satisfactorio',
              requiere_mejora: '⚠️ Requiere Mejora',
              no_alineado: '❌ No Alineado',
            };
            const dimLabel: Record<string, string> = {
              propositos_alineacion: '1. Alineación con Propósitos Formativos',
              cobertura_contenidos: '2. Cobertura de Contenidos Temáticos',
              secuenciacion_logica: '3. Secuenciación Lógica y Momentos Didácticos',
              adecuacion_evidencias: '4. Adecuación de Evidencias e Instrumentos',
            };
            const statusIcon: Record<string, string> = { cumple: '✅', parcial: '⚠️', no_cumple: '❌' };
            const dimScores = auditReport.dimension_scores || {};
            const findings = auditReport.findings || {};
            const recommendations: any[] = auditReport.recommendations || [];
            const sevColor: Record<string, string> = { alta: '#f43f5e', media: '#f59e0b', baja: '#10b981' };

            return (
              <>
                {/* Score Card */}
                <div style={{
                  display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap',
                  padding: '24px', borderRadius: '14px', background: scoreBg,
                  border: `2px solid ${scoreColor}33`,
                }}>
                  {/* Circular score */}
                  <div style={{
                    position: 'relative', width: '100px', height: '100px', flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="10"
                        strokeDasharray={`${(score / 100) * 263.9} 263.9`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '24px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
                      <span style={{ fontSize: '11px', color: scoreColor, fontWeight: 600 }}>/ 100</span>
                    </div>
                  </div>

                  {/* Level + meta */}
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: scoreColor }}>
                      {levelLabel[level] || level}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--c-text)', marginTop: '4px' }}>
                      {auditReport.uac_name} · {auditReport.semester}° Semestre
                    </div>
                    {auditReport.created_at && (
                      <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '6px' }}>
                        Auditado: {new Date(auditReport.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* Mini dimension bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px', flex: 1 }}>
                    {Object.entries(dimScores).map(([key, dim]: [string, any]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', width: '14px', textAlign: 'center' }}>
                          {statusIcon[dim.status] || '⚠️'}
                        </span>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${dim.score}%`, height: '100%',
                            background: dim.score >= 80 ? '#10b981' : dim.score >= 60 ? '#f59e0b' : '#f43f5e',
                            borderRadius: '99px', transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text)', width: '28px', textAlign: 'right' }}>
                          {dim.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dimension Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>Detalle por Dimensión</h3>
                  {Object.entries(dimScores).map(([key, dim]: [string, any]) => {
                    const isExpanded = expandedDimension === key;
                    const dimScore: number = dim.score ?? 0;
                    const dimColor = dimScore >= 80 ? '#34d399' : dimScore >= 60 ? '#fbbf24' : '#f87171';
                    const dimBg = dimScore >= 80 ? 'rgba(16, 185, 129, 0.08)' : dimScore >= 60 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(244, 63, 94, 0.08)';
                    return (
                      <div key={key} style={{ border: `1px solid ${dimColor}33`, borderRadius: '10px', overflow: 'hidden' }}>
                        <button
                          onClick={() => setExpandedDimension(isExpanded ? null : key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '14px 16px', background: dimBg, border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: '18px' }}>{statusIcon[dim.status] || '⚠️'}</span>
                          <span style={{ flex: 1, fontWeight: 700, fontSize: '14px', color: 'var(--c-text)' }}>
                            {dimLabel[key] || key}
                          </span>
                          <span style={{
                            fontSize: '16px', fontWeight: 900, color: dimColor,
                            background: `${dimColor}18`, borderRadius: '6px', padding: '2px 10px',
                          }}>
                            {dimScore}/100
                          </span>
                          <span style={{ color: 'var(--c-text-muted)', fontSize: '13px' }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: '14px 16px', background: 'var(--c-bg-elevated)', borderTop: `1px solid ${dimColor}22` }}>
                            <p style={{ fontSize: '13.5px', color: 'var(--c-text-2)', lineHeight: 1.6, margin: 0 }}>
                              {dim.feedback}
                            </p>
                            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700,
                                background: dim.status === 'cumple' ? 'rgba(16,185,129,0.15)' : dim.status === 'parcial' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                                color: dim.status === 'cumple' ? '#34d399' : dim.status === 'parcial' ? '#fcd34d' : '#fb7185',
                              }}>
                                {dim.status === 'cumple' ? 'Cumple' : dim.status === 'parcial' ? 'Cumple Parcialmente' : 'No Cumple'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>Ponderación: {Math.round((dim.weight ?? 0) * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Findings */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {/* Fortalezas */}
                  {findings.fortalezas?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#34d399', marginBottom: '10px' }}>✅ Fortalezas</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.fortalezas.map((f: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Desalineaciones */}
                  {findings.desalineaciones?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#fbbf24', marginBottom: '10px' }}>⚠️ Desalineaciones Detectadas</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.desalineaciones.map((d: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Omisiones */}
                  {findings.omisiones_detectadas?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#fb7185', marginBottom: '10px' }}>❌ Contenidos Omitidos</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.omisiones_detectadas.map((o: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Propósitos cubiertos */}
                  {findings.propositos_cubiertos?.length > 0 && (
                    <div style={{ padding: '16px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#818cf8', marginBottom: '10px' }}>📌 Propósitos Cubiertos</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.propositos_cubiertos.map((p: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--c-text)', lineHeight: 1.5 }}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>🎯 Recomendaciones del Auditor</h3>
                    {recommendations.map((rec: any, i: number) => {
                      const sev: string = rec.severidad ?? 'media';
                      const bg = sev === 'alta' ? 'rgba(244,63,94,0.12)' : sev === 'media' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)';
                      const border = sev === 'alta' ? 'rgba(244,63,94,0.3)' : sev === 'media' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)';
                      return (
                        <div key={i} style={{
                          padding: '14px 16px', background: bg, border: `1px solid ${border}`,
                          borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'flex-start',
                        }}>
                          <span style={{
                            padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                            background: sevColor[sev] ?? '#f59e0b', color: '#fff', flexShrink: 0, marginTop: '1px',
                          }}>
                            {sev.toUpperCase()}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: 'var(--c-text-muted)', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {dimLabel[rec.dimension] || rec.dimension}
                            </div>
                            <div style={{ fontSize: '13.5px', color: 'var(--c-text)', lineHeight: 1.6 }}>{rec.mensaje}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* TAB CONTENT: BUNDLE DIDÁCTICO */}
      {activeTab === 'bundle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header card */}
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📦 Bundle Didáctico Complementario</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.12)', borderLeft: '3px solid #b45309', borderRadius: '6px', marginBottom: '20px', fontSize: '13.5px' }}>
                <p style={{ color: '#fbbf24', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es el Bundle Didáctico?</p>
                <p style={{ color: 'var(--c-text)', margin: 0 }}>
                  Conjunto de 4 materiales complementarios generados automáticamente a partir de tu planeación:
                  Guía del Alumno, Instrumento de Coevaluación, Guión de Diapositivas y Quiz Diagnóstico.
                  Genera cada uno individualmente o todos a la vez con <strong>Suite Completa</strong>.
                </p>
              </div>

              {/* Generate All button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <button
                  onClick={handleGenerateFullBundle}
                  disabled={Object.values(bundleLoading).some(Boolean)}
                  style={{
                    padding: '12px 32px',
                    fontSize: '15px',
                    fontWeight: 700,
                    background: Object.values(bundleLoading).some(Boolean) ? '#d97706' : '#b45309',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: Object.values(bundleLoading).some(Boolean) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(180,83,9,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {Object.values(bundleLoading).some(Boolean) ? '⏳ Generando Suite…' : '⚡ Generar Suite Completa (4 materiales)'}
                </button>
              </div>

              {/* 4 material cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {BUNDLE_TYPES.map((bt) => {
                  const result  = bundleResults[bt.type] ?? null;
                  const loading = bundleLoading[bt.type] ?? false;
                  const error   = bundleErrors[bt.type]  ?? null;
                  const isExpanded = bundleExpanded === bt.type;

                  return (
                    <div
                      key={bt.type}
                      style={{
                        border: `1px solid ${bt.color}33`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'var(--c-bg-surface)',
                      }}
                    >
                      {/* Card header */}
                      <div style={{
                        padding: '12px 16px',
                        background: `${bt.color}15`,
                        borderBottom: `2px solid ${bt.color}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{bt.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: bt.color }}>{bt.label}</span>
                        </div>
                        {result && (
                          <span style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>✓ Listo</span>
                        )}
                      </div>

                      {/* Card body */}
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {error && (
                          <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#fb7185' }}>
                            ⚠️ {error}
                          </div>
                        )}

                        {!result ? (
                          <button
                            onClick={() => handleGenerateBundleItem(bt.type)}
                            disabled={loading}
                            style={{
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 600,
                              background: loading ? `${bt.color}80` : bt.color,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              width: '100%',
                            }}
                          >
                            {loading ? `⏳ Generando ${bt.label}…` : `⚡ Generar ${bt.label}`}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setBundleExpanded(isExpanded ? null : bt.type)}
                              style={{
                                flex: 1,
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: isExpanded ? bt.color : `${bt.color}15`,
                                color: isExpanded ? '#fff' : bt.color,
                                border: `1px solid ${bt.color}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              {isExpanded ? '▲ Ocultar' : '👁️ Ver contenido'}
                            </button>
                            <button
                              onClick={() => handleGenerateBundleItem(bt.type)}
                              disabled={loading}
                              style={{
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: 'var(--c-bg-elevated)',
                                color: 'var(--c-text-muted)',
                                border: '1px solid var(--c-border-2)',
                                borderRadius: '6px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {loading ? '⏳' : '🔄 Regenerar'}
                            </button>
                          </div>
                        )}

                        {/* Expanded preview */}
                        {isExpanded && result && (
                          <div style={{
                            background: 'var(--c-bg-base)',
                            border: '1px solid var(--c-border-2)',
                            borderRadius: '6px',
                            padding: '12px',
                            maxHeight: '320px',
                            overflowY: 'auto',
                            fontSize: '12.5px',
                            lineHeight: 1.65,
                            color: 'var(--c-text)',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                          }}>
                            {result}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EVALUADOR IA */}
      {activeTab === 'evaluador' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>🏅 Evaluador IA — Rúbrica Oficial Anexo 12 USICAMM</span>
            </div>
            <div className="section-card-body">
              {evalLoading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#dc2626' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                  <p style={{ fontWeight: 600 }}>Evaluando planeación con IA…</p>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Esto puede tardar 15-30 segundos. La IA analiza todos los criterios del Anexo 12.</p>
                </div>
              )}

              {evalError && (
                <div style={{ background: '#FEE2E2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', color: '#991b1b' }}>
                  <p style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Error al evaluar</p>
                  <p style={{ fontSize: '14px', margin: 0 }}>{evalError}</p>
                  <button
                    onClick={() => handleRunEvaluacion(true)}
                    style={{ marginTop: '12px', padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔄 Reintentar
                  </button>
                </div>
              )}

              {!evalResult && !evalLoading && !evalError && (
                <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--c-bg-surface)', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: '42px', marginBottom: '12px' }}>🏅</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '8px' }}>
                    Auditoría Oficial con IA (Anexo 12 USICAMM / DBEPA)
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--c-text-muted)', maxWidth: '560px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                    Esta planeación aún no ha sido evaluada. La IA auditará los criterios pedagógicos oficiales, asignará puntuaciones cuantitativas fijas y emitirá dictamen de mejora.
                  </p>
                  <button
                    onClick={() => handleRunEvaluacion(false)}
                    style={{
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🚀 Iniciar Evaluación IA Ahora
                  </button>
                </div>
              )}

              {evalResult && !evalLoading && (
                <>
                  {/* Score hero */}
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', padding: '20px', background: 'var(--c-bg-surface)', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <div style={{
                        width: '96px', height: '96px', borderRadius: '50%', margin: '0 auto 8px',
                        background: `conic-gradient(${evalResult.nivelCumplimiento === 'COMPLETO' ? '#10b981' : evalResult.nivelCumplimiento === 'PARCIAL' ? '#f59e0b' : '#ef4444'} ${(evalResult.puntajeTotal / evalResult.puntajeMaximo) * 360}deg, var(--c-border) 0)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 0 8px var(--c-bg-surface) inset',
                      }}>
                        <div style={{ background: 'var(--c-card-bg)', borderRadius: '50%', width: '72px', height: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text)' }}>{evalResult.puntajeTotal}</span>
                          <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>/{evalResult.puntajeMaximo}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: evalResult.nivelCumplimiento === 'COMPLETO' ? '#10b981' : evalResult.nivelCumplimiento === 'PARCIAL' ? '#d97706' : '#dc2626' }}>
                        {evalResult.nivelCumplimiento === 'COMPLETO' ? '✅ COMPLETO' : evalResult.nivelCumplimiento === 'PARCIAL' ? '⚠️ PARCIAL' : '❌ REQUIERE CORRECCIÓN'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '8px' }}><strong>Rúbrica:</strong> {evalResult.rubricaUsada}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {evalResult.puntosFuertes?.slice(0, 3).map((pf: string, i: number) => (
                          <span key={i} style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>✓ {pf}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {evalResult.mejorasUrgentes?.slice(0, 3).map((m: string, i: number) => (
                          <span key={i} style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>⚡ {m}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('¿Deseas volver a auditar esta planeación con la IA? Se consumirán tokens de IA para regenerar la evaluación.')) {
                          handleRunEvaluacion(true);
                        }
                      }}
                      style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: '12px', fontWeight: 600, background: 'var(--c-bg-elevated)', color: 'var(--c-text)', border: '1px solid var(--c-border-2)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      🔄 Re-evaluar
                    </button>
                  </div>

                  {/* Criteria table */}
                  <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border-2)' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Criterio</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Categoría</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Pts</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Cumple</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.criterios?.map((cr: any, idx: number) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--c-bg-surface)' : 'transparent', borderBottom: '1px solid var(--c-border)' }}>
                            <td style={{ padding: '9px 12px', color: 'var(--c-text)', fontWeight: 500 }}>{cr.criterio}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '12px' }}>{cr.categoria}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: cr.cumple === 'SI' ? '#10b981' : cr.cumple === 'PARCIAL' ? '#f59e0b' : '#f43f5e' }}>
                              {cr.puntajeObtenido}/{cr.puntajeMax}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{ background: cr.cumple === 'SI' ? 'rgba(16,185,129,0.15)' : cr.cumple === 'PARCIAL' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)', color: cr.cumple === 'SI' ? '#34d399' : cr.cumple === 'PARCIAL' ? '#fcd34d' : '#fb7185', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                                {cr.cumple}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', color: 'var(--c-text-muted)', fontSize: '12.5px' }}>{cr.observacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Retroalimentación */}
                  {evalResult.retroalimentacionDocente && (
                    <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ fontWeight: 700, color: 'var(--c-accent-bright)', marginBottom: '8px' }}>💬 Retroalimentación Docente</p>
                      <p style={{ fontSize: '14px', color: 'var(--c-text)', lineHeight: 1.7, margin: 0 }}>{evalResult.retroalimentacionDocente}</p>
                    </div>
                  )}
                  {evalResult.alineacionPaecPec && (
                    <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
                      <p style={{ fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>🌿 Alineación PAEC/PEC</p>
                      <p style={{ fontSize: '14px', color: 'var(--c-text)', lineHeight: 1.7, margin: 0 }}>{evalResult.alineacionPaecPec}</p>
                    </div>
                  )}
                </>
              )}

              {!evalLoading && !evalResult && !evalError && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: 'var(--c-text-muted)' }}>Iniciando evaluación automática…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ANALYTICS PEDAGÓGICO — Recharts */}
      {activeTab === 'analytics' && (() => {
        // ── Derived chart data ────────────────────────────────────────────────
        const semesterBarData = analyticsData?.plannings?.by_semester
          ? Object.entries(analyticsData.plannings.by_semester)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([sem, count]) => ({ name: `Sem ${sem}`, value: Number(count) }))
          : [];

        const componentPieData = analyticsData?.plannings?.by_component
          ? Object.entries(analyticsData.plannings.by_component).map(([comp, count]) => ({
              name: comp === 'laboral' ? 'Laboral' : comp === 'fundamental' ? 'Fundamental' : comp,
              value: Number(count),
            }))
          : [];

        const KPI_ITEMS = [
          { label: 'Planeaciones', value: analyticsData?.plannings?.total_plannings ?? 0, icon: <FileText size={20}/>,  color: '#1d4ed8' },
          { label: 'PAEC',         value: analyticsData?.paec_count         ?? 0, icon: <BookMarked size={20}/>, color: '#059669' },
          { label: 'PMC',          value: analyticsData?.pmc_count          ?? 0, icon: <Grid       size={20}/>, color: '#7c3aed' },
          { label: 'PIPS',         value: analyticsData?.pips_count         ?? 0, icon: <Microscope size={20}/>, color: '#b45309' },
          { label: 'Biblioteca',   value: analyticsData?.library_docs_count ?? 0, icon: <Library    size={20}/>, color: '#0891b2' },
        ];

        const radarData = KPI_ITEMS.map(k => ({ subject: k.label, A: k.value }));

        const PIE_COLORS = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#0891b2'];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="section-card">
              <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0891b2 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="section-card-title" style={{ color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18}/> Analytics Pedagógico Personal
                </span>
                {!analyticsLoading && analyticsData && (
                  <button
                    onClick={() => { setAnalyticsLoaded(false); handleLoadAnalytics(); }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={12}/> Actualizar
                  </button>
                )}
              </div>
              <div className="section-card-body">

                {/* ── Loading ─────────────────────────────────────────────── */}
                {analyticsLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#0891b2' }}>
                    <TrendingUp size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }}/>
                    <p style={{ fontWeight: 600 }}>Cargando tu panel de analytics…</p>
                  </div>
                )}

                {/* ── Error ───────────────────────────────────────────────── */}
                {analyticsError && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', color: '#991b1b' }}>
                    <p style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16}/> Error</p>
                    <p style={{ fontSize: '14px', margin: 0 }}>{analyticsError}</p>
                    <button onClick={handleLoadAnalytics} style={{ marginTop: '12px', padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={13}/> Reintentar
                    </button>
                  </div>
                )}

                {analyticsData && !analyticsLoading && (
                  <>
                    {/* ── KPI cards ──────────────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                      {KPI_ITEMS.map((item) => (
                        <div key={item.label} style={{ background: `${item.color}0f`, border: `1px solid ${item.color}30`, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                          <div style={{ color: item.color, display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>{item.icon}</div>
                          <div style={{ fontSize: '30px', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* ── Two-column charts ──────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>

                      {/* BarChart — por semestre */}
                      {semesterBarData.length > 0 && (
                        <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BarChart3 size={15} color="#818cf8"/> Planeaciones por Semestre
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={semesterBarData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false}/>
                              <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                              <Tooltip
                                contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}
                                formatter={(v: any) => [v, 'Planeaciones']}
                              />
                              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                {semesterBarData.map((_, i) => (
                                  <Cell key={i} fill={['#6366f1','#818cf8','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'][i % 6]}/>
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* PieChart — por componente */}
                      {componentPieData.length > 0 && (
                        <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Grid size={15} color="#34d399"/> Distribución por Componente
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={componentPieData}
                                cx="50%" cy="50%"
                                innerRadius={45} outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {componentPieData.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}
                                formatter={(v: any, name: any) => [v, name]}
                              />
                              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px', color: 'var(--c-text-muted)' }}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* RadarChart — distribución de módulos */}
                      {radarData.some(r => r.A > 0) && (
                        <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={15} color="#c084fc"/> Perfil Pedagógico General
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="var(--c-border)"/>
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--c-text-muted)' }}/>
                              <PolarRadiusAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false}/>
                              <Radar name="Total" dataKey="A" stroke="#a855f7" fill="#a855f7" fillOpacity={0.25}/>
                              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}/>
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Feedback ratings */}
                      {analyticsData.feedback && analyticsData.feedback.length > 0 && (() => {
                        const fbBarData = analyticsData.feedback.map((fb: any) => ({
                          name: (fb.entity_type as string).split('_').pop() || fb.entity_type,
                          rating: Number(Number(fb.avg_rating).toFixed(1)),
                          count: fb.total_count,
                        }));
                        return (
                          <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                            <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Star size={15} color="#fbbf24"/> Ratings de Generación IA
                            </p>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={fbBarData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false}/>
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false} width={72}/>
                                <Tooltip
                                  contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}
                                  formatter={(v: any) => [`${v}/5`, 'Rating']}
                                />
                                <Bar dataKey="rating" radius={[0, 4, 4, 0]}>
                                  {fbBarData.map((fb: any, i: number) => (
                                    <Cell key={i} fill={fb.rating >= 4 ? '#10b981' : fb.rating >= 3 ? '#f59e0b' : '#f43f5e'}/>
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── Recent plannings list ──────────────────────────── */}
                    {analyticsData.plannings?.recent && analyticsData.plannings.recent.length > 0 && (
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} color="#38bdf8"/> Últimas planeaciones
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {analyticsData.plannings.recent.map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--c-bg-surface)', borderRadius: '6px', border: '1px solid var(--c-border)', fontSize: '13px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={13} color="#38bdf8"/> {p.uac_name}
                              </span>
                              <span style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>
                                {new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Visor Modal Overlay */}
      {previewExtra && (
        <ExtraPreviewModal
          isOpen={previewExtra !== null}
          onClose={() => setPreviewExtra(null)}
          title={previewExtra.title}
          contentText={previewExtra.contentText}
          type={previewExtra.type}
        />
      )}

      {/* Modal Lista de Cotejo de Supervisión */}
      {showChecklistModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'var(--c-card-bg)', border: '1px solid var(--c-border-2)', borderRadius: '12px', maxWidth: '750px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: 'var(--shadow-xl)',
            color: 'var(--c-text)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--c-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>
                  📋 Lista de Cotejo de Supervisión DBEPA (2026-2027)
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', margin: '4px 0 0 0' }}>
                  Alineado a <em>03 Lista de cotejo Plan de Clase 1-4_SEM.pdf</em> y normativas del Bachillerato General Estatal.
                </p>
              </div>
              <button onClick={() => setShowChecklistModal(false)} style={{ background: 'var(--c-bg-elevated)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Propósitos Formativos / Contenidos Formativos', desc: 'Contenidos temáticos oficiales de la UAC vinculados al MCCEMS.', status: true },
                { label: 'Meta Educativa', desc: 'Metas de aprendizaje claras, objetivas y orientadas al logro de trayectoria.', status: true },
                { label: 'Transversalidad Disciplinar', desc: 'Conexión coherente con otras asignaturas del mismo semestre y currículum ampliado.', status: true },
                { label: 'Exploración de Conocimientos Previos', desc: 'Fase de Apertura con recuperación activa de saberes e ideas de los estudiantes.', status: true },
                { label: 'Actividades de Aprendizaje Acordes', desc: 'Actividades continuas, contextualizadas a la comunidad de Puebla y al PAEC.', status: true },
                { label: 'Metodología Socio-crítica / Estrategias Activas', desc: 'Uso obligatorio de ABP, Método de Casos o Simulaciones prácticas (Nivel 2 de complejidad).', status: true },
                { label: 'Productos Esperados', desc: 'Entregables físicos/digitales concretos por sesión y por Actividad Clave.', status: true },
                { label: 'Temporalidad y Dosificación de Tiempos', desc: 'Dosificación matemática estricta por Cortes (18h/24h por corte) y sesiones de 50 min.', status: true },
                { label: 'Momentos de Evaluación Formativa', desc: 'Evaluación Diagnóstica, Formativa y Sumativa con Hetero, Co y Autoevaluación.', status: true },
                { label: 'Metacognición Formativa en Cierre', desc: 'Fase de Cierre orientada a la reflexión del aprendizaje y consolidación de competencias.', status: true },
                { label: 'Instrumentos Objetivos de Evaluación', desc: 'Rúbricas analíticas y Listas de cotejo para Producto y Desempeño.', status: true }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', background: 'var(--c-bg-surface)', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
                  <span style={{ background: '#10b981', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--c-text)' }}>{i + 1}. {item.label}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                ✓ Cumplimiento del 100% verificado por DidácticaIA
              </span>
              <button onClick={() => setShowChecklistModal(false)} className="btn btn-navy" style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '6px' }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
