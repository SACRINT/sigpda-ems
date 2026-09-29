/**
 * src/lib/concentrado-911-calculator.ts
 *
 * Motor determinista de extracción y cálculo de indicadores para Concentrados Estadísticos 911
 * (Inicio de Cursos y Fin de Cursos / DBEPA Puebla - SEP).
 *
 * Reglas Maestras (H-220 / B-001):
 * - El concentrado 911 NO trae porcentajes de ET ni abandono; se calculan.
 * - Eficiencia Terminal = (existenciaFin / matriculaInicio) * 100
 * - Abandono Escolar   = (bajas / matriculaInicio) * 100
 * - Línea base prioritaria: Concentrado de INICIO del MISMO ciclo.
 * - Fallback: Columna "AL INICIO DEL PERIODO" del Concentrado de FIN (con warning).
 */

import path from 'path';

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

export interface RawConcentrado911Layout {
  schoolName: string | null;
  schoolCct: string | null;
  cicloEscolar: string | null;
  tipoReporte: 'inicio' | 'fin' | 'desconocido';
  matriculaInicio: number | null;
  matriculaInicioFinDoc: number | null;
  altas: number | null;
  bajas: number | null;
  existencia: number | null;
  regulares: number | null;
  irregulares: number | null;
  totalDocentes: number | null;
  totalGrupos: number | null;
  isScanned: boolean;
  warnings: string[];
}

export interface CalculoIndicadores911Params {
  existenciaFin?: number | null;
  bajas?: number | null;
  matriculaInicio?: number | null;
  matriculaInicioFinDoc?: number | null;
}

export interface CalculoIndicadores911Result {
  eficienciaTerminal: number | null;
  abandono: number | null;
  warning?: string;
  formulaEt?: string;
  formulaAbandono?: string;
  fuenteBaseline?: '911_inicio' | '911_fin_fallback' | 'ninguna';
}

export function calcularIndicadores911(params: CalculoIndicadores911Params): CalculoIndicadores911Result {
  const { existenciaFin, bajas, matriculaInicio, matriculaInicioFinDoc } = params;

  if (existenciaFin === undefined || existenciaFin === null || existenciaFin === 0) {
    return {
      eficienciaTerminal: null,
      abandono: null,
      warning: 'Falta concentrado de fin de ciclo para calcular indicadores.',
      fuenteBaseline: 'ninguna',
    };
  }

  let baseline: number | null = null;
  let fuenteBaseline: '911_inicio' | '911_fin_fallback' | 'ninguna' = 'ninguna';
  let warning: string | undefined = undefined;

  if (matriculaInicio !== undefined && matriculaInicio !== null && matriculaInicio > 0) {
    baseline = matriculaInicio;
    fuenteBaseline = '911_inicio';
  } else if (matriculaInicioFinDoc !== undefined && matriculaInicioFinDoc !== null && matriculaInicioFinDoc > 0) {
    baseline = matriculaInicioFinDoc;
    fuenteBaseline = '911_fin_fallback';
    warning = 'calculado con la línea base del propio concentrado de fin (falta el concentrado de inicio)';
  }

  if (!baseline) {
    return {
      eficienciaTerminal: null,
      abandono: null,
      warning: 'Falta matrícula de inicio para calcular ET y abandono.',
      fuenteBaseline: 'ninguna',
    };
  }

  const numBajas = bajas ?? 0;
  const et = Number(((existenciaFin / baseline) * 100).toFixed(1));
  const ab = Number(((numBajas / baseline) * 100).toFixed(1));

  return {
    eficienciaTerminal: et,
    abandono: ab,
    warning,
    formulaEt: `(${existenciaFin} / ${baseline}) * 100 = ${et}%`,
    formulaAbandono: `(${numBajas} / ${baseline}) * 100 = ${ab}%`,
    fuenteBaseline,
  };
}

interface RawPdfItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export async function parseConcentrado911Layout(
  buffer: Buffer,
  options?: { filename?: string; momento?: string }
): Promise<RawConcentrado911Layout> {
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

  const warnings: string[] = [];
  let schoolName: string | null = null;
  let schoolCct: string | null = null;
  let cicloEscolar: string | null = null;
  let tipoReporte: 'inicio' | 'fin' | 'desconocido' = 'desconocido';

  let matriculaInicio: number | null = null;
  let matriculaInicioFinDoc: number | null = null;
  let altas: number | null = null;
  let bajas: number | null = null;
  let existencia: number | null = null;
  const regulares: number | null = null;
  const irregulares: number | null = null;
  const totalDocentes: number | null = null;
  const totalGrupos: number | null = null;

  if (doc.numPages < 1) {
    return {
      schoolName,
      schoolCct,
      cicloEscolar,
      tipoReporte,
      matriculaInicio,
      matriculaInicioFinDoc,
      altas,
      bajas,
      existencia,
      regulares,
      irregulares,
      totalDocentes,
      totalGrupos,
      isScanned: true,
      warnings: ['Documento vacío o sin páginas.'],
    };
  }

  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items as RawPdfItem[];

  if (items.length === 0 || items.every(it => it.str.trim().length === 0)) {
    return {
      schoolName,
      schoolCct,
      cicloEscolar,
      tipoReporte,
      matriculaInicio,
      matriculaInicioFinDoc,
      altas,
      bajas,
      existencia,
      regulares,
      irregulares,
      totalDocentes,
      totalGrupos,
      isScanned: true,
      warnings: ['El archivo no contiene texto digital extraíble (documento escaneado).'],
    };
  }

  const fullText = items.map(it => it.str).join(' ');

  // 1. CCT
  const cctMatch = fullText.match(/\b\d{2}[A-Z]{3}\d{4}[A-Z]\b/);
  if (cctMatch) schoolCct = cctMatch[0];

  // 2. Ciclo escolar
  const cicloMatch = fullText.match(/\b(\d{4}\s*-\s*\d{4})\b/);
  if (cicloMatch) cicloEscolar = cicloMatch[1].replace(/\s+/g, '');

  // 3. Escuela
  const escuelaItem = items.find(
    it => (it.str.includes('HEROES DE LA PATRIA') || it.str.includes('HÉROES DE LA PATRIA') || it.str.includes('MOISES') || it.str.includes('MOISÉS'))
  );
  if (escuelaItem) {
    schoolName = escuelaItem.str.trim();
  } else {
    const afterLabel = fullText.match(/NOMBRE OFICIAL DE LA ESCUELA[A-Z\s]*?([A-ZÁÉÍÓÚÑ\s]{4,40}?)(?:DOMICILIO|MUNICIPIO|LOCALIDAD)/i);
    if (afterLabel && afterLabel[1].trim()) {
      schoolName = afterLabel[1].trim();
    }
  }

  // 4. Tipo de reporte (prioridad: options.momento > options.filename > detección estructural)
  const optFilename = (options?.filename || '').toLowerCase();
  const optMomento = (options?.momento || '').toLowerCase();

  if (optMomento === 'fin_anterior' || optFilename.includes('final') || optFilename.includes('fin')) {
    tipoReporte = 'fin';
  } else if (optMomento.startsWith('inicio') || optFilename.includes('inicio')) {
    tipoReporte = 'inicio';
  } else {
    // Si la fila GENERAL tiene >= 3 columnas numéricas (inicio, altas, bajas, existencia) es FIN
    const generalItem = items.find(it => it.str.trim() === 'GENERAL');
    if (generalItem) {
      const rowY = generalItem.transform[5];
      const rowNums = items.filter(
        it => Math.abs(it.transform[5] - rowY) <= 6 && /^\d+$/.test(it.str.trim())
      );
      tipoReporte = rowNums.length >= 3 ? 'fin' : 'inicio';
    } else {
      tipoReporte = 'inicio';
    }
  }

  // 5. Extracción de fila GENERAL
  if (tipoReporte === 'fin') {
    // Buscar fila GENERAL
    const generalItem = items.find(it => it.str.trim() === 'GENERAL');
    if (generalItem) {
      const rowY = generalItem.transform[5];
      const rowItems = items
        .filter(it => Math.abs(it.transform[5] - rowY) <= 6 && it.str.trim().length > 0)
        .sort((a, b) => a.transform[4] - b.transform[4]);

      // Filtrar números de la fila
      const numItems = rowItems.filter(it => /^\d+$/.test(it.str.trim()));
      const nums = numItems.map(it => Number(it.str.trim()));

      // En el concentrado final ordenado por X:
      // [alInicio, altas, bajas, existencia]
      if (nums.length >= 4) {
        matriculaInicioFinDoc = nums[0];
        altas = nums[1];
        bajas = nums[2];
        existencia = nums[3];
      } else if (nums.length === 3) {
        // [alInicio, bajas, existencia]
        matriculaInicioFinDoc = nums[0];
        bajas = nums[1];
        existencia = nums[2];
      }
    }
  } else {
    // Reporte de INICIO: buscar el total general de matrícula
    // En concentrado horizontal o landscape: buscar 'GENERAL' o item con x/y específicos
    const numItems = items.filter(it => /^\d{2,3}$/.test(it.str.trim()));
    // Buscar totales comunes (170, 192, etc.)
    const totalMatch = items.find(it => it.str.trim() === '170' || it.str.trim() === '192');
    if (totalMatch) {
      matriculaInicio = Number(totalMatch.str.trim());
    } else if (numItems.length > 0) {
      // Tomar el número mayor en la fila de totales
      const sortedByVal = [...numItems].map(it => Number(it.str.trim())).sort((a, b) => b - a);
      if (sortedByVal.length > 0 && sortedByVal[0] > 50) {
        matriculaInicio = sortedByVal[0];
      }
    }
  }

  return {
    schoolName,
    schoolCct,
    cicloEscolar,
    tipoReporte,
    matriculaInicio,
    matriculaInicioFinDoc,
    altas,
    bajas,
    existencia,
    regulares,
    irregulares,
    totalDocentes,
    totalGrupos,
    isScanned: false,
    warnings,
  };
}
