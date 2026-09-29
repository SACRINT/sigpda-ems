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

import type { ExtractedField, ExtractionMethod } from './document-ingestion/types';
import { createExtractedField } from './document-ingestion/types';
export type { ExtractionMethod };

export interface Concentrado911FieldConfidence {
  schoolName: ExtractedField<string>;
  schoolCct: ExtractedField<string>;
  cicloEscolar: ExtractedField<string>;
  tipoReporte: ExtractedField<string>;
  matriculaInicio: ExtractedField<number>;
  matriculaInicioFinDoc: ExtractedField<number>;
  altas: ExtractedField<number>;
  bajas: ExtractedField<number>;
  existencia: ExtractedField<number>;
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
  fieldConfidence: Concentrado911FieldConfidence;
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

  const emptyConfidence = (): Concentrado911FieldConfidence => ({
    schoolName: createExtractedField<string>(null, 'inferred', 0.0),
    schoolCct: createExtractedField<string>(null, 'inferred', 0.0),
    cicloEscolar: createExtractedField<string>(null, 'inferred', 0.0),
    tipoReporte: createExtractedField<string>(null, 'inferred', 0.0),
    matriculaInicio: createExtractedField<number>(null, 'inferred', 0.0),
    matriculaInicioFinDoc: createExtractedField<number>(null, 'inferred', 0.0),
    altas: createExtractedField<number>(null, 'inferred', 0.0),
    bajas: createExtractedField<number>(null, 'inferred', 0.0),
    existencia: createExtractedField<number>(null, 'inferred', 0.0),
  });

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
      fieldConfidence: emptyConfidence(),
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
      fieldConfidence: emptyConfidence(),
    };
  }

  const fullText = items.map(it => it.str).join(' ');

  // 1. CCT
  let schoolCctConfidence = createExtractedField<string>(null, 'inferred', 0.0);
  const cctMatch = fullText.match(/\b\d{2}[A-Z]{3}\d{4}[A-Z]\b/);
  if (cctMatch) {
    schoolCct = cctMatch[0];
    schoolCctConfidence = createExtractedField(schoolCct, 'regex_fulltext', 0.95);
  }

  // 2. Ciclo escolar
  let cicloEscolarConfidence = createExtractedField<string>(null, 'inferred', 0.0);
  const cicloMatch = fullText.match(/\b(\d{4}\s*-\s*\d{4})\b/);
  if (cicloMatch) {
    cicloEscolar = cicloMatch[1].replace(/\s+/g, '');
    cicloEscolarConfidence = createExtractedField(cicloEscolar, 'regex_fulltext', 0.90);
  }

  // 3. Escuela (extracción determinista a partir de etiqueta oficial, sin nombres hardcodeados)
  let schoolNameConfidence = createExtractedField<string>(null, 'inferred', 0.0);
  const labelEscuela = items.find(it =>
    /NOMBRE\s+OFICIAL\s+DE\s+LA\s+ESCUELA/i.test(it.str)
  );
  if (labelEscuela) {
    const candidates = items.filter(
      it => it !== labelEscuela &&
            it.str.trim().length >= 4 &&
            !/CLAVE|CATALOGO|MUNICIPIO|LOCALIDAD|DOMICILIO|CONCEPTO|TURNO|CICLO|SEMESTRE/i.test(it.str) &&
            Math.hypot(it.transform[4] - labelEscuela.transform[4], it.transform[5] - labelEscuela.transform[5]) < 120
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const distA = Math.hypot(a.transform[4] - labelEscuela.transform[4], a.transform[5] - labelEscuela.transform[5]);
        const distB = Math.hypot(b.transform[4] - labelEscuela.transform[4], b.transform[5] - labelEscuela.transform[5]);
        return distA - distB;
      });
      schoolName = candidates[0].str.trim();
      const bestDist = Math.hypot(candidates[0].transform[4] - labelEscuela.transform[4], candidates[0].transform[5] - labelEscuela.transform[5]);
      // H-266: Derivar confianza de la distancia a la etiqueta oficial (máx 120px)
      const schoolNameConf = Math.max(0.65, Number((0.98 - (bestDist / 120) * 0.22).toFixed(2)));
      schoolNameConfidence = createExtractedField(schoolName, 'structural_anchor', schoolNameConf, Math.round(bestDist));
    }
  }

  if (!schoolName) {
    const afterLabel = fullText.match(/NOMBRE OFICIAL DE LA ESCUELA[A-Z\s]*?([A-ZÁÉÍÓÚÑ\s]{4,40}?)(?:DOMICILIO|MUNICIPIO|LOCALIDAD|CLAVE)/i);
    if (afterLabel && afterLabel[1].trim()) {
      schoolName = afterLabel[1].trim();
      schoolNameConfidence = createExtractedField(schoolName, 'regex_fulltext', 0.75);
    }
  }

  // 4. Tipo de reporte (prioridad: options.momento > options.filename > detección estructural)
  const optFilename = (options?.filename || '').toLowerCase();
  const optMomento = (options?.momento || '').toLowerCase();
  let tipoReporteConfidence = createExtractedField<string>('desconocido', 'inferred', 0.0);

  if (optMomento === 'fin_anterior' || optFilename.includes('final') || optFilename.includes('fin')) {
    tipoReporte = 'fin';
    tipoReporteConfidence = createExtractedField('fin', 'inferred', 0.85);
  } else if (optMomento.startsWith('inicio') || optFilename.includes('inicio')) {
    tipoReporte = 'inicio';
    tipoReporteConfidence = createExtractedField('inicio', 'inferred', 0.85);
  } else {
    // Si la fila GENERAL tiene >= 3 columnas numéricas (inicio, altas, bajas, existencia) es FIN
    const generalItem = items.find(it => it.str.trim() === 'GENERAL');
    if (generalItem) {
      const rowY = generalItem.transform[5];
      const rowNums = items.filter(
        it => Math.abs(it.transform[5] - rowY) <= 6 && /^\d+$/.test(it.str.trim())
      );
      tipoReporte = rowNums.length >= 3 ? 'fin' : 'inicio';
      tipoReporteConfidence = createExtractedField(tipoReporte, 'structural_anchor', 0.95, 6);
    } else {
      tipoReporte = 'inicio';
      tipoReporteConfidence = createExtractedField('inicio', 'inferred', 0.60);
    }
  }

  let matriculaInicioFinDocConfidence = createExtractedField<number>(null, 'inferred', 0.0);
  let altasConfidence = createExtractedField<number>(null, 'inferred', 0.0);
  let bajasConfidence = createExtractedField<number>(null, 'inferred', 0.0);
  let existenciaConfidence = createExtractedField<number>(null, 'inferred', 0.0);
  let matriculaInicioConfidence = createExtractedField<number>(null, 'inferred', 0.0);

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
        matriculaInicioFinDocConfidence = createExtractedField(nums[0], 'structural_anchor', 0.95, 6);
        altasConfidence = createExtractedField(nums[1], 'structural_anchor', 0.95, 6);
        bajasConfidence = createExtractedField(nums[2], 'structural_anchor', 0.95, 6);
        existenciaConfidence = createExtractedField(nums[3], 'structural_anchor', 0.95, 6);
      } else if (nums.length === 3) {
        // [alInicio, bajas, existencia]
        matriculaInicioFinDoc = nums[0];
        bajas = nums[1];
        existencia = nums[2];
        matriculaInicioFinDocConfidence = createExtractedField(nums[0], 'structural_anchor', 0.90, 6);
        bajasConfidence = createExtractedField(nums[1], 'structural_anchor', 0.90, 6);
        existenciaConfidence = createExtractedField(nums[2], 'structural_anchor', 0.90, 6);
      }
    }
  } else {
    // Reporte de INICIO: extracción determinista por coordenadas estructurales oficiales (H-223)
    // 1. Localizar concepto "AL INICIO DEL PERIODO"
    const inicioSectionItem = items.find(it => /AL\s+INICIO\s+DEL\s+PERIODO/i.test(it.str));
    // 2. Localizar columna "GENERAL" en la cabecera
    const generalColItem = items.find(it => it.str.trim() === 'GENERAL' && it.transform[5] < 300);

    if (inicioSectionItem) {
      const secY = inicioSectionItem.transform[5];
      const secX = inicioSectionItem.transform[4];
      const totalRowCandidates = items.filter(
        it => it.str.trim() === 'TOTAL' &&
              Math.abs(it.transform[4] - secX) <= 40 &&
              Math.abs(it.transform[5] - secY) <= 150 &&
              Math.abs(it.transform[5] - secY) > 2
      );

      if (totalRowCandidates.length > 0) {
        // En concentrado 911: "AL INICIO DEL PERIODO" tiene NUEVO INGRESO, REPETIDORES y finalmente TOTAL
        totalRowCandidates.sort(
          (a, b) => Math.abs(b.transform[5] - secY) - Math.abs(a.transform[5] - secY)
        );
        const totalRowItem = totalRowCandidates[0];
        const rowY = totalRowItem.transform[5];

        const rowItems = items
          .filter(it => Math.abs(it.transform[5] - rowY) <= 6 && /^\d+$/.test(it.str.trim()))
          .sort((a, b) => a.transform[4] - b.transform[4]);

        if (rowItems.length > 0) {
          if (generalColItem) {
            const sortedByDist = [...rowItems].sort(
              (a, b) => Math.abs(a.transform[4] - generalColItem.transform[4]) - Math.abs(b.transform[4] - generalColItem.transform[4])
            );
            const distToCol = Math.abs(sortedByDist[0].transform[4] - generalColItem.transform[4]);
            if (distToCol <= 8) {
              matriculaInicio = Number(sortedByDist[0].str.trim());
              // H-266: Derivar confianza de la proximidad al centro de la columna GENERAL (máx 8px)
              const matriculaConf = Math.max(0.70, Number((0.98 - (distToCol / 8) * 0.15).toFixed(2)));
              matriculaInicioConfidence = createExtractedField(matriculaInicio, 'cross_validated', matriculaConf, Math.round(distToCol));
            }
          }

          if (matriculaInicio === null) {
            const lastNum = Number(rowItems[rowItems.length - 1].str.trim());
            if (rowItems.length >= 3) {
              const prev1 = Number(rowItems[rowItems.length - 2].str.trim());
              const prev2 = Number(rowItems[rowItems.length - 3].str.trim());
              if (prev1 + prev2 === lastNum && lastNum > 0) {
                matriculaInicio = lastNum;
                matriculaInicioConfidence = createExtractedField(matriculaInicio, 'cross_validated', 0.95);
              } else if (lastNum > 0) {
                matriculaInicio = lastNum;
                matriculaInicioConfidence = createExtractedField(matriculaInicio, 'inferred', 0.70);
              }
            } else if (lastNum > 0) {
              matriculaInicio = lastNum;
              matriculaInicioConfidence = createExtractedField(matriculaInicio, 'inferred', 0.70);
            }
          }
        }
      }
    }

    // Fallback estructural 2: fila horizontal tradicional si el documento tuviera layout tipo FIN
    if (matriculaInicio === null) {
      const generalItem = items.find(it => it.str.trim() === 'GENERAL');
      if (generalItem) {
        const rowY = generalItem.transform[5];
        const rowItems = items
          .filter(it => Math.abs(it.transform[5] - rowY) <= 6 && /^\d+$/.test(it.str.trim()))
          .sort((a, b) => a.transform[4] - b.transform[4]);
        if (rowItems.length >= 3) {
          const last = Number(rowItems[rowItems.length - 1].str.trim());
          if (last > 0) {
            matriculaInicio = last;
            matriculaInicioConfidence = createExtractedField(matriculaInicio, 'coordinate_band', 0.65, 6);
          }
        }
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
    fieldConfidence: {
      schoolName: schoolNameConfidence,
      schoolCct: schoolCctConfidence,
      cicloEscolar: cicloEscolarConfidence,
      tipoReporte: tipoReporteConfidence,
      matriculaInicio: matriculaInicioConfidence,
      matriculaInicioFinDoc: matriculaInicioFinDocConfidence,
      altas: altasConfidence,
      bajas: bajasConfidence,
      existencia: existenciaConfidence,
    },
  };
}
