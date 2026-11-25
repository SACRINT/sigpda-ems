'use client';

import React, { useState, useMemo } from 'react';
import { deduplicateMetasInstitucionales } from '@/lib/pmc-meta-deduplicator';
import { consolidateMetasPersonalesByTeacher } from '@/lib/pmc-document-structure';
import type { PmcNormalizedGoalResponse } from '@/lib/ai-schemas';
import {
  AMBITOS_OFICIALES,
  type MetaPersonalItem,
  type MetaInstitucionalItem,
  type PlanAccionData,
  type StaffMemberData,
  type PmcMetasComplementariasProps,
} from './types';

export function usePmcMetasComplementarias({
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
    const nextStaff: StaffMemberData[] = [...staffData];
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


  return {
    projectId,
    planAccion,
    setPlanAccion,
    staffData,
    setStaffData,
    cicloEscolar,
    indicadores,
    onPlanUpdated,
    subTab,
    setSubTab,
    saving,
    setSaving,
    feedback,
    setFeedback,
    aiSelectedStaffIndex,
    setAiSelectedStaffIndex,
    aiDocenteNombre,
    setAiDocenteNombre,
    aiDocenteCargo,
    setAiDocenteCargo,
    aiHorasBase,
    setAiHorasBase,
    aiRawGoalText,
    setAiRawGoalText,
    aiTipoMeta,
    setAiTipoMeta,
    aiAmbitoSugerido,
    setAiAmbitoSugerido,
    aiNormalizing,
    setAiNormalizing,
    normalizedPreview,
    setNormalizedPreview,
    selectedStaffIndex,
    setSelectedStaffIndex,
    personalNombre,
    setPersonalNombre,
    personalCargo,
    setPersonalCargo,
    personalMeta,
    setPersonalMeta,
    personalEstrategia,
    setPersonalEstrategia,
    personalEntregable,
    setPersonalEntregable,
    personalPeriodo,
    setPersonalPeriodo,
    instAmbito,
    setInstAmbito,
    instTema,
    setInstTema,
    instMeta,
    setInstMeta,
    instEstrategia,
    setInstEstrategia,
    instResponsable,
    setInstResponsable,
    instEntregable,
    setInstEntregable,
    instSituacion,
    setInstSituacion,
    instPeriodoInicio,
    setInstPeriodoInicio,
    instPeriodoFin,
    setInstPeriodoFin,
    editingPersonalIndex,
    setEditingPersonalIndex,
    editingPersonalData,
    setEditingPersonalData,
    editingInstIndex,
    setEditingInstIndex,
    editingInstData,
    setEditingInstData,
    staffWithoutGoal,
    handleSelectStaffForAI,
    handleSelectStaff,
    handleNormalizeWithAI,
    previewItems,
    handleUpdatePreviewIndividual,
    handleUpdatePreviewInstitucional,
    handleConfirmSurgicalInsertion,
    handleSavePersonalMeta,
    handleSaveInstitucionalMeta,
    handleDeletePersonalMeta,
    handleDeleteInstMeta,
    handleStartEditPersonalMeta,
    handleCancelEditPersonalMeta,
    handleSaveEditPersonalMeta,
    handleStartEditInstMeta,
    handleCancelEditInstMeta,
    handleSaveEditInstMeta,
    inputStyle,
    labelStyle,
  };
}

export type PmcMetasController = ReturnType<typeof usePmcMetasComplementarias>;
