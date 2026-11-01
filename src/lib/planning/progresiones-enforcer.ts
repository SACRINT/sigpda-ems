import type { ProgramCatalogItem } from '@/lib/db';
import type { ExtractedPdfData } from '@/types/planning';
import {
  cleanLearningOutcomeText,
  distributeProgressionHoursAndCorte,
} from '@/lib/pdf-parser';

export interface CanonicalProgressionItem {
  order: number;
  name: string;
  description: string;
  hours: number;
  corte: 'Corte 1' | 'Corte 2' | 'Corte 3';
  categorias: string[];
  subcategorias: string[];
  metas: string[];
  contenidoFormativo: string;
}

/**
 * Construye la lista canónica de Progresiones Oficiales (verbatim) a partir de
 * `officialProgram` (prioritario) o `extractedData` (fallback).
 */
export function buildCanonicalProgresionesList(
  officialProgram?: ProgramCatalogItem | null,
  extractedData?: ExtractedPdfData | null
): CanonicalProgressionItem[] {
  const rawActs: unknown[] =
    officialProgram?.activities &&
    Array.isArray(officialProgram.activities) &&
    officialProgram.activities.length > 0
      ? (officialProgram.activities as unknown[])
      : extractedData?.activities && Array.isArray(extractedData.activities)
        ? (extractedData.activities as unknown[])
        : [];

  if (rawActs.length === 0) return [];

  const totalHours = officialProgram?.total_hours || extractedData?.totalHours || 54;
  const totalN = rawActs.length;

  const rawContenidos: unknown[] = Array.isArray(officialProgram?.contenidos_formativos)
    ? (officialProgram.contenidos_formativos as unknown[])
    : Array.isArray(extractedData?.contenidosFormativos)
      ? (extractedData.contenidosFormativos as unknown[])
      : [];

  return rawActs.map((raw, idx) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const order = Number(r.order) || idx + 1;
    const rawDesc = String(r.description || r.name || '')
      .replace(/^Progresi[óo]n\s*\d+\s*[:.]?\s*/i, '')
      .trim();
    const fullName = `Progresión ${order}: ${rawDesc}`;
    const { hours, corte } = distributeProgressionHoursAndCorte(idx, totalN, totalHours);

    const cfItem = (rawContenidos[idx] && typeof rawContenidos[idx] === 'object'
      ? rawContenidos[idx]
      : {}) as Record<string, unknown>;

    const categorias = Array.isArray(r.categorias)
      ? (r.categorias as string[]).filter(Boolean)
      : Array.isArray(cfItem.categorias)
        ? (cfItem.categorias as string[]).filter(Boolean)
        : [];

    const subcategorias = Array.isArray(r.subcategorias)
      ? (r.subcategorias as string[]).filter(Boolean)
      : Array.isArray(cfItem.subcategorias)
        ? (cfItem.subcategorias as string[]).filter(Boolean)
        : [];

    const metas = Array.isArray(r.metas)
      ? (r.metas as string[]).filter(Boolean)
      : Array.isArray(cfItem.metas)
        ? (cfItem.metas as string[]).filter(Boolean)
        : [];

    const parts: string[] = [];
    if (categorias.length > 0) parts.push(`Categorías: ${categorias.join('; ')}`);
    if (subcategorias.length > 0) parts.push(`Subcategorías: ${subcategorias.join('; ')}`);
    if (metas.length > 0) parts.push(`Metas: ${metas.join(' ')}`);

    const contenidoFormativo =
      parts.length > 0
        ? parts.join(' | ')
        : typeof r.contenidoFormativo === 'string' && r.contenidoFormativo.trim().length > 0
          ? r.contenidoFormativo.trim()
          : '';

    return {
      order,
      name: fullName,
      description: rawDesc,
      hours,
      corte,
      categorias,
      subcategorias,
      metas,
      contenidoFormativo,
    };
  });
}

/**
 * Construye el resumen jerárquico real de Categorías y Subcategorías de la UAC
 * para `sectionII.categoriasSubcategorias` (sin mezclar nunca con learningOutcomes).
 */
export function buildUacCategoriasSubcategoriasSummary(
  canonicalProgs: CanonicalProgressionItem[]
): string[] {
  const allCats = new Set<string>();
  const allSubcats = new Set<string>();

  for (const p of canonicalProgs) {
    for (const c of p.categorias) allCats.add(c.trim());
    for (const s of p.subcategorias) allSubcats.add(s.trim());
  }

  const summary: string[] = [];
  if (allCats.size > 0) {
    summary.push(`Categorías: ${Array.from(allCats).join(' | ')}`);
  }
  if (allSubcats.size > 0) {
    summary.push(`Subcategorías: ${Array.from(allSubcats).join(' | ')}`);
  }
  return summary;
}

/**
 * Repara deterministamente `extractedData` usando el programa oficial de `programs_catalog`
 * cuando corresponde a 5.º o 6.º semestre.
 */
export function repairExtractedDataWithCatalog(
  extractedData: ExtractedPdfData,
  officialProgram?: ProgramCatalogItem | null,
  semester?: number,
  component?: string
): ExtractedPdfData {
  const sem = Number(semester || officialProgram?.semester || 0);
  if (sem < 5 || component === 'laboral' || !officialProgram) {
    return extractedData;
  }

  const canonicalProgs = buildCanonicalProgresionesList(officialProgram, extractedData);
  if (canonicalProgs.length === 0) {
    return extractedData;
  }

  const cleanOutcome = officialProgram.learning_outcome
    ? cleanLearningOutcomeText(officialProgram.learning_outcome)
    : cleanLearningOutcomeText(extractedData.learningOutcome || '');

  return {
    ...extractedData,
    uacName: officialProgram.uac_name || extractedData.uacName,
    totalHours: officialProgram.total_hours || extractedData.totalHours || 54,
    learningOutcome: cleanOutcome || extractedData.learningOutcome,
    activities: canonicalProgs.map(p => ({
      order: p.order,
      name: p.name,
      description: p.description,
      hours: p.hours,
      corte: p.corte,
      categorias: p.categorias,
      subcategorias: p.subcategorias,
      metas: p.metas,
      contenidoFormativo: p.contenidoFormativo,
    })),
    contenidosFormativos: canonicalProgs.map(p => ({
      numero: p.order,
      proposito: p.name,
      progresion: p.name,
      categorias: p.categorias,
      subcategorias: p.subcategorias,
      metas: p.metas,
      contenidos: [
        ...p.categorias.map(c => `Categoría: ${c}`),
        ...p.subcategorias.map(s => `Subcategoría: ${s}`),
        ...p.metas.map(m => `Meta: ${m}`),
      ],
    })),
  };
}

/**
 * Post-procesador determinista que garantiza que en 5.º y 6.º semestre (modelo de Progresiones):
 * 1) `sectionII.activities` y `sectionIV.activities` tengan EXACTAMENTE N bloques (1 por Progresión oficial).
 * 2) El campo `name` de cada bloque sea COPIA VERBATIM del texto oficial de la Progresión (cero rangos como "Progresión 3 a 7").
 * 3) El campo `contenidoFormativo` de cada bloque contenga las Categorías, Subcategorías y Metas reales.
 * 4) `sectionII.categoriasSubcategorias` contenga únicamente las Categorías y Subcategorías reales de la UAC.
 */
export function enforceOfficialProgresiones(
  parsedContent: Record<string, unknown>,
  officialProgram?: ProgramCatalogItem | null,
  extractedData?: ExtractedPdfData | null,
  semester?: number,
  component?: string
): Record<string, unknown> {
  const sem = Number(semester || officialProgram?.semester || 0);
  if (sem < 5 || component === 'laboral') {
    return parsedContent;
  }

  const canonicalProgs = buildCanonicalProgresionesList(officialProgram, extractedData);
  if (canonicalProgs.length === 0) {
    return parsedContent;
  }

  parsedContent.model_type = 'progresiones';

  // ── 1. Reparar Sección II ───────────────────────────────────────────────────
  const s2 = ((parsedContent.sectionII && typeof parsedContent.sectionII === 'object')
    ? parsedContent.sectionII
    : {}) as Record<string, unknown>;

  if (officialProgram?.learning_outcome) {
    s2.learningOutcome = cleanLearningOutcomeText(officialProgram.learning_outcome);
  } else if (typeof s2.learningOutcome === 'string') {
    s2.learningOutcome = cleanLearningOutcomeText(s2.learningOutcome);
  }

  s2.totalHours = officialProgram?.total_hours || extractedData?.totalHours || 54;
  s2.activities = canonicalProgs.map(p => ({
    order: p.order,
    name: p.name,
    description: p.description,
    hours: p.hours,
    corte: p.corte,
    categorias: p.categorias,
    subcategorias: p.subcategorias,
    metas: p.metas,
    contenidoFormativo: p.contenidoFormativo,
  }));

  const uacCatSubcatSummary = buildUacCategoriasSubcategoriasSummary(canonicalProgs);
  if (uacCatSubcatSummary.length > 0) {
    s2.categoriasSubcategorias = uacCatSubcatSummary;
  }
  parsedContent.sectionII = s2;

  // ── 2. Reparar Sección IV (1 bloque por Progresión, Verbatim + Metas/Categorías/Subcategorías) ──
  const s4 = ((parsedContent.sectionIV && typeof parsedContent.sectionIV === 'object')
    ? parsedContent.sectionIV
    : {}) as Record<string, unknown>;

  const existingS4Acts = Array.isArray(s4.activities)
    ? (s4.activities as Array<Record<string, unknown>>)
    : [];

  const uacTitle = officialProgram?.uac_name || extractedData?.uacName || 'la UAC';

  const enforcedS4Activities = canonicalProgs.map((prog, idx) => {
    // Buscar si ya existe un bloque específico para esta progresión
    const exactMatch =
      existingS4Acts.length === canonicalProgs.length
        ? existingS4Acts[idx]
        : existingS4Acts.find(a => {
            const n = String(a?.name || '');
            // Evitar coincidir con rangos tipo "Progresión 3 a 7"
            if (/Progresi[óo]n\s*\d+\s*(?:a|al|-|–)\s*\d+/i.test(n)) return false;
            const m = n.match(/Progresi[óo]n\s*(\d+)/i);
            return m && parseInt(m[1], 10) === prog.order;
          });

    // Fallback a bloque del mismo Corte si la IA colapsó en 3 bloques
    const corteMatch =
      exactMatch ||
      existingS4Acts.find(a => String(a?.corte || '').toLowerCase() === prog.corte.toLowerCase()) ||
      existingS4Acts[Math.min(existingS4Acts.length - 1, Math.floor((idx * existingS4Acts.length) / canonicalProgs.length))] ||
      {};

    const baseBlock = { ...corteMatch };
    const isSharedFallback = !exactMatch && existingS4Acts.length < canonicalProgs.length;

    const normalizePhaseObject = (
      rawPhase: unknown,
      phaseLabel: 'Apertura' | 'Desarrollo' | 'Cierre',
      defaultProcesses: string,
      defaultMaterials: string
    ): { activities: string; processes: string; materials: string } => {
      const pObj = (rawPhase && typeof rawPhase === 'object' && !Array.isArray(rawPhase)
        ? rawPhase
        : {}) as Record<string, unknown>;

      let actText = '';
      if (typeof pObj.activities === 'string' && pObj.activities.trim().length > 0) {
        actText = pObj.activities.trim();
      } else if (Array.isArray(rawPhase)) {
        actText = rawPhase.map(x => String(x || '').trim()).filter(Boolean).join('\n');
      } else if (typeof rawPhase === 'string') {
        actText = rawPhase.trim();
      }

      // Erradicar cualquier rango colapsado como "Progresión 3 a 7"
      actText = actText.replace(
        /Progresi[óo]n(?:es)?\s*\d+\s*(?:a|al|-|–)\s*\d+/gi,
        `Progresión ${prog.order}`
      );

      if (!actText) {
        actText = `[${phaseLabel} — Progresión ${prog.order}] Desarrollo situado en torno a: ${prog.description}`;
      } else if (isSharedFallback && !actText.includes(`Progresión ${prog.order}`)) {
        actText = `[Progresión ${prog.order}: ${prog.description}] ${actText}`;
      }

      return {
        activities: actText,
        processes:
          typeof pObj.processes === 'string' && pObj.processes.trim().length > 0
            ? pObj.processes.trim()
            : defaultProcesses,
        materials:
          typeof pObj.materials === 'string' && pObj.materials.trim().length > 0
            ? pObj.materials.trim()
            : defaultMaterials,
      };
    };

    const existingSaberes = (baseBlock.saberes && typeof baseBlock.saberes === 'object'
      ? baseBlock.saberes
      : {}) as Record<string, unknown>;

    const catText = prog.categorias.length > 0 ? prog.categorias.join(', ') : 'Categorías oficiales MCCEMS';
    const subcatText = prog.subcategorias.length > 0 ? prog.subcategorias.join(', ') : 'Subcategorías oficiales MCCEMS';
    const metaText = prog.metas.length > 0 ? prog.metas[0] : prog.description;

    const saberes = {
      saber: isSharedFallback || !existingSaberes.saber
        ? `Fundamentos conceptuales y formales de la Progresión ${prog.order}: ${prog.description} articulando ${catText} (${subcatText}).`
        : String(existingSaberes.saber),
      saberHacer: isSharedFallback || !existingSaberes.saberHacer
        ? `Aplicación procedimental y resolución situada en ${uacTitle} para cumplir la meta: ${metaText}`
        : String(existingSaberes.saberHacer),
      saberSer: typeof existingSaberes.saberSer === 'string' && existingSaberes.saberSer.trim().length > 0
        ? existingSaberes.saberSer
        : `Rigor metodológico, pensamiento crítico, trabajo colaborativo e inclusión en el análisis de problemáticas del contexto comunitario.`,
    };

    const apertura = normalizePhaseObject(
      baseBlock.apertura,
      'Apertura',
      'asombro, problematizacion',
      'Cuaderno de notas, pizarrón y guía de problematización situada.'
    );
    const ejecucion = normalizePhaseObject(
      baseBlock.ejecucion || baseBlock.desarrollo,
      'Desarrollo',
      'traduccion, conceptualizacion, razonamiento, indagacion',
      'Cuaderno de trabajo, instrumentos de trazo/cálculo y fichas técnicas.'
    );
    const conclusion = normalizePhaseObject(
      baseBlock.conclusion || baseBlock.cierre,
      'Cierre',
      'reflexion, transferencia',
      'Portafolio de evidencias e instrumento de evaluación formativa.'
    );

    return {
      ...baseBlock,
      order: prog.order,
      name: prog.name,
      description: prog.description,
      hours: prog.hours,
      corte: prog.corte,
      methodology: typeof baseBlock.methodology === 'string' && baseBlock.methodology.trim().length > 0
        ? baseBlock.methodology
        : 'Aprendizaje Basado en Proyectos (ABP) / STEAM',
      categorias: prog.categorias,
      subcategorias: prog.subcategorias,
      metas: prog.metas,
      contenidoFormativo: prog.contenidoFormativo || String(baseBlock.contenidoFormativo || ''),
      saberes,
      apertura,
      ejecucion,
      conclusion,
      evidence:
        typeof baseBlock.evidence === 'string' && baseBlock.evidence.trim().length > 0
          ? isSharedFallback
            ? `Evidencia Progresión ${prog.order} (${prog.subcategorias[0] || prog.categorias[0] || uacTitle}): ${String(baseBlock.evidence).replace(/^Evidencia\s+Progresi[óo]n\s*\d+\s*:\s*/i, '')}`
            : baseBlock.evidence
          : `Producto integrador de la Progresión ${prog.order} evaluado conforme a ${prog.categorias.join(' y ') || 'criterios MCCEMS'}.`,
    };
  });

  s4.activities = enforcedS4Activities;
  parsedContent.sectionIV = s4;

  return parsedContent;
}
