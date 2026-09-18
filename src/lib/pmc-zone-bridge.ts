/**
 * src/lib/pmc-zone-bridge.ts
 * Helper para interconexión y consultas rápidas de estado de PMC por CCT escolar.
 * Análogo a `paec-context.ts`, centraliza la extracción de datos de `pmc_projects`.
 */

import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface PmcSummaryContext {
  found: boolean;
  projectId?: string;
  schoolName?: string;
  schoolCct?: string;
  schoolZone?: string;
  status?: 'draft' | 'completed' | 'none';
  currentStep?: number;
  cicloEscolar?: string;
  directorName?: string;
  indicadoresAcademicos?: {
    matricula?: number;
    abandono_ant?: number;
    et_ant?: number;
    reprobacion_ant?: number;
    aprobacion_ant?: number;
  };
  categoriasPriorizadasCount?: number;
  updatedAt?: string;
}

/**
 * Consulta el proyecto de PMC más reciente para un CCT escolar.
 */
export async function loadPmcSummary(cct: string): Promise<PmcSummaryContext> {
  const cleanCct = (cct || '').trim().toUpperCase();
  if (!cleanCct) {
    return { found: false };
  }

  try {
    const db = sql();
    const rows = await db`
      SELECT id, school_name, school_cct, school_zone, status, current_step,
             ciclo_escolar, director_name, indicadores_academicos,
             categorias_priorizadas, updated_at
      FROM pmc_projects
      WHERE UPPER(school_cct) = ${cleanCct}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { found: false };
    }

    const row = rows[0];
    const rawIndicadores = (row.indicadores_academicos as Record<string, unknown>) || {};
    const categorias = Array.isArray(row.categorias_priorizadas) ? row.categorias_priorizadas : [];

    return {
      found: true,
      projectId: row.id,
      schoolName: row.school_name || undefined,
      schoolCct: row.school_cct || cleanCct,
      schoolZone: row.school_zone || undefined,
      status: (row.status === 'completed' ? 'completed' : 'draft') as 'draft' | 'completed',
      currentStep: Number(row.current_step) || 1,
      cicloEscolar: row.ciclo_escolar || undefined,
      directorName: row.director_name || undefined,
      indicadoresAcademicos: {
        matricula: Number(rawIndicadores.matricula) || undefined,
        abandono_ant: Number(rawIndicadores.abandono_ant) || undefined,
        et_ant: Number(rawIndicadores.et_ant) || undefined,
        reprobacion_ant: Number(rawIndicadores.reprobacion_ant) || undefined,
        aprobacion_ant: Number(rawIndicadores.aprobacion_ant) || undefined,
      },
      categoriasPriorizadasCount: categorias.length,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  } catch (error) {
    logger.error(`[PmcZoneBridge] Error consultando PMC para CCT ${cleanCct}:`, error);
    return { found: false };
  }
}
