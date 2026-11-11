'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type { GeneratedPlanningContent, Planning, PlanningExtra, SecuenciaBloque, SecuenciaSesion } from '@/types/planning';
import { ExtraPreviewModal } from '@/components/planeacion/ExtraPreviewModal';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import PlanningDetailHero from '@/components/planeacion/PlanningDetailHero';
import DocumentA4Modal from '@/components/planeacion/DocumentA4Modal';
import ChecklistSupervisionModal from '@/components/planeacion/ChecklistSupervisionModal';
import { generatePlanningPDF, generateSecuenciaPDF } from '@/lib/planning-pdf-renderer';
import { generateBlockSessions, generateCurricularBlockSessions, type DetailedSession } from '@/lib/session-progression-engine';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { exportPlanningPdfWithFallback, generateSequenceWithFallback } from '@/lib/planeaciones/strangler-client';
import { resolveWeeklyHours, computeContentBudget } from '@/lib/guide-engine/content-budget';
import type { ActiveWorkTextbook, GenerationProgressState } from '@/types/work-textbook';
// ── Lucide Icons ────────────────────────────────────────────────────────────
import {
  FileText, Clock, Package, ShieldCheck,
} from 'lucide-react';

interface PlanningDetailClientProps {
  locale: string;
  planning: Planning;
  initialExtras: PlanningExtra[];
  editorialEngineEnabled?: boolean;
  canEditDocument?: boolean;
}

import PlanningDetailLegacy from './legacy/PlanningDetailLegacy';
import {
  PlanningTabDocumento,
  PlanningTabSecuencias,
  PlanningTabMateriales,
  PlanningTabCalidad,
  type QualitySubTab,
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
  planning: initialPlanning,
  initialExtras,
  editorialEngineEnabled,
  canEditDocument = false,
}: PlanningDetailClientProps) {
  const [planning, setPlanning] = useState<Planning>(initialPlanning);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPlanning(initialPlanning);
  }, [initialPlanning]);

  const handlePlanningUpdated = (updatedContent: GeneratedPlanningContent) => {
    setPlanning((prev) => ({
      ...prev,
      contentJson: updatedContent,
    }));
  };

  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;

  // Tabs state (4 atomic axes + subtab controlled state)
  const [activeTab, setActiveTabState] = useState<'planning' | 'lessonPlans' | 'materials' | 'quality'>('planning');
  const [materialsSubTab, setMaterialsSubTab] = useState<'extras' | 'teacherGuides' | 'practiceGuides'>('extras');
  const [qualitySubTab, setQualitySubTab] = useState<QualitySubTab>('audit');
  const [showA4Modal, setShowA4Modal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const setActiveTab = useCallback((tab: string) => {
    if (tab === 'planning') {
      setActiveTabState('planning');
    } else if (tab === 'lessonPlans') {
      setActiveTabState('lessonPlans');
    } else if (tab === 'materials') {
      setActiveTabState('materials');
    } else if (tab === 'extras') {
      setActiveTabState('materials');
      setMaterialsSubTab('extras');
    } else if (tab === 'practiceGuides' || tab === 'guiasPractica') {
      setActiveTabState('materials');
      setMaterialsSubTab('practiceGuides');
    } else if (tab === 'teacherGuides') {
      setActiveTabState('materials');
      setMaterialsSubTab('teacherGuides');
    } else if (tab === 'a4print') {
      setShowA4Modal(true);
    } else if (tab === 'quality') {
      setActiveTabState('quality');
    } else if (tab === 'audit') {
      setActiveTabState('quality');
      setQualitySubTab('audit');
    } else if (tab === 'evaluador') {
      setActiveTabState('quality');
      setQualitySubTab('evaluador');
    } else if (tab === 'analytics') {
      setActiveTabState('quality');
      setQualitySubTab('analytics');
    }
  }, []);

  // ── Secuencia Didáctica por Sesión state ──────────────────────────────────
  const [sequenceData, setSequenceData] = useState<Record<number, SecuenciaBloque>>(
    (planning.sequenceJson as Record<number, SecuenciaBloque>) || {}
  );

  // Generate detailed pedagogical sessions for all 3 curricular blocks using Session Progression Engine
  const curricularBlocks = useMemo(() => resolveCurricularBlocks(content), [content]);
  const blockSessionsMap: DetailedSession[][] = useMemo(() => {
    return curricularBlocks.map((block) => {
      const savedSeq = sequenceData?.[block.blockIndex] || null;
      return generateCurricularBlockSessions(block, isLaboral, savedSeq);
    });
  }, [curricularBlocks, isLaboral, sequenceData]);
  const allDetailedSessions: DetailedSession[] = useMemo(() => {
    return blockSessionsMap.flat();
  }, [blockSessionsMap]);
  const lessonSessions = allDetailedSessions;

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
    [0, 1, 2].every((idx) => !!collapsedBlocks[idx]);

  const toggleAllBlocks = () => {
    const shouldCollapse = !allBlocksCollapsed;
    const next: Record<number, boolean> = {};
    [0, 1, 2].forEach((idx) => {
      next[idx] = shouldCollapse;
    });
    setCollapsedBlocks(next);
  };

  // Modal Checklist Supervisión
  const [showChecklistModal, setShowChecklistModal] = useState(false);

  // Extras state
  const [extras, setExtras] = useState<PlanningExtra[]>(initialExtras);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [previewExtra, setPreviewExtra] = useState<PlanningExtra | null>(null);
  const [syncingSuite, setSyncingSuite] = useState<number | null>(null);

  const loadExtras = useCallback(async () => {
    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras`);
      if (res.ok) {
        const data = await res.json();
        setExtras(data);
      }
    } catch (err) {
      console.error('Failed to load extras:', err);
    }
  }, [planning.id]);

  // Fetch extras on mount (to ensure sync)
  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

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

      // Auto-navegar a la pestaña de Planes para ver las sesiones
      setActiveTab('lessonPlans');
      const count = blockSessionsMap[blockIdx]?.length || '';
      toast.success(
        `¡Suite del Bloque ${blockIdx + 1} sincronizada con éxito! ${count ? `(${count} Planes de Clase derivados)` : ''}`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al sincronizar la Suite');
    } finally {
      setSyncingSuite(null);
    }
  };

  // Generate extra handler
  async function handleGenerateExtra(
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide' | 'teacher_guide' | 'evaluation',
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
      toast.error(err instanceof Error ? err.message : 'Error al generar el recurso');
    } finally {
      setGeneratingKey(null);
    }
  }

  // Delete extra handler
  async function handleDeleteExtra(extraId: string) {
    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras?extraId=${extraId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setExtras((prev) => prev.filter((ex) => ex.id !== extraId));
        toast.success('Recurso eliminado correctamente');
      } else {
        toast.error('Error al eliminar el recurso');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar el recurso');
    }
  }

  // Helper to find existing generated extra (memoizado para estabilidad referencial)
  const findExtra = useCallback(
    (type: string, keyIndex: number | null, title?: string, sessionNum?: number) => {
      return extras.find((ex) => {
        if (ex.type !== type) return false;
        const rawEx = ex as unknown as { key_index?: number | null; keyIndex?: number | null };
        const exKey = ex.keyIndex !== undefined && ex.keyIndex !== null ? ex.keyIndex : (rawEx.key_index ?? null);

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
    },
    [extras]
  );

  // ── Secuencia Didáctica por Sesión state ──────────────────────────────────
  const [generatingSeqBlock, setGeneratingSeqBlock] = useState<number | null>(null);
  const [editingSeqBlock, setEditingSeqBlock] = useState<number | null>(null);
  const [editedSessions, setEditedSessions] = useState<Record<number, SecuenciaSesion[]>>({});
  const [seqMessage, setSeqMessage] = useState<{ block: number; text: string; type: 'success' | 'error' } | null>(null);
  const [expandedSeqBlock, setExpandedSeqBlock] = useState<number | null>(0);

  const handleGenerateSecuencia = async (blockIndex: number) => {
    setGeneratingSeqBlock(blockIndex);
    setSeqMessage(null);
    try {
      const result = await generateSequenceWithFallback<{ sequence: SecuenciaBloque }>({
        planningId: planning.id,
        blockIndex,
        onLegacyFallback: async () => {
          const act = content?.sectionIV?.activities?.[blockIndex];
          if (!act) {
            throw new Error(`Bloque ${blockIndex + 1} no encontrado en la planeación`);
          }
          const outcome = content?.sectionII?.learningOutcomes?.[blockIndex] || '';
          const hours = act.hours || (isLaboral ? 18 : 12);
          const rawSessions = generateBlockSessions(act, blockIndex, hours, outcome, isLaboral, null);
          const sessions: SecuenciaSesion[] = rawSessions.map((s) => ({
            sessionNum: s.sessionNum,
            totalSessions: s.totalSessions,
            phase: s.phase,
            title: s.title,
            teachingActivity: s.teachingActivity || s.description || 'Desarrollo de actividades formativas',
            learningActivity: s.learningActivity || s.focus || 'Participación activa en la sesión',
            evidence: s.evidence || 'Evidencia de trabajo en clase',
            evaluation: s.evaluation,
          }));
          return {
            sequence: {
              blockIndex,
              blockName: act.name || `Bloque ${blockIndex + 1}`,
              hours,
              sessions,
              updatedAt: new Date().toISOString(),
            },
          };
        },
      });

      if (result.error) {
        setSeqMessage({ block: blockIndex, text: result.error, type: 'error' });
        return;
      }

      if (result.data?.sequence) {
        setSequenceData(prev => ({ ...prev, [blockIndex]: result.data!.sequence }));
        setExpandedSeqBlock(blockIndex);
        setSeqMessage({ block: blockIndex, text: '¡Secuencia didáctica generada y guardada con éxito!', type: 'success' });
      }
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
      toast.error(err instanceof Error ? err.message : 'Error al guardar cambios');
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

  const handleUpdateEditedSession = (blockIndex: number, sessionIdx: number, field: keyof SecuenciaSesion, val: unknown) => {
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

  interface RawWorkbookRecord {
    current?: ActiveWorkTextbook | null;
    version?: number;
    progress?: GenerationProgressState | null;
  }

  const initialWorkbooks: Record<number, BlockWorkbookItem> = {};
  const rawWorkbooks = (planning.workbooksJson ||
    (planning as unknown as { workbooks_json?: Record<string, RawWorkbookRecord> }).workbooks_json ||
    {}) as Record<string, RawWorkbookRecord>;

  const initialBlockIndexes = curricularBlocks.map((b) => b.blockIndex);
  initialBlockIndexes.forEach((idx) => {
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
    const activeIntervals = pollIntervalsRef.current;
    return () => {
      Object.values(activeIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  // Sync / verify existing workbooks on mount
  useEffect(() => {
    [0, 1, 2].forEach(async (idx) => {
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
                  // Monotonía visual: nunca retroceder dentro de la misma generación.
                  percent: Math.max(cur.progress?.percent ?? 0, statusData.progress || 10),
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

  const totalWorkbookBlocks = curricularBlocks.length;
  const blockIndexes = useMemo(
    () => curricularBlocks.map((b) => b.blockIndex),
    [curricularBlocks]
  );
  const generatedWorkbookCount = blockIndexes.filter(
    (idx) => Boolean(blockWorkbooks[idx]?.workbook)
  ).length;
  const allBlocksGenerated = totalWorkbookBlocks > 0 && generatedWorkbookCount === totalWorkbookBlocks;

  const weeklyHours = resolveWeeklyHours(planning);
  const blockBudget = computeContentBudget(weeklyHours);
  // Presupuesto macro unificado semestral (bloques curriculares de la UAC)
  const macroTargetWords = blockBudget.targetWords.ideal * totalWorkbookBlocks;

  const accumulatedWorkbookWords = blockIndexes.reduce(
    (acc, idx) => {
      const wb = blockWorkbooks[idx]?.workbook;
      const prog = blockWorkbooks[idx]?.progress;
      const words = wb?.totalWords || prog?.totalWords || prog?.wordCount || 0;
      return acc + words;
    },
    0
  );

  const blockWordCountDetails = blockIndexes.map((idx) => {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    const roman = romanNumerals[idx] || `${idx + 1}`;
    const wb = blockWorkbooks[idx]?.workbook;
    const prog = blockWorkbooks[idx]?.progress;
    const words = wb?.totalWords || prog?.totalWords || prog?.wordCount;
    if (words) {
      const generatedAt = wb?.generatedAt ? new Date(wb.generatedAt) : null;
      // Solo renderizar stamp localizado una vez montado para evitar error de hidratación #418 SSR vs cliente
      const stamp =
        mounted && generatedAt && !Number.isNaN(generatedAt.getTime())
          ? ` (${generatedAt.toLocaleDateString('es-MX', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}, ${generatedAt.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })})`
          : '';
      return `Bloque ${roman}: ${words.toLocaleString()} palabras${stamp}`;
    }
    return `Bloque ${roman}: pendiente`;
  });

  const semestralThresholdMet = accumulatedWorkbookWords >= blockBudget.targetWords.min * totalWorkbookBlocks;
  const semestralReady = allBlocksGenerated;

  // Download PDF handler
  const [downloadingSeqPdf, setDownloadingSeqPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const filename = `Planeacion_${planning.uacName.replace(/\s+/g, '_')}_Semestre_${planning.semester}.pdf`;
      const result = await exportPlanningPdfWithFallback({
        planningId: planning.id,
        filename,
        onLegacyFallback: async () => {
          const pdf = await generatePlanningPDF({ ...planning, sequenceJson: sequenceData });
          pdf.save(filename);
        },
      });
      if (result.error) {
        toast.error(result.error);
      }
    } catch (e) {
      console.error('Error generating PDF:', e);
      toast.error('Hubo un error al generar el archivo PDF.');
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
      toast.error('Hubo un error al generar el archivo PDF de la secuencia didáctica.');
    } finally {
      setDownloadingSeqPdf(false);
    }
  };

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
        toast.error('Configura Google Classroom en Configuración\n\n' + data.message);
        return;
      }

      if (data.success) {
        toast.success(data.message);
        if (data.courseUrl) {
          window.open(data.courseUrl, '_blank');
        }
      } else {
        toast.error(data.message || 'No se pudo publicar la planeación en Classroom.');
      }
    } catch (err: unknown) {
      console.error('Error publishing to classroom:', err);
      toast.error(err instanceof Error ? err.message : 'Ocurrió un error al intentar publicar en Google Classroom.');
    } finally {
      setPublishingClassroom(false);
    }
  };

  if (!content) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PlanningDetailHero
          locale={locale}
          planning={planning}
          isLaboral={isLaboral}
          weeklyHours={weeklyHours}
          totalSessions={lessonSessions.length}
          totalBlocks={totalWorkbookBlocks}
          hasContent={false}
          publishingClassroom={false}
          onPublishClassroom={() => {}}
          onOpenChecklistModal={() => setShowChecklistModal(true)}
        />

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
      {/* Hero Card & Action Toolbar */}
      <PlanningDetailHero
        locale={locale}
        planning={planning}
        isLaboral={isLaboral}
        weeklyHours={weeklyHours}
        totalSessions={lessonSessions.length}
        totalBlocks={totalWorkbookBlocks}
        hasContent={true}
        publishingClassroom={publishingClassroom}
        onPublishClassroom={handlePublishClassroom}
        onOpenChecklistModal={() => setShowChecklistModal(true)}
      />

      {/* Tabs Menu — 4 Ejes Atómicos (.detail-tabs) */}
      <div className="detail-tabs" role="tablist" aria-label="Ejes principales de planeación">
        <button
          type="button"
          role="tab"
          id="tab-btn-planning"
          aria-controls="tabpanel-planning"
          aria-selected={activeTab === 'planning'}
          onClick={() => setActiveTab('planning')}
          className={`detail-tab${activeTab === 'planning' ? ' is-active' : ''}`}
          aria-current={activeTab === 'planning' ? 'page' : undefined}
        >
          <FileText size={16} />
          <span>Planeación y Libros</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-btn-lessonPlans"
          aria-controls="tabpanel-lessonPlans"
          aria-selected={activeTab === 'lessonPlans'}
          onClick={() => setActiveTab('lessonPlans')}
          className={`detail-tab${activeTab === 'lessonPlans' ? ' is-active' : ''}`}
          aria-current={activeTab === 'lessonPlans' ? 'page' : undefined}
        >
          <Clock size={16} />
          <span>Planes de Clase</span>
          <span className="detail-tab-badge">{lessonSessions.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-btn-materials"
          aria-controls="tabpanel-materials"
          aria-selected={activeTab === 'materials'}
          onClick={() => setActiveTab('materials')}
          className={`detail-tab${activeTab === 'materials' ? ' is-active' : ''}`}
          aria-current={activeTab === 'materials' ? 'page' : undefined}
        >
          <Package size={16} />
          <span>Materiales e Instrumentos</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-btn-quality"
          aria-controls="tabpanel-quality"
          aria-selected={activeTab === 'quality'}
          onClick={() => setActiveTab('quality')}
          className={`detail-tab${activeTab === 'quality' ? ' is-active' : ''}`}
          aria-current={activeTab === 'quality' ? 'page' : undefined}
        >
          <ShieldCheck size={16} />
          <span>Calidad y Auditoría</span>
        </button>
      </div>

      {/* ── ATOMIC TABS DISPATCHER ────────────────────── */}
      <div
        id="tabpanel-planning"
        role="tabpanel"
        aria-labelledby="tab-btn-planning"
        hidden={activeTab !== 'planning'}
      >
        {activeTab === 'planning' && (
          <PlanningTabDocumento
            planning={planning}
            editorialEngineEnabled={editorialEngineEnabled}
            sequenceData={sequenceData}
            extras={extras}
            totalSessions={lessonSessions.length}
            onOpenA4Modal={() => setShowA4Modal(true)}
            onNavigateToLessonPlans={() => setActiveTab('lessonPlans')}
            onNavigateToSolucionario={() => {
              setActiveTabState('materials');
              setMaterialsSubTab('teacherGuides');
            }}
            onNavigateToInstrumentos={() => {
              setActiveTabState('materials');
              setMaterialsSubTab('extras');
            }}
            onNavigateToGuiasPractica={() => {
              setActiveTabState('materials');
              setMaterialsSubTab('practiceGuides');
            }}
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
            canEditDocument={canEditDocument}
            onPlanningUpdated={handlePlanningUpdated}
          />
        )}
      </div>

      <div
        id="tabpanel-lessonPlans"
        role="tabpanel"
        aria-labelledby="tab-btn-lessonPlans"
        hidden={activeTab !== 'lessonPlans'}
      >
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
      </div>

      <div
        id="tabpanel-materials"
        role="tabpanel"
        aria-labelledby="tab-btn-materials"
        hidden={activeTab !== 'materials'}
      >
        {activeTab === 'materials' && (
          <PlanningTabMateriales
            planning={planning}
            activeSubTab={materialsSubTab}
            onSubTabChange={setMaterialsSubTab}
            sequenceData={sequenceData}
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
      </div>

      <div
        id="tabpanel-quality"
        role="tabpanel"
        aria-labelledby="tab-btn-quality"
        hidden={activeTab !== 'quality'}
      >
        <PlanningTabCalidad
          key={planning.id}
          planning={planning}
          activeSubTab={qualitySubTab}
          onSubTabChange={setQualitySubTab}
          isActive={activeTab === 'quality'}
        />
      </div>

      {/* Modal Vista Impresión Carta */}
      <DocumentA4Modal
        isOpen={showA4Modal}
        onClose={() => setShowA4Modal(false)}
        planning={planning}
        sequenceData={sequenceData}
      />

      {/* Visor Modal Overlay */}
      {previewExtra && (
        <ExtraPreviewModal
          isOpen={previewExtra !== null}
          onClose={() => setPreviewExtra(null)}
          title={previewExtra.title || 'Vista Previa'}
          contentText={previewExtra.contentText || (previewExtra as unknown as { content_text?: string }).content_text || ''}
          type={previewExtra.type || 'document'}
        />
      )}

      {/* Modal Lista de Cotejo de Supervisión (W3C WAI-ARIA / Focus Trap) */}
      <ChecklistSupervisionModal
        isOpen={showChecklistModal}
        onClose={() => setShowChecklistModal(false)}
      />
    </div>
  );
}
