import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import type { ProgramCatalogItem } from '@/lib/db';
import type { RagContext } from '@/lib/rag-curricular';
import { buildRagContextBlock } from '@/lib/rag-curricular';
import { CATALOGO_METODOLOGIAS_ACTIVAS } from '@/lib/catalogo-metodologias';
import { formatearEstrategiasParaPrompt } from '@/lib/catalogo-estrategias';
import { isTechnologicalSubsystem } from '@/lib/subsystem-config';
import { resolverIdentidadEscolar } from '@/lib/school-identity';
import { SCHOOL_YEAR } from '@/lib/config';
import {
  buildMaterialSlugIndex,
  getMaterialCategoriesForContext,
  MATERIAL_INDEX_MAX_CHARS,
} from '@/lib/materials/slug-index';
import {
  getDisciplinaryAdapter,
  buildDisciplinaryPromptBlock,
} from '@/lib/prompts/disciplinary-adapters';

export interface AuditFeedbackContext {
  overall_score: number;
  compliance_level: string;
  findings?: {
    cobertura_horas?: string;
    desalineaciones?: string[];
    omisiones_detectadas?: string[];
  } | null;
  recommendations?: {
    pedagogicas?: string[];
    didacticas?: string[];
    normativas?: string[];
  } | null;
}

export interface FfeContinuityContext {
  semester_5_uac?: string;
  semester_6_uac?: string;
  area?: string;
}

interface ActivitySourceItem {
  name?: string;
  description?: string;
  hours?: number;
  corte?: string;
  categorias?: string[];
  subcategorias?: string[];
  metas?: string[];
  contenidoFormativo?: string;
}

interface ContenidoFormativoItem {
  proposito?: string;
  progresion?: string;
  actividad_clave?: string;
  contenidos?: string[];
  temas?: string[];
  categorias?: string[];
  subcategorias?: string[];
  metas?: string[];
}

/**
 * Distribución canónica de horas y cortes para N progresiones (sumando 18h por Corte = 54h).
 */
function resolveProgressionHoursAndCorte(
  index: number,
  totalN: number,
  totalHours: number = 54
): { hours: number; corte: string } {
  if (totalN === 8 && totalHours === 54) {
    const hoursList = [6, 6, 6, 6, 6, 6, 9, 9];
    const cortesList = [
      'Corte 1', 'Corte 1', 'Corte 1',
      'Corte 2', 'Corte 2', 'Corte 2',
      'Corte 3', 'Corte 3',
    ];
    return { hours: hoursList[index] ?? 6, corte: cortesList[index] ?? 'Corte 3' };
  }
  if (totalN === 7 && totalHours === 54) {
    const hoursList = [9, 9, 6, 6, 6, 9, 9];
    const cortesList = [
      'Corte 1', 'Corte 1',
      'Corte 2', 'Corte 2', 'Corte 2',
      'Corte 3', 'Corte 3',
    ];
    return { hours: hoursList[index] ?? 6, corte: cortesList[index] ?? 'Corte 3' };
  }
  const base = Math.floor(totalHours / Math.max(1, totalN));
  const rem = totalHours % Math.max(1, totalN);
  const hours = base + (index < rem ? 1 : 0);
  const corteNum = Math.min(3, Math.floor((index * 3) / Math.max(1, totalN)) + 1);
  return { hours, corte: `Corte ${corteNum}` };
}

/**
 * Sanitiza y valida en tiempo de ejecución un elemento de actividad curricular,
 * asegurando tipos coherentes contra entradas malformadas de OCR/PDF o DB.
 */
function sanitizeActivityItem(raw: unknown): ActivitySourceItem {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const parsedHours = typeof r.hours === 'number' && !isNaN(r.hours) && r.hours > 0
    ? r.hours
    : typeof r.hours === 'string' && !isNaN(Number(r.hours)) && Number(r.hours) > 0
      ? Number(r.hours)
      : undefined;

  const rawName = typeof r.name === 'string' && r.name.trim().length > 0 ? r.name.trim() : undefined;
  const rawDesc = typeof r.description === 'string' && r.description.trim().length > 0 ? r.description.trim() : undefined;

  return {
    name: rawName || rawDesc,
    description: rawDesc,
    hours: parsedHours,
    corte: typeof r.corte === 'string' && r.corte.trim().length > 0 ? r.corte.trim() : undefined,
    categorias: Array.isArray(r.categorias)
      ? r.categorias.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : undefined,
    subcategorias: Array.isArray(r.subcategorias)
      ? r.subcategorias.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : undefined,
    metas: Array.isArray(r.metas)
      ? r.metas.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : undefined,
    contenidoFormativo: typeof r.contenidoFormativo === 'string' && r.contenidoFormativo.trim().length > 0
      ? r.contenidoFormativo.trim()
      : undefined,
  };
}

/**
 * Sanitiza y valida en tiempo de ejecución un contenido formativo oficial enriquecido,
 * garantizando arrays limpios de cadenas y previniendo inyecciones de valores nulos.
 */
function sanitizeContenidoFormativoItem(raw: unknown): ContenidoFormativoItem {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    proposito: typeof r.proposito === 'string' && r.proposito.trim().length > 0 ? r.proposito.trim() : undefined,
    progresion: typeof r.progresion === 'string' && r.progresion.trim().length > 0 ? r.progresion.trim() : undefined,
    actividad_clave: typeof r.actividad_clave === 'string' && r.actividad_clave.trim().length > 0 ? r.actividad_clave.trim() : undefined,
    contenidos: Array.isArray(r.contenidos)
      ? r.contenidos.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : typeof r.contenidos === 'string' && r.contenidos.trim().length > 0
        ? [r.contenidos.trim()]
        : undefined,
    temas: Array.isArray(r.temas)
      ? r.temas.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : undefined,
    categorias: Array.isArray(r.categorias)
      ? r.categorias.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : undefined,
    subcategorias: Array.isArray(r.subcategorias)
      ? r.subcategorias.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : undefined,
    metas: Array.isArray(r.metas)
      ? r.metas.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : undefined,
  };
}

export function buildUserPrompt(
  extractedData: ExtractedPdfData,
  context: TeacherContext,
  semester: number,
  component: string,
  officialProgram?: ProgramCatalogItem | null,
  auditFeedback?: AuditFeedbackContext | null,
  continuityInfo?: FfeContinuityContext | null,
  ragContext?: RagContext | null
): string {
  const subsystemKey = (officialProgram?.subsystem || context.subsystem || 'bge').toLowerCase();
  const isTec = isTechnologicalSubsystem(subsystemKey);
  const isLaboral = component === 'laboral';
  const isTransitionSemester = semester >= 5; // 5to y 6to semestre aún usan progresiones en 2026-2027

  // ── Hour distribution math ─────────────────────────────────────────────────
  // BGE usa 18 semanas de mediación docente.
  // Bachilleratos Tecnológicos (BT) usan 16 semanas de mediación docente oficial COSFAC.
  const weeksPerSemester = isTec ? 16 : 18;
  const totalHours = officialProgram?.total_hours || extractedData.totalHours || (isTec && isLaboral ? 80 : 54);
  const weeklyLoad = Math.max(1, Math.round(totalHours / weeksPerSemester));

  // ── Prepare Activities & Official Content ───────────────────────────────────
  let activitiesList: {
    name: string;
    hours: number;
    corte?: string;
    topics?: string[];
    purpose?: string;
    categorias?: string[];
    subcategorias?: string[];
    metas?: string[];
    contenidoFormativo?: string;
  }[] = [];

  if (isLaboral) {
    if (isTec) {
      // Carrera Técnica BT: 3 Fases de la Competencia Profesional
      const sourceActivities = (extractedData.activities && extractedData.activities.length > 0)
        ? (extractedData.activities as unknown[])
        : (officialProgram?.activities && Array.isArray(officialProgram.activities) && officialProgram.activities.length > 0)
          ? (officialProgram.activities as unknown[])
          : [];

      if (sourceActivities.length > 0) {
        activitiesList = sourceActivities.map((raw, idx: number) => {
          const a = sanitizeActivityItem(raw);
          return {
            name: a.name || `Fase ${idx + 1} de la Competencia Profesional`,
            hours: a.hours || Math.round(totalHours / Math.max(1, sourceActivities.length)),
          };
        });
      } else {
        const h1 = Math.round(totalHours / 3);
        const h3 = totalHours - (h1 * 2);
        activitiesList = [
          { name: `Fase 1: Diagnóstico técnico, fundamentos y preparación operativa de ${extractedData.uacName}`, hours: h1 },
          { name: `Fase 2: Ejecución práctica, procesos técnicos y aplicación en taller/laboratorio`, hours: h1 },
          { name: `Fase 3: Simulación profesional, control de calidad y entrega de evidencias técnicas`, hours: h3 },
        ];
      }
    } else {
      // Formación Laboral BGE: Estrictamente 3 Actividades Clave (18h c/u = 54h totales)
      if (officialProgram?.activities && Array.isArray(officialProgram.activities) && officialProgram.activities.length === 3) {
        activitiesList = officialProgram.activities.map((raw, idx: number) => {
          const a = sanitizeActivityItem(raw);
          return {
            name: a.name || `Actividad Clave ${idx + 1}`,
            hours: a.hours || 18,
          };
        });
      } else if (extractedData.activities && extractedData.activities.length === 3) {
        activitiesList = extractedData.activities.map((raw, idx) => {
          const a = sanitizeActivityItem(raw);
          return {
            name: a.name || `Actividad Clave ${idx + 1}`,
            hours: a.hours || 18,
          };
        });
      } else {
        activitiesList = [
          { name: `Actividad Clave 1: Diagnóstico, fundamentación y preparación técnica de ${extractedData.uacName}`, hours: 18 },
          { name: `Actividad Clave 2: Ejecución, procesamiento y desarrollo operativo de ${extractedData.uacName}`, hours: 18 },
          { name: `Actividad Clave 3: Simulación profesional, control de calidad y entrega de evidencias técnicas`, hours: 18 },
        ];
      }
    }
  } else {
    // Componentes Fundamentales, Ampliados o FFE (Propósitos o Progresiones)
    const sourceActivities: unknown[] = (officialProgram?.activities && Array.isArray(officialProgram.activities) && officialProgram.activities.length > 0)
      ? (officialProgram.activities as unknown[])
      : (extractedData.activities as unknown[]);

    const totalN = sourceActivities.length;
    activitiesList = sourceActivities.map((raw, idx: number) => {
      const a = sanitizeActivityItem(raw);
      const { hours: canonicalHours, corte: canonicalCorte } = resolveProgressionHoursAndCorte(idx, totalN, totalHours);
      const baseName = a.name || a.description || `${isTransitionSemester ? 'Progresión' : 'Propósito Formativo'} ${idx + 1}`;
      const formattedName = isTransitionSemester && !/^Progresi[óo]n\s*\d+/i.test(baseName)
        ? `Progresión ${idx + 1}: ${baseName}`
        : baseName;

      return {
        name: formattedName,
        hours: isTransitionSemester ? canonicalHours : (a.hours || canonicalHours),
        corte: a.corte || canonicalCorte,
        categorias: a.categorias,
        subcategorias: a.subcategorias,
        metas: a.metas,
        contenidoFormativo: a.contenidoFormativo,
      };
    });
  }

  // Asociar contenidos formativos oficiales enriquecidos si existen
  const rawContenidos = officialProgram?.contenidos_formativos || extractedData.contenidosFormativos;
  if (Array.isArray(rawContenidos)) {
    const contenidosSource = rawContenidos.map(sanitizeContenidoFormativoItem);
    activitiesList.forEach((act, i) => {
      // Intentar coincidir por nombre o índice
      const match = contenidosSource.find((cf: ContenidoFormativoItem) => 
        cf.proposito === act.name || 
        cf.progresion === act.name ||
        cf.actividad_clave === act.name ||
        (cf.proposito && cf.proposito.substring(0, 45) === act.name.substring(0, 45)) ||
        (cf.progresion && cf.progresion.substring(0, 45) === act.name.substring(0, 45))
      ) || contenidosSource[i];

      if (match) {
        if (!act.categorias?.length && match.categorias?.length) act.categorias = match.categorias;
        if (!act.subcategorias?.length && match.subcategorias?.length) act.subcategorias = match.subcategorias;
        if (!act.metas?.length && match.metas?.length) act.metas = match.metas;
        if (Array.isArray(match.contenidos) && match.contenidos.length > 0) {
          act.topics = match.contenidos;
        } else if (Array.isArray(match.temas) && match.temas.length > 0) {
          act.topics = match.temas;
        }
      }
    });
  }

  const activitiesText = activitiesList
    .map((a, i) => {
      const assignedCorte = a.corte || `Corte ${Math.min(3, i + 1)}`;
      let text = `  ${i + 1}. ${a.name} (${a.hours} horas) [Asignado al ${assignedCorte}]`;
      if (a.categorias?.length || a.subcategorias?.length || a.metas?.length) {
        text += `\n     [Categorías, Subcategorías y Metas Oficiales de esta Progresión]:`;
        if (a.categorias?.length) {
          text += `\n       • Categorías: ${a.categorias.join('; ')}`;
        }
        if (a.subcategorias?.length) {
          text += `\n       • Subcategorías: ${a.subcategorias.join('; ')}`;
        }
        if (a.metas?.length) {
          text += `\n       • Metas de Aprendizaje: ${a.metas.join(' ')}`;
        }
      } else if (a.topics && a.topics.length > 0) {
        text += `\n     [Contenidos Temáticos Oficiales obligatorios para esta unidad]:\n` + 
                a.topics.map(t => `       • ${t}`).join('\n');
      }
      return text;
    })
    .join('\n\n');

  // ── Evidencias oficiales o inferidas ─────────────────────────────────────────
  const evidencesSource = (officialProgram?.evidences && Array.isArray(officialProgram.evidences) && officialProgram.evidences.length > 0)
    ? officialProgram.evidences
    : extractedData.evidences;

  const evidencesText = evidencesSource && evidencesSource.length > 0
    ? evidencesSource.map(e => `  - ${e}`).join('\n')
    : '  - Evidencia de producto técnico\n  - Reporte de desempeño de simulación\n  - Instrumento de evaluación formativa';

  // ── Subsistema y Componente Labels ──────────────────────────────────────────
  const subsystemLabels: Record<string, string> = {
    bge: 'Bachillerato General Estatal (BGE)',
    digital: 'Bachillerato Digital',
    emsad: 'EMSAD',
    tecnologico: 'Bachillerato Tecnológico (General)',
    cecyte: 'CECyTE (Bachillerato Tecnológico)',
    cbtis: 'CBTIS (DGETI - Bachillerato Tecnológico Industrial)',
    cbta: 'CBTA (DGETAyCM - Bachillerato Tecnológico Agropecuario)',
    conalep: 'CONALEP',
    dgb: 'Preparatoria Federal / DGB',
    telebachillerato: 'Telebachillerato',
  };

  const componentLabels: Record<string, string> = {
    laboral: isTec ? 'Carrera Técnica (Módulos y Submódulos Profesionales)' : 'Formación Laboral (3 Actividades Clave)',
    fundamental: 'Currículum Fundamental',
    ampliado: 'Currículum Ampliado',
    ext_optativo: 'Formación Fundamental Extendida (Optativa)',
    ext_obligatorio: 'Formación Fundamental Extendida (Obligatoria)',
  };

  const location = [context.municipality, context.state].filter(Boolean).join(', ');
  const subsystemLabel = subsystemLabels[subsystemKey] || context.subsystem;

  // ── Identidad Territorial y CCT Fidedigno ──────────────────────────────────
  const identidadPlantel = resolverIdentidadEscolar({
    schoolName: context.schoolName,
    cct: context.cct || extractedData.cct,
    municipality: context.municipality,
    schoolZone: context.schoolZone,
  });
  const effectiveCct =
    identidadPlantel.cct && identidadPlantel.cct !== '21EBH0000X' ? identidadPlantel.cct : '';
  const effectiveLocality = context.locality || context.municipality || '';
  const effectiveMunicipality = identidadPlantel.municipality || '';
  const effectiveCorde = context.region || '';

  const directricesIdentidad = [
    effectiveLocality || effectiveMunicipality
      ? `El plantel se ubica geográficamente en la localidad "${effectiveLocality || 'no registrada'}"${
          effectiveMunicipality ? `, municipio de "${effectiveMunicipality}"` : ''
        }.`
      : null,
    effectiveCorde
      ? `La adscripción administrativa de supervisión oficial es la "${effectiveCorde}".`
      : null,
    `Queda ESTRICTAMENTE PROHIBIDO sustituir el municipio o la localidad de residencia de los estudiantes${
      effectiveCorde ? ` por la cabecera distrital de la CORDE ("${effectiveCorde}")` : ''
    } al formular el Reto Situado o las problemáticas del aula.`,
    effectiveCct
      ? `Queda ESTRICTAMENTE PROHIBIDO utilizar claves CCT comodines, ficticias o genéricas (como 21EBH0000X). Usa obligatoriamente: ${effectiveCct}.`
      : `Queda ESTRICTAMENTE PROHIBIDO inventar o completar una clave CCT. No se tiene registro de la clave del plantel: indícala como "CCT no registrado".`,
  ]
    .filter((linea): linea is string => Boolean(linea))
    .map((linea, i) => `${i + 1}. ${linea}`)
    .join('\n');

  const learningOutcome = officialProgram?.learning_outcome || extractedData.learningOutcome || 
    `Desarrollar competencias integrales y saberes formativos en ${extractedData.uacName} aplicados al contexto comunitario de los estudiantes.`;

  // ── Continuidad FFE ─────────────────────────────────────────────────────────
  let ffeContinuityBlock = '';
  if (continuityInfo) {
    ffeContinuityBlock = `\n═══════════ TRAYECTORIA Y CONTINUIDAD FFE (OFICIAL SEP) ═══════════
• Asignatura de 5.° Semestre: ${continuityInfo.semester_5_uac || 'N/A'}
• Asignatura de 6.° Semestre (Continuación directa): ${continuityInfo.semester_6_uac || 'N/A'}
• Campo de Formación: ${continuityInfo.area || 'Formación Fundamental Extendida'}
*IMPORTANTE*: La planeación debe articularse de forma progresiva respetando los saberes previos o la proyección de esta secuencia curricular oficial.
`;
  }

  // ── Auditoría Previa Feedback ───────────────────────────────────────────────
  let auditRemediationBlock = '';
  if (auditFeedback) {
    const findingsList: string[] = [];
    if (auditFeedback.findings?.desalineaciones?.length) {
      findingsList.push(...auditFeedback.findings.desalineaciones.map(d => `  ⚠️ Desalineación detectada: ${d}`));
    }
    if (auditFeedback.findings?.omisiones_detectadas?.length) {
      findingsList.push(...auditFeedback.findings.omisiones_detectadas.map(o => `  ⚠️ Omisión en versión previa: ${o}`));
    }

    const recsList: string[] = [];
    if (auditFeedback.recommendations?.pedagogicas?.length) {
      recsList.push(...auditFeedback.recommendations.pedagogicas.map(r => `  ✅ Pedagógica: ${r}`));
    }
    if (auditFeedback.recommendations?.didacticas?.length) {
      recsList.push(...auditFeedback.recommendations.didacticas.map(r => `  ✅ Didáctica: ${r}`));
    }
    if (auditFeedback.recommendations?.normativas?.length) {
      recsList.push(...auditFeedback.recommendations.normativas.map(r => `  ✅ Normativa: ${r}`));
    }

    auditRemediationBlock = `\n═══════════ RETROALIMENTACIÓN DE AUDITORÍA PEDAGÓGICA PREVIA ═══════════
⚠️ ESTA PLANEACIÓN FUE AUDITADA PREVIAMENTE CON UNA CALIFICACIÓN DE ${auditFeedback.overall_score}/100 (${auditFeedback.compliance_level.toUpperCase()}).
Para alcanzar una calificación de EXCELENCIA (100/100), el motor de IA DEBE CORREGIR obligatoriamente las siguientes observaciones:

OBSERVACIONES CRÍTICAS A SUBSANAR:
${findingsList.length > 0 ? findingsList.join('\n') : '  - Mejorar la vinculación situacional y el desglose de evidencias evaluativas.'}

ACCIONES CORRECTIVAS EXIGIDAS:
${recsList.length > 0 ? recsList.join('\n') : '  - Integrar metodologías activas y asegurar la exactitud horaria en cada corte de evaluación.'}
`;
  }

  // ── RAG Context Block ───────────────────────────────────────────────────────
  const ragBlock = ragContext ? buildRagContextBlock(ragContext) : '';

  // ── Bloque de Metodología Activa ─────────────────────────────────────────
  // Se inyecta solo si el docente seleccionó una metodología en el wizard.
  // Si no hay selección, el bloque se omite y la planeación usa el default del system prompt.
  let metodologiaBlock = '';
  if (context.metodologiaActiva) {
    const met = CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === context.metodologiaActiva);
    if (met) {
      const fasesText = met.fases
        .map((f, i) => `  ${i + 1}. ${f}`)
        .join('\n');
      metodologiaBlock = `
═══════════ METODOLOGÍA ACTIVA SELECCIONADA POR EL DOCENTE ═══════════
Metodología: ${met.nombre}
Definición: ${met.definicion}
Tipo de evidencia esperada: ${met.tipoEvidenciaSugerida}

El estudiante DEBE vivir estas fases EN ORDEN durante la secuencia didáctica:
${fasesText}

OBLIGATORIO: Cada Actividad Clave o Propósito Formativo en la Sección IV debe
estructurarse usando estas fases. Queda PROHIBIDO saltar fases, fusionarlas
o convertirlas en explicación expositiva pasiva.
`;
    }
  }

  // ── Bloque de Estrategias Didácticas ─────────────────────────────────────
  // Se inyecta cuando el docente selecciona una metodología activa.
  // Filtra las estrategias compatibles por momento didáctico y metodología.
  let estrategiasBlock = '';
  if (context.metodologiaActiva) {
    const estApertura = formatearEstrategiasParaPrompt('apertura', context.metodologiaActiva);
    const estDesarrollo = formatearEstrategiasParaPrompt('desarrollo', context.metodologiaActiva);
    const estCierre = formatearEstrategiasParaPrompt('cierre', context.metodologiaActiva);
    estrategiasBlock = `
═══════════ REPERTORIO DE ESTRATEGIAS DIDÁCTICAS RECOMENDADAS ═══════════
Selecciona e integra estas estrategias en la Sección IV según el momento didáctico.
Cada una incluye una Garantía Dual Offline para contextos sin conectividad (MCCEMS).

• FASE DE APERTURA:
${estApertura}

• FASE DE DESARROLLO (EJECUCIÓN):
${estDesarrollo}

• FASE DE CIERRE (CONCLUSIÓN):
${estCierre}
`;
  }

  // ── Prompt Completo ────────────────────────────────────────────────────────
  return `Genera una Planeación Didáctica completa y de nivel EXCELENCIA en formato oficial MCCEMS ${SCHOOL_YEAR} para:
${ragBlock}
═══════════ DATOS DE LA UAC (PROGRAMA OFICIAL AUTÉNTICO) ═══════════
UAC: ${extractedData.uacName}
Semestre: ${semester}° Semestre
Componente Curricular: ${componentLabels[component] || component}
Carga Horaria Semestral TOTAL: ${totalHours} horas oficiales
Carga Horaria Semanal: ${weeklyLoad} horas por semana (${weeksPerSemester} semanas de mediación docente)
Modelo Pedagógico Vigente: ${isLaboral ? (isTec ? 'Carrera Técnica por Módulos y Submódulos (Base 16 Semanas Oficial COSFAC)' : '3 Actividades Clave (Formación Laboral BGE)') : isTransitionSemester ? 'Progresiones de Aprendizaje (5° y 6° Semestre)' : 'Propósitos Formativos y Contenidos Temáticos (1° a 4° Semestre)'}

Resultado de Aprendizaje / Propósito General Oficial:
${learningOutcome}

${isLaboral ? (isTec ? 'FASES DE COMPETENCIA PROFESIONAL DEL SUBMÓDULO TÉCNICO:' : 'ACTIVIDADES CLAVE OFICIALES DEL PROGRAMA (EXACTAMENTE 3, 18 HORAS CADA UNA):') : isTransitionSemester ? 'PROGRESIONES DE APRENDIZAJE OFICIALES DEL PROGRAMA:' : 'PROPÓSITOS FORMATIVOS Y CONTENIDOS TEMÁTICOS OFICIALES:'}
${activitiesText}

Evidencias e Instrumentos Sugeridos por el Programa Oficial:
${evidencesText}
${ffeContinuityBlock}${auditRemediationBlock}
═══════════ DISTRIBUCIÓN HORARIA OBLIGATORIA POR CORTE ═══════════
REGLA MATEMÁTICA ESTRICTA — NO MODIFICAR:
  • El semestre se divide en 3 Cortes de evaluación (Corte 1, Corte 2, Corte 3).
  • Carga semanal de esta UAC: ${weeklyLoad} horas/semana (Base ${weeksPerSemester} semanas lectivas).
  • HORAS POR CORTE: Distribución canónica en 3 Cortes lectivos: Corte 1: ${Math.round(totalHours / 3)}h, Corte 2: ${Math.round(totalHours / 3)}h, Corte 3: ${totalHours - 2 * Math.round(totalHours / 3)}h.
  • TOTAL: ${totalHours} horas (debe cuadrar exactamente con la carga total oficial).

DOSIFICACIÓN OBLIGATORIA:
  - La suma de horas de las actividades asignadas al Corte 1 debe ser EXACTAMENTE ${Math.round(totalHours / 3)} horas.
  - La suma de horas de las actividades asignadas al Corte 2 debe ser EXACTAMENTE ${Math.round(totalHours / 3)} horas.
  - La suma de horas de las actividades asignadas al Corte 3 debe ser EXACTAMENTE ${totalHours - 2 * Math.round(totalHours / 3)} horas.
  - Si es Formación Laboral (BGE): Asigna la Actividad Clave 1 al Corte 1 (18h), la Actividad Clave 2 al Corte 2 (18h) y la Actividad Clave 3 al Corte 3 (18h).
  - Si es Carrera Técnica (Bachillerato Tecnológico): Asigna la Fase 1 al Corte 1 (${Math.round(totalHours / 3)}h), la Fase 2 al Corte 2 (${Math.round(totalHours / 3)}h) y la Fase 3 al Corte 3 (${totalHours - 2 * Math.round(totalHours / 3)}h).
  - En la Sección IV, la suma de horas de las secuencias de cada Corte debe sumar exactamente la cuota asignada a dicho Corte.

═══════════ DATOS DEL DOCENTE Y PLANTEL (IDENTIDAD OFICIAL) ═══════════
Docente Titular: ${context.teacherName}
Plantel Educativo: ${identidadPlantel.schoolName || 'Plantel no registrado'}
CCT Oficial: ${effectiveCct || 'CCT no registrado'}
Localidad Escolar: ${effectiveLocality || 'Comunidad escolar'}
Municipio: ${effectiveMunicipality || 'Municipio no registrado'}
Región Administrativa (CORDE): ${effectiveCorde || 'No registrada'}
Estado: ${context.state || 'Puebla'}
Subsistema: ${subsystemLabel}
Grupos: ${context.groupInfo || 'Grupo A'}
Período de aplicación: ${context.applicationPeriod || `Ciclo escolar ${SCHOOL_YEAR}`}
Recursos disponibles: ${context.schoolResources || 'Recursos básicos de aula y tecnología accesible'}

DIRECTRICES DE IDENTIDAD TERRITORIAL Y ADMINISTRATIVA OBLIGATORIAS:
${directricesIdentidad}

═══════════ PROYECTO PAEC/PEC (VINCULACIÓN COMUNITARIA OBLIGATORIA) ═══════════
Nombre del proyecto PAEC: ${context.paecProjectName || 'Transformación e Innovación Comunitaria'}
Objetivo del PAEC: ${context.paecObjective || 'Resolver problemáticas reales del contexto mediante el aprendizaje situado.'}

Problemática Comunitaria Central detectada en el PAEC:
${context.paecProblem}

${context.usePaecActivity !== false && context.paecOperationalActivity?.actividad ? `ACTIVIDAD ACORDADA EN EL PLAN OPERATIVO DEL PAEC PARA ESTA ASIGNATURA (${context.paecOperationalActivity.isPrescheduled ? 'ACUERDO OFICIAL DEL CONSEJO TÉCNICO ESCOLAR' : 'ACTIVIDAD CAPTURADA POR EL DOCENTE'}):
• Actividad asignada: "${context.paecOperationalActivity.actividad}"
${context.paecOperationalActivity.semana ? `• Semana / Fase programada: ${context.paecOperationalActivity.semana}${context.paecOperationalActivity.fase ? ` (${context.paecOperationalActivity.fase})` : ''}` : ''}
${context.paecOperationalActivity.estrategiaDidactica ? `• Estrategia didáctica propuesta: ${context.paecOperationalActivity.estrategiaDidactica}` : ''}
${(context.paecOperationalActivity.propositoFormativo || context.paecOperationalActivity.progresion) ? `• Propósito formativo / Progresión: ${context.paecOperationalActivity.propositoFormativo || context.paecOperationalActivity.progresion}` : ''}

INSTRUCCIONES OBLIGATORIAS PARA ESTA ACTIVIDAD:
1. SECCIÓN III (Transversalidad y PAEC): Describe explícitamente cómo esta UAC (${extractedData.uacName}) vincula sus aprendizajes con la actividad institucional acordada: "${context.paecOperationalActivity.actividad}".
2. SECCIÓN IV (Secuencia Didáctica): Integra y desarrolla esta actividad concreta en la secuencia didáctica (en la fase de Desarrollo o Cierre del Corte correspondiente), articulándola directamente con los saberes y contenidos oficiales.
` : `ESTADO DEL PLAN OPERATIVO DEL PAEC:
Esta asignatura (${extractedData.uacName}) no cuenta con una actividad preasignada en el Plan Operativo del documento escolar.
INSTRUCCIÓN: Genera en la SECCIÓN III y en la SECCIÓN IV propuestas formativas pertinentes y situadas que vinculen de forma natural la asignatura con la problemática comunitaria: "${context.paecProjectName || context.paecProblem.substring(0, 80)}".`}

Caracterización y Perfil de los Estudiantes:
${context.studentContext || 'Estudiantes de bachillerato con interés en proyectos prácticos y resolución de problemas comunitarios.'}

${metodologiaBlock}${estrategiasBlock}${buildDisciplinaryPromptBlock(
    extractedData.uacName || officialProgram?.uac_name || '',
    component,
    extractedData.carreraTecnica || officialProgram?.curriculum_name || ''
  )}
═══════════ EJEMPLO DE REFERENCIA — SECCIÓN IV DE NIVEL EXCELENCIA (FEW-SHOT DISCIPLINAR) ═══════════
El siguiente es UN EJEMPLO de la calidad y estructura requerida para la Sección IV en esta disciplina.
Adapta el contenido a la UAC, semestre, carga horaria oficial y contexto PAEC indicados arriba. NO copies este ejemplo literalmente.

${getDisciplinaryAdapter(
    extractedData.uacName || officialProgram?.uac_name || '',
    component,
    extractedData.carreraTecnica || officialProgram?.curriculum_name || ''
  ).fewShotExampleBlock}
═══════════ FIN DEL EJEMPLO ═══════════

═══════════ INSTRUCCIONES DE CALIDAD PEDAGÓGICA EXIGIDAS ═══════════
1. VINCULACIÓN SITUADA: Conecta explícitamente las secuencias de aprendizaje con la problemática del PAEC: "${context.paecProjectName || context.paecProblem.substring(0, 70)}".
${(context.usePaecActivity !== false && context.paecOperationalActivity?.actividad) ? `   - Integra OBLIGATORIAMENTE en la Sección III y en la secuencia de la Sección IV la actividad oficial del Plan Operativo: "${context.paecOperationalActivity.actividad}".` : '   - Propón actividades transversales pertinentes que atiendan la problemática comunitaria diagnosticada.'}
2. METODOLOGÍAS ACTIVAS: ${context.metodologiaActiva ? `Aplica EXCLUSIVAMENTE la metodología ${CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === context.metodologiaActiva)?.nombre ?? context.metodologiaActiva} respetando sus fases en el orden indicado arriba.` : 'Aplica estrictamente metodologías activas (Aprendizaje Basado en Proyectos, Estudio de Casos, Simulación y Prácticas de Campo). Prohibidas clases expositivas pasivas.'}
${isTransitionSemester
  ? `   - MCCEMS 5.° y 6.° SEMESTRE (FFE Optativas - PROGRESIONES DE APRENDIZAJE):
     • Esta UAC tiene EXACTAMENTE ${activitiesList.length} Progresiones de Aprendizaje oficiales (Progresión 1 a Progresión ${activitiesList.length}).
     • Tanto "sectionII.activities" como "sectionIV.activities" DEBEN contener EXACTAMENTE ${activitiesList.length} elementos individuales (1 elemento por cada Progresión oficial, en orden 1 a ${activitiesList.length}).
     • Queda ESTRICTAMENTE PROHIBIDO colapsar o agrupar varias progresiones en un solo bloque o rango (ej. PROHIBIDO escribir "Progresión 3 a 7" o "Progresión 1 a 3").
     • En cada elemento i (1..${activitiesList.length}), el campo "name" DEBE ser COPIA VERBATIM ÍNTEGRA del texto oficial de la Progresión i tal como se listó arriba ("Progresión K: <texto oficial completo>"). PROHIBIDO resumir, parafrasear o truncar.
     • En cada elemento i de "sectionIV.activities", el campo "contenidoFormativo" DEBE incluir las Categorías (C1...), Subcategorías (S1...) y Metas (C1M1...) oficiales correspondientes a esa Progresión.`
  : '   - Para asignaturas no laborales: Especifica obligatoriamente el "contenidoFormativo" oficial exacto desarrollado en la secuencia.'
}
   - Para Formación Laboral (BGE): Exige que el Desarrollo alcance Nivel 2 de complejidad técnica y el Cierre sea una simulación práctica evaluable con lista de cotejo/rúbrica.
   - Para Carrera Técnica (Bachillerato Tecnológico): Exige que el Desarrollo implemente prácticas de taller/laboratorio, simulación técnica y resolución de problemas profesionales reales con equipo o software correspondiente a la especialidad técnica.
3. TAXONOMÍA EXPLÍCITA DE LOS 3 SABERES (OBLIGATORIO EN CADA ACTIVIDAD DE LA SECCIÓN IV):
   En cada bloque de 'activities' de la Sección IV, desglosa obligatoriamente el objeto "saberes":
   - "saber": Conocimientos conceptuales, principios teóricos, normativas técnicas y fundamentos que el alumno domina.
   - "saberHacer": Procedimientos aplicados, destrezas técnicas, mediciones, cálculos, manipulación de herramientas y resolución operativa.
   - "saberSer": Actitudes profesionales, ética, seguridad e higiene, compromiso comunitario y trabajo colaborativo.
4. SECCIÓN V (EVALUACIÓN): Incluye el Acuerdo de Acreditación formal firmado y asegura que las ponderaciones sumen exactamente 100%.
5. SECCIÓN VI (MATERIALES): En "teacherMaterials" incluye ÚNICAMENTE materiales diseñados por el docente (guías, manuales, hojas de trabajo). NUNCA infraestructura física escolar (proyector, internet, pizarrones).
6. SECCIÓN I: Asigna el período de aplicación: ${context.applicationPeriod || `Ciclo escolar ${SCHOOL_YEAR}`}.
7. SECCIÓN II (RETO SITUADO 4/4 Y DIAGNÓSTICO EN 3 DIMENSIONES):
   - "retoSituado": Genera un reto de alta utilidad real con verbo en infinitivo (Diseñar, Construir, Diagnosticar, Evaluar, Mitigar, Optimizar), contexto local concreto de Puebla (${location}), problemática real de la comunidad ("${context.paecProblem.substring(0, 80)}") y propósito curricular articulado.
   - "diagnosticoSituado3D": Desarrolla la dimensión territorial, la dimensión de praxis juvenil (reconociendo al 44% de alumnos que trabajan) y la dimensión de aula/EDIEMS (rezago diagnóstico y BAP).
8. SECCIÓN IV (8 PROCESOS DE PENSAMIENTO Y MODELO FINLANDÉS):
   - "procesosPensamiento": Desglosa los 8 procesos cognitivos oficiales (asombro, problematizacion, traduccion, conceptualizacion, razonamiento, indagacion, reflexion, transferencia) indicando para cada uno su "utilidadReal" cotidiana y su "garantiaDualOffline" en aula (material análogo). CERO tareas de relleno o memorísticas pasivas.
9. SECCIÓN V-B (BITÁCORA FORMATIVA Y REGULADORA 50-20-30):
   - "bitacora502030": Genera la bitácora oficial con criterioProceso50 (observando participativo, dialogante, cuestionador, apoyo), evidenciaColectiva20, evidenciaIndividual30, ticketSalidaPregunta y 4-5 estudiantes representativos con calificaciones y notas cualitativas de acompañamiento.

INDICE DE MATERIALES AUTORIZADOS — usa SOLO estos slugs dentro de tokens [[material:slug]] en "garantiaDualOffline" y "utilidadReal". En cualquier otro campo (actividades de apertura/ejecucion/conclusion, materiales generales de sección VI, saberes), escribe SIEMPRE en texto plano legible sin corchetes ni tokens:
${buildMaterialSlugIndex(getMaterialCategoriesForContext(extractedData.uacName || officialProgram?.uac_name || '', component), MATERIAL_INDEX_MAX_CHARS - 300)}

Responde ÚNICAMENTE con el objeto JSON válido que cumpla la estructura exacta solicitada en el system prompt.`;
}
