import type { ProgramCatalogItem } from '@/lib/db';
import type { ExtractedPdfData } from '@/types/planning';
import {
  cleanLearningOutcomeText,
  distributeProgressionHoursAndCorte,
} from '@/lib/pdf-parser';
import { resolveWeeklyHours, SEMESTER_WEEKS } from '@/lib/guide-engine/content-budget';

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

  const declaredHours = rawActs.reduce<number>((sum, act) => {
    const hours = Number(
      (act && typeof act === 'object' ? (act as Record<string, unknown>) : {}).hours
    );
    return sum + (Number.isFinite(hours) && hours > 0 ? hours : 0);
  }, 0);
  const totalHours =
    officialProgram?.total_hours ||
    extractedData?.totalHours ||
    declaredHours ||
    resolveWeeklyHours() * SEMESTER_WEEKS;
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

  const canonicalHours = canonicalProgs.reduce((sum, p) => sum + (Number(p.hours) || 0), 0);

  return {
    ...extractedData,
    uacName: officialProgram.uac_name || extractedData.uacName,
    totalHours:
      officialProgram.total_hours ||
      extractedData.totalHours ||
      canonicalHours ||
      resolveWeeklyHours() * SEMESTER_WEEKS,
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

  s2.totalHours =
    officialProgram?.total_hours ||
    extractedData?.totalHours ||
    canonicalProgs.reduce((sum, p) => sum + (Number(p.hours) || 0), 0) ||
    resolveWeeklyHours() * SEMESTER_WEEKS;
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

    // Sin placeholders: si el programa oficial no trae Categorías/Subcategorías, se omite la cláusula.
    const catText = prog.categorias.join(', ');
    const subcatText = prog.subcategorias.join(', ');
    const articulacion = catText
      ? ` articulando ${catText}${subcatText ? ` (${subcatText})` : ''}`
      : subcatText
        ? ` articulando ${subcatText}`
        : '';
    const metaText = prog.metas.length > 0 ? prog.metas[0] : prog.description;

    const saberes = {
      saber: isSharedFallback || !existingSaberes.saber
        ? `Fundamentos conceptuales y formales de la Progresión ${prog.order}: ${prog.description}${articulacion}.`
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
          : `Producto integrador de la Progresión ${prog.order}${prog.categorias.length > 0 ? ` evaluado conforme a ${prog.categorias.join(' y ')}` : ''}.`,
    };
  });

  s4.activities = enforcedS4Activities;
  parsedContent.sectionIV = s4;

  return parsedContent;
}

/**
 * Garantiza deterministamente que `sectionIV.activities` contenga SIEMPRE >= 3 actividades completas
 * (con apertura, ejecucion, conclusion y taxonomía de 3 saberes) en asignaturas de 1.º a 4.º semestre
 * y Formación Laboral cuando el modelo de IA colapsa por error las actividades en 1 o 2 elementos.
 * Si la IA ya generó >= 3 actividades válidas, respeta íntegramente sus elementos y solo repara
 * cualquier subcampo vacío para evitar rechazos fail-closed innecesarios en Anexo 12 (`iv_secuencia`,
 * `iv_fases`, `iv_tres_saberes`).
 */
export function enforceMinimumSecuenciaActivities(
  parsedContent: Record<string, unknown>,
  officialProgram?: ProgramCatalogItem | null,
  extractedData?: ExtractedPdfData | null,
  options?: {
    uacName?: string;
    semester?: number;
    component?: string;
    totalHours?: number;
    metodologiaActiva?: string;
  }
): Record<string, unknown> {
  const sem = Number(options?.semester || officialProgram?.semester || 1);
  const comp = String(options?.component || officialProgram?.component || 'fundamental').toLowerCase();
  // 5.º y 6.º semestre no laborales ya son atendidos por enforceOfficialProgresiones
  if (sem >= 5 && !comp.includes('laboral')) {
    return parsedContent;
  }

  const s4 = ((parsedContent.sectionIV && typeof parsedContent.sectionIV === 'object')
    ? parsedContent.sectionIV
    : {}) as Record<string, unknown>;
  const existingActs = Array.isArray(s4.activities)
    ? (s4.activities as Array<Record<string, unknown>>)
    : [];

  const uacTitle =
    options?.uacName ||
    officialProgram?.uac_name ||
    extractedData?.uacName ||
    String((parsedContent.sectionI as Record<string, unknown> | undefined)?.uacName || 'la UAC');
  const defaultMethodology =
    options?.metodologiaActiva ||
    String((parsedContent.sectionI as Record<string, unknown> | undefined)?.metodologiaActiva || '') ||
    'Aprendizaje Basado en Proyectos (ABP)';
  const isLaboral = comp.includes('laboral');

  const ensureCompleteActivity = (
    raw: Record<string, unknown>,
    fallbackTitle: string,
    fallbackContenido: string,
    corteLabel: string,
    fallbackHours: number
  ): Record<string, unknown> => {
    const title = typeof raw.name === 'string' && raw.name.trim().length >= 3 ? raw.name.trim() : fallbackTitle;
    const contenido =
      typeof raw.contenidoFormativo === 'string' && raw.contenidoFormativo.trim().length >= 5
        ? raw.contenidoFormativo.trim()
        : fallbackContenido || title;

    const ensurePhase = (
      phaseRaw: unknown,
      phaseName: 'Apertura' | 'Desarrollo' | 'Cierre',
      defaultProc: string,
      defaultMat: string,
      defaultDesc: string
    ) => {
      const pObj = (phaseRaw && typeof phaseRaw === 'object' && !Array.isArray(phaseRaw)
        ? phaseRaw
        : {}) as Record<string, unknown>;
      const actStr =
        typeof pObj.activities === 'string' && pObj.activities.trim().length >= 12
          ? pObj.activities.trim()
          : typeof phaseRaw === 'string' && phaseRaw.trim().length >= 12
            ? phaseRaw.trim()
            : `${phaseName} situada (${title}): ${defaultDesc}`;
      return {
        activities: actStr,
        processes:
          typeof pObj.processes === 'string' && pObj.processes.trim().length >= 3
            ? pObj.processes.trim()
            : defaultProc,
        materials:
          typeof pObj.materials === 'string' && pObj.materials.trim().length >= 3
            ? pObj.materials.trim()
            : defaultMat,
      };
    };

    const rawSab = (raw.saberes && typeof raw.saberes === 'object' ? raw.saberes : {}) as Record<string, unknown>;
    const saberes = {
      saber:
        typeof rawSab.saber === 'string' && rawSab.saber.trim().length >= 8
          ? rawSab.saber.trim()
          : `Fundamentos conceptuales y teóricos de ${title} en ${uacTitle}.`,
      saberHacer:
        typeof rawSab.saberHacer === 'string' && rawSab.saberHacer.trim().length >= 8
          ? rawSab.saberHacer.trim()
          : `Aplicación práctica, análisis contextualizado y elaboración de evidencias sobre ${contenido}.`,
      saberSer:
        typeof rawSab.saberSer === 'string' && rawSab.saberSer.trim().length >= 8
          ? rawSab.saberSer.trim()
          : `Pensamiento crítico, participación dialógica, ética y trabajo colaborativo en la comunidad escolar.`,
    };

    return {
      ...raw,
      name: title,
      hours: Number(raw.hours) > 0 ? Number(raw.hours) : fallbackHours,
      corte: typeof raw.corte === 'string' && raw.corte.trim() ? raw.corte.trim() : corteLabel,
      methodology:
        typeof raw.methodology === 'string' && raw.methodology.trim().length >= 3
          ? raw.methodology.trim()
          : defaultMethodology,
      contenidoFormativo: contenido,
      saberes,
      apertura: ensurePhase(
        raw.apertura,
        'Apertura',
        'asombro, problematizacion',
        'Cuaderno de notas, pizarrón y guía de exploración diagnóstica.',
        `exploración de saberes previos y problematización comunitaria en torno a ${contenido}.`
      ),
      ejecucion: ensurePhase(
        raw.ejecucion || raw.desarrollo,
        'Desarrollo',
        'traduccion, conceptualizacion, razonamiento, indagacion',
        'Cuaderno de trabajo, lecturas de análisis y fichas de trabajo colaborativo.',
        `análisis conceptual, práctica guiada y construcción de evidencias sobre ${contenido}.`
      ),
      conclusion: ensurePhase(
        raw.conclusion || raw.cierre,
        'Cierre',
        'reflexion, transferencia',
        'Instrumento de evaluación formativa y portafolio de evidencias.',
        `socialización de hallazgos, coevaluación formativa y reflexión metacognitiva de ${title}.`
      ),
    };
  };

  const totalHours = Number(options?.totalHours || officialProgram?.total_hours || extractedData?.totalHours || 54);
  const s2 = ((parsedContent.sectionII && typeof parsedContent.sectionII === 'object')
    ? parsedContent.sectionII
    : {}) as Record<string, unknown>;

  const ensureSectionIIIntegrity = (finalS4Acts: Array<Record<string, unknown>>) => {
    const rawPurpose = typeof s2.purpose === 'string' ? s2.purpose.trim() : '';
    if (rawPurpose.length < 40) {
      const candidateOutcome =
        cleanLearningOutcomeText(officialProgram?.learning_outcome || extractedData?.learningOutcome || '');
      s2.purpose =
        candidateOutcome.length >= 40
          ? candidateOutcome
          : `Desarrollar aprendizajes integrales, pensamiento crítico y saberes situados en ${uacTitle} articulados al contexto comunitario escolar.`;
    }
    const existingOutcomes = Array.isArray(s2.learningOutcomes)
      ? (s2.learningOutcomes as unknown[]).filter((x) => typeof x === 'string' && x.trim().length >= 5)
      : [];
    if (existingOutcomes.length === 0) {
      s2.learningOutcomes = [String(s2.purpose)];
    }
    if (!Array.isArray(s2.activities) || s2.activities.length < 3) {
      s2.activities = finalS4Acts.map((a, idx) => ({
        order: idx + 1,
        name: a.name,
        hours: a.hours,
        corte: a.corte,
        contenidoFormativo: a.contenidoFormativo,
      }));
    }
    parsedContent.sectionII = s2;
  };

  // Caso 1: La IA ya entregó >= 3 bloques (o exactamente 3 en Formación Laboral BGE) -> blindar campos internos y Sección II
  if (existingActs.length >= 3 && (!isLaboral || existingActs.length === 3)) {
    const completedActs = existingActs.map((act, idx) => {
      const { hours, corte } = distributeProgressionHoursAndCorte(idx, existingActs.length, totalHours);
      return ensureCompleteActivity(
        act,
        `${isLaboral ? 'Actividad Clave' : 'Propósito Formativo'} ${idx + 1}`,
        '',
        corte,
        hours
      );
    });
    s4.activities = completedActs;
    parsedContent.sectionIV = s4;
    ensureSectionIIIntegrity(completedActs);
    return parsedContent;
  }

  // Caso 2: La IA colapsó en < 3 bloques (causa raíz del fallo iv_secuencia < 3) -> expandir deterministamente
  const catalogActs = Array.isArray(officialProgram?.activities) ? (officialProgram.activities as Array<Record<string, unknown>>) : [];
  const extractedActs = Array.isArray(extractedData?.activities) ? (extractedData.activities as unknown as Array<Record<string, unknown>>) : [];
  const s2Acts = Array.isArray(s2.activities) ? (s2.activities as Array<Record<string, unknown>>) : [];

  let blueprintSource: Array<{ name: string; contenidoFormativo: string }> = [];
  const pickSource =
    catalogActs.length >= 3
      ? catalogActs
      : extractedActs.length >= 3
        ? extractedActs
        : s2Acts.length >= 3
          ? s2Acts
          : [];

  if (pickSource.length >= 3) {
    const targetSlice = isLaboral ? pickSource.slice(0, 3) : pickSource;
    const rawContenidos = Array.isArray(officialProgram?.contenidos_formativos)
      ? (officialProgram.contenidos_formativos as Array<Record<string, unknown>>)
      : Array.isArray(extractedData?.contenidosFormativos)
        ? (extractedData.contenidosFormativos as unknown as Array<Record<string, unknown>>)
        : [];

    blueprintSource = targetSlice.map((item, idx) => {
      const name =
        String(item.name || item.description || '').trim() ||
        `${isLaboral ? 'Actividad Clave' : 'Propósito Formativo'} ${idx + 1}`;
      const cfObj = rawContenidos[idx] || {};
      const topics = Array.isArray(cfObj.contenidos)
        ? (cfObj.contenidos as string[]).filter(Boolean)
        : Array.isArray(cfObj.temas)
          ? (cfObj.temas as string[]).filter(Boolean)
          : [];
      const cf =
        (typeof item.contenidoFormativo === 'string' && item.contenidoFormativo.trim()) ||
        (topics.length > 0 ? topics.join('; ') : name);
      return { name, contenidoFormativo: cf };
    });
  } else {
    blueprintSource = [1, 2, 3].map((corteNum) => ({
      name: isLaboral
        ? `Actividad Clave ${corteNum} de ${uacTitle}`
        : `Bloque ${corteNum} (Corte ${corteNum}): Propósito Formativo ${corteNum} de ${uacTitle}`,
      contenidoFormativo: `Desarrollo formativo del Corte ${corteNum} de ${uacTitle}`,
    }));
  }

  const expandedActs = blueprintSource.map((bpItem, idx) => {
    const { hours, corte } = distributeProgressionHoursAndCorte(idx, blueprintSource.length, totalHours);
    const seedAct =
      existingActs.length > 0
        ? existingActs[Math.min(existingActs.length - 1, Math.floor((idx * existingActs.length) / blueprintSource.length))] || {}
        : {};
    // Clonar seedAct contextualizándolo al propósito específico para no repetir el mismo nombre
    const clonedSeed: Record<string, unknown> = {
      ...seedAct,
      name: bpItem.name,
      contenidoFormativo: bpItem.contenidoFormativo,
      hours,
      corte,
    };
    return ensureCompleteActivity(clonedSeed, bpItem.name, bpItem.contenidoFormativo, corte, hours);
  });

  s4.activities = expandedActs;
  parsedContent.sectionIV = s4;
  ensureSectionIIIntegrity(expandedActs);

  return parsedContent;
}
