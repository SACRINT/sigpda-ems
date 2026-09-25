/**
 * pmc-statistics-parser.ts
 * Parser oficial de datos estadísticos Formato 911.7G / F11C / EDIEMS / ESA — SEMS Puebla (SIGPDA-EMS)
 * 
 * Procesa la matriz oficial de estadísticas escolares (911.7G, F11C, EDIEMS, ESA y metas de zona)
 * extrayendo matrícula, calificaciones, aprobación, abandono y eficiencia terminal.
 * Calcula promedios de zona, brechas diagnósticas e inyecta la línea base real al PMC.
 */

import * as XLSX from 'xlsx';
import type {
  PmcStatisticalContext,
  PmcStatisticalPlantel,
  PmcStatisticalZona,
} from '@/types/pmc';
import { logger } from '@/lib/logger';

export interface ParsePmcOptions {
  targetCct?: string;
  targetSchoolName?: string;
  zonaNumero?: string;
  cicloEscolar?: string;
}

export interface ParsePmcResult {
  success: boolean;
  context?: PmcStatisticalContext;
  allPlanteles: PmcStatisticalPlantel[];
  zona?: PmcStatisticalZona;
  error?: string;
}

/**
 * Normaliza encabezados para búsqueda flexible sin importar tildes o mayúsculas.
 */
function normalizeHeader(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parsea un buffer de Excel o una matriz de filas JSON.
 */
export function parsePmcStatistics(
  input: Buffer | Uint8Array | ArrayBuffer | unknown[],
  options?: ParsePmcOptions
): ParsePmcResult {
  try {
    let rows: unknown[][] = [];

    if (Array.isArray(input)) {
      rows = input as unknown[][];
    } else {
      const isBuffer = typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function' && Buffer.isBuffer(input);
      const workbook = XLSX.read(input, { type: isBuffer ? 'buffer' : 'array' });
      // Buscar hoja 'Punto de partida', '911', 'F11' o la primera hoja
      const sheetName = workbook.SheetNames.find((name) => {
        const n = normalizeHeader(name);
        return n.includes('puntodepartida') || n.includes('911') || n.includes('f11') || n.includes('metas');
      }) || workbook.SheetNames[0];

      if (!sheetName) {
        return { success: false, allPlanteles: [], error: 'El archivo Excel no contiene hojas válidas.' };
      }

      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    }

    if (!rows || rows.length === 0) {
      return { success: false, allPlanteles: [], error: 'La hoja de datos está vacía.' };
    }

    // Mapeo de columnas oficiales y asignaturas F11
    let headerRowIndex = -1;
    const colMap: Record<string, number> = {};
    const subjectCols: { name: string; colIdx: number }[] = [];

    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i] || [];
      const rowNormalized = row.map((cell) => normalizeHeader(String(cell || '')));

      const hasCct = rowNormalized.some((h) => h === 'cct');
      const hasEscuela = rowNormalized.some((h) => h.includes('escuela') || h.includes('plantel') || h.includes('nombre'));
      const hasMatricula = rowNormalized.some((h) => h.includes('matricula'));

      if (hasCct || (hasEscuela && hasMatricula)) {
        headerRowIndex = i;
        rowNormalized.forEach((h, colIdx) => {
          const rawHeader = String(row[colIdx] || '').trim();
          if (h === 'cct') colMap['cct'] = colIdx;
          else if (h.includes('escuela') || h.includes('nombre') || h.includes('plantel')) colMap['nombre'] = colIdx;
          else if (h === 'turno' || h === 't') colMap['turno'] = colIdx;
          
          // ── 1. Formato 911.7G (Fin de Cursos / Inicio) ─────────────────────
          else if (h.includes('matricula')) colMap['matricula'] = colIdx;
          else if (h.includes('egresad')) colMap['egresados'] = colIdx;
          else if (h.includes('baja')) colMap['bajasDefinitivas'] = colIdx;
          else if (h.includes('eficiencia') || h.includes('terminal')) colMap['eficiencia'] = colIdx;
          else if (h.includes('abandono') || h.includes('desercion')) colMap['abandono'] = colIdx;
          else if (h.includes('numero') && h.includes('reprob')) colMap['reprobados'] = colIdx;
          else if (h.includes('numero') && h.includes('aprob')) colMap['estudiantesAprobados'] = colIdx;
          
          // ── 2. Formato F11C (Control Escolar / Calificaciones por Alumno/Materia) ──
          else if (h.includes('promedio') || h.includes('calificacion') || (h.includes('resultado') && h.includes('evaluac'))) {
            colMap['calificaciones'] = colIdx;
          }
          else if (h.includes('aprob') && !colMap['aprobacion']) colMap['aprobacion'] = colIdx;
          else if (h.includes('reprob') && !colMap['reprobacion']) colMap['reprobacion'] = colIdx;
          else if (
            h.includes('matemat') || h.includes('lengua') || h.includes('comunic') ||
            h.includes('cienc') || h.includes('quimic') || h.includes('fisic') ||
            h.includes('social') || h.includes('human') || h.includes('digit') ||
            h.includes('ingl') || h.includes('asigna') || h.includes('materia')
          ) {
            subjectCols.push({ name: rawHeader || `Asignatura ${colIdx}`, colIdx });
          }

          // ── 3. Evaluaciones Externas SEMS (independientes del F11) ──────────
          else if (h.includes('ediems') && h.includes('pre')) colMap['ediemsPre'] = colIdx;
          else if (h.includes('ediems') && h.includes('post')) colMap['ediemsPost'] = colIdx;
          else if (h.includes('esa') && h.includes('pre')) colMap['esaPre'] = colIdx;
          else if (h.includes('esa') && h.includes('post')) colMap['esaPost'] = colIdx;
        });
        break;
      }
    }

    if (headerRowIndex === -1) {
      return { success: false, allPlanteles: [], error: 'No se identificaron columnas válidas (CCT, Escuela, Matrícula).' };
    }

    // Extraer datos de los planteles
    const allPlanteles: PmcStatisticalPlantel[] = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const cctRaw = String(row[colMap['cct'] ?? 1] || '').trim().toUpperCase();
      const nombreRaw = String(row[colMap['nombre'] ?? 0] || '').trim();

      // Ignorar filas de totales, promedios o vacías
      if (!cctRaw && !nombreRaw) continue;
      if (nombreRaw.toLowerCase().includes('total') || nombreRaw.toLowerCase().includes('promedio')) continue;
      if (cctRaw.toLowerCase().includes('total') || cctRaw.toLowerCase().includes('promedio')) continue;

      const matricula = parseFloat(String(row[colMap['matricula'] ?? 3] || '0').replace(/[^0-9.]/g, '')) || 0;
      if (matricula <= 0 && !cctRaw.startsWith('21')) continue;

      // ── Datos 911.7G ──
      const egresados = colMap['egresados'] !== undefined ? parseInt(String(row[colMap['egresados']] || '0').replace(/[^0-9]/g, ''), 10) || undefined : undefined;
      const bajasDefinitivas = colMap['bajasDefinitivas'] !== undefined ? parseInt(String(row[colMap['bajasDefinitivas']] || '0').replace(/[^0-9]/g, ''), 10) || undefined : undefined;
      const estudiantesAprobados = colMap['estudiantesAprobados'] !== undefined ? parseInt(String(row[colMap['estudiantesAprobados']] || '0').replace(/[^0-9]/g, ''), 10) || undefined : undefined;
      const estudiantesReprobados = colMap['reprobados'] !== undefined ? parseInt(String(row[colMap['reprobados']] || '0').replace(/[^0-9]/g, ''), 10) || undefined : undefined;

      // Fórmulas oficiales de Eficiencia Terminal y Abandono
      // Nota H-046: La Eficiencia Terminal es un indicador GENERACIONAL oficial (% egresados sobre matrícula inicial de cohorte).
      // NUNCA debe recalcularse dividiendo egresados entre matrícula del ciclo escolar vigente (en multigrado subvalúa a ~30%).
      // Si la columna oficial no viene en la matriz o viene vacía, no se sintetiza con fórmula defectuosa.
      const rawEficiencia = colMap['eficiencia'] !== undefined ? String(row[colMap['eficiencia'] ?? 7] || '').replace(/[^0-9.]/g, '') : '';
      const parsedEficiencia = parseFloat(rawEficiencia);
      const eficienciaTerminal = !isNaN(parsedEficiencia) && parsedEficiencia > 0 ? parsedEficiencia : undefined;

      let abandono = parseFloat(String(row[colMap['abandono'] ?? 8] || '0').replace(/[^0-9.]/g, '')) || 0;
      if (abandono === 0 && bajasDefinitivas && matricula > 0) {
        abandono = parseFloat(((bajasDefinitivas / matricula) * 100).toFixed(2));
      }

      // ── Datos F11C (Control Escolar) ──
      let promedioCalificaciones = parseFloat(String(row[colMap['calificaciones'] ?? 4] || '0').replace(/[^0-9.]/g, '')) || undefined;
      const aprobadosPorcentaje = parseFloat(String(row[colMap['aprobacion'] ?? 6] || '0').replace(/[^0-9.]/g, '')) || (estudiantesAprobados && matricula > 0 ? parseFloat(((estudiantesAprobados / matricula) * 100).toFixed(2)) : 0);
      const reprobacion = aprobadosPorcentaje > 0 
        ? Math.max(0, parseFloat((100 - aprobadosPorcentaje).toFixed(2))) 
        : (colMap['reprobacion'] !== undefined ? parseFloat(String(row[colMap['reprobacion']] || '0').replace(/[^0-9.]/g, '')) || 0 : (estudiantesReprobados && matricula > 0 ? parseFloat(((estudiantesReprobados / matricula) * 100).toFixed(2)) : 0));

      // Extraer promedios por asignatura si existen columnas específicas
      const promediosPorAsignatura: Record<string, number> = {};
      for (const sc of subjectCols) {
        const val = parseFloat(String(row[sc.colIdx] || '').replace(/[^0-9.]/g, ''));
        if (!isNaN(val) && val > 0 && val <= 100) {
          promediosPorAsignatura[sc.name] = val;
        }
      }

      // Si no había columna de promedio general pero sí materias, promediar
      if (!promedioCalificaciones && Object.keys(promediosPorAsignatura).length > 0) {
        const vals = Object.values(promediosPorAsignatura);
        promedioCalificaciones = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      }

      allPlanteles.push({
        cct: cctRaw || '21EBH0000X',
        nombre: nombreRaw || 'Plantel sin nombre',
        turno: String(row[colMap['turno'] ?? 2] || 'MATUTINO').trim().toUpperCase(),
        // 911.7G
        matricula,
        egresados,
        bajasDefinitivas,
        aprobados: estudiantesAprobados,
        reprobados: estudiantesReprobados,
        eficienciaTerminal,
        abandono,
        reprobacion,
        // F11C
        promedioGeneral: promedioCalificaciones ?? 0,
        promediosPorAsignatura,
        aprobadosPorcentaje,
        reprobadosPorcentaje: reprobacion,
        estudiantesAprobados,
        promedioCalificaciones,
        // Evaluaciones externas SEMS
        ediemsPre: colMap['ediemsPre'] !== undefined ? parseFloat(String(row[colMap['ediemsPre']] || '0')) || undefined : undefined,
        ediemsPost: colMap['ediemsPost'] !== undefined ? parseFloat(String(row[colMap['ediemsPost']] || '0')) || undefined : undefined,
        esaPre: colMap['esaPre'] !== undefined ? parseFloat(String(row[colMap['esaPre']] || '0')) || undefined : undefined,
        esaPost: colMap['esaPost'] !== undefined ? parseFloat(String(row[colMap['esaPost']] || '0')) || undefined : undefined,
      });
    }

    if (allPlanteles.length === 0) {
      return { success: false, allPlanteles: [], error: 'No se encontraron registros de escuelas válidos en la hoja.' };
    }

    // Calcular estadísticas globales de zona (excluyendo planteles con matrícula <= 0 para no distorsionar benchmarks)
    const plantelesZonaValidos = allPlanteles.filter((p) => p.matricula > 0);
    const divisorZona = plantelesZonaValidos.length > 0 ? plantelesZonaValidos.length : allPlanteles.length;
    const totalPlanteles = allPlanteles.length;
    const matriculaTotal = allPlanteles.reduce((acc, p) => acc + p.matricula, 0);
    const sumaAbandono = plantelesZonaValidos.reduce((acc, p) => acc + p.abandono, 0);
    const plantelesConEficiencia = plantelesZonaValidos.filter((p) => p.eficienciaTerminal !== undefined && p.eficienciaTerminal > 0);
    const sumaEficiencia = plantelesConEficiencia.reduce((acc, p) => acc + (p.eficienciaTerminal || 0), 0);
    const sumaReprobacion = plantelesZonaValidos.reduce((acc, p) => acc + p.reprobacion, 0);

    const plantelesConProm = plantelesZonaValidos.filter((p) => p.promedioCalificaciones !== undefined);
    const sumaProm = plantelesConProm.reduce((acc, p) => acc + (p.promedioCalificaciones || 0), 0);

    const promedioAbandono = parseFloat((sumaAbandono / divisorZona).toFixed(2));
    const promedioEficiencia = plantelesConEficiencia.length > 0 ? parseFloat((sumaEficiencia / plantelesConEficiencia.length).toFixed(2)) : 0;
    const promedioReprobacion = parseFloat((sumaReprobacion / divisorZona).toFixed(2));
    const promedioCalificaciones = plantelesConProm.length > 0 ? parseFloat((sumaProm / plantelesConProm.length).toFixed(2)) : undefined;

    // Buscar el plantel objetivo si se especificó CCT o nombre
    const targetCct = (options?.targetCct || '').trim().toUpperCase();
    const targetName = (options?.targetSchoolName || '').trim().toLowerCase();

    let targetPlantel = allPlanteles.find((p) => {
      if (targetCct && p.cct === targetCct) return true;
      if (targetName && p.nombre.toLowerCase().includes(targetName)) return true;
      return false;
    });

    // Si no se encuentra objetivo específico, tomar el primer plantel representativo
    if (!targetPlantel && allPlanteles.length > 0) {
      targetPlantel = allPlanteles[0];
    }

    // Calcular brechas para el plantel seleccionado
    const brechaAbandono = parseFloat(((targetPlantel?.abandono || 0) - promedioAbandono).toFixed(2));
    const targetET = targetPlantel?.eficienciaTerminal;
    const brechaEficiencia = typeof targetET === 'number' && promedioEficiencia > 0
      ? parseFloat((targetET - promedioEficiencia).toFixed(2))
      : undefined;
    const brechaReprobacion = parseFloat(((targetPlantel?.reprobacion || 0) - promedioReprobacion).toFixed(2));

    const observaciones: string[] = [];
    let prioridad: 'alta' | 'media' | 'baja' = 'media';

    if (brechaAbandono > 3) {
      observaciones.push(`Abandono escolar (${targetPlantel?.abandono}%) está ${brechaAbandono}% por encima de la media de zona (${promedioAbandono}%). Requiere alerta temprana.`);
      prioridad = 'alta';
    } else if (brechaAbandono < -2) {
      observaciones.push(`Favorable retención estudiantil: abandono está ${Math.abs(brechaAbandono)}% por debajo de la media regional.`);
    }

    if (brechaEficiencia !== undefined && brechaEficiencia < -5) {
      observaciones.push(`Eficiencia terminal (${targetPlantel?.eficienciaTerminal}%) sensiblemente inferior al promedio de zona (${promedioEficiencia}%).`);
      prioridad = 'alta';
    }

    if (brechaReprobacion > 5) {
      observaciones.push(`Índice de reprobación (${targetPlantel?.reprobacion}%) exige estrategias urgentes de nivelación didáctica y evaluación formativa.`);
      prioridad = 'alta';
    }

    if (observaciones.length === 0) {
      observaciones.push('Indicadores del plantel en rango de estabilidad respecto a la media de la zona escolar.');
      prioridad = 'baja';
    }

    const zonaSummary: PmcStatisticalZona = {
      zonaNumero: options?.zonaNumero,
      totalPlanteles,
      matriculaTotal,
      promedioAbandono,
      promedioEficiencia,
      promedioReprobacion,
      promedioCalificaciones,
      brechasDiagnostico: {
        brechaAbandonoVsZona: brechaAbandono,
        brechaEficienciaVsZona: brechaEficiencia,
        brechaReprobacionVsZona: brechaReprobacion,
        prioridadIntervencion: prioridad,
        observaciones,
      },
    };

    const context: PmcStatisticalContext = {
      fuente: 'matriz_combinada_excel',
      plantel: targetPlantel!,
      zona: zonaSummary,
      cicloEscolar: options?.cicloEscolar || '2026-2027',
      parsedAt: new Date().toISOString(),
    };

    return {
      success: true,
      context,
      allPlanteles,
      zona: zonaSummary,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Error al procesar el archivo estadístico.';
    logger.error('Error al parsear estadísticas escolares PMC/911/F11:', error);
    return { success: false, allPlanteles: [], error: errMsg };
  }
}
