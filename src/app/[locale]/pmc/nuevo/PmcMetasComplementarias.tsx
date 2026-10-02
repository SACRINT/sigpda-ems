'use client';

import React, { useState, useMemo } from 'react';
import type { IndicadoresAcademicos } from './PmcWizardClient';
import { deduplicateMetasInstitucionales } from '@/lib/pmc-meta-deduplicator';
import { consolidateMetasPersonalesByTeacher } from '@/lib/pmc-document-structure';
import type { PmcNormalizedGoalResponse } from '@/lib/ai-schemas';

export interface MetaPersonalItem {
  nombre: string;
  cargo: string;
  categoria?: string;
  tema?: string;
  meta_individual: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

export interface MetaInstitucionalItem {
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
  continuidad_de?: string;
  accion_especifica?: string;
  finalidad?: string;
  necesidad?: string;
  proceso_evaluacion?: string;
  subcategorias_vinculadas?: string[];
  estrategias_seguimiento?: string;
  observaciones?: string;
}

export interface PlanAccionData {
  metas_institucionales: MetaInstitucionalItem[];
  metas_personales: MetaPersonalItem[];
}

export interface StaffMemberData {
  nombre: string;
  cargo: string;
  horas_base?: number | string | null;
  meta_individual?: string;
  asignaturas?: string;
  grupos?: string;
}

interface PmcMetasComplementariasProps {
  projectId: string | null;
  planAccion: PlanAccionData | null;
  setPlanAccion: React.Dispatch<React.SetStateAction<PlanAccionData | null>>;
  staffData: StaffMemberData[];
  setStaffData?: React.Dispatch<React.SetStateAction<StaffMemberData[]>>;
  cicloEscolar: string;
  subsystem?: string;
  indicadores?: IndicadoresAcademicos;
  onPlanUpdated?: (updatedPlan: PlanAccionData) => void;
}

const AMBITOS_OFICIALES = [
  { id: 'aprovechamiento', nombre: '1. Aprovechamiento académico y asistencia educativa' },
  { id: 'practica_docente', nombre: '2. Práctica docente y formación continua' },
  { id: 'infraestructura', nombre: '3. Infraestructura y equipamiento escolar' },
  { id: 'convivencia_paec', nombre: '4. Convivencia escolar y Proyecto Escolar Comunitario (PAEC)' },
  { id: 'adicional', nombre: '5. Ámbito Institucional Adicional (Priorizado por el Plantel)' },
];

export function PmcMetasComplementarias({
  projectId,
  planAccion,
  setPlanAccion,
  staffData,
  setStaffData,
  cicloEscolar,
  indicadores,
  onPlanUpdated,
}: PmcMetasComplementariasProps) {
  // Pestaña principal: por defecto 'ia_quirurgica' para la mejor experiencia
  const [subTab, setSubTab] = useState<'ia_quirurgica' | 'personales' | 'institucionales'>('ia_quirurgica');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── ESTADO INGESTIÓN Y NORMALIZACIÓN QUIRÚRGICA CON IA ──────────────────────
  const [aiSelectedStaffIndex, setAiSelectedStaffIndex] = useState<string>('custom');
  const [aiDocenteNombre, setAiDocenteNombre] = useState('');
  const [aiDocenteCargo, setAiDocenteCargo] = useState('Docente');
  const [aiHorasBase, setAiHorasBase] = useState('');
  const [aiRawGoalText, setAiRawGoalText] = useState('');
  const [aiTipoMeta, setAiTipoMeta] = useState<'ambas' | 'individual' | 'institucional'>('ambas');
  const [aiAmbitoSugerido, setAiAmbitoSugerido] = useState('auto');
  const [aiNormalizing, setAiNormalizing] = useState(false);
  const [normalizedPreview, setNormalizedPreview] = useState<PmcNormalizedGoalResponse | null>(null);

  // ── ESTADO FORMULARIO MANUAL META INDIVIDUAL ────────────────────────────────
  const [selectedStaffIndex, setSelectedStaffIndex] = useState<string>('custom');
  const [personalNombre, setPersonalNombre] = useState('');
  const [personalCargo, setPersonalCargo] = useState('Docente');
  const [personalMeta, setPersonalMeta] = useState('');
  const [personalEstrategia, setPersonalEstrategia] = useState('');
  const [personalEntregable, setPersonalEntregable] = useState('');
  const [personalPeriodo, setPersonalPeriodo] = useState(`Ciclo Escolar ${cicloEscolar || '2025-2026'}`);

  // ── ESTADO FORMULARIO MANUAL META INSTITUCIONAL ─────────────────────────────
  const [instAmbito, setInstAmbito] = useState(AMBITOS_OFICIALES[0].id);
  const [instTema, setInstTema] = useState('');
  const [instMeta, setInstMeta] = useState('');
  const [instEstrategia, setInstEstrategia] = useState('');
  const [instResponsable, setInstResponsable] = useState('Director y Colegiado Docente');
  const [instEntregable, setInstEntregable] = useState('');
  const [instSituacion, setInstSituacion] = useState('');
  const [instPeriodoInicio, setInstPeriodoInicio] = useState('Septiembre');
  const [instPeriodoFin, setInstPeriodoFin] = useState('Julio');

  // ── ESTADO EDICIÓN IN-SITU METAS PERSONALES ────────────────────────────────
  const [editingPersonalIndex, setEditingPersonalIndex] = useState<number | null>(null);
  const [editingPersonalData, setEditingPersonalData] = useState<MetaPersonalItem | null>(null);

  // ── ESTADO EDICIÓN IN-SITU METAS INSTITUCIONALES ───────────────────────────
  const [editingInstIndex, setEditingInstIndex] = useState<number | null>(null);
  const [editingInstData, setEditingInstData] = useState<MetaInstitucionalItem | null>(null);

  // Docentes de staff que aún no tienen meta individual registrada
  const staffWithoutGoal = useMemo(() => {
    const goalsNames = new Set(
      (planAccion?.metas_personales || []).map((m) => m.nombre?.trim().toLowerCase())
    );
    return staffData.filter((s) => s.nombre?.trim() && !goalsNames.has(s.nombre.trim().toLowerCase()));
  }, [staffData, planAccion]);

  const handleSelectStaffForAI = (val: string) => {
    setAiSelectedStaffIndex(val);
    if (val === 'custom') {
      setAiDocenteNombre('');
      setAiDocenteCargo('Docente');
      setAiHorasBase('');
    } else {
      const idx = parseInt(val, 10);
      const member = staffData[idx];
      if (member) {
        setAiDocenteNombre(member.nombre);
        setAiDocenteCargo(member.cargo || 'Docente');
        setAiHorasBase(member.horas_base ? String(member.horas_base) : '');
        if (member.meta_individual && !aiRawGoalText) {
          setAiRawGoalText(member.meta_individual);
        }
      }
    }
  };

  const handleSelectStaff = (val: string) => {
    setSelectedStaffIndex(val);
    if (val === 'custom') {
      setPersonalNombre('');
      setPersonalCargo('Docente');
    } else {
      const idx = parseInt(val, 10);
      const member = staffData[idx];
      if (member) {
        setPersonalNombre(member.nombre);
        setPersonalCargo(member.cargo || 'Docente');
        if (member.meta_individual) {
          setPersonalMeta(member.meta_individual);
        }
      }
    }
  };

  const persistToDatabase = async (nextPlan: PlanAccionData, nextStaff?: StaffMemberData[]) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        plan_accion: nextPlan,
      };
      if (nextStaff && nextStaff.length > 0) {
        payload.staff_data = nextStaff;
        payload.total_staff = nextStaff.length;
      }
      const res = await fetch(`/api/pmc/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al persistir en base de datos');
      }
      setFeedback({
        type: 'success',
        message: 'Cambio guardado y sincronizado de forma quirúrgica en el PMC.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: (err as Error).message || 'Error al guardar los cambios.',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── LLAMADA A ENDPOINT DE NORMALIZACIÓN IA ──────────────────────────────────
  const handleNormalizeWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = aiDocenteNombre.trim();
    const cleanRaw = aiRawGoalText.trim();

    if (!cleanNombre) {
      setFeedback({ type: 'error', message: 'Indica el nombre del docente que solicita la meta.' });
      return;
    }
    if (cleanRaw.length < 5) {
      setFeedback({
        type: 'error',
        message: 'Por favor escribe la meta en bruto (al menos 5 caracteres) para que la IA pueda estructurarla.',
      });
      return;
    }

    setAiNormalizing(true);
    setFeedback(null);
    setNormalizedPreview(null);

    try {
      if (!projectId) {
        throw new Error('Proyecto no identificado. Guarda primero el proyecto PMC.');
      }

      const res = await fetch(`/api/pmc/${projectId}/normalize-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_en_bruto: cleanRaw,
          docente_nombre: cleanNombre,
          docente_cargo: aiDocenteCargo.trim() || 'Docente',
          horas_base: aiHorasBase.trim() || undefined,
          tipo_meta: aiTipoMeta,
          ambito_sugerido: aiAmbitoSugerido !== 'auto' ? aiAmbitoSugerido : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo normalizar la meta con IA.');
      }

      setNormalizedPreview(json.normalized);
      const metasCount = json.normalized?.metas?.length || (json.normalized?.meta_individual || json.normalized?.meta_institucional ? 1 : 0);
      setFeedback({
        type: 'success',
        message: `✨ ${metasCount > 1 ? `${metasCount} metas normalizadas` : 'Meta normalizada'} con éxito según lineamientos MCCEMS/NEM. Revisa la proyección a continuación y confirma la inserción quirúrgica.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: (err as Error).message || 'Error al normalizar la meta con IA.',
      });
    } finally {
      setAiNormalizing(false);
    }
  };

  // ── PREVIEW ITEMS ADAPTATIVO (SOPORTA 1 O MÚLTIPLES METAS) ─────────────────
  const previewItems = useMemo(() => {
    if (!normalizedPreview) return [];
    if (Array.isArray(normalizedPreview.metas) && normalizedPreview.metas.length > 0) {
      return normalizedPreview.metas;
    }
    if (normalizedPreview.meta_individual || normalizedPreview.meta_institucional) {
      return [{ meta_individual: normalizedPreview.meta_individual, meta_institucional: normalizedPreview.meta_institucional }];
    }
    return [];
  }, [normalizedPreview]);

  const handleUpdatePreviewIndividual = (itemIndex: number, field: string, val: string) => {
    if (!normalizedPreview) return;
    const nextMetas = previewItems.map((item, idx) => {
      if (idx !== itemIndex || !item.meta_individual) return item;
      return {
        ...item,
        meta_individual: {
          ...item.meta_individual,
          [field]: val,
        },
      };
    });
    setNormalizedPreview({
      ...normalizedPreview,
      metas: nextMetas,
      meta_individual: nextMetas[0]?.meta_individual,
      meta_institucional: nextMetas[0]?.meta_institucional,
    });
  };

  const handleUpdatePreviewInstitucional = (itemIndex: number, field: string, val: string) => {
    if (!normalizedPreview) return;
    const nextMetas = previewItems.map((item, idx) => {
      if (idx !== itemIndex || !item.meta_institucional) return item;
      return {
        ...item,
        meta_institucional: {
          ...item.meta_institucional,
          [field]: val,
        },
      };
    });
    setNormalizedPreview({
      ...normalizedPreview,
      metas: nextMetas,
      meta_individual: nextMetas[0]?.meta_individual,
      meta_institucional: nextMetas[0]?.meta_institucional,
    });
  };

  // ── CONFIRMAR E INSERTAR QUIRÚRGICAMENTE LAS METAS NORMALIZADAS ─────────────
  const handleConfirmSurgicalInsertion = async () => {
    if (!normalizedPreview || previewItems.length === 0) return;

    let nextMetasPersonales = planAccion?.metas_personales ? [...planAccion.metas_personales] : [];
    let nextMetasInst = planAccion?.metas_institucionales ? [...planAccion.metas_institucionales] : [];

    const insertedTeacherNames: string[] = [];

    for (const item of previewItems) {
      const cleanNombre = (item.meta_individual?.nombre || aiDocenteNombre).trim();
      const cleanCargo = (item.meta_individual?.cargo || aiDocenteCargo).trim() || 'Docente';
      if (!insertedTeacherNames.includes(cleanNombre)) {
        insertedTeacherNames.push(cleanNombre);
      }

      // 1. Inyectar en Metas Personales (Sección 7) si aplica
      if (aiTipoMeta !== 'institucional' && item.meta_individual) {
        const mi = item.meta_individual;
        const newPersonal: MetaPersonalItem = {
          nombre: cleanNombre,
          cargo: cleanCargo,
          categoria: mi.categoria || undefined,
          tema: mi.tema || undefined,
          meta_individual: mi.meta_individual,
          estrategia: mi.estrategia,
          entregable: mi.entregable,
          periodo: mi.periodo || `Ciclo Escolar ${cicloEscolar || '2025-2026'}`,
        };
        nextMetasPersonales.push(newPersonal);
      }

      // 2. Inyectar en Metas Institucionales (Plan de Acción Secciones 6 y 8, Formato 5.1 / Adicional, Fichas Técnicas) si aplica
      if (aiTipoMeta !== 'individual' && item.meta_institucional) {
        const min = item.meta_institucional;
        const newInst: MetaInstitucionalItem = {
          categoria: min.categoria || 'aprovechamiento',
          nombre_categoria: min.nombre_categoria || '1. Aprovechamiento académico y asistencia educativa',
          tema: min.tema || 'Mejora de los Aprendizajes',
          meta: min.meta,
          estrategia: min.estrategia,
          linea_base: min.linea_base || 'Diagnóstico integral escolar del ciclo lectivo.',
          personal_designado: min.personal_designado || `${cleanNombre} y Academia Docente`,
          entregable: min.entregable,
          periodo_inicio: min.periodo_inicio || 'Septiembre',
          periodo_fin: min.periodo_fin || 'Julio',
          diagnostico_meta: min.diagnostico_meta || 'Necesidad pedagógica detectada por el colectivo escolar.',
          accion_especifica: min.accion_especifica || min.estrategia,
          finalidad: min.finalidad || `Consolidar los aprendizajes en ${min.tema || 'el área formativa'}.`,
          necesidad: min.necesidad || min.diagnostico_meta || 'Atención prioritaria detectada en el aula.',
          proceso_evaluacion: min.proceso_evaluacion || 'Seguimiento sistemático en sesiones de Consejo Técnico Escolar.',
          subcategorias_vinculadas: min.subcategorias_vinculadas || [min.tema || 'Formación Académica'],
          estrategias_seguimiento: min.estrategias_seguimiento || 'Cortes bimestrales en CTE e indicadores de logro.',
          observaciones: min.observaciones || 'Compromiso pedagógico colegiado formalizado.',
        };
        nextMetasInst = deduplicateMetasInstitucionales([...nextMetasInst, newInst], indicadores) as MetaInstitucionalItem[];
      }
    }

    // Consolidación inteligente por docente: si el docente ya tiene metas, se fusionan sin duplicar la fila
    nextMetasPersonales = consolidateMetasPersonalesByTeacher(nextMetasPersonales);

    const nextPlan: PlanAccionData = {
      metas_institucionales: nextMetasInst,
      metas_personales: nextMetasPersonales,
    };

    // 3. Sincronizar Staff si el docente no existía en staff_data para que aparezca en el Colectivo Participante (Sección 8)
    let nextStaff: StaffMemberData[] = [...staffData];
    const targetName = (insertedTeacherNames[0] || aiDocenteNombre).trim();
    const targetCargo = (previewItems[0]?.meta_individual?.cargo || aiDocenteCargo).trim() || 'Docente';
    const allPersonalGoals = previewItems
      .map((it) => it.meta_individual?.meta_individual)
      .filter(Boolean)
      .join(' | ');

    const existingStaffIdx = nextStaff.findIndex(
      (s) => s.nombre?.trim().toLowerCase() === targetName.toLowerCase()
    );

    if (existingStaffIdx === -1) {
      nextStaff.push({
        nombre: targetName,
        cargo: targetCargo,
        horas_base: aiHorasBase ? (isNaN(Number(aiHorasBase)) ? aiHorasBase : Number(aiHorasBase)) : undefined,
        meta_individual: allPersonalGoals || undefined,
      });
      if (setStaffData) setStaffData(nextStaff);
    } else if (allPersonalGoals) {
      const currentMeta = nextStaff[existingStaffIdx].meta_individual;
      const combined = currentMeta ? `${currentMeta} | ${allPersonalGoals}` : allPersonalGoals;
      nextStaff[existingStaffIdx] = {
        ...nextStaff[existingStaffIdx],
        meta_individual: combined,
      };
      if (setStaffData) setStaffData(nextStaff);
    }

    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);

    // Limpiar preview y texto en bruto para permitir agregar otra meta inmediatamente
    setNormalizedPreview(null);
    setAiRawGoalText('');

    await persistToDatabase(nextPlan, nextStaff);

    const count = previewItems.length;
    setFeedback({
      type: 'success',
      message: `✅ ¡${count > 1 ? `${count} metas integradas` : 'Meta integrada'} quirúrgicamente! Se incluyeron en el Plan de Acción, Tablas 5.1/Adicionales, Fichas Técnicas, Metas Individuales y Monitoreo Trimestral sin alterar a los demás docentes.`,
    });
  };

  // ── GUARDAR MANUAL META INDIVIDUAL ──────────────────────────────────────────
  const handleSavePersonalMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = personalNombre.trim();
    const cleanMeta = personalMeta.trim();

    if (!cleanNombre) {
      setFeedback({ type: 'error', message: 'Indica el nombre del docente o trabajador.' });
      return;
    }
    if (cleanMeta.length < 5) {
      setFeedback({ type: 'error', message: 'La redacción de la meta individual debe tener al menos 5 caracteres.' });
      return;
    }

    const newPersonalItem: MetaPersonalItem = {
      nombre: cleanNombre,
      cargo: personalCargo.trim() || 'Docente',
      meta_individual: cleanMeta,
      estrategia: personalEstrategia.trim() || 'Trabajo colaborativo y seguimiento formativo continuo en aula y CTE.',
      entregable: personalEntregable.trim() || 'Portafolio de evidencias y listas de cotejo de evaluación formativa.',
      periodo: personalPeriodo.trim() || `Ciclo Escolar ${cicloEscolar}`,
    };

    const currentMetas = planAccion?.metas_personales ? [...planAccion.metas_personales] : [];
    const nextMetas = consolidateMetasPersonalesByTeacher([...currentMetas, newPersonalItem]);

    const nextPlan: PlanAccionData = {
      metas_institucionales: planAccion?.metas_institucionales ? [...planAccion.metas_institucionales] : [],
      metas_personales: nextMetas,
    };

    let nextStaff: StaffMemberData[] | undefined;
    const existsInStaff = staffData.some(
      (s) => s.nombre?.trim().toLowerCase() === cleanNombre.toLowerCase()
    );
    if (!existsInStaff) {
      nextStaff = [
        ...staffData,
        {
          nombre: cleanNombre,
          cargo: personalCargo.trim() || 'Docente',
          meta_individual: cleanMeta,
        },
      ];
      if (setStaffData) setStaffData(nextStaff);
    }

    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);

    setSelectedStaffIndex('custom');
    setPersonalNombre('');
    setPersonalCargo('Docente');
    setPersonalMeta('');
    setPersonalEstrategia('');
    setPersonalEntregable('');

    await persistToDatabase(nextPlan, nextStaff);
  };

  // ── GUARDAR MANUAL META INSTITUCIONAL ───────────────────────────────────────
  const handleSaveInstitucionalMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMeta = instMeta.trim();
    if (cleanMeta.length < 5) {
      setFeedback({ type: 'error', message: 'La redacción de la meta institucional debe tener al menos 5 caracteres.' });
      return;
    }

    const ambitoObj = AMBITOS_OFICIALES.find((a) => a.id === instAmbito);
    const nombreCategoria = ambitoObj ? ambitoObj.nombre : 'Ámbito Institucional General';
    const cleanTema = instTema.trim() || 'Mejora Continua y Fortalecimiento Académico';

    const newInstItem: MetaInstitucionalItem = {
      categoria: instAmbito,
      nombre_categoria: nombreCategoria,
      tema: cleanTema,
      meta: cleanMeta,
      estrategia: instEstrategia.trim() || 'Coordinación colegiada, acompañamiento directivo y evaluación bimestral.',
      personal_designado: instResponsable.trim() || 'Director y Colegiado Docente',
      entregable: instEntregable.trim() || 'Informes bimestrales y evidencias pedagógicas colegiadas.',
      linea_base: instSituacion.trim() || 'Diagnóstico integral escolar del ciclo lectivo.',
      diagnostico_meta: instSituacion.trim() || 'Necesidad pedagógica identificada por el colectivo escolar.',
      periodo_inicio: instPeriodoInicio.trim() || 'Septiembre',
      periodo_fin: instPeriodoFin.trim() || 'Julio',
      finalidad: `Consolidar los aprendizajes y metas institucionales en ${cleanTema}.`,
      necesidad: instSituacion.trim() || 'Fortalecer los procesos educativos en el marco de la NEM.',
      proceso_evaluacion: 'Seguimiento sistemático en sesiones de Consejo Técnico Escolar.',
      subcategorias_vinculadas: [cleanTema],
      estrategias_seguimiento: 'Cortes bimestrales en CTE e indicadores de logro académico.',
    };

    const currentInst = planAccion?.metas_institucionales ? [...planAccion.metas_institucionales] : [];
    const dedupedInst = deduplicateMetasInstitucionales([...currentInst, newInstItem], indicadores) as MetaInstitucionalItem[];

    const nextPlan: PlanAccionData = {
      metas_institucionales: dedupedInst,
      metas_personales: planAccion?.metas_personales ? [...planAccion.metas_personales] : [],
    };

    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);

    setInstTema('');
    setInstMeta('');
    setInstEstrategia('');
    setInstResponsable('Director y Colegiado Docente');
    setInstEntregable('');
    setInstSituacion('');

    await persistToDatabase(nextPlan);
  };

  // ── ELIMINAR META INDIVIDUAL ────────────────────────────────────────────────
  const handleDeletePersonalMeta = async (index: number) => {
    if (!planAccion?.metas_personales) return;
    const target = planAccion.metas_personales[index];
    const confirmDelete = window.confirm(
      `¿Deseas eliminar la meta individual de "${target.nombre}"?`
    );
    if (!confirmDelete) return;

    const nextMetas = planAccion.metas_personales.filter((_, i) => i !== index);
    const nextPlan: PlanAccionData = {
      ...planAccion,
      metas_personales: nextMetas,
    };
    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);
    await persistToDatabase(nextPlan);
  };

  // ── ELIMINAR META INSTITUCIONAL ─────────────────────────────────────────────
  const handleDeleteInstMeta = async (index: number) => {
    if (!planAccion?.metas_institucionales) return;
    const target = planAccion.metas_institucionales[index];
    const confirmDelete = window.confirm(
      `¿Deseas eliminar la meta institucional "${target.tema || target.nombre_categoria}"?`
    );
    if (!confirmDelete) return;

    const nextInst = planAccion.metas_institucionales.filter((_, i) => i !== index);
    const nextPlan: PlanAccionData = {
      ...planAccion,
      metas_institucionales: nextInst,
    };
    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);
    await persistToDatabase(nextPlan);
  };

  // ── MANEJADORES DE EDICIÓN IN-SITU METAS PERSONALES ─────────────────────────
  const handleStartEditPersonalMeta = (index: number) => {
    if (!planAccion?.metas_personales?.[index]) return;
    setEditingPersonalIndex(index);
    setEditingPersonalData({ ...planAccion.metas_personales[index] });
  };

  const handleCancelEditPersonalMeta = () => {
    setEditingPersonalIndex(null);
    setEditingPersonalData(null);
  };

  const handleSaveEditPersonalMeta = async () => {
    if (editingPersonalIndex === null || !editingPersonalData || !planAccion?.metas_personales) return;
    const cleanMeta = editingPersonalData.meta_individual.trim();
    if (cleanMeta.length < 5) {
      setFeedback({ type: 'error', message: 'La meta individual debe tener al menos 5 caracteres.' });
      return;
    }

    const nextMetas = [...planAccion.metas_personales];
    nextMetas[editingPersonalIndex] = {
      ...editingPersonalData,
      nombre: editingPersonalData.nombre.trim(),
      cargo: editingPersonalData.cargo.trim() || 'Docente',
      meta_individual: cleanMeta,
      estrategia: editingPersonalData.estrategia.trim(),
      entregable: editingPersonalData.entregable.trim(),
      periodo: editingPersonalData.periodo.trim() || `Ciclo Escolar ${cicloEscolar || '2025-2026'}`,
    };

    const nextPlan: PlanAccionData = {
      ...planAccion,
      metas_personales: nextMetas,
    };

    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);
    const updatedTeacher = nextMetas[editingPersonalIndex].nombre;
    setEditingPersonalIndex(null);
    setEditingPersonalData(null);

    await persistToDatabase(nextPlan);
    setFeedback({
      type: 'success',
      message: `✅ Meta de "${updatedTeacher}" modificada y sincronizada correctamente en el PMC sin alterar a los demás docentes.`,
    });
  };

  // ── MANEJADORES DE EDICIÓN IN-SITU METAS INSTITUCIONALES ────────────────────
  const handleStartEditInstMeta = (index: number) => {
    if (!planAccion?.metas_institucionales?.[index]) return;
    setEditingInstIndex(index);
    setEditingInstData({ ...planAccion.metas_institucionales[index] });
  };

  const handleCancelEditInstMeta = () => {
    setEditingInstIndex(null);
    setEditingInstData(null);
  };

  const handleSaveEditInstMeta = async () => {
    if (editingInstIndex === null || !editingInstData || !planAccion?.metas_institucionales) return;
    const cleanMeta = editingInstData.meta.trim();
    if (cleanMeta.length < 5) {
      setFeedback({ type: 'error', message: 'La meta institucional debe tener al menos 5 caracteres.' });
      return;
    }

    const nextInst = [...planAccion.metas_institucionales];
    nextInst[editingInstIndex] = {
      ...editingInstData,
      meta: cleanMeta,
      tema: editingInstData.tema.trim(),
      estrategia: editingInstData.estrategia.trim(),
      personal_designado: editingInstData.personal_designado.trim(),
      entregable: editingInstData.entregable.trim(),
      linea_base: editingInstData.linea_base?.trim() || '',
      diagnostico_meta: editingInstData.diagnostico_meta?.trim() || '',
      periodo_inicio: editingInstData.periodo_inicio?.trim() || 'Septiembre',
      periodo_fin: editingInstData.periodo_fin?.trim() || 'Julio',
    };

    const nextPlan: PlanAccionData = {
      ...planAccion,
      metas_institucionales: nextInst,
    };

    setPlanAccion(nextPlan);
    if (onPlanUpdated) onPlanUpdated(nextPlan);
    const updatedMetaTitle = nextInst[editingInstIndex].tema || nextInst[editingInstIndex].nombre_categoria;
    setEditingInstIndex(null);
    setEditingInstData(null);

    await persistToDatabase(nextPlan);
    setFeedback({
      type: 'success',
      message: `✅ Meta institucional "${updatedMetaTitle}" modificada y sincronizada correctamente en el PMC.`,
    });
  };

  // Estilos UI modernos
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#f8fafc',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '5px',
  };

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1.5px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Encabezado Principal */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#e0e7ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯</span> Adición Quirúrgica de Metas (Sin Afectar a Otros Docentes)
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.5 }}>
              Agrega una o varias metas adicionales que hayan faltado o solicitado los docentes (ej. Docente 1).
              La plataforma <strong>las normaliza y las inserta quirúrgicamente</strong> en el Plan de Acción, Tablas 5.1/Adicionales, Fichas Técnicas, Metas Individuales y Monitoreo Trimestral{' '}
              <strong style={{ color: '#a7f3d0' }}>sin alterar nada de lo que ya aprobaron los demás docentes</strong>.
            </p>
          </div>
          {saving && (
            <span style={{ fontSize: '12px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.2)', padding: '5px 12px', borderRadius: '6px' }}>
              <span>⏳</span> Guardando en base de datos...
            </span>
          )}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
              color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Selector de Pestañas Superiores */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSubTab('ia_quirurgica')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: subTab === 'ia_quirurgica' ? '1px solid rgba(16,185,129,0.6)' : '1px solid transparent',
            background: subTab === 'ia_quirurgica' ? 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.2) 100%)' : 'rgba(255,255,255,0.04)',
            color: subTab === 'ia_quirurgica' ? '#a7f3d0' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: subTab === 'ia_quirurgica' ? '0 4px 12px rgba(16,185,129,0.25)' : 'none',
          }}
        >
          <span>🪄</span> Ingestión Quirúrgica Asistida por IA
          <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '2px 8px', borderRadius: '10px' }}>
            Recomendado
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('personales')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: subTab === 'personales' ? '1px solid rgba(99,102,241,0.6)' : '1px solid transparent',
            background: subTab === 'personales' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
            color: subTab === 'personales' ? '#c7d2fe' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>👨‍🏫</span> Metas Individuales (Captura Manual)
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>
            {planAccion?.metas_personales?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('institucionales')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: subTab === 'institucionales' ? '1px solid rgba(99,102,241,0.6)' : '1px solid transparent',
            background: subTab === 'institucionales' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
            color: subTab === 'institucionales' ? '#c7d2fe' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🏛️</span> Metas Institucionales Formato 5.1 (Captura Manual)
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '10px' }}>
            {planAccion?.metas_institucionales?.length || 0}
          </span>
        </button>
      </div>

      {/* ── SUBTAB 1: INGESTIÓN QUIRÚRGICA CON IA (LA SOLUCIÓN EXACTA) ─────────── */}
      {subTab === 'ia_quirurgica' && (
        <div>
          {/* Card Asistente */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '22px',
              marginBottom: '22px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>🪄</span>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#a7f3d0', margin: 0 }}>
                  Normalización Inteligente de Metas en Bruto (MCCEMS / NEM / DGB)
                </h4>
                <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0' }}>
                  Solo escribe o pega una o varias metas tal como las propuso el personal docente. La IA las convertirá en metas SMART oficiales,
                  formulará sus estrategias, entregables y fichas técnicas, y las insertará en todas las secciones pertinentes.
                </p>
              </div>
            </div>

            <form onSubmit={handleNormalizeWithAI} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {/* Selector de docente */}
                <div>
                  <label style={labelStyle}>1. ¿Quién solicita o ejecutará esta meta? *</label>
                  <select
                    value={aiSelectedStaffIndex}
                    onChange={(e) => handleSelectStaffForAI(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="custom">➕ Escribir nombre de docente / personal nuevo...</option>
                    {staffWithoutGoal.length > 0 && (
                      <optgroup label="Docentes sin meta registrada (Recomendados)">
                        {staffWithoutGoal.map((s) => {
                          const realIdx = staffData.indexOf(s);
                          return (
                            <option key={`ai-without-${realIdx}`} value={String(realIdx)}>
                              ⚠️ {s.nombre} ({s.cargo || 'Docente'}) — Sin meta
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Toda la plantilla escolar">
                      {staffData.map((s, idx) => (
                        <option key={`ai-all-${idx}`} value={String(idx)}>
                          {s.nombre} ({s.cargo || 'Docente'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Nombre */}
                <div>
                  <label style={labelStyle}>Nombre del Docente *</label>
                  <input
                    type="text"
                    value={aiDocenteNombre}
                    onChange={(e) => setAiDocenteNombre(e.target.value)}
                    placeholder="Ej. Docente 1"
                    style={inputStyle}
                    required
                  />
                </div>

                {/* Cargo */}
                <div>
                  <label style={labelStyle}>Cargo / Función Docente</label>
                  <input
                    type="text"
                    value={aiDocenteCargo}
                    onChange={(e) => setAiDocenteCargo(e.target.value)}
                    placeholder="Ej. Docente de Lengua y Comunicación"
                    style={inputStyle}
                  />
                </div>

                {/* Horas Base (Opcional) */}
                <div>
                  <label style={labelStyle}>Horas Base (Opcional)</label>
                  <input
                    type="text"
                    value={aiHorasBase}
                    onChange={(e) => setAiHorasBase(e.target.value)}
                    placeholder="Ej. 20 hrs"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Meta en Bruto */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. Meta en bruto proporcionada por el docente (texto sin normalizar) *</span>
                  <span style={{ fontSize: '11px', color: '#6ee7b7' }}>Permite 1 sola meta o varias numeradas</span>
                </label>
                <textarea
                  value={aiRawGoalText}
                  onChange={(e) => setAiRawGoalText(e.target.value)}
                  placeholder="Puedes escribir una meta individual o varias al mismo tiempo numeradas (1. ..., 2. ...). Ejemplo:&#10;1. Realizar los 2 cursos en tiempo y forma de acuerdo a la calendarización del COSFAC y acreditar dichos cursos en un 100% obteniendo la constancia.&#10;2. Participar en las actividades de 'Vive Saludable y Vive Feliz' promoviendo hábitos de vida saludable, bienestar físico y emocional en los estudiantes."
                  rows={4}
                  style={{ ...inputStyle, minHeight: '85px', lineHeight: 1.5, fontSize: '13.5px' }}
                  required
                />
              </div>

              {/* Opciones de alcance y ámbito */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>3. ¿Dónde debe integrarse esta meta en el documento oficial?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f1f5f9', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipo_meta"
                        checked={aiTipoMeta === 'ambas'}
                        onChange={() => setAiTipoMeta('ambas')}
                      />
                      <span>
                        <strong>Ambas (Recomendado):</strong> Meta Individual del Docente (Secc. 7) + Plan de Acción (Secc. 6, Tablas 5.1/Adicionales, Fichas Técnicas y Monitoreo Trimestral Secc. 8)
                      </span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipo_meta"
                        checked={aiTipoMeta === 'individual'}
                        onChange={() => setAiTipoMeta('individual')}
                      />
                      <span>Solo Meta Individual del Personal (Sección 7)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipo_meta"
                        checked={aiTipoMeta === 'institucional'}
                        onChange={() => setAiTipoMeta('institucional')}
                      />
                      <span>Solo Plan de Acción Institucional (Secciones 6 y 8)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Ámbito de intervención sugerido:</label>
                  <select
                    value={aiAmbitoSugerido}
                    onChange={(e) => setAiAmbitoSugerido(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="auto">✨ Automático (Detectado por IA según el texto)</option>
                    <option value="aprovechamiento">1. Aprovechamiento académico y asistencia educativa (Área obligatoria 5.1)</option>
                    <option value="practica_docente">2. Práctica docente y formación continua (Área obligatoria 5.1)</option>
                    <option value="infraestructura">3. Infraestructura y equipamiento escolar (Área obligatoria 5.1)</option>
                    <option value="convivencia_paec">4. Convivencia escolar y PAEC (Área obligatoria 5.1)</option>
                    <option value="adicional">5. Ámbito Adicional Priorizado por el Plantel</option>
                  </select>
                </div>
              </div>

              {/* Botón de Normalizar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={aiNormalizing || !aiDocenteNombre.trim() || !aiRawGoalText.trim()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: aiNormalizing
                      ? 'rgba(16,185,129,0.3)'
                      : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: aiNormalizing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  {aiNormalizing ? (
                    <>
                      <span>⏳</span> Normalizando con IA según MCCEMS / NEM...
                    </>
                  ) : (
                    <>
                      <span>🪄</span> Normalizar con IA y Visualizar Inserción
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── PREVIEW DE RESULTADO NORMALIZADO ─────────────────────────────── */}
          {normalizedPreview && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
                border: '2px solid rgba(16, 185, 129, 0.6)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#6ee7b7', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✨</span> Proyección de Inserción Quirúrgica en el Documento Oficial
                    {previewItems.length > 1 && (
                      <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', padding: '3px 9px', borderRadius: '12px', fontWeight: 700 }}>
                        {previewItems.length} Metas Detectadas
                      </span>
                    )}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                    Revisa cómo se {previewItems.length > 1 ? 'integrarán estas metas' : 'integrará esta meta'} en cada sección oficial del PMC. Puedes ajustar cualquier campo antes de confirmar.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNormalizedPreview(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#cbd5e1',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSurgicalInsertion}
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13.5px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <span>✅</span> Confirmar e Insertar Quirúrgicamente {previewItems.length > 1 ? `las ${previewItems.length} Metas` : 'la Meta'} en el PMC
                  </button>
                </div>
              </div>

              {previewItems.map((item, itemIdx) => (
                <div
                  key={`preview-item-${itemIdx}`}
                  style={{
                    marginBottom: itemIdx < previewItems.length - 1 ? '24px' : '0',
                    paddingBottom: itemIdx < previewItems.length - 1 ? '20px' : '0',
                    borderBottom: itemIdx < previewItems.length - 1 ? '1px dashed rgba(255, 255, 255, 0.15)' : 'none',
                  }}
                >
                  {previewItems.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12.5px', background: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>
                        🎯 META #{itemIdx + 1}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                        {item.meta_institucional?.tema || (item.meta_individual?.meta_individual ? item.meta_individual.meta_individual.slice(0, 60) + '...' : `Meta ${itemIdx + 1}`)}
                      </strong>
                    </div>
                  )}

                  {/* Tarjeta Sección 7: Meta Individual */}
                  {item.meta_individual && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', background: 'rgba(99, 102, 241, 0.3)', color: '#c7d2fe', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          SECCIÓN 7 DEL DOCUMENTO
                        </span>
                        <strong style={{ fontSize: '14px', color: '#e0e7ff' }}>
                          Metas Individuales del Personal: {item.meta_individual.nombre} ({item.meta_individual.cargo})
                        </strong>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={labelStyle}>Meta y Compromiso Individual SMART:</label>
                          <textarea
                            value={item.meta_individual.meta_individual}
                            onChange={(e) => handleUpdatePreviewIndividual(itemIdx, 'meta_individual', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, minHeight: '56px' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Estrategia Individual en Aula:</label>
                            <input
                              type="text"
                              value={item.meta_individual.estrategia}
                              onChange={(e) => handleUpdatePreviewIndividual(itemIdx, 'estrategia', e.target.value)}
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>Entregable Comprobable:</label>
                            <input
                              type="text"
                              value={item.meta_individual.entregable}
                              onChange={(e) => handleUpdatePreviewIndividual(itemIdx, 'entregable', e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tarjeta Secciones 6 y 8: Plan de Acción, 5.1 / Adicional, Fichas Técnicas y Monitoreo */}
                  {item.meta_institucional && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          SECCIONES 6 Y 8 DEL DOCUMENTO
                        </span>
                        <strong style={{ fontSize: '14px', color: '#e0e7ff' }}>
                          Plan de Acción, Tablas Oficiales Formato 5.1 / Adicionales, Fichas Técnicas y Monitoreo Trimestral
                        </strong>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Ámbito / Clasificación Formato 5.1:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.nombre_categoria}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'nombre_categoria', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Tema Específico / Subcategoría:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.tema}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'tema', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Responsable / Personal Designado:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.personal_designado}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'personal_designado', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Meta Institucional Oficial:</label>
                          <textarea
                            value={item.meta_institucional.meta}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'meta', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, minHeight: '52px' }}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Estrategia de Implementación (Formato 4.1):</label>
                          <textarea
                            value={item.meta_institucional.estrategia}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'estrategia', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, minHeight: '52px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>Producto que Comprobará la Meta (Formato 5.1):</label>
                          <input
                            type="text"
                            value={item.meta_institucional.entregable}
                            onChange={(e) => handleUpdatePreviewInstitucional(itemIdx, 'entregable', e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Situación Actual que Justifica la Meta:</label>
                          <input
                            type="text"
                            value={item.meta_institucional.diagnostico_meta || item.meta_institucional.necesidad || ''}
                            onChange={(e) => {
                              handleUpdatePreviewInstitucional(itemIdx, 'diagnostico_meta', e.target.value);
                              handleUpdatePreviewInstitucional(itemIdx, 'necesidad', e.target.value);
                            }}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      {/* Detalle Ficha Técnica y Monitoreo */}
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '12px',
                          color: '#94a3b8',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#cbd5e1' }}>Acción Específica (Formato 3.1):</strong>{' '}
                          {item.meta_institucional.accion_especifica || item.meta_institucional.estrategia}
                        </div>
                        <div>
                          <strong style={{ color: '#cbd5e1' }}>Finalidad (Formato 3.1):</strong>{' '}
                          {item.meta_institucional.finalidad || 'Consolidar los aprendizajes'}
                        </div>
                        <div>
                          <strong style={{ color: '#cbd5e1' }}>Mecanismo de Monitoreo (Secc. 8):</strong>{' '}
                          Cortes de {item.meta_institucional.periodo_inicio || 'Septiembre'} a {item.meta_institucional.periodo_fin || 'Julio'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Botón inferior de confirmación */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleConfirmSurgicalInsertion}
                  disabled={saving}
                  style={{
                    padding: '11px 26px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <span>✅</span> Confirmar e Insertar Quirúrgicamente {previewItems.length > 1 ? `las ${previewItems.length} Metas` : 'la Meta'} en el PMC
                </button>
              </div>
            </div>
          )}

          {/* Resumen de metas registradas */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e0e7ff', marginBottom: '10px' }}>
              📋 Metas Registradas Actualmente en el Proyecto
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#c7d2fe' }}>Metas Individuales ({planAccion?.metas_personales?.length || 0})</span>
                  <button type="button" onClick={() => setSubTab('personales')} style={{ fontSize: '11.5px', color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver / Gestionar
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', maxHeight: '140px', overflowY: 'auto' }}>
                  {(planAccion?.metas_personales || []).length === 0 ? (
                    <span>No hay metas individuales capturadas.</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(planAccion?.metas_personales || []).map((m, idx) => (
                        <li key={`sum-p-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong style={{ color: '#f1f5f9' }}>{m.nombre}:</strong> {m.meta_individual}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('personales');
                              handleStartEditPersonalMeta(idx);
                            }}
                            title="Editar esta meta"
                            style={{
                              background: 'rgba(99, 102, 241, 0.2)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#c7d2fe',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✏️ Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#a7f3d0' }}>Metas Institucionales ({planAccion?.metas_institucionales?.length || 0})</span>
                  <button type="button" onClick={() => setSubTab('institucionales')} style={{ fontSize: '11.5px', color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver / Gestionar
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', maxHeight: '140px', overflowY: 'auto' }}>
                  {(planAccion?.metas_institucionales || []).length === 0 ? (
                    <span>No hay metas institucionales capturadas.</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(planAccion?.metas_institucionales || []).map((m, idx) => (
                        <li key={`sum-i-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong style={{ color: '#f1f5f9' }}>{m.tema || m.nombre_categoria}:</strong> {m.meta}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSubTab('institucionales');
                              handleStartEditInstMeta(idx);
                            }}
                            title="Editar esta meta"
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#a7f3d0',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✏️ Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBTAB 2: CAPTURA MANUAL METAS INDIVIDUALES ─────────────────────── */}
      {subTab === 'personales' && (
        <div>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '20px',
            }}
          >
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#a5b4fc', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>➕</span> Agregar Meta Individual al Personal Manualmente
            </h4>

            <form onSubmit={handleSavePersonalMeta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Seleccionar docente de la plantilla escolar:</label>
                  <select
                    value={selectedStaffIndex}
                    onChange={(e) => handleSelectStaff(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="custom">+ Ingresar docente o personal nuevo manualmente...</option>
                    {staffWithoutGoal.length > 0 && (
                      <optgroup label="Docentes sin meta registrada (Recomendados)">
                        {staffWithoutGoal.map((s) => {
                          const realIdx = staffData.indexOf(s);
                          return (
                            <option key={`without-${realIdx}`} value={String(realIdx)}>
                              ⚠️ {s.nombre} ({s.cargo || 'Docente'}) — Sin meta
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Todo el personal registrado">
                      {staffData.map((s, idx) => (
                        <option key={`all-${idx}`} value={String(idx)}>
                          {s.nombre} ({s.cargo || 'Docente'})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Nombre del Docente / Trabajador *</label>
                  <input
                    type="text"
                    value={personalNombre}
                    onChange={(e) => setPersonalNombre(e.target.value)}
                    placeholder="Ej. Mtro. Juan Carlos Pérez Gómez"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Cargo o Función *</label>
                  <input
                    type="text"
                    value={personalCargo}
                    onChange={(e) => setPersonalCargo(e.target.value)}
                    placeholder="Ej. Docente de Pensamiento Matemático / Tutor"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Período de Ejecución</label>
                  <input
                    type="text"
                    value={personalPeriodo}
                    onChange={(e) => setPersonalPeriodo(e.target.value)}
                    placeholder="Ej. Ciclo Escolar 2025-2026"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Redacción de Meta Individual SMART *</label>
                <textarea
                  value={personalMeta}
                  onChange={(e) => setPersonalMeta(e.target.value)}
                  placeholder="Ej. Lograr que el 90% de los estudiantes del grupo alcancen los aprendizajes esperados..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '68px', lineHeight: 1.5 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Estrategia de Implementación / Acciones</label>
                  <textarea
                    value={personalEstrategia}
                    onChange={(e) => setPersonalEstrategia(e.target.value)}
                    placeholder="Ej. Sesiones de asesoría personalizada y rúbricas de evaluación formativa."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Entregable / Evidencia Comprobable</label>
                  <textarea
                    value={personalEntregable}
                    onChange={(e) => setPersonalEntregable(e.target.value)}
                    placeholder="Ej. Portafolio de evidencias de proyectos situados y listas de cotejo."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                  }}
                >
                  <span>💾</span> Guardar y Añadir Meta Individual
                </button>
              </div>
            </form>
          </div>

          {/* Lista de Metas Individuales Actuales */}
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e0e7ff', marginBottom: '12px' }}>
              Personal Docente y de Apoyo con Meta Registrada ({planAccion?.metas_personales?.length || 0})
            </h4>

            {(!planAccion?.metas_personales || planAccion.metas_personales.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                No hay metas individuales registradas en este PMC. Usa el asistente o el formulario superior para agregarlas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {planAccion.metas_personales.map((item, idx) => {
                  const isEditing = editingPersonalIndex === idx && editingPersonalData;
                  if (isEditing) {
                    return (
                      <div
                        key={`personal-edit-${idx}`}
                        style={{
                          background: 'rgba(30, 41, 59, 0.85)',
                          border: '1.5px solid rgba(99, 102, 241, 0.5)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>✏️</span> Editando Meta Individual de {editingPersonalData.nombre}
                          </span>
                          <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', padding: '2px 8px', borderRadius: '4px' }}>
                            #{idx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Nombre del Docente:</label>
                            <input
                              type="text"
                              value={editingPersonalData.nombre}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, nombre: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Cargo o Función:</label>
                            <input
                              type="text"
                              value={editingPersonalData.cargo}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, cargo: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Período:</label>
                            <input
                              type="text"
                              value={editingPersonalData.periodo}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, periodo: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Redacción de la Meta Individual:</label>
                          <textarea
                            value={editingPersonalData.meta_individual}
                            onChange={(e) => setEditingPersonalData({ ...editingPersonalData, meta_individual: e.target.value })}
                            rows={3}
                            style={{ ...inputStyle, minHeight: '70px', lineHeight: 1.45 }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Estrategia Individual:</label>
                            <textarea
                              value={editingPersonalData.estrategia}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, estrategia: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Entregable Comprobable:</label>
                            <textarea
                              value={editingPersonalData.entregable}
                              onChange={(e) => setEditingPersonalData({ ...editingPersonalData, entregable: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={handleCancelEditPersonalMeta}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.06)',
                              color: '#94a3b8',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditPersonalMeta}
                            disabled={saving}
                            style={{
                              padding: '7px 16px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: saving ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                            }}
                          >
                            💾 Guardar Cambios
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`personal-${idx}`}
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            #{idx + 1}
                          </span>
                          <strong style={{ fontSize: '14px', color: '#f8fafc' }}>{item.nombre}</strong>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>• {item.cargo}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>({item.periodo})</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#e2e8f0', margin: '4px 0', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                          <strong>Meta:</strong> {item.meta_individual}
                        </p>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                          <span><strong>Estrategia:</strong> {item.estrategia}</span>
                          <span><strong>Entregable:</strong> {item.entregable}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditPersonalMeta(idx)}
                          disabled={saving}
                          title="Editar meta individual"
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#a5b4fc',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePersonalMeta(idx)}
                          disabled={saving}
                          title="Eliminar meta individual"
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUBTAB 3: CAPTURA MANUAL METAS INSTITUCIONALES ───────────────────── */}
      {subTab === 'institucionales' && (
        <div>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '20px',
            }}
          >
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#a5b4fc', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>➕</span> Agregar Meta Institucional al Plan de Acción Manualmente
            </h4>

            <form onSubmit={handleSaveInstitucionalMeta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Ámbito / Área Oficial *</label>
                  <select
                    value={instAmbito}
                    onChange={(e) => setInstAmbito(e.target.value)}
                    style={inputStyle}
                  >
                    {AMBITOS_OFICIALES.map((amb) => (
                      <option key={amb.id} value={amb.id}>
                        {amb.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Tema Específico de Intervención *</label>
                  <input
                    type="text"
                    value={instTema}
                    onChange={(e) => setInstTema(e.target.value)}
                    placeholder="Ej. Rezago y Reprobación en Matemáticas"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Personal Designado / Responsable</label>
                  <input
                    type="text"
                    value={instResponsable}
                    onChange={(e) => setInstResponsable(e.target.value)}
                    placeholder="Ej. Director y Academia de Ciencias Exactas"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Redacción de Meta Institucional SMART *</label>
                <textarea
                  value={instMeta}
                  onChange={(e) => setInstMeta(e.target.value)}
                  placeholder="Ej. Incrementar el índice de aprobación escolar al 88% al término del ciclo escolar mediante tutorías especializadas..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '68px', lineHeight: 1.5 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Estrategia de Implementación (Formato 4.1)</label>
                  <textarea
                    value={instEstrategia}
                    onChange={(e) => setInstEstrategia(e.target.value)}
                    placeholder="Ej. Talleres de regularización sabatinos y clubes de estudio guiados por docentes."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Producto que Comprobará la Meta (Formato 5.1)</label>
                  <textarea
                    value={instEntregable}
                    onChange={(e) => setInstEntregable(e.target.value)}
                    placeholder="Ej. Listas de asistencia a tutorías, registros de evaluación bimestral e informe final de indicadores."
                    rows={2}
                    style={{ ...inputStyle, minHeight: '52px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Situación Actual que Justifica la Meta</label>
                  <input
                    type="text"
                    value={instSituacion}
                    onChange={(e) => setInstSituacion(e.target.value)}
                    placeholder="Ej. Se detectó un 22% de reprobación en el ciclo previo."
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Mes Inicio</label>
                  <input
                    type="text"
                    value={instPeriodoInicio}
                    onChange={(e) => setInstPeriodoInicio(e.target.value)}
                    placeholder="Septiembre"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Mes Término</label>
                  <input
                    type="text"
                    value={instPeriodoFin}
                    onChange={(e) => setInstPeriodoFin(e.target.value)}
                    placeholder="Julio"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                  }}
                >
                  <span>💾</span> Guardar y Añadir Meta Institucional
                </button>
              </div>
            </form>
          </div>

          {/* Lista de Metas Institucionales Actuales */}
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e0e7ff', marginBottom: '12px' }}>
              Metas Institucionales Activas ({planAccion?.metas_institucionales?.length || 0})
            </h4>

            {(!planAccion?.metas_institucionales || planAccion.metas_institucionales.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                No hay metas institucionales registradas en el plan. Usa el asistente o el formulario superior para agregarlas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {planAccion.metas_institucionales.map((item, idx) => {
                  const isEditing = editingInstIndex === idx && editingInstData;
                  if (isEditing) {
                    return (
                      <div
                        key={`inst-edit-${idx}`}
                        style={{
                          background: 'rgba(30, 41, 59, 0.85)',
                          border: '1.5px solid rgba(16, 185, 129, 0.5)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>✏️</span> Editando Meta Institucional: {editingInstData.tema || editingInstData.nombre_categoria}
                          </span>
                          <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.2)', color: '#a7f3d0', padding: '2px 8px', borderRadius: '4px' }}>
                            #{idx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Tema Específico:</label>
                            <input
                              type="text"
                              value={editingInstData.tema}
                              onChange={(e) => setEditingInstData({ ...editingInstData, tema: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Responsable / Personal Designado:</label>
                            <input
                              type="text"
                              value={editingInstData.personal_designado}
                              onChange={(e) => setEditingInstData({ ...editingInstData, personal_designado: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Período (Mes Inicio - Mes Fin):</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                value={editingInstData.periodo_inicio}
                                onChange={(e) => setEditingInstData({ ...editingInstData, periodo_inicio: e.target.value })}
                                placeholder="Inicio"
                                style={inputStyle}
                              />
                              <input
                                type="text"
                                value={editingInstData.periodo_fin}
                                onChange={(e) => setEditingInstData({ ...editingInstData, periodo_fin: e.target.value })}
                                placeholder="Fin"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Redacción de la Meta Institucional:</label>
                          <textarea
                            value={editingInstData.meta}
                            onChange={(e) => setEditingInstData({ ...editingInstData, meta: e.target.value })}
                            rows={3}
                            style={{ ...inputStyle, minHeight: '70px', lineHeight: 1.45 }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Estrategia de Implementación:</label>
                            <textarea
                              value={editingInstData.estrategia}
                              onChange={(e) => setEditingInstData({ ...editingInstData, estrategia: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Producto Comprobable (Entregable):</label>
                            <textarea
                              value={editingInstData.entregable}
                              onChange={(e) => setEditingInstData({ ...editingInstData, entregable: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, minHeight: '52px' }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>Situación Actual que Justifica la Meta:</label>
                          <input
                            type="text"
                            value={editingInstData.diagnostico_meta || editingInstData.linea_base || ''}
                            onChange={(e) => setEditingInstData({ ...editingInstData, diagnostico_meta: e.target.value, linea_base: e.target.value })}
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={handleCancelEditInstMeta}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.06)',
                              color: '#94a3b8',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditInstMeta}
                            disabled={saving}
                            style={{
                              padding: '7px 16px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: saving ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                            }}
                          >
                            💾 Guardar Cambios
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`inst-${idx}`}
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            #{idx + 1}
                          </span>
                          <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                            {item.nombre_categoria || item.categoria}
                          </strong>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>• {item.tema}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>({item.periodo_inicio} - {item.periodo_fin})</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#e2e8f0', margin: '4px 0', lineHeight: 1.45 }}>
                          <strong>Meta:</strong> {item.meta}
                        </p>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                          <span><strong>Responsable:</strong> {item.personal_designado}</span>
                          <span><strong>Estrategia:</strong> {item.estrategia}</span>
                          <span><strong>Entregable:</strong> {item.entregable}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEditInstMeta(idx)}
                          disabled={saving}
                          title="Editar meta institucional"
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#6ee7b7',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInstMeta(idx)}
                          disabled={saving}
                          title="Eliminar meta institucional"
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
