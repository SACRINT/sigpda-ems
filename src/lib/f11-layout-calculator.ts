/**
 * src/lib/f11-layout-calculator.ts
 *
 * Motor determinista de extracción y cálculo escolar para Formato 11 (F11 - Control Escolar).
 * Implementa el parsing directo por coordenadas de pdfjs-dist y reglas de clasificación
 * oficiales de Educación Media Superior (SEP / DBEPA Puebla).
 *
 * Cero IA para cifras numéricas (Regla Anti-Fabricación B-001):
 * - Detección de grupos por regex sobre banda de encabezado (y ≈ 503).
 * - Detección de encabezados de materias rotadas (transform[1] > 0.01) ordenadas por X.
 * - Columnas de calificación derivadas de los datos numéricos de los alumnos.
 * - Clasificación de alumnos:
 *     a) SITUACIÓN = "B" (o sin calificaciones numéricas) -> BAJA
 *     b) Promedio numérico                                  -> REGULAR
 *     c) Promedio "/" con 1 a 3 materias en 5              -> IRREGULAR
 *     d) Promedio "/" con 4 o más materias en 5             -> REPROBADO
 * - Base de cálculo de porcentajes = Total alumnos F11 (ej. 189).
 * - Metas sugeridas por asignatura mediante Regla de Bandas:
 *     <= 5%  -> meta 0.0%
 *     5-20%  -> actual - 5%
 *     > 20%  -> actual - 10%
 */

import path from 'path';

// ─── Polyfills estrictamente aislados para pdfjs-dist bajo Node.js / Vercel ───
interface GlobalWithPolyfills {
  DOMMatrix?: unknown;
  Path2D?: unknown;
}
const g = globalThis as unknown as GlobalWithPolyfills;
if (typeof g.DOMMatrix === 'undefined') {
  g.DOMMatrix = class DOMMatrix {};
}
if (typeof g.Path2D === 'undefined') {
  g.Path2D = class Path2D {};
}

export type ClaseAlumnoF11 = 'BAJA' | 'REGULAR' | 'IRREGULAR' | 'REPROBADO';

export interface AlumnoF11 {
  curp: string;
  nombre: string;
  nia?: string;
  grupo: string;
  promedioGeneral: string;
  situacion: string;
  clase: ClaseAlumnoF11;
  materiasCinco: number;
  calificaciones: Record<string, string>;
}

export interface DetalleGrupoMateria {
  n: number;
  reprobados: number;
  porcentajeReprobacion: number;
}

export interface MetricaAsignaturaF11 {
  materia: string;
  ciclo: string;
  n: number;
  reprobados: number;
  reprobacion_actual: number;
  aprobacion_actual: number;
  reprobacion_meta_sugerida: number;
  aprobacion_meta_sugerida: number;
  confirmada: boolean;
  fuente: string[];
  detallePorGrupo: Record<string, DetalleGrupoMateria>;
}

export interface F11LayoutResult {
  schoolName: string | null;
  schoolCct: string | null;
  cicloEscolar: string | null;
  directorName: string | null;
  supervisorName: string | null;
  controlEscolarName: string | null;
  totalAlumnos: number;
  totalConCalificacion: number;
  bajas: number;
  regulares: number;
  irregulares: number;
  reprobados: number;
  aprobados: number;
  promedioGeneral: number | null;
  porcentajes: {
    aprobados: number;
    regulares: number;
    irregulares: number;
    reprobados: number;
    bajas: number;
  };
  alumnos: AlumnoF11[];
  materias: MetricaAsignaturaF11[];
  promediosPorAsignatura: Record<string, number>;
  grupos: Record<string, number>;
  warnings: string[];
  crossChecks: {
    alumnosConCalificacion: number;
    bajas: number;
    totalAlumnos: number;
  };
}

interface RawPdfItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
  width: number;
  height: number;
}

/**
 * Regla de bandas configurable para cálculo de meta sugerida por asignatura.
 */
export const BANDAS_META_ASIGNATURA = {
  UMBRAL_BAJO: 5.0,
  REDUCCION_MEDIA: 5.0,
  UMBRAL_MEDIO: 20.0,
  REDUCCION_ALTA: 10.0,
} as const;

export function calcularMetaSugeridaBandas(reprobacionActual: number): number {
  if (reprobacionActual <= BANDAS_META_ASIGNATURA.UMBRAL_BAJO) {
    return 0.0;
  }
  if (reprobacionActual <= BANDAS_META_ASIGNATURA.UMBRAL_MEDIO) {
    return Number(Math.max(0, reprobacionActual - BANDAS_META_ASIGNATURA.REDUCCION_MEDIA).toFixed(1));
  }
  return Number(Math.max(0, reprobacionActual - BANDAS_META_ASIGNATURA.REDUCCION_ALTA).toFixed(1));
}

/**
 * Parsea y calcula métricas del formato F11 desde su Buffer digital nativo.
 */
export async function parseF11Layout(buffer: Buffer): Promise<F11LayoutResult> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  const normalizedPath = workerPath.replace(/\\/g, '/');
  const workerUrl = 'file://' + (normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: '',
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  } as unknown as Parameters<typeof pdfjsLib.getDocument>[0]).promise;

  const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
  const groupRegex = /ESTATAL\s+\d+\s+(\d+)\s+([A-Z])\s+MATUTINO/i;

  const warnings: string[] = [];
  const alumnos: AlumnoF11[] = [];
  const materiasMap: Record<
    string,
    { total: number; reprobados: number; sumPromedios: number; detallePorGrupo: Record<string, { n: number; reprobados: number }> }
  > = {};
  const gruposCount: Record<string, number> = {};

  let schoolName: string | null = null;
  let schoolCct: string | null = null;
  let cicloEscolar: string | null = null;
  let directorName: string | null = null;
  let supervisorName: string | null = null;
  let controlEscolarName: string | null = null;

  let currentGroup = '';

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as RawPdfItem[];

    // Extracción de metadatos de cabecera institucional en pág 1
    if (pageNum === 1) {
      const cctItem = items.find(it => /\d{2}[A-Z]{3}\d{4}[A-Z]/.test(it.str.trim()));
      if (cctItem) {
        const matchCct = cctItem.str.trim().match(/\d{2}[A-Z]{3}\d{4}[A-Z]/);
        if (matchCct) schoolCct = matchCct[0];
      }

      // School name sits at y ≈ 525, x ≈ 63 (below label 'NOMBRE OFICIAL...')
      const schoolItem = items.find(
        it => it.transform[5] >= 520 && it.transform[5] <= 530 && it.transform[4] < 400 && it.str.trim().length > 3
      );
      if (schoolItem) {
        schoolName = schoolItem.str.trim();
      }

      // Ciclo escolar at y ≈ 503, x ≈ 925
      const cicloItem = items.find(
        it => it.transform[5] >= 495 && it.transform[5] <= 510 && it.transform[4] >= 900 && /\d{4}\s*-\s*\d{4}/.test(it.str.trim())
      );
      if (cicloItem) {
        const m = cicloItem.str.trim().match(/\d{4}\s*-\s*\d{4}/);
        if (m) cicloEscolar = m[0].replace(/\s+/g, '');
      }
    }

    // Extracción de firmas al pie de páginas resumen (páginas pares o firmas en y < 100)
    const directorLabelItem = items.find(it => it.transform[5] < 60 && it.str.includes('DIRECTOR DE LA ESCUELA'));
    if (directorLabelItem && !directorName) {
      const nameCandidate = items.find(it => 
        Math.abs(it.transform[4] - directorLabelItem.transform[4]) < 50 &&
        it.transform[5] > directorLabelItem.transform[5] &&
        it.transform[5] < directorLabelItem.transform[5] + 20 &&
        it.str.trim().length > 3
      );
      if (nameCandidate) directorName = nameCandidate.str.trim();
    }

    const supervisorLabelItem = items.find(it => it.transform[5] < 60 && it.str.includes('SUPERVISOR ESCOLAR'));
    if (supervisorLabelItem && !supervisorName) {
      const nameCandidate = items.find(it => 
        Math.abs(it.transform[4] - supervisorLabelItem.transform[4]) < 50 &&
        it.transform[5] > supervisorLabelItem.transform[5] &&
        it.transform[5] < supervisorLabelItem.transform[5] + 20 &&
        it.str.trim().length > 3
      );
      if (nameCandidate) supervisorName = nameCandidate.str.trim();
    }

    const controlLabelItem = items.find(it => it.transform[5] < 60 && it.str.includes('RESPONSABLE DE CONTROL ESCOLAR'));
    if (controlLabelItem && !controlEscolarName) {
      const nameCandidate = items.find(it => 
        Math.abs(it.transform[4] - controlLabelItem.transform[4]) < 50 &&
        it.transform[5] > controlLabelItem.transform[5] &&
        it.transform[5] < controlLabelItem.transform[5] + 20 &&
        it.str.trim().length > 3
      );
      if (nameCandidate) controlEscolarName = nameCandidate.str.trim();
    }

    // 1. Detectar encabezado de grupo (fila y ≈ 503)
    const headerRowItems = items
      .filter(it => Math.abs(it.transform[5] - 503) < 10)
      .sort((a, b) => a.transform[4] - b.transform[4]);
    const headerRowStr = headerRowItems.map(it => it.str).join(' ');
    const groupMatch = headerRowStr.match(groupRegex);
    if (groupMatch) {
      currentGroup = `${groupMatch[1]}${groupMatch[2]}`;
    }

    // 2. Encabezados rotados de materias (transform[1] > 0.01)
    const rotated = items.filter(
      it =>
        Math.abs(it.transform[1]) > 0.01 &&
        it.transform[4] >= 480 &&
        it.transform[4] <= 745 &&
        it.str.trim().length > 0
    );
    rotated.sort((a, b) => a.transform[4] - b.transform[4]);

    const headerClusters: { name: string; x: number }[] = [];
    let curCluster: RawPdfItem[] = [];

    for (const r of rotated) {
      const text = r.str.trim();
      if (
        !text ||
        text.includes('PROMEDIO') ||
        text.includes('SITUACIÓN') ||
        text.includes('NÚMERO') ||
        text.includes('PROGRESIVO')
      ) {
        continue;
      }

      if (curCluster.length === 0) {
        curCluster.push(r);
      } else {
        const lastX = curCluster[curCluster.length - 1].transform[4];
        if (Math.abs(r.transform[4] - lastX) <= 10) {
          curCluster.push(r);
        } else {
          const name = curCluster.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
          const avgX = curCluster.reduce((s, it) => s + it.transform[4], 0) / curCluster.length;
          if (name.length > 2) {
            headerClusters.push({ name, x: avgX });
          }
          curCluster = [r];
        }
      }
    }
    if (curCluster.length > 0) {
      const name = curCluster.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      const avgX = curCluster.reduce((s, it) => s + it.transform[4], 0) / curCluster.length;
      if (name.length > 2) {
        headerClusters.push({ name, x: avgX });
      }
    }

    // 3. CURPs en esta página
    const curpItems = items
      .filter(it => curpRegex.test(it.str.trim()))
      .sort((a, b) => b.transform[5] - a.transform[5]);

    if (curpItems.length === 0) continue;

    // 4. Derivar columnas de datos numéricos a partir de los datos reales (x entre 485 y 760)
    const gradeTokens = items.filter(
      it =>
        it.transform[5] < 410 &&
        it.transform[5] > 100 &&
        it.transform[4] >= 485 &&
        it.transform[4] <= 760 &&
        /^(10|[0-9]|Ac|\/)$/.test(it.str.trim())
    );

    const xClusters: { avgX: number; count: number }[] = [];
    const sortedTokens = [...gradeTokens].sort((a, b) => a.transform[4] - b.transform[4]);
    for (const t of sortedTokens) {
      const x = t.transform[4];
      const match = xClusters.find(c => Math.abs(c.avgX - x) <= 8);
      if (match) {
        match.avgX = (match.avgX * match.count + x) / (match.count + 1);
        match.count++;
      } else {
        xClusters.push({ avgX: x, count: 1 });
      }
    }

    const dataCols = xClusters.filter(c => c.count >= 2).sort((a, b) => a.avgX - b.avgX);
    const subjDataCols = dataCols.filter(c => c.avgX < 735);

    // Mapeo zip 1:1 entre columnas numéricas de datos y encabezados de materias (H-230)
    if (subjDataCols.length !== headerClusters.length) {
      warnings.push(
        `Discrepancia en columnas F11 (pág. ${pageNum}): ${subjDataCols.length} columnas de calificaciones vs ${headerClusters.length} encabezados de materias. Requiere revisión.`
      );
    }

    const colToSubjectMap: { avgX: number; subjectName: string }[] = [];
    for (let i = 0; i < Math.min(subjDataCols.length, headerClusters.length); i++) {
      colToSubjectMap.push({
        avgX: subjDataCols[i].avgX,
        subjectName: headerClusters[i].name,
      });
    }

    // 5. Extracción estructurada fila por fila de cada alumno
    for (let cIdx = 0; cIdx < curpItems.length; cIdx++) {
      const curCurp = curpItems[cIdx];
      const topY = curCurp.transform[5] + 5;
      const nextY = cIdx + 1 < curpItems.length ? curpItems[cIdx + 1].transform[5] + 5 : 100;
      const rowItems = items.filter(it => it.transform[5] <= topY && it.transform[5] > nextY);

      // Nombre del alumno: items en x entre 150 y 480
      const nameItems = rowItems
        .filter(it => it.transform[4] >= 150 && it.transform[4] < 480)
        .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
      let rawName = nameItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      rawName = rawName
        .replace(/^\d+\s+/, '')
        .replace(/\s*\*\s*/g, ' ')
        .replace(/\s*\/\s*/g, ' ')
        .trim();

      const niaItem = rowItems.find(
        it => it.transform[4] >= 785 && it.transform[4] <= 815 && /^\d{7,9}$/.test(it.str.trim())
      );
      const nia = niaItem?.str.trim();

      const situacionItems = rowItems.filter(
        it => it.transform[4] >= 760 && it.transform[4] <= 790 && it.str.trim().length > 0
      );
      const situacionStr = situacionItems.map(it => it.str.trim()).join('');

      const promItems = rowItems.filter(
        it => it.transform[4] >= 740 && it.transform[4] <= 758 && it.str.trim().length > 0
      );
      const promStr = promItems.map(it => it.str.trim()).join('');

      const califs: Record<string, string> = {};
      let materiasEnCinco = 0;
      let hasAnyNumeric = false;

      for (const col of colToSubjectMap) {
        const matchItem = rowItems.find(
          it =>
            Math.abs(it.transform[4] - col.avgX) <= 9 &&
            /^(10|[0-9]|Ac|\/)$/.test(it.str.trim())
        );
        if (matchItem) {
          const val = matchItem.str.trim();
          califs[col.subjectName] = val;
          const n = Number(val);
          if (!isNaN(n) && /^(10|[0-9])$/.test(val)) {
            hasAnyNumeric = true;
            if (n === 5) materiasEnCinco++;
          }
        }
      }

      // Regla de clasificación del plantel:
      // a) SITUACIÓN = "B" (o sin calificaciones) -> BAJA
      // b) Promedio numérico -> REGULAR
      // c) Promedio "/" con 1 a 3 materias en 5 -> IRREGULAR
      // d) Promedio "/" con 4 o más materias en 5 -> REPROBADO
      let clase: ClaseAlumnoF11 = 'REGULAR';
      if (situacionStr.includes('B') || !hasAnyNumeric) {
        clase = 'BAJA';
        if (!situacionStr.includes('B')) {
          warnings.push(`sin letra B en SITUACIÓN DEL ALUMNO para CURP ${curCurp.str.trim()}`);
        }
      } else if (promStr === '/' || materiasEnCinco > 0) {
        if (materiasEnCinco >= 4) {
          clase = 'REPROBADO';
        } else {
          clase = 'IRREGULAR';
        }
      } else {
        clase = 'REGULAR';
      }

      alumnos.push({
        curp: curCurp.str.trim(),
        nombre: rawName,
        nia,
        grupo: currentGroup,
        promedioGeneral: promStr,
        situacion: situacionStr,
        clase,
        materiasCinco: materiasEnCinco,
        calificaciones: califs,
      });

      // Acumular estadísticas por materia si no es baja
      if (clase !== 'BAJA') {
        gruposCount[currentGroup] = (gruposCount[currentGroup] || 0) + 1;
        for (const col of colToSubjectMap) {
          // Ignorar materias socioemocionales no numéricas
          if (col.subjectName.toLowerCase().includes('socioemocional')) continue;

          if (!materiasMap[col.subjectName]) {
            materiasMap[col.subjectName] = {
              total: 0,
              reprobados: 0,
              sumPromedios: 0,
              detallePorGrupo: {},
            };
          }
          const mObj = materiasMap[col.subjectName];
          if (!mObj.detallePorGrupo[currentGroup]) {
            mObj.detallePorGrupo[currentGroup] = { n: 0, reprobados: 0 };
          }
          const val = califs[col.subjectName];
          if (val !== undefined && val !== 'Ac') {
            const numVal = Number(val);
            mObj.total++;
            mObj.detallePorGrupo[currentGroup].n++;
            if (!isNaN(numVal)) {
              mObj.sumPromedios += numVal;
            }
            if (numVal === 5) {
              mObj.reprobados++;
              mObj.detallePorGrupo[currentGroup].reprobados++;
            }
          }
        }
      }
    }
  }

  const totalAlumnos = alumnos.length;
  const bajas = alumnos.filter(a => a.clase === 'BAJA').length;
  const regulares = alumnos.filter(a => a.clase === 'REGULAR').length;
  const irregulares = alumnos.filter(a => a.clase === 'IRREGULAR').length;
  const reprobados = alumnos.filter(a => a.clase === 'REPROBADO').length;
  const aprobados = regulares + irregulares;
  const totalConCalificacion = totalAlumnos - bajas;

  const pctAprobados = totalAlumnos > 0 ? Number(((aprobados / totalAlumnos) * 100).toFixed(1)) : 0;
  const pctRegulares = totalAlumnos > 0 ? Number(((regulares / totalAlumnos) * 100).toFixed(1)) : 0;
  const pctIrregulares = totalAlumnos > 0 ? Number(((irregulares / totalAlumnos) * 100).toFixed(1)) : 0;
  const pctReprobados = totalAlumnos > 0 ? Number(((reprobados / totalAlumnos) * 100).toFixed(1)) : 0;
  const pctBajas = totalAlumnos > 0 ? Number(((bajas / totalAlumnos) * 100).toFixed(1)) : 0;

  // Promedios y métricas por asignatura
  const materiasResult: MetricaAsignaturaF11[] = [];
  const promediosPorAsignatura: Record<string, number> = {};

  for (const [mName, stats] of Object.entries(materiasMap)) {
    const repPct = stats.total > 0 ? Number(((stats.reprobados / stats.total) * 100).toFixed(1)) : 0;
    const apPct = Number((100 - repPct).toFixed(1));
    const metaSugerida = calcularMetaSugeridaBandas(repPct);
    const metaAprobacion = Number((100 - metaSugerida).toFixed(1));
    const promMateria = stats.total > 0 ? Number((stats.sumPromedios / stats.total).toFixed(1)) : 0;

    promediosPorAsignatura[mName] = promMateria;

    const detalle: Record<string, DetalleGrupoMateria> = {};
    for (const [grp, gStats] of Object.entries(stats.detallePorGrupo)) {
      detalle[grp] = {
        n: gStats.n,
        reprobados: gStats.reprobados,
        porcentajeReprobacion: gStats.n > 0 ? Number(((gStats.reprobados / gStats.n) * 100).toFixed(1)) : 0,
      };
    }

    materiasResult.push({
      materia: mName,
      ciclo: cicloEscolar || '2025-2026',
      n: stats.total,
      reprobados: stats.reprobados,
      reprobacion_actual: repPct,
      aprobacion_actual: apPct,
      reprobacion_meta_sugerida: metaSugerida,
      aprobacion_meta_sugerida: metaAprobacion,
      confirmada: false,
      fuente: ['F11'],
      detallePorGrupo: detalle,
    });
  }

  // Promedio general de los alumnos con promedio numérico
  const alumnosConPromedio = alumnos.filter(a => a.clase === 'REGULAR' && !isNaN(Number(a.promedioGeneral)));
  const promedioGeneral = alumnosConPromedio.length > 0
    ? Number((alumnosConPromedio.reduce((sum, a) => sum + Number(a.promedioGeneral), 0) / alumnosConPromedio.length).toFixed(1))
    : null;

  return {
    schoolName,
    schoolCct,
    cicloEscolar,
    directorName,
    supervisorName,
    controlEscolarName,
    totalAlumnos,
    totalConCalificacion,
    bajas,
    regulares,
    irregulares,
    reprobados,
    aprobados,
    promedioGeneral,
    porcentajes: {
      aprobados: pctAprobados,
      regulares: pctRegulares,
      irregulares: pctIrregulares,
      reprobados: pctReprobados,
      bajas: pctBajas,
    },
    alumnos,
    materias: materiasResult,
    promediosPorAsignatura,
    grupos: gruposCount,
    warnings,
    crossChecks: {
      alumnosConCalificacion: totalConCalificacion,
      bajas,
      totalAlumnos,
    },
  };
}
