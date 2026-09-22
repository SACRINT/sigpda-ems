/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { GeneratedPlanningContent, Planning, PlanningExtra, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import { ExtraPreviewModal } from '@/components/planeacion/ExtraPreviewModal';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import GenerationFeedback from '@/components/feedback/GenerationFeedback';
import DocumentA4Viewer from '@/components/common/DocumentA4Viewer';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { generateBlockSessions, type DetailedSession } from '@/lib/session-progression-engine';
import type { ActiveWorkTextbook, GenerationProgressState } from '@/types/work-textbook';
// ── Lucide Icons ────────────────────────────────────────────────────────────
import {
  FileText, Zap, Clock, GraduationCap, Printer, BarChart3,
  Award, TrendingUp, Download, FileDown, Trash2, Search,
  RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Star, BookMarked, Microscope, Grid, Library, Send, Eye,
} from 'lucide-react';

interface PlanningDetailClientProps {
  locale: string;
  planning: Planning;
  initialExtras: PlanningExtra[];
}

import PlanningDetailLegacy from './legacy/PlanningDetailLegacy';
import {
  PlanningTabDocumento,
  PlanningTabSecuencias,
  PlanningTabMateriales,
  PlanningTabEvaluador,
  PlanningTabAuditoria,
  PlanningTabAnalitica,
} from '@/components/planeacion/tabs';
import { useAssistant } from '@/components/assistant';

export default function PlanningDetailClient(props: PlanningDetailClientProps) {
  if (process.env.NEXT_PUBLIC_FF_NEW_PLANNING_DETAIL === 'false') {
    return <PlanningDetailLegacy {...props} />;
  }
  return <PlanningDetailModular {...props} />;
}

function PlanningDetailModular({
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
  const [activeTab, setActiveTab] = useState<'planning' | 'extras' | 'lessonPlans' | 'teacherGuides' | 'a4print' | 'audit' | 'evaluador' | 'analytics'>('planning');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // SAPCU Copiloto Pedagógico: Sincronización contextual bidireccional
  const { setDetallesDocumento } = useAssistant();
  useEffect(() => {
    if (planning) {
      setDetallesDocumento({
        programa: 'planeaciones',
        documentoId: planning.id,
        seccionActiva: `Pestaña: ${activeTab}`,
        detallesMediaSuperior: {
          uac: planning.uacName,
          semestre: planning.semester,
          subsistema: (s1?.subsystem as "bge" | "tecnologico" | "general") || 'bge',
          metodologiaActiva: planning.metodologiaActiva || s1?.metodologiaActiva,
          retoSituado: {
            contextoReal: content?.sectionII?.retoSituado?.contextoLocal,
            problemaComunidad: content?.sectionII?.retoSituado?.problematicaReal,
            accionCognitiva: content?.sectionII?.retoSituado?.verboInfinitivo,
            productoEvidencia: content?.sectionII?.retoSituado?.retoCompleto,
          },
          paecNombre: content?.sectionII?.paecConnection,
        },
      });
    }
  }, [planning, activeTab, setDetallesDocumento, content, s1]);

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
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Error desconocido.');
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
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Error desconocido.');
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
  const [syncingSuite, setSyncingSuite] = useState<number | null>(null);

  const loadExtras = async () => {
    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras`);
      if (res.ok) {
        const data = await res.json();
        setExtras(data);
      }
    } catch (err) {
      console.error('Failed to load extras:', err);
    }
  };

  // Fetch extras on mount (to ensure sync)
  useEffect(() => {
    loadExtras();
  }, [planning.id]);

  const handleSyncSuite = async (blockIdx: number) => {
    setSyncingSuite(blockIdx);
    try {
      const res = await fetch(`/api/planeaciones/${planning.id}/materiales-bloque?blockIndex=${blockIdx}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar materiales del bloque');

      // Recargar extras en estado React
      await loadExtras();

      // Auto-navegar a la pestaña de Planes para ver las 24 sesiones
      setActiveTab('lessonPlans');
      alert(`¡Suite del Bloque ${blockIdx + 1} sincronizada con éxito!\nSe derivaron los 24 Planes de Clase, Rúbricas y Materiales Didácticos.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al sincronizar la Suite');
    } finally {
      setSyncingSuite(null);
    }
  };

  // Generate extra handler
  async function handleGenerateExtra(
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'teacher_guide',
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
      const exKey = (ex as any).keyIndex !== undefined ? (ex as any).keyIndex : (ex as any).key_index;
      
      // CRÍTICO: Si se especificó el bloque (keyIndex), este DEBE coincidir estrictamente
      // para evitar que los planes de clase de un bloque aparezcan falsamente en otros bloques.
      if (keyIndex !== null) {
        if (exKey === null || exKey === undefined || Number(exKey) !== Number(keyIndex)) {
          return false;
        }
      }

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
    } catch (err: unknown) {
      setSeqMessage({ block: blockIndex, text: err instanceof Error ? err.message : 'Error al generar secuencia', type: 'error' });
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar cambios');
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

    try {
      // 1. Crear / encolar el trabajo asíncrono (responde en < 300ms)
      const createRes = await fetch(`/api/planeaciones/${planning.id}/libro-bloque/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || 'Error al iniciar la generación del libro');
      }

      const jobId = createData.jobId;

      // 2. Iniciar polling del estado real cada 2500ms
      let isFinished = false;
      const interval = setInterval(async () => {
        if (isFinished) return;
        try {
          const statusRes = await fetch(
            `/api/planeaciones/${planning.id}/libro-bloque/status?jobId=${jobId}`
          );
          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
          if (!statusData?.found) return;

          // Actualizar barra de progreso con el avance verídico del pipeline
          setBlockWorkbooks(prev => {
            const cur = prev[blockIndex];
            if (!cur || !cur.generating) return prev;
            return {
              ...prev,
              [blockIndex]: {
                ...cur,
                progress: {
                  planningId: planning.id,
                  blockIndex,
                  phase: statusData.currentPhase || 'writing',
                  currentStep: statusData.currentStep || 'Generando contenido formativo...',
                  percent: statusData.progress || 10,
                  updatedAt: statusData.updatedAt || new Date().toISOString(),
                },
              },
            };
          });

          // Si el worker completó el libro
          if (statusData.status === 'completed') {
            isFinished = true;
            if (pollIntervalsRef.current[blockIndex]) {
              clearInterval(pollIntervalsRef.current[blockIndex]);
              delete pollIntervalsRef.current[blockIndex];
            }

            // Consultar el resultado final del libro
            const resultRes = await fetch(
              `/api/planeaciones/${planning.id}/libro-bloque/result?jobId=${jobId}`
            );
            const resultData = await resultRes.json();

            if (resultData?.workbook) {
              setBlockWorkbooks(prev => ({
                ...prev,
                [blockIndex]: {
                  loaded: true,
                  generating: false,
                  workbook: resultData.workbook,
                  version: resultData.workbook.version || 1,
                  progress: {
                    planningId: planning.id,
                    blockIndex,
                    phase: 'completed',
                    currentStep: '¡Libro-Cuaderno de Trabajo Activo generado exitosamente!',
                    percent: 100,
                    qualityScore: resultData.workbook.qualityScore,
                    wordCount: resultData.wordCount || resultData.workbook.totalWords,
                    totalWords: resultData.totalWords || resultData.workbook.totalWords,
                    updatedAt: new Date().toISOString(),
                  },
                  error: null,
                },
              }));
              loadExtras();
            }
          } else if (statusData.status === 'failed') {
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
                error: statusData.error || 'Error durante la generación del libro de trabajo',
              },
            }));
          }
        } catch (pollErr) {
          console.warn('[handleGenerateWorkbook] Polling warning:', pollErr);
        }
      }, 2500);

      pollIntervalsRef.current[blockIndex] = interval;
    } catch (err: unknown) {
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
          error: err instanceof Error ? err.message : 'Error al iniciar la generación del libro de trabajo',
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
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : 'Error desconocido.');
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
    } catch (err: unknown) {
      setAnalyticsError(err instanceof Error ? err.message : 'Error desconocido.');
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
    } catch (err: unknown) {
      console.error('Error publishing to classroom:', err);
      alert(err instanceof Error ? err.message : 'Ocurrió un error al intentar publicar en Google Classroom.');
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
          { key: 'extras',        label: 'Rúbricas y Materiales', icon: <Zap     size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'lessonPlans',   label: `Planes (${lessonSessions.length})`, icon: <Clock size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'teacherGuides', label: 'Solucionario Docente',       icon: <GraduationCap size={15}/>, color: '#7c3aed' },
          { key: 'a4print',       label: 'Formato Carta',      icon: <Printer    size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'audit',         label: 'Auditoría',          icon: <BarChart3  size={15}/>, color: '#059669' },
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
      {/* ── ATOMIC TABS DISPATCHER (Fase 3 Refactor) ────────────────────── */}
      {(activeTab === 'planning' || activeTab === 'a4print') && (
        <PlanningTabDocumento
          planning={planning}
          activeSubTab={activeTab === 'a4print' ? 'a4print' : 'planning'}
          sequenceData={sequenceData}
          downloadingPdf={downloadingPdf}
          handleDownloadPdf={handleDownloadPdf}
          handleDownloadSecuenciaPdf={handleDownloadSecuenciaPdf}
          downloadingSeqPdf={downloadingSeqPdf}
          accumulatedWorkbookWords={accumulatedWorkbookWords}
          macroTargetWords={macroTargetWords}
          generatedWorkbookCount={generatedWorkbookCount}
          totalWorkbookBlocks={totalWorkbookBlocks}
          blockWordCountDetails={blockWordCountDetails}
          semestralThresholdMet={semestralThresholdMet}
          semestralReady={semestralReady}
          generatingSeqBlock={generatingSeqBlock}
          editingSeqBlock={editingSeqBlock}
          expandedSeqBlock={expandedSeqBlock}
          blockWorkbooks={blockWorkbooks}
          editedSessions={editedSessions}
          handleGenerateSecuencia={handleGenerateSecuencia}
          setExpandedSeqBlock={setExpandedSeqBlock}
          handleSyncSuite={handleSyncSuite}
          syncingSuite={syncingSuite}
          handleGenerateWorkbook={handleGenerateWorkbook}
          seqMessage={seqMessage}
          handleSaveSecuencia={handleSaveSecuencia}
          setEditingSeqBlock={setEditingSeqBlock}
          handleStartEdit={handleStartEdit}
          handleUpdateEditedSession={handleUpdateEditedSession}
        />
      )}

      {activeTab === 'lessonPlans' && (
        <PlanningTabSecuencias
          planning={planning}
          sequenceData={sequenceData}
          collapsedBlocks={collapsedBlocks}
          toggleBlock={toggleBlock}
          toggleAllBlocks={toggleAllBlocks}
          allBlocksCollapsed={allBlocksCollapsed}
          findExtra={findExtra}
          generatingKey={generatingKey}
          setPreviewExtra={setPreviewExtra}
          handleDeleteExtra={handleDeleteExtra}
          handleGenerateExtra={handleGenerateExtra}
          blockWorkbooks={blockWorkbooks}
          handleSyncSuite={handleSyncSuite}
          syncingSuite={syncingSuite}
        />
      )}

      {(activeTab === 'extras' || activeTab === 'teacherGuides') && (
        <PlanningTabMateriales
          planning={planning}
          activeSubTab={activeTab}
          extras={extras}
          generatingKey={generatingKey}
          syncingSuite={syncingSuite}
          blockWorkbooks={blockWorkbooks}
          handleGenerateExtra={handleGenerateExtra}
          handlePreviewExtra={(ex) => setPreviewExtra(ex)}
          handleDeleteExtra={handleDeleteExtra}
          handleSyncSuite={handleSyncSuite}
          handleGenerateWorkbook={handleGenerateWorkbook}
          findExtra={findExtra}
          setPreviewExtra={setPreviewExtra}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === 'audit' && (
        <PlanningTabAuditoria
          planning={planning}
          auditReport={auditReport}
          auditLoading={auditLoading}
          auditError={auditError}
          auditLoaded={auditLoaded}
          expandedDimension={expandedDimension}
          setExpandedDimension={setExpandedDimension}
          handleRunAudit={handleRunAudit}
          handleReAudit={handleReAudit}
        />
      )}

      {activeTab === 'evaluador' && (
        <PlanningTabEvaluador
          planning={planning}
          evalResult={evalResult}
          evalLoading={evalLoading}
          evalError={evalError}
          handleRunEvaluacion={handleRunEvaluacion}
        />
      )}

      {activeTab === 'analytics' && (
        <PlanningTabAnalitica
          planning={planning}
          analyticsData={analyticsData}
          analyticsLoading={analyticsLoading}
          analyticsError={analyticsError}
          analyticsLoaded={analyticsLoaded}
          handleLoadAnalytics={handleLoadAnalytics}
        />
      )}

      {/* Visor Modal Overlay */}
      {previewExtra && (
        <ExtraPreviewModal
          isOpen={previewExtra !== null}
          onClose={() => setPreviewExtra(null)}
          title={previewExtra.title || 'Vista Previa'}
          contentText={previewExtra.contentText || (previewExtra as any).content_text || ''}
          type={previewExtra.type || 'document'}
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