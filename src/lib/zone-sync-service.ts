/**
 * src/lib/zone-sync-service.ts
 * Servicio integral para la sincronización bidireccional de Zona Escolar (Fase 9).
 * - Herencia descendente (Cartografía -> PMC/PAEC) por CCT.
 * - Monitoreo ascendente (Semáforo de Zona en tiempo real para supervisores).
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildCartografiaBaseContext,
  getCartografiaMomentos,
} from '@/lib/cartografia-context-builder';
import type {
  CartografiaPlantelItem,
  CartografiaMomento3Ubicar,
  CartografiaMomento5Decidir,
} from '@/types/cartografia';
import type { CartografiaIdentificacion } from '@/lib/prompts/cartografia-prompts';

export interface SchoolZoneContextResponse {
  found: boolean;
  zona?: {
    identificacion: CartografiaIdentificacion;
    pipsProjectId: string;
    averages: {
      promAbandono?: number;
      promEficiencia?: number;
      promAprovechamiento?: number;
      promReprobacion?: number;
    };
    problematicasComunes: string[];
    momento3Territorio?: CartografiaMomento3Ubicar;
    momento5Metas?: CartografiaMomento5Decidir;
  };
  plantel?: Omit<CartografiaPlantelItem, 'abandono' | 'reprobacion' | 'promedioGeneral' | 'matricula'> & {
    matricula?: number;
    abandono?: number;
    reprobacion?: number;
    promedioGeneral?: number;
  };
}

export interface PlantelSemaforoItem {
  id?: string;
  cct: string;
  nombre: string;
  municipio?: string;
  subsistema: string;
  directorNombre?: string;
  directorEmail?: string;
  activa: boolean;
  pmc: {
    status: 'completed' | 'draft' | 'none';
    currentStep: number;
    projectId?: string;
    updatedAt?: string;
  };
  paec: {
    status: 'completed' | 'draft' | 'none';
    currentStep: number;
    projectName?: string;
    projectId?: string;
    updatedAt?: string;
  };
  cartografia: {
    inZona: boolean;
    abandono?: number;
    eficienciaTerminal?: number;
    matricula?: number;
    atencionPrioritaria: boolean;
  };
  alertas: string[];
}

export interface SupervisorDashboardData {
  zona: {
    nombre: string;
    clave: string;
    supervisorName: string;
    hasCartografia: boolean;
    cartografiaProjectId?: string;
    momento5Completed: boolean;
    memoriaCompleted: boolean;
  };
  resumen: {
    totalPlanteles: number;
    pmcCompletados: number;
    pmcEnProceso: number;
    pmcSinIniciar: number;
    paecCompletados: number;
    paecEnProceso: number;
    paecSinIniciar: number;
    plantelesAtencionPrioritaria: number;
  };
  planteles: PlantelSemaforoItem[];
}

/**
 * Obtiene el contexto de la Cartografía de Zona correspondiente a un plantel por su CCT.
 * Utilizado por directores en el asistente de PMC y PAEC para herencia sugerida.
 */
export async function getZoneContextForSchool(cct: string): Promise<SchoolZoneContextResponse> {
  const cleanCct = (cct || '').trim().toUpperCase();
  if (!cleanCct) return { found: false };

  try {
    const db = sql();
    const rows = await db`
      SELECT *
      FROM pips_projects
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(planteles_json) AS elem
        WHERE UPPER(COALESCE(elem->>'cct', '')) = ${cleanCct}
      )
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { found: false };
    }

    const row = rows[0];
    const baseCtx = buildCartografiaBaseContext(row);
    const momentos = getCartografiaMomentos(row, baseCtx.planteles.length);

    const plantel = baseCtx.planteles.find(
      (p) => p.cct.trim().toUpperCase() === cleanCct
    );

    const rawPlanteles = Array.isArray(row.planteles_json) ? (row.planteles_json as Record<string, unknown>[]) : [];
    const rawPlantel = rawPlanteles.find(
      (p) => String(p.cct || '').trim().toUpperCase() === cleanCct
    );

    const safeMetric = (val: unknown): number | undefined => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'string' && val.trim() === '') return undefined;
      const num = typeof val === 'number' ? val : Number(val);
      return Number.isFinite(num) && num >= 0 ? num : undefined;
    };

    type PlantelWithOptionalMetrics = Omit<CartografiaPlantelItem, 'abandono' | 'reprobacion' | 'promedioGeneral' | 'matricula'> & {
      matricula?: number;
      abandono?: number;
      reprobacion?: number;
      promedioGeneral?: number;
    };

    let sanitizedPlantel: PlantelWithOptionalMetrics | undefined = plantel;
    if (plantel && rawPlantel) {
      sanitizedPlantel = {
        ...plantel,
        matricula: safeMetric(rawPlantel.matricula ?? rawPlantel.total),
        abandono: safeMetric(rawPlantel.abandono),
        eficienciaTerminal: safeMetric(rawPlantel.eficienciaTerminal),
        reprobacion: safeMetric(rawPlantel.reprobacion),
        promedioGeneral: safeMetric(rawPlantel.promedioGeneral ?? rawPlantel.promedioCalificaciones),
      };
    }

    // Nota (H-082): safeAverage mantiene > 0 porque un promedio calculado de zona sin datos no debe ser 0 (no distinguible de fabricación).
    const safeAverage = (val: unknown): number | undefined => {
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        return val;
      }
      return undefined;
    };

    return {
      found: true,
      zona: {
        identificacion: baseCtx.identificacion,
        pipsProjectId: row.id,
        averages: {
          promAbandono: safeAverage(baseCtx.promAbandono),
          promEficiencia: safeAverage(baseCtx.promEficiencia),
          promAprovechamiento: safeAverage(baseCtx.promAprovechamiento),
          promReprobacion: safeAverage(baseCtx.promReprobacion),
        },
        problematicasComunes: baseCtx.momento2.capaCualitativa.problematicasComunes,
        momento3Territorio: momentos.momento3Ubicar,
        momento5Metas: momentos.momento5Decidir,
      },
      plantel: sanitizedPlantel,
    };
  } catch (error) {
    logger.error(`[ZoneSyncService] Error obteniendo contexto de zona para CCT ${cleanCct}:`, error);
    return { found: false };
  }
}

/**
 * Construye el Semáforo de Zona en tiempo real para el Supervisor Escolar.
 * Agrega el estatus de PMC, PAEC y Cartografía de todos los planteles vinculados.
 */
export async function getZoneSupervisorDashboard(supervisorId: string): Promise<SupervisorDashboardData> {
  const db = sql();

  // 1. Obtener Cartografía del supervisor (si existe)
  const [pipsRow] = await db`
    SELECT * FROM pips_projects
    WHERE teacher_id = ${supervisorId}::uuid
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const pipsBaseCtx = pipsRow ? buildCartografiaBaseContext(pipsRow) : null;

  // 2. Obtener escuelas registradas en supervisor_escuelas
  const escuelasRows = await db`
    SELECT id, cct, nombre, municipio, subsistema, director_nombre, director_email, activa
    FROM supervisor_escuelas
    WHERE supervisor_id = ${supervisorId}::uuid
    ORDER BY nombre ASC
  `;

  // 3. Crear mapa unificado de planteles (combinando supervisor_escuelas y planteles_json de Cartografía)
  const plantelesMap = new Map<string, {
    id?: string;
    cct: string;
    nombre: string;
    municipio?: string;
    subsistema: string;
    directorNombre?: string;
    directorEmail?: string;
    activa: boolean;
  }>();

  for (const esc of escuelasRows) {
    const cctClean = (esc.cct || '').trim().toUpperCase();
    if (cctClean) {
      plantelesMap.set(cctClean, {
        id: esc.id,
        cct: cctClean,
        nombre: esc.nombre,
        municipio: esc.municipio || undefined,
        subsistema: esc.subsistema || 'BGE',
        directorNombre: esc.director_nombre || undefined,
        directorEmail: esc.director_email || undefined,
        activa: esc.activa ?? true,
      });
    }
  }

  // Si hay planteles en la Cartografía que aún no están en supervisor_escuelas, incorporarlos
  if (pipsBaseCtx) {
    for (const p of pipsBaseCtx.planteles) {
      const cctClean = p.cct.trim().toUpperCase();
      if (cctClean && !plantelesMap.has(cctClean)) {
        plantelesMap.set(cctClean, {
          cct: cctClean,
          nombre: p.nombre,
          municipio: p.municipio,
          subsistema: 'BGE',
          activa: true,
        });
      }
    }
  }

  const allCcts = Array.from(plantelesMap.keys());

  // 4. Batch query a pmc_projects por la lista de CCTs
  const pmcMap = new Map<string, { id: string; status: 'draft' | 'completed'; currentStep: number; updatedAt?: string }>();
  if (allCcts.length > 0) {
    const pmcRows = await db`
      SELECT DISTINCT ON (UPPER(school_cct))
        id, school_cct, status, current_step, updated_at
      FROM pmc_projects
      WHERE UPPER(school_cct) = ANY(${allCcts})
      ORDER BY UPPER(school_cct), updated_at DESC
    `;
    for (const r of pmcRows) {
      pmcMap.set(String(r.school_cct).toUpperCase(), {
        id: r.id,
        status: r.status === 'completed' ? 'completed' : 'draft',
        currentStep: Number(r.current_step) || 1,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      });
    }
  }

  // 5. Batch query a paec_projects por la lista de CCTs
  const paecMap = new Map<string, { id: string; status: 'draft' | 'completed'; currentStep: number; projectName?: string; updatedAt?: string }>();
  if (allCcts.length > 0) {
    const paecRows = await db`
      SELECT DISTINCT ON (UPPER(COALESCE(school_context->>'cct', community_context->>'cct', '')))
        id,
        UPPER(COALESCE(school_context->>'cct', community_context->>'cct', '')) as cct,
        status, current_step, project_name, updated_at
      FROM paec_projects
      WHERE UPPER(COALESCE(school_context->>'cct', community_context->>'cct', '')) = ANY(${allCcts})
      ORDER BY UPPER(COALESCE(school_context->>'cct', community_context->>'cct', '')), updated_at DESC
    `;
    for (const r of paecRows) {
      paecMap.set(String(r.cct).toUpperCase(), {
        id: r.id,
        status: r.status === 'completed' ? 'completed' : 'draft',
        currentStep: Number(r.current_step) || 1,
        projectName: r.project_name || undefined,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      });
    }
  }

  // 6. Ensamblar los items semafóricos y calcular alertas
  const planteles: PlantelSemaforoItem[] = [];
  let pmcCompletados = 0;
  let pmcEnProceso = 0;
  let pmcSinIniciar = 0;
  let paecCompletados = 0;
  let paecEnProceso = 0;
  let paecSinIniciar = 0;
  let plantelesAtencionPrioritariaCount = 0;

  for (const [cct, pInfo] of plantelesMap.entries()) {
    const pmcData = pmcMap.get(cct);
    const paecData = paecMap.get(cct);

    const cartografiaPlantel = pipsBaseCtx?.planteles.find((p) => p.cct.toUpperCase() === cct);
    const isPrioritario = cartografiaPlantel
      ? cartografiaPlantel.abandono > (pipsBaseCtx?.promAbandono || 0) + 3 ||
        (cartografiaPlantel.eficienciaTerminal !== undefined &&
          (pipsBaseCtx?.promEficiencia || 0) > 0 &&
          cartografiaPlantel.eficienciaTerminal < (pipsBaseCtx?.promEficiencia || 0) - 5)
      : false;

    if (isPrioritario) plantelesAtencionPrioritariaCount++;

    // Contadores PMC
    const pmcStatus = pmcData ? pmcData.status : 'none';
    if (pmcStatus === 'completed') pmcCompletados++;
    else if (pmcStatus === 'draft') pmcEnProceso++;
    else pmcSinIniciar++;

    // Contadores PAEC
    const paecStatus = paecData ? paecData.status : 'none';
    if (paecStatus === 'completed') paecCompletados++;
    else if (paecStatus === 'draft') paecEnProceso++;
    else paecSinIniciar++;

    // Generar alertas pedagógicas
    const alertas: string[] = [];
    if (isPrioritario && pmcStatus !== 'completed') {
      alertas.push(`Prioridad: Abandono elevado (${cartografiaPlantel?.abandono || 0}%) con PMC en proceso o pendiente.`);
    }
    if (paecStatus === 'none') {
      alertas.push('Proyecto Comunitario PAEC no iniciado.');
    }
    if (pmcStatus === 'none') {
      alertas.push('Programa de Mejora Continua (PMC) sin registro activo.');
    }

    planteles.push({
      id: pInfo.id,
      cct,
      nombre: pInfo.nombre,
      municipio: pInfo.municipio,
      subsistema: pInfo.subsistema,
      directorNombre: pInfo.directorNombre,
      directorEmail: pInfo.directorEmail,
      activa: pInfo.activa,
      pmc: {
        status: pmcStatus,
        currentStep: pmcData ? pmcData.currentStep : 0,
        projectId: pmcData?.id,
        updatedAt: pmcData?.updatedAt,
      },
      paec: {
        status: paecStatus,
        currentStep: paecData ? paecData.currentStep : 0,
        projectName: paecData?.projectName,
        projectId: paecData?.id,
        updatedAt: paecData?.updatedAt,
      },
      cartografia: {
        inZona: !!cartografiaPlantel,
        abandono: cartografiaPlantel?.abandono,
        eficienciaTerminal: cartografiaPlantel?.eficienciaTerminal,
        matricula: cartografiaPlantel?.matricula,
        atencionPrioritaria: isPrioritario,
      },
      alertas,
    });
  }

  return {
    zona: {
      nombre: pipsBaseCtx?.identificacion.zonaNumero || '004',
      clave: pipsBaseCtx?.identificacion.zonaClave || '21FMS0004Z',
      supervisorName: pipsBaseCtx?.identificacion.supervisorName || 'Supervisor(a) Escolar',
      hasCartografia: !!pipsRow,
      cartografiaProjectId: pipsRow?.id,
      momento5Completed: !!pipsRow?.momento5_decidir,
      memoriaCompleted: !!pipsRow?.memoria_pedagogica,
    },
    resumen: {
      totalPlanteles: planteles.length,
      pmcCompletados,
      pmcEnProceso,
      pmcSinIniciar,
      paecCompletados,
      paecEnProceso,
      paecSinIniciar,
      plantelesAtencionPrioritaria: plantelesAtencionPrioritariaCount,
    },
    planteles,
  };
}
