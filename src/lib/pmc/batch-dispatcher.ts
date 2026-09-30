/**
 * batch-dispatcher.ts — Dispatcher por Lotes para Extracción de PMC
 * SIGPDA-EMS · PMC-EXTRACT v6.4
 *
 * Divide tablas y documentos densos en lotes seguros basados en densidad de metas
 * (máx. 15 metas por llamada) para evitar colisiones con el límite de tokens de salida.
 * Consolida y deduplica personal escolar (staffData) entre lotes.
 */

import type { PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';

export interface BatchItem {
  tableIndex: number;
  rowIndex: number;
  rawText: string;
  itemsCount: number;
  [key: string]: any;
}

export function partitionRowsByMetaDensity<T extends { itemsCount?: number }>(
  rows: T[],
  maxMetasPerBatch = 15
): T[][] {
  if (!rows || rows.length === 0) return [];

  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentMetaAccumulator = 0;

  for (const row of rows) {
    const rowMetas = Math.max(1, row.itemsCount || 1);

    if (currentMetaAccumulator + rowMetas > maxMetasPerBatch && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentMetaAccumulator = 0;
    }

    currentBatch.push(row);
    currentMetaAccumulator += rowMetas;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Consolida múltiples respuestas de lotes en un único DTO de PMC sin duplicar docentes.
 */
export function consolidateBatchResults(
  baseMetadata: Partial<PmcPreviousExtractDTO>,
  batchResults: Partial<PmcPreviousExtractDTO>[]
): PmcPreviousExtractDTO {
  const consolidated: PmcPreviousExtractDTO = {
    schoolName: baseMetadata.schoolName ?? '',
    schoolCct: baseMetadata.schoolCct ?? '',
    directorName: baseMetadata.directorName ?? '',
    supervisorName: baseMetadata.supervisorName ?? '',
    schoolZone: baseMetadata.schoolZone ?? '',
    municipality: baseMetadata.municipality ?? '',
    locality: baseMetadata.locality ?? '',
    cicloEscolar: baseMetadata.cicloEscolar ?? '2025-2026',
    subsystem: baseMetadata.subsystem ?? 'BGE',
    totalStaff: baseMetadata.totalStaff,
    participantes: [...(baseMetadata.participantes || [])],
    staffData: [],
    metas_institucionales_previas: [],
    elementos_plan: [],
    totales_detectados: { metas: null, actividades: null },
    categorias_priorizadas: [],
    diagnosticoComunidad: baseMetadata.diagnosticoComunidad ?? '',
    indicadores: baseMetadata.indicadores || {},
    foda: baseMetadata.foda || {}
  };

  const staffMap = new Map<
    string,
    {
      nombre: string;
      cargo: string;
      meta_individual: string;
      metas_individuales: any[];
    }
  >();

  for (const res of batchResults) {
    if (!consolidated.schoolName && res.schoolName) consolidated.schoolName = res.schoolName;
    if (!consolidated.schoolCct && res.schoolCct) consolidated.schoolCct = res.schoolCct;
    if (!consolidated.directorName && res.directorName) consolidated.directorName = res.directorName;
    if (!consolidated.supervisorName && res.supervisorName) consolidated.supervisorName = res.supervisorName;
    if (!consolidated.schoolZone && res.schoolZone) consolidated.schoolZone = res.schoolZone;
    if (!consolidated.municipality && res.municipality) consolidated.municipality = res.municipality;
    if (!consolidated.locality && res.locality) consolidated.locality = res.locality;
    if (!consolidated.subsystem && res.subsystem) consolidated.subsystem = res.subsystem;
    if (!consolidated.diagnosticoComunidad && res.diagnosticoComunidad) {
      consolidated.diagnosticoComunidad = res.diagnosticoComunidad;
    }

    // Acumular elementos del plan y metas institucionales
    if (res.elementos_plan) {
      consolidated.elementos_plan!.push(...res.elementos_plan);
    }
    if (res.metas_institucionales_previas) {
      consolidated.metas_institucionales_previas!.push(...res.metas_institucionales_previas);
    }
    if (res.participantes) {
      consolidated.participantes!.push(...res.participantes);
    }

    // Deduplicación formal de staffData (Aporte Gemini)
    for (const staff of res.staffData || []) {
      const nombreLimpio = (staff.nombre || '').trim().toLowerCase();
      if (!nombreLimpio) continue;

      if (!staffMap.has(nombreLimpio)) {
        staffMap.set(nombreLimpio, {
          nombre: staff.nombre || '',
          cargo: staff.cargo || 'Docente',
          meta_individual: staff.meta_individual || '',
          metas_individuales: [...(staff.metas_individuales || [])]
        });
      } else {
        const existing = staffMap.get(nombreLimpio)!;
        if (staff.metas_individuales && staff.metas_individuales.length > 0) {
          existing.metas_individuales.push(...staff.metas_individuales);
        }
      }
    }
  }

  consolidated.staffData = Array.from(staffMap.values());

  // Actualizar totales detectados con la suma final
  const totalMetas = consolidated.elementos_plan?.filter((e) => e.tipo === 'meta').length || 0;
  const totalActividades = consolidated.elementos_plan?.filter((e) => e.tipo === 'actividad').length || 0;
  consolidated.totales_detectados = {
    metas: totalMetas,
    actividades: totalActividades
  };

  return consolidated;
}
