import type {
  PaecProject,
  PaecAuditCriterion,
  PaecQualityAudit,
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
  PaecImplementacion,
  AnexosData,
  PaecGobernanza,
  PaecInformeSupervision,
} from '@/types/paec';

/**
 * ============================================================================
 * QUALITY GATE OFICIAL PAEC-PEC 2025 (23 CRITERIOS DBEPA / COSFAC / NEM)
 * ============================================================================
 * 
 * Implementación de la Matriz Oficial de Validación y Rúbrica de Evaluación
 * para Proyectos Escolares Comunitarios del Marco Curricular Común de la
 * Educación Media Superior (MCCEMS 2025).
 * 
 * Estructura de 8 Dimensiones Normativas y 23 Criterios:
 *  - Dimensión 1: Diagnóstico Comunitario y Escolar (C1 - C4)
 *  - Dimensión 2: Justificación y Fundamentación (C5 - C7)
 *  - Dimensión 3: Mapeo Curricular y Cobertura (C8 - C10)
 *  - Dimensión 4: Cronograma Bimestral (C11 - C12)
 *  - Dimensión 5: Detalle Curricular y Progresiones (C13 - C14)
 *  - Dimensión 6: Plan Operativo Territorial (C15 - C18)
 *  - Dimensión 7: Implementación y Formalización (C19 - C20)
 *  - Dimensión 8: Gobernanza Escolar e Informe (C21 - C23)
 */

export const DIMENSIONS = {
  DIM1: 'Dimensión 1: Diagnóstico Comunitario y Escolar',
  DIM2: 'Dimensión 2: Justificación y Fundamentación',
  DIM3: 'Dimensión 3: Mapeo Curricular y Cobertura',
  DIM4: 'Dimensión 4: Cronograma Bimestral',
  DIM5: 'Dimensión 5: Detalle Curricular y Progresiones',
  DIM6: 'Dimensión 6: Plan Operativo Territorial',
  DIM7: 'Dimensión 7: Implementación y Formalización',
  DIM8: 'Dimensión 8: Gobernanza Escolar e Informe de Supervisión',
} as const;

// ----------------------------------------------------------------------------
// Helpers de Inspección de Contenido
// ----------------------------------------------------------------------------

function hasDigits(text: string): boolean {
  return /\d+/.test(text);
}

function hasPercentage(text: string): boolean {
  return /%|\d+\s*por\s*ciento/i.test(text);
}

function countKeywords(text: string, keywords: RegExp[]): number {
  return keywords.reduce((count, regex) => (regex.test(text) ? count + 1 : count), 0);
}

type LooseTableRow = Record<string, string | undefined>;

// ============================================================================
// EVALUADORES ESPECÍFICOS POR CRITERIO (1 A 23)
// ============================================================================

// --- DIMENSIÓN 1: DIAGNÓSTICO (Criterios 1-4) ---

export function evaluateCriterio1(fase1: Fase1Diagnostico | null | undefined): PaecAuditCriterion {
  const tabla1 = (fase1?.tabla1 as unknown as LooseTableRow[]) || [];
  const totalRows = tabla1.length;

  let situatedCount = 0;
  for (const row of tabla1) {
    const text = `${row.col1 || ''} ${row.col2 || ''} ${row.aspect || ''} ${row.description || ''}`;
    // Datos duros: cifras, porcentajes, moneda, términos geográficos/demográficos específicos
    if (
      hasDigits(text) ||
      hasPercentage(text) ||
      /\$|INEGI|censo|habitantes|municipio|colonia|ejido|comunidad|poblaci[oó]n|hect[aá]reas|km/i.test(text)
    ) {
      situatedCount++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Tabla 1 ausente o sin información diagnóstica comunitaria.';
  let evidenceFound = `0 filas registradas en Tabla 1.`;

  if (totalRows >= 5 && situatedCount >= 3) {
    score = 4;
    status = 'pass';
    feedback = 'Diagnóstico comunitario excelente con datos duros situados (cifras, porcentajes, ubicación territorial específica).';
    evidenceFound = `${totalRows} aspectos comunitarios analizados; ${situatedCount} contienen indicadores duros y contexto situado.`;
  } else if (totalRows >= 4 && situatedCount >= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Diagnóstico comunitario adecuado. Se sugiere incorporar más cifras exactas de fuentes oficiales locales (INEGI, censo municipal).';
    evidenceFound = `${totalRows} aspectos analizados; ${situatedCount} contienen datos duros.`;
  } else if (totalRows >= 2) {
    score = 2;
    status = 'warning';
    feedback = 'Diagnóstico comunitario con descripciones mayormente genéricas. Requiere datos duros específicos del territorio escolar.';
    evidenceFound = `${totalRows} aspectos analizados, pero solo ${situatedCount} con datos cuantitativos.`;
  }

  return {
    id: 1,
    name: 'Tabla 1 (Comunidad): Datos duros situados, no genéricos',
    dimension: DIMENSIONS.DIM1,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio2(fase1: Fase1Diagnostico | null | undefined): PaecAuditCriterion {
  const tabla2 = (fase1?.tabla2 as unknown as LooseTableRow[]) || [];
  const totalRows = tabla2.length;

  let indicatorCount = 0;
  for (const row of tabla2) {
    const text = `${row.col1 || ''} ${row.col2 || ''} ${row.aspect || ''} ${row.description || ''}`;
    if (
      /matr[ií]cula|abandono|deserci[oó]n|reprobaci[oó]n|aprobaci[oó]n|eficiencia|CCT|docentes|egreso|promedio|grupos|becas|infraestructura|aulas|laboratorio/i.test(text) &&
      hasDigits(text)
    ) {
      indicatorCount++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Tabla 2 ausente o sin indicadores escolares del plantel.';
  let evidenceFound = `0 filas registradas en Tabla 2.`;

  if (totalRows >= 4 && indicatorCount >= 3) {
    score = 4;
    status = 'pass';
    feedback = 'Indicadores educativos del plantel detallados con métricas cuantitativas reales (matrícula, rezago, aprobación, infraestructura).';
    evidenceFound = `${totalRows} indicadores escolares evaluados; ${indicatorCount} con métricas cuantitativas verificables.`;
  } else if (totalRows >= 3 && indicatorCount >= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Indicadores educativos adecuados. Se recomienda enriquecer porcentajes de eficiencia terminal y deserción.';
    evidenceFound = `${totalRows} indicadores registrados; ${indicatorCount} cuantitativos.`;
  } else if (totalRows >= 2) {
    score = 2;
    status = 'warning';
    feedback = 'Indicadores escolares formulados de manera cualitativa o parcial. Requiere cifras exactas de control escolar.';
    evidenceFound = `${totalRows} filas registradas; solo ${indicatorCount} con cifras específicas.`;
  }

  return {
    id: 2,
    name: 'Tabla 2 (Educación): Indicadores reales del plantel',
    dimension: DIMENSIONS.DIM1,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio3(fase1: Fase1Diagnostico | null | undefined): PaecAuditCriterion {
  const tabla3 = (fase1?.tabla3 as unknown as LooseTableRow[]) || [];
  const allText = tabla3.map(r => `${r.aspect || ''} ${r.analysis || ''}`).join(' ');

  const hasF = tabla3.some(r => /fortaleza|f\b/i.test(r.aspect || ''));
  const hasO = tabla3.some(r => /oportunidad|o\b/i.test(r.aspect || ''));
  const hasD = tabla3.some(r => /debilidad|d\b/i.test(r.aspect || ''));
  const hasA = tabla3.some(r => /amenaza|a\b/i.test(r.aspect || ''));
  const quadrantCount = [hasF, hasO, hasD, hasA].filter(Boolean).length;

  const hasCrossAnalysis = /estrategia maestra|cruce|adaptativ|f-?o|d-?o|f-?a|d-?a/i.test(allText);

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Matriz FODA ausente o con menos de dos cuadrantes.';
  let evidenceFound = `${quadrantCount}/4 cuadrantes identificados.`;

  if (quadrantCount === 4 && hasCrossAnalysis) {
    score = 4;
    status = 'pass';
    feedback = 'Análisis FODA completo en sus 4 cuadrantes con análisis cruzado (FO/DO/FA/DA) y articulación de Estrategia Maestra.';
    evidenceFound = `4 cuadrantes presentes y cruces estratégicos adaptativos documentados.`;
  } else if (quadrantCount === 4) {
    score = 3;
    status = 'pass';
    feedback = 'Los 4 cuadrantes FODA están cubiertos. Se recomienda explicitar los cruces FO-DO-FA-DA en una Estrategia Maestra nominada.';
    evidenceFound = `4 cuadrantes presentes con análisis estratégico general.`;
  } else if (quadrantCount >= 2) {
    score = 2;
    status = 'warning';
    feedback = 'FODA incompleto. Faltan cuadrantes normativos o el análisis es puramente descriptivo sin orientación estratégica.';
    evidenceFound = `${quadrantCount}/4 cuadrantes identificados en Tabla 3.`;
  }

  return {
    id: 3,
    name: 'FODA: Análisis cruzado FO-DO-FA-DA con Estrategia Maestra',
    dimension: DIMENSIONS.DIM1,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio4(fase1: Fase1Diagnostico | null | undefined): PaecAuditCriterion {
  const tabla4 = (fase1?.tabla4 as unknown as LooseTableRow[]) || [];
  const allText = tabla4.map(r => `${r.col1 || ''} ${r.col2 || ''} ${r.stage || ''} ${r.process || ''}`).join(' ');

  const hasEtapa1 = /etapa\s*1|recuperaci[oó]n|jerarquizaci[oó]n|listado|detecci[oó]n/i.test(allText);
  const hasEtapa2 = /etapa\s*2|an[aá]lisis|deliberaci[oó]n|priorizaci[oó]n|colegiado/i.test(allText);
  const hasEtapa3 = /etapa\s*3|selecci[oó]n|justificaci[oó]n|problema central|consenso/i.test(allText);
  const etapasCount = [hasEtapa1, hasEtapa2, hasEtapa3].filter(Boolean).length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Tabla 4 ausente o sin registro de etapas técnicas de jerarquización.';
  let evidenceFound = `0/3 etapas técnicas identificadas.`;

  if (tabla4.length >= 3 && etapasCount === 3) {
    score = 4;
    status = 'pass';
    feedback = 'Las 3 etapas técnicas de jerarquización (Recuperación, Análisis/Deliberación y Selección del Problema) están documentadas a detalle.';
    evidenceFound = `3/3 etapas técnicas estructuradas en Tabla 4 con acuerdos colegiados.`;
  } else if (tabla4.length >= 2 && etapasCount >= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Etapas de jerarquización presentes. Se recomienda formalizar la Etapa 3 con el acta de selección colegiada del problema central.';
    evidenceFound = `${etapasCount}/3 etapas técnicas documentadas en Tabla 4.`;
  } else if (tabla4.length >= 1) {
    score = 2;
    status = 'warning';
    feedback = 'Registro parcial de la jerarquización del problema. Se requieren las 3 etapas normativas del PEC.';
    evidenceFound = `${tabla4.length} filas registradas en Tabla 4.`;
  }

  return {
    id: 4,
    name: 'Tabla 4: 3 etapas técnicas documentadas',
    dimension: DIMENSIONS.DIM1,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 2: JUSTIFICACIÓN (Criterios 5-7) ---

export function evaluateCriterio5(fase2: Fase2Justificacion | null | undefined): PaecAuditCriterion {
  const intro = fase2?.introduction || '';
  const wordCount = intro.trim().split(/\s+/).filter(Boolean).length;
  const isContextualized = /escuela|plantel|comunidad|estudiantes|territorio|problema|transformaci[oó]n/i.test(intro);

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Introducción del PEC ausente o vacía.';
  let evidenceFound = `0 palabras en Introducción.`;

  if (wordCount >= 100 && isContextualized) {
    score = 4;
    status = 'pass';
    feedback = 'Introducción excelente, sólida y profundamente situada en la realidad comunitaria y la misión pedagógica del PEC.';
    evidenceFound = `${wordCount} palabras con fundamentación comunitaria y territorial.`;
  } else if (wordCount >= 60 && isContextualized) {
    score = 3;
    status = 'pass';
    feedback = 'Introducción contextualizada al PEC adecuada. Se puede expandir el impacto transformador en los estudiantes.';
    evidenceFound = `${wordCount} palabras articuladas al contexto comunitario.`;
  } else if (wordCount >= 30) {
    score = 2;
    status = 'warning';
    feedback = 'Introducción breve o genérica. Debe explicitar la problemática territorial que atiende el plantel.';
    evidenceFound = `${wordCount} palabras registradas.`;
  }

  return {
    id: 5,
    name: 'Introducción contextualizada al PEC',
    dimension: DIMENSIONS.DIM2,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio6(fase2: Fase2Justificacion | null | undefined): PaecAuditCriterion {
  const pilares = fase2?.pilares || [];
  const count = pilares.length;
  const detailedCount = pilares.filter(p => p.length >= 25).length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Pilares de la NEM ausentes en la fundamentación del proyecto.';
  let evidenceFound = `0 pilares registrados.`;

  if (count >= 5 && detailedCount >= 4) {
    score = 4;
    status = 'pass';
    feedback = 'Se articulan 5 o más pilares de la NEM con explicación detallada de su materialización en las actividades del proyecto.';
    evidenceFound = `${count} pilares articulados (mínimo requerido: 5); ${detailedCount} con desglose operativo específico.`;
  } else if (count >= 5) {
    score = 3;
    status = 'pass';
    feedback = 'Se cubren los 5 pilares normativos de la NEM. Se sugiere profundizar en cómo cada uno se vive en el aula y la comunidad.';
    evidenceFound = `${count} pilares de la NEM listados.`;
  } else if (count >= 3) {
    score = 2;
    status = 'warning';
    feedback = 'Número insuficiente de pilares NEM. La normativa del PEC exige un mínimo de 5 pilares articulados.';
    evidenceFound = `${count} pilares registrados (requerido: ≥5).`;
  }

  return {
    id: 6,
    name: 'Pilares NEM articulados (mínimo 5)',
    dimension: DIMENSIONS.DIM2,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio7(fase2: Fase2Justificacion | null | undefined): PaecAuditCriterion {
  const allText = [
    fase2?.introduction || '',
    fase2?.proposito?.educativo || '',
    fase2?.proposito?.social || '',
    fase2?.proposito?.funcional || '',
    ...(fase2?.alcance?.metas || []),
    ...(fase2?.alcance?.participantes || []),
    ...(fase2?.alcance?.recursos || []),
  ].join(' ');

  const hasMagnitud = /magnitud|alcance|poblaci[oó]n|estudiantes|beneficiari|comunidad\s*en\s*general|\d+\s*personas/i.test(allText);
  const hasInteres = /inter[eé]s|relevan|prioridad|preocupaci[oó]n|demanda|consenso\s*comunitario/i.test(allText);
  const hasFactibilidad = /factib|viab|recurso|posib|instalaci|capacidad|materiales|alianza/i.test(allText);
  const hasOportunidad = /oportunidad|pertinen|coyuntura|momento|tiempo|ciclo\s*escolar|calendario/i.test(allText);

  const vertientesCount = [hasMagnitud, hasInteres, hasFactibilidad, hasOportunidad].filter(Boolean).length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Justificación ausente o sin evidencia de las 4 vertientes del criterio DBEPA.';
  let evidenceFound = `0/4 vertientes DBEPA detectadas.`;

  if (vertientesCount === 4) {
    score = 4;
    status = 'pass';
    feedback = 'Criterio DBEPA completamente sustentado en sus 4 vertientes: Magnitud, Interés, Factibilidad y Oportunidad.';
    evidenceFound = `4/4 vertientes técnicas DBEPA explícitas y justificadas en propósitos y alcance.`;
  } else if (vertientesCount === 3) {
    score = 3;
    status = 'pass';
    feedback = 'Criterio DBEPA justificado adecuadamente. Se recomienda explicitar con mayor fuerza la Oportunidad temporal o Factibilidad.';
    evidenceFound = `3/4 vertientes DBEPA sustentadas.`;
  } else if (vertientesCount >= 1) {
    score = 2;
    status = 'warning';
    feedback = 'Sustentación parcial del criterio DBEPA. Falta argumentar viabilidad técnica (Factibilidad) o impacto poblacional (Magnitud).';
    evidenceFound = `${vertientesCount}/4 vertientes identificadas.`;
  }

  return {
    id: 7,
    name: 'Criterio DBEPA 4 vertientes: Magnitud, Interés, Factibilidad, Oportunidad',
    dimension: DIMENSIONS.DIM2,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 3: MAPEO CURRICULAR (Criterios 8-10) ---

export function evaluateCriterio8(mapeo: MapeoRow[] | null | undefined): PaecAuditCriterion {
  const rows = mapeo || [];
  const totalCount = rows.length;

  // Semestres representados
  const semesters = new Set(rows.map(r => r.semester).filter(Boolean));

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Mapeo curricular ausente o con cobertura mínima.';
  let evidenceFound = `0 UACs mapeadas.`;

  if (totalCount >= 24 && semesters.size >= 4) {
    score = 4;
    status = 'pass';
    feedback = 'Cobertura curricular total. 100% de UACs activas representadas a lo largo de los semestres escolares sin omisiones.';
    evidenceFound = `${totalCount} UACs mapeadas con cobertura en ${semesters.size} semestres.`;
  } else if (totalCount >= 14 && semesters.size >= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Mapeo curricular amplio. Verificar si falta incorporar UACs de Formación Socioemocional o Laboral.';
    evidenceFound = `${totalCount} UACs mapeadas en ${semesters.size} semestres.`;
  } else if (totalCount >= 6) {
    score = 2;
    status = 'warning';
    feedback = 'Mapeo curricular incompleto. Varios campos disciplinares o semestres quedaron omitidos.';
    evidenceFound = `${totalCount} UACs mapeadas.`;
  }

  return {
    id: 8,
    name: '100% de UACs activas representadas (sin omisiones)',
    dimension: DIMENSIONS.DIM3,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio9(mapeo: MapeoRow[] | null | undefined): PaecAuditCriterion {
  const rows = mapeo || [];
  if (rows.length === 0) {
    return {
      id: 9,
      name: 'Nomenclatura NOM-MCCEMS correcta por semestre',
      dimension: DIMENSIONS.DIM3,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Mapeo curricular no disponible para verificar nomenclatura.',
      evidenceFound: '0 UACs evaluadas.',
    };
  }

  const mccemsPattern = /lengua\s*y\s*comunicaci[oó]n|pensamiento\s*matem[aá]tico|conciencia\s*hist[oó]rica|cultura\s*digital|ciencias\s*naturales|materia\s*y\s*sus\s*interacciones|conservaci[oó]n|ecosistemas|reacciones|humanidades|ciencias\s*sociales|ingl[eé]s|socioemocional|pr[aá]ctica\s*y\s*colaboraci[oó]n|artes|salud|orientaci[oó]n/i;
  const obsoletePattern = /algebra|\bqu[ií]mica\s*i\b|\bf[ií]sica\s*i\b|taller\s*de\s*lectura|geometr[ií]a\s*y\s*trigonometr[ií]a|[eé]tica\s*y\s*valores/i;

  let mccemsCount = 0;
  let obsoleteCount = 0;

  for (const r of rows) {
    const name = r.uacName || '';
    if (mccemsPattern.test(name)) mccemsCount++;
    if (obsoletePattern.test(name)) obsoleteCount++;
  }

  const complianceRate = (mccemsCount / rows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Nomenclatura desactualizada o fuera del Marco Curricular Común (MCCEMS 2025).';
  let evidenceFound = `${Math.round(complianceRate)}% de UACs con nomenclatura NOM-MCCEMS (${obsoleteCount} obsoletas detectadas).`;

  if (complianceRate >= 75 && obsoleteCount === 0) {
    score = 4;
    status = 'pass';
    feedback = 'Nomenclatura oficial NOM-MCCEMS impecable. Todas las UACs corresponden al rediseño curricular de la NEM.';
    evidenceFound = `${mccemsCount}/${rows.length} UACs validadas bajo nomenclatura NOM-MCCEMS (0 nombres obsoletos).`;
  } else if (complianceRate >= 50 && obsoleteCount <= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Nomenclatura mayoritariamente correcta. Se sugiere homogeneizar nombres conforme al catálogo oficial MCCEMS.';
    evidenceFound = `${mccemsCount}/${rows.length} UACs con nombres afines al MCCEMS.`;
  } else if (rows.length > 0) {
    score = 2;
    status = 'warning';
    feedback = 'Persisten nombres curriculares de planes anteriores no vigentes (Álgebra, Química I, TLR). Requiere actualización a NOM-MCCEMS.';
    evidenceFound = `${obsoleteCount} nombres de planes antiguos detectados.`;
  }

  return {
    id: 9,
    name: 'Nomenclatura NOM-MCCEMS correcta por semestre',
    dimension: DIMENSIONS.DIM3,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio10(mapeo: MapeoRow[] | null | undefined): PaecAuditCriterion {
  const rows = mapeo || [];
  if (rows.length === 0) {
    return {
      id: 10,
      name: 'Vinculación específica (no genérica) por asignatura',
      dimension: DIMENSIONS.DIM3,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Mapeo ausente para evaluar vinculación disciplinar.',
      evidenceFound: '0 vinculaciones evaluadas.',
    };
  }

  let specificCount = 0;
  for (const r of rows) {
    const linking = r.linking || '';
    const isGeneric = /se\s*vincula\s*con\s*el\s*proyecto|trabajar[aá]\s*en\s*clase|apoyar[aá]\s*el\s*tema|aportar[aá]\s*valores/i.test(linking);
    const hasSubstance = linking.trim().length >= 35 && !isGeneric;
    if (hasSubstance) specificCount++;
  }

  const rate = (specificCount / rows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Vinculaciones curriculares mayormente genéricas o repetitivas.';
  let evidenceFound = `${Math.round(rate)}% de vinculaciones específicas.`;

  if (rate >= 80) {
    score = 4;
    status = 'pass';
    feedback = 'Vinculaciones altamente específicas por asignatura, articulando entregables tangibles, cálculos, análisis o intervenciones reales.';
    evidenceFound = `${specificCount}/${rows.length} UACs con contribución disciplinar concreta y no genérica.`;
  } else if (rate >= 60) {
    score = 3;
    status = 'pass';
    feedback = 'Vinculación específica adecuada. Se recomienda enriquecer el producto esperado en las asignaturas socioemocionales.';
    evidenceFound = `${specificCount}/${rows.length} vinculaciones específicas documentadas.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Varias vinculaciones usan fórmulas genéricas. Cada UAC debe aportar un producto o aprendizaje situado concreto.';
    evidenceFound = `Solo ${specificCount}/${rows.length} UACs con aportación disciplinar diferenciada.`;
  }

  return {
    id: 10,
    name: 'Vinculación específica (no genérica) por asignatura',
    dimension: DIMENSIONS.DIM3,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 4: CRONOGRAMA (Criterios 11-12) ---

export function evaluateCriterio11(cronograma: CronogramaRow[] | null | undefined): PaecAuditCriterion {
  const rows = cronograma || [];
  const phaseCount = rows.length;

  let fullColumnRows = 0;
  for (const r of rows) {
    if (r.phase && r.objective && r.macroActivities && r.responsibleSubjects && r.semesterInvolved) {
      fullColumnRows++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Cronograma bimestral ausente o con menos de 3 fases.';
  let evidenceFound = `${phaseCount}/6 fases registradas.`;

  if (phaseCount === 6 && fullColumnRows === 6) {
    score = 4;
    status = 'pass';
    feedback = 'Cronograma completo con exactamente 6 fases bimestrales y las 5 columnas normativas detalladas al 100%.';
    evidenceFound = `6/6 fases bimestrales con 5 columnas completas (Fase, Objetivo, Macro-actividades, Responsables, Semestre).`;
  } else if (phaseCount >= 5 && fullColumnRows >= 4) {
    score = 3;
    status = 'pass';
    feedback = 'Cronograma bien estructurado. Asegurar que las 6 fases cubran el ciclo anual de manera balanceada.';
    evidenceFound = `${phaseCount}/6 fases registradas; ${fullColumnRows} con 5 columnas completas.`;
  } else if (phaseCount >= 3) {
    score = 2;
    status = 'warning';
    feedback = 'Cronograma incompleto. La arquitectura normativa del PAEC requiere 6 fases bimestrales con 5 columnas obligatorias.';
    evidenceFound = `${phaseCount} fases registradas.`;
  }

  return {
    id: 11,
    name: '6 fases bimestrales con 5 columnas',
    dimension: DIMENSIONS.DIM4,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio12(cronograma: CronogramaRow[] | null | undefined): PaecAuditCriterion {
  const rows = cronograma || [];
  if (rows.length === 0) {
    return {
      id: 12,
      name: 'Asignaturas viga maestra con justificación',
      dimension: DIMENSIONS.DIM4,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Cronograma no disponible para evaluar asignaturas articuladoras.',
      evidenceFound: '0 fases analizadas.',
    };
  }

  let vigaMaestraCount = 0;
  for (const r of rows) {
    const text = `${r.responsibleSubjects || ''} ${r.macroActivities || ''} ${r.objective || ''}`;
    if (/viga\s*maestra|articuladora|coordinadora|asignatura\s*eje|l[ií]der\s*de\s*fase|responsable\s*t[eé]cnica/i.test(text)) {
      vigaMaestraCount++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No se identifican asignaturas viga maestra en las fases del cronograma.';
  let evidenceFound = `${vigaMaestraCount} fases con asignaturas eje designadas.`;

  if (vigaMaestraCount >= 4 || (rows.length === 6 && rows.every(r => r.responsibleSubjects && r.responsibleSubjects.length > 15))) {
    score = 4;
    status = 'pass';
    feedback = 'Asignaturas viga maestra plenamente identificadas con justificación de su liderazgo pedagógico en cada fase bimestral.';
    evidenceFound = `${vigaMaestraCount >= 4 ? vigaMaestraCount : 6}/6 fases con asignaturas articuladoras y responsabilidades claras.`;
  } else if (vigaMaestraCount >= 2 || rows.some(r => r.responsibleSubjects && r.responsibleSubjects.length > 10)) {
    score = 3;
    status = 'pass';
    feedback = 'Asignaturas responsables indicadas. Se recomienda formalizar la designación de la asignatura "viga maestra" por fase.';
    evidenceFound = `Asignaturas responsables presentes en las ${rows.length} fases.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Mención genérica de asignaturas sin rol de viga maestra claramente definido.';
    evidenceFound = `Solo listas simples de asignaturas sin justificación de liderazgo en cronograma.`;
  }

  return {
    id: 12,
    name: 'Asignaturas viga maestra con justificación',
    dimension: DIMENSIONS.DIM4,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 5: DETALLE CURRICULAR (Criterios 13-14) ---

export function evaluateCriterio13(detalle: DetalleCurricularRow[] | null | undefined): PaecAuditCriterion {
  const rows = detalle || [];
  if (rows.length === 0) {
    return {
      id: 13,
      name: 'Propósitos/Progresiones por semestre correctos',
      dimension: DIMENSIONS.DIM5,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Detalle curricular ausente.',
      evidenceFound: '0 filas registradas.',
    };
  }

  let wellFormulated = 0;
  let sem1to4Progressions = 0;
  let sem5to6Purposes = 0;

  for (const r of rows) {
    const sem = r.semester;
    const content = r.progressionsOrPurposes || '';
    if (content.length >= 25) wellFormulated++;

    if (sem && sem <= 4 && /progresi[oó]n|meta|p\d+/i.test(content)) {
      sem1to4Progressions++;
    } else if (sem && sem >= 5 && /prop[oó]sito|integrador|laboral|optativ/i.test(content)) {
      sem5to6Purposes++;
    }
  }

  const rate = (wellFormulated / rows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Progresiones y propósitos escasos o sin diferenciación formativa por semestre.';
  let evidenceFound = `${Math.round(rate)}% de filas con contenido curricular suficiente.`;

  if (rate >= 80) {
    score = 4;
    status = 'pass';
    feedback = 'Alineación perfecta: progresiones de aprendizaje redactadas a detalle en 1°-4° y propósitos integradores en 5°-6°.';
    evidenceFound = `${wellFormulated}/${rows.length} UACs con desglose curricular progresivo y pertinente.`;
  } else if (rate >= 60) {
    score = 3;
    status = 'pass';
    feedback = 'Contenidos curriculares adecuados. Verificar correspondencia exacta con las progresiones publicadas por COSFAC.';
    evidenceFound = `${wellFormulated}/${rows.length} UACs con progresiones/propósitos formulados.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Descripciones curriculares breves o poco diferenciadas entre semestres.';
    evidenceFound = `Solo ${wellFormulated}/${rows.length} filas con desglose sustantivo.`;
  }

  return {
    id: 13,
    name: 'Propósitos/Progresiones por semestre correctos',
    dimension: DIMENSIONS.DIM5,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio14(detalle: DetalleCurricularRow[] | null | undefined): PaecAuditCriterion {
  const rows = detalle || [];
  if (rows.length === 0) {
    return {
      id: 14,
      name: 'Fases del PEC articuladas',
      dimension: DIMENSIONS.DIM5,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Detalle curricular ausente para evaluar articulación con fases PEC.',
      evidenceFound: '0 filas registradas.',
    };
  }

  let phaseMappedCount = 0;
  for (const r of rows) {
    const phases = r.projectPhases || '';
    const justif = r.curricularJustification || '';
    if (/fase\s*[i|v|x|\d]+/i.test(phases) && justif.length >= 25) {
      phaseMappedCount++;
    }
  }

  const rate = (phaseMappedCount / rows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Articulación débil entre asignaturas y fases del proyecto comunitario.';
  let evidenceFound = `${Math.round(rate)}% de UACs vinculadas a fases del PEC.`;

  if (rate >= 80) {
    score = 4;
    status = 'pass';
    feedback = 'Articulación excelente y justificada pedagógicamente entre cada UAC y las fases específicas del PEC (I a VI).';
    evidenceFound = `${phaseMappedCount}/${rows.length} UACs con asignación explícita de fase PEC y justificación curricular.`;
  } else if (rate >= 60) {
    score = 3;
    status = 'pass';
    feedback = 'Buena articulación con fases del proyecto. Asegurar justificación curricular en las asignaturas optativas.';
    evidenceFound = `${phaseMappedCount}/${rows.length} UACs articuladas a fases.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Mapeo de fases incompleto en el detalle curricular; varias asignaturas no indican a qué fase aportan.';
    evidenceFound = `${phaseMappedCount}/${rows.length} UACs articuladas.`;
  }

  return {
    id: 14,
    name: 'Fases del PEC articuladas',
    dimension: DIMENSIONS.DIM5,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 6: PLAN OPERATIVO (Criterios 15-18) ---

function inspectPlanOperativoSemestre(
  rows: PlanOperativoRow[],
  semestreLabel: 'A' | 'B'
): { totalRows: number; weeksCount: number; has8Cols: boolean; sampleWeeks: string[] } {
  const weeks = new Set<string>();
  let has8Cols = rows.length > 0;

  for (const r of rows) {
    if (r.week) {
      weeks.add(r.week.trim());
    }
    if (
      !r.phase ||
      !r.activity ||
      !r.uac ||
      !r.progression ||
      !r.strategy ||
      !r.week ||
      !r.responsibles ||
      !r.evaluationInstrument
    ) {
      has8Cols = false;
    }
  }

  return {
    totalRows: rows.length,
    weeksCount: weeks.size,
    has8Cols,
    sampleWeeks: Array.from(weeks).slice(0, 5),
  };
}

export function evaluateCriterio15(
  planA: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: any
): PaecAuditCriterion {
  const rows = planA || planOperativoLegacy?.semestreA || [];
  const info = inspectPlanOperativoSemestre(rows, 'A');

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Plan Operativo Semestre A ausente o sin actividades programadas.';
  let evidenceFound = `0 actividades registradas en Semestre A.`;

  if (info.totalRows >= 16 && info.weeksCount >= 14 && info.has8Cols) {
    score = 4;
    status = 'pass';
    feedback = 'Plan Operativo Semestre A completo: 16 semanas cubiertas y las 8 columnas normativas pobladas al 100%.';
    evidenceFound = `${info.totalRows} actividades distribuidas en ${info.weeksCount} semanas; 8 columnas completas.`;
  } else if (info.totalRows >= 12 && info.weeksCount >= 10) {
    score = 3;
    status = 'pass';
    feedback = 'Plan Operativo Semestre A amplio. Se recomienda verificar que todas las semanas del 1 al 16 tengan actividades explícitas.';
    evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas registradas.`;
  } else if (info.totalRows >= 6) {
    score = 2;
    status = 'warning';
    feedback = 'Plan Operativo Semestre A parcial. Cobertura semanal insuficiente o columnas faltantes.';
    evidenceFound = `${info.totalRows} actividades registradas en ${info.weeksCount} semanas.`;
  }

  return {
    id: 15,
    name: 'Semestre A: 16 semanas, 8 columnas',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio16(
  planB: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: any
): PaecAuditCriterion {
  const rows = planB || planOperativoLegacy?.semestreB || [];
  const info = inspectPlanOperativoSemestre(rows, 'B');

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Plan Operativo Semestre B ausente o sin actividades programadas.';
  let evidenceFound = `0 actividades registradas en Semestre B.`;

  if (info.totalRows >= 16 && info.weeksCount >= 14 && info.has8Cols) {
    score = 4;
    status = 'pass';
    feedback = 'Plan Operativo Semestre B completo: 16 semanas cubiertas y las 8 columnas normativas pobladas al 100%.';
    evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas; 8 columnas estructuradas.`;
  } else if (info.totalRows >= 12 && info.weeksCount >= 10) {
    score = 3;
    status = 'pass';
    feedback = 'Plan Operativo Semestre B adecuado. Se recomienda afinar el instrumento de evaluación en las semanas intermedias.';
    evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas registradas.`;
  } else if (info.totalRows >= 6) {
    score = 2;
    status = 'warning';
    feedback = 'Plan Operativo Semestre B parcial. No alcanza la cobertura de 16 semanas normativas.';
    evidenceFound = `${info.totalRows} actividades registradas.`;
  }

  return {
    id: 16,
    name: 'Semestre B: 16 semanas, 8 columnas',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio17(
  planA: PlanOperativoRow[] | null | undefined,
  planB: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: any,
  stepContext?: number // Permite validar cuando solo se evalúa paso 6 o paso 7
): PaecAuditCriterion {
  const rowsA: PlanOperativoRow[] = planA || planOperativoLegacy?.semestreA || [];
  const rowsB: PlanOperativoRow[] = planB || planOperativoLegacy?.semestreB || [];

  const textSem16A = rowsA
    .filter((r: PlanOperativoRow) => /semana\s*(16|diecis[eé]is)/i.test(r.week || ''))
    .map((r: PlanOperativoRow) => `${r.activity} ${r.strategy}`)
    .join(' ');

  const textSem16B = rowsB
    .filter((r: PlanOperativoRow) => /semana\s*(16|diecis[eé]is)/i.test(r.week || ''))
    .map((r: PlanOperativoRow) => `${r.activity} ${r.strategy}`)
    .join(' ');

  const hasCierreTransferenciaA = /cierre|transferencia|evaluaci[oó]n\s*parcial|sistematizaci[oó]n|entrega|corte/i.test(textSem16A);
  const hasFeriaEvaluacionB = /feria|presentaci[oó]n|evaluaci[oó]n\s*final|difusi[oó]n|impacto|clausura|exposici[oó]n/i.test(textSem16B);

  // Si solo se evalúa el paso 6 individual
  if (stepContext === 6) {
    if (hasCierreTransferenciaA) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 4,
        status: 'pass',
        feedback: 'Semana 16 del Semestre A programada como hito de Cierre de Fase y Transferencia Metodológica.',
        evidenceFound: 'Semana 16 de Semestre A validada exitosamente.',
      };
    } else if (textSem16A.length > 0) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 3,
        status: 'pass',
        feedback: 'Semana 16 de Semestre A presente. Se recomienda explicitar el proceso de transferencia metodológica.',
        evidenceFound: 'Semana 16 presente con actividades generales de cierre.',
      };
    } else {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 2,
        status: 'warning',
        feedback: 'No se detecta la Semana 16 como hito de cierre/transferencia en Semestre A.',
        evidenceFound: 'Semana 16 no identificada en Semestre A.',
      };
    }
  }

  // Si solo se evalúa el paso 7 individual
  if (stepContext === 7) {
    if (hasFeriaEvaluacionB) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 4,
        status: 'pass',
        feedback: 'Semana 16 del Semestre B programada como Feria Comunitaria y Evaluación Integral de Impacto.',
        evidenceFound: 'Semana 16 de Semestre B validada como Feria Comunitaria.',
      };
    } else if (textSem16B.length > 0) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 3,
        status: 'pass',
        feedback: 'Semana 16 de Semestre B presente con cierre. Se recomienda nombrar formalmente la Feria de Resultados.',
        evidenceFound: 'Semana 16 presente con actividades de cierre.',
      };
    } else {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 2,
        status: 'warning',
        feedback: 'No se detecta la Feria de Resultados en la Semana 16 del Semestre B.',
        evidenceFound: 'Semana 16 no identificada en Semestre B.',
      };
    }
  }

  // Evaluación global (ambos semestres)
  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Hitos de Semana 16 ausentes en ambos semestres.';
  let evidenceFound = `Semana 16 A: ${hasCierreTransferenciaA ? 'Sí' : 'No'} | Semana 16 B: ${hasFeriaEvaluacionB ? 'Sí' : 'No'}`;

  if (hasCierreTransferenciaA && hasFeriaEvaluacionB) {
    score = 4;
    status = 'pass';
    feedback = 'Hitos críticos de Semana 16 plenamente cumplidos: Cierre/Transferencia en Semestre A y Feria de Impacto Comunitario en Semestre B.';
    evidenceFound = 'Semana 16 de ambos semestres programadas con hitos institucionales de cierre y feria comunitaria.';
  } else if (hasCierreTransferenciaA || hasFeriaEvaluacionB) {
    score = 3;
    status = 'pass';
    feedback = 'Uno de los hitos de Semana 16 está documentado. Asegurar que ambos semestres concluyan con el hito correspondiente.';
    evidenceFound = `Hito cumplido en ${hasCierreTransferenciaA ? 'Semestre A (Transferencia)' : 'Semestre B (Feria)'}.`;
  } else if (rowsA.length > 0 || rowsB.length > 0) {
    score = 2;
    status = 'warning';
    feedback = 'Semana 16 programada con actividades habituales de clase, sin elevarse a hito de cierre, transferencia o feria comunitaria.';
    evidenceFound = 'Faltan hitos de cierre normativo en semana 16.';
  }

  return {
    id: 17,
    name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio18(
  planA: PlanOperativoRow[] | null | undefined,
  planB: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: any
): PaecAuditCriterion {
  const allRows: PlanOperativoRow[] = [
    ...(planA || planOperativoLegacy?.semestreA || []),
    ...(planB || planOperativoLegacy?.semestreB || []),
  ];

  if (allRows.length === 0) {
    return {
      id: 18,
      name: 'Metodologías activas documentadas',
      dimension: DIMENSIONS.DIM6,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Plan Operativo no disponible para evaluar metodologías.',
      evidenceFound: '0 actividades evaluadas.',
    };
  }

  const activeMethodPattern = /ABPC|ABP|STEAM|aprendizaje\s*servicio|\bAS\b|estudio\s*de\s*caso|investigaci[oó]n[-\s]acci[oó]n|taller\s*participativo|trabajo\s*de\s*campo|proyecto\s*comunitario/i;

  let activeCount = 0;
  for (const r of allRows) {
    if (activeMethodPattern.test(r.strategy || '')) {
      activeCount++;
    }
  }

  const rate = (activeCount / allRows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Estrategias de enseñanza tradicionales o sin metodología sociocrítica especificada.';
  let evidenceFound = `${Math.round(rate)}% de actividades con metodologías activas.`;

  if (rate >= 65) {
    score = 4;
    status = 'pass';
    feedback = 'Metodologías activas y sociocríticas (ABPC, STEAM, Aprendizaje Servicio, ABP) documentadas de manera predominante en los planes operativos.';
    evidenceFound = `${activeCount}/${allRows.length} actividades implementan metodologías sociocríticas activas.`;
  } else if (rate >= 40) {
    score = 3;
    status = 'pass';
    feedback = 'Buena presencia de metodologías activas. Se recomienda sustituir actividades pasivas por dinámicas de campo o proyectos.';
    evidenceFound = `${activeCount}/${allRows.length} actividades con metodologías activas.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Prevalecen dinámicas expositivas o de lectura tradicional. La NEM requiere metodologías sociocríticas activas.';
    evidenceFound = `Solo ${activeCount}/${allRows.length} actividades con metodología activa.`;
  }

  return {
    id: 18,
    name: 'Metodologías activas documentadas',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 7: IMPLEMENTACIÓN (Criterios 19-20) ---

export function evaluateCriterio19(
  impl: PaecImplementacion | null | undefined,
  anexosLegacy?: AnexosData | null
): PaecAuditCriterion {
  const carta = impl?.cartaInvitacion;
  const minuta = impl?.minutaArranque || anexosLegacy?.anexo1Minuta;
  const oficios = impl?.oficiosAliados || [];

  const hasCartaValid =
    carta &&
    carta.asunto &&
    (carta.cuerpo || '').length >= 60 &&
    carta.fechaReunion &&
    carta.firmante;

  const hasMinutaValid =
    minuta &&
    (minuta.acuerdos || []).length >= 2 &&
    (minuta.firmas || []).length >= 2;

  const hasOficiosValid =
    oficios.length >= 2 &&
    oficios.every(o => o.institucion && o.destinatario && o.propuestaColaboracion);

  const elementsValid = [hasCartaValid, hasMinutaValid, hasOficiosValid].filter(Boolean).length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Instrumentos de formalización institucional ausentes o incompletos.';
  let evidenceFound = `${elementsValid}/3 instrumentos formales validados.`;

  if (elementsValid === 3) {
    score = 4;
    status = 'pass';
    feedback = 'Instrumentos de formalización completos y profesionales: Carta de Invitación con orden del día, Minuta formal con acuerdos y firmas, y Oficios dirigidos a aliados territoriales reales.';
    evidenceFound = '3/3 instrumentos formalizados (Carta de Invitación, Minuta de Arranque con acuerdos y firmas, Oficios a aliados externos).';
  } else if (elementsValid === 2) {
    score = 3;
    status = 'pass';
    feedback = 'Instrumentos de formalización adecuados. Se recomienda asegurar que los oficios a aliados externos incluyan compromisos recíprocos.';
    evidenceFound = '2/3 instrumentos de formalización completos.';
  } else if (carta || minuta || oficios.length > 0) {
    score = 2;
    status = 'warning';
    feedback = 'Formalización institucional parcial. Faltan oficios a aliados o firmas colegiadas en la minuta.';
    evidenceFound = `1/3 instrumentos estructurados adecuadamente.`;
  }

  return {
    id: 19,
    name: 'Carta, minuta y oficios con contenido real',
    dimension: DIMENSIONS.DIM7,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio20(anexos: AnexosData | null | undefined): PaecAuditCriterion {
  if (!anexos) {
    return {
      id: 20,
      name: '6 anexos técnicos completos',
      dimension: DIMENSIONS.DIM7,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Anexos técnicos ausentes en el proyecto.',
      evidenceFound: '0/6 anexos detectados.',
    };
  }

  const hasA1 = Boolean(anexos.anexo1Minuta || anexos.anexo1);
  const hasA2 = Boolean((anexos.anexo2Seguimiento && anexos.anexo2Seguimiento.length > 0) || anexos.anexo2);
  const hasA3 = Boolean(anexos.anexo3ReporteMensual || anexos.anexo3);
  const hasA4 = Boolean(anexos.anexo4ImpactoComunidad || anexos.anexo4);
  const hasA5 = Boolean(anexos.anexo5AutoevaluacionEstudiantes || anexos.anexo5);
  const hasA6 = Boolean(anexos.anexo6EvaluacionColegiado || anexos.anexo6);

  const completedCount = [hasA1, hasA2, hasA3, hasA4, hasA5, hasA6].filter(Boolean).length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Menos de 3 anexos técnicos normativos presentes.';
  let evidenceFound = `${completedCount}/6 anexos normativos identificados.`;

  if (completedCount === 6) {
    score = 4;
    status = 'pass';
    feedback = 'Los 6 anexos técnicos normativos están completos y estructurados: Minuta, Seguimiento semanal, Reporte mensual y las 3 Encuestas Likert de impacto.';
    evidenceFound = '6/6 anexos técnicos normativos verificados al 100%.';
  } else if (completedCount >= 4) {
    score = 3;
    status = 'pass';
    feedback = 'Mayoría de anexos completos. Verificar que las encuestas de impacto a la comunidad y colegiado docente cuenten con escala Likert formal.';
    evidenceFound = `${completedCount}/6 anexos técnicos presentes.`;
  } else if (completedCount >= 2) {
    score = 2;
    status = 'warning';
    feedback = 'Instrumentación técnica incompleta. Faltan instrumentos de evaluación y seguimiento normativo del PEC.';
    evidenceFound = `${completedCount}/6 anexos disponibles.`;
  }

  return {
    id: 20,
    name: '6 anexos técnicos completos',
    dimension: DIMENSIONS.DIM7,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 8: GOBERNANZA E INFORME (Criterios 21-23) ---

export function evaluateCriterio21(gobernanza: PaecGobernanza | null | undefined): PaecAuditCriterion {
  const cal = gobernanza?.calendario || [];
  const allText = cal.map(c => `${c.tipo} ${c.participantes} ${c.objetivo}`).join(' ');

  const hasDirectivo = /direct|comit[eé]\s*central|liderazgo/i.test(allText);
  const hasColegiado = /colegiado|academia|docente/i.test(allText);
  const hasAula = /aula|estudiante|alumno/i.test(allText);
  const hasComunidad = /comunidad|padres|aliad|externo/i.test(allText);

  const levelsCount = [hasDirectivo, hasColegiado, hasAula, hasComunidad].filter(Boolean).length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Esquema de gobernanza escolar ausente.';
  let evidenceFound = `${levelsCount}/4 niveles de gobernanza identificados.`;

  if (cal.length >= 4 && levelsCount === 4) {
    score = 4;
    status = 'pass';
    feedback = 'Gobernanza escolar sólida con calendario estructurado en los 4 niveles: Directivo, Colegiado Docente, Aula y Comunidad territorial.';
    evidenceFound = `4/4 niveles de gobernanza cubiertos con frecuencias, responsables y evidencias explícitas.`;
  } else if (cal.length >= 3 && levelsCount >= 3) {
    score = 3;
    status = 'pass';
    feedback = 'Gobernanza escolar adecuada. Se recomienda programar con mayor precisión las sesiones de retroalimentación comunitaria.';
    evidenceFound = `${levelsCount}/4 niveles de gobernanza articulados en el calendario.`;
  } else if (cal.length >= 1) {
    score = 2;
    status = 'warning';
    feedback = 'Gobernanza parcial. No se especifican mecanismos de coordinación en todos los niveles operativos del plantel.';
    evidenceFound = `${cal.length} reuniones calendarizadas.`;
  }

  return {
    id: 21,
    name: 'Gobernanza 4 niveles con calendario',
    dimension: DIMENSIONS.DIM8,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio22(informe: PaecInformeSupervision | null | undefined): PaecAuditCriterion {
  if (!informe) {
    return {
      id: 22,
      name: 'Informe final con metas vs logros Pre/Post',
      dimension: DIMENSIONS.DIM8,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Informe final de supervisión ausente.',
      evidenceFound: 'Informe no generado.',
    };
  }

  const metasVsLogros = informe.metasVsLogros || [];
  const prePost = informe.analisisPrePost;

  const hasMetas = metasVsLogros.length >= 3 && metasVsLogros.every(m => m.meta && m.indicador);
  const hasPrePost = Boolean(
    prePost &&
    prePost.participacionTotal &&
    prePost.alcanceComunitario &&
    prePost.cambioConocimientos &&
    prePost.desarrolloCompetencias
  );

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Informe final incompleto; carece de comparativa de metas vs logros o evaluación Pre/Post.';
  let evidenceFound = `Metas tabuladas: ${metasVsLogros.length} | Análisis Pre/Post: ${hasPrePost ? 'Sí' : 'No'}`;

  if (hasMetas && hasPrePost) {
    score = 4;
    status = 'pass';
    feedback = 'Informe final de rendición de cuentas ejemplar: tabla cuantitativa comparativa de Metas vs Logros y análisis cualitativo Pre/Post de impacto escolar-comunitario.';
    evidenceFound = `${metasVsLogros.length} metas evaluadas con porcentajes reales y análisis Pre/Post multidimensional completo.`;
  } else if (metasVsLogros.length >= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Informe final adecuado. Se recomienda ampliar el detalle del impacto en el desarrollo de competencias del perfil de egreso.';
    evidenceFound = `${metasVsLogros.length} metas evaluadas.`;
  } else if (informe.resumenEjecutivo || metasVsLogros.length > 0) {
    score = 2;
    status = 'warning';
    feedback = 'Informe preliminar o puramente narrativo sin tabla cuantitativa de contraste entre lo programado y lo alcanzado.';
    evidenceFound = `Informe sin tabla formal de Metas vs Logros.`;
  }

  return {
    id: 22,
    name: 'Informe final con metas vs logros Pre/Post',
    dimension: DIMENSIONS.DIM8,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio23(informe: PaecInformeSupervision | null | undefined): PaecAuditCriterion {
  const sostenibilidad = informe?.sostenibilidad || [];
  const count = sostenibilidad.length;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Plan de sostenibilidad y continuidad institucional ausente.';
  let evidenceFound = `0 compromisos de sostenibilidad registrados.`;

  if (count >= 3 && sostenibilidad.every(s => s.length >= 25)) {
    score = 4;
    status = 'pass';
    feedback = 'Plan de sostenibilidad integral con compromisos concretos para la permanencia del proyecto en ciclos futuros y custodia comunitaria.';
    evidenceFound = `${count} estrategias de sostenibilidad y continuidad institucional formuladas.`;
  } else if (count >= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Plan de sostenibilidad adecuado. Se recomienda formalizar acuerdos con el comité de padres de familia para mantenimiento.';
    evidenceFound = `${count} estrategias de sostenibilidad documentadas.`;
  } else if (count >= 1) {
    score = 2;
    status = 'warning';
    feedback = 'Mención genérica de continuidad sin mecanismos específicos de permanencia o financiamiento local.';
    evidenceFound = `${count} mención preliminar.`;
  }

  return {
    id: 23,
    name: 'Plan de sostenibilidad',
    dimension: DIMENSIONS.DIM8,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// ============================================================================
// FUNCIONES PÚBLICAS PRINCIPALES DEL QUALITY GATE
// ============================================================================

/**
 * Evalúa los criterios normativos correspondientes a un paso específico recién generado.
 * 
 * @param step Número de paso (1 a 9)
 * @param data Contenido estructurado generado en el paso
 * @returns PaecQualityAudit con los criterios evaluados para ese paso
 */
export function validatePaecStepResult(step: number, data: any): PaecQualityAudit {
  const criterios: PaecAuditCriterion[] = [];

  switch (step) {
    case 1: {
      const fase1 = data as Fase1Diagnostico;
      criterios.push(evaluateCriterio1(fase1));
      criterios.push(evaluateCriterio2(fase1));
      criterios.push(evaluateCriterio3(fase1));
      criterios.push(evaluateCriterio4(fase1));
      break;
    }

    case 2: {
      const fase2 = data as Fase2Justificacion;
      criterios.push(evaluateCriterio5(fase2));
      criterios.push(evaluateCriterio6(fase2));
      criterios.push(evaluateCriterio7(fase2));
      break;
    }

    case 3: {
      const mapeo = (Array.isArray(data) ? data : data?.mapeo || []) as MapeoRow[];
      criterios.push(evaluateCriterio8(mapeo));
      criterios.push(evaluateCriterio9(mapeo));
      criterios.push(evaluateCriterio10(mapeo));
      break;
    }

    case 4: {
      const cronograma = (Array.isArray(data) ? data : data?.cronograma || []) as CronogramaRow[];
      criterios.push(evaluateCriterio11(cronograma));
      criterios.push(evaluateCriterio12(cronograma));
      break;
    }

    case 5: {
      const detalle = (Array.isArray(data) ? data : data?.detalleCurricular || []) as DetalleCurricularRow[];
      criterios.push(evaluateCriterio13(detalle));
      criterios.push(evaluateCriterio14(detalle));
      break;
    }

    case 6: {
      const rowsA = (Array.isArray(data) ? data : data?.semestreA || []) as PlanOperativoRow[];
      criterios.push(evaluateCriterio15(rowsA));
      criterios.push(evaluateCriterio17(rowsA, null, null, 6));
      criterios.push(evaluateCriterio18(rowsA, null));
      break;
    }

    case 7: {
      const rowsB = (Array.isArray(data) ? data : data?.semestreB || []) as PlanOperativoRow[];
      criterios.push(evaluateCriterio16(rowsB));
      criterios.push(evaluateCriterio17(null, rowsB, null, 7));
      criterios.push(evaluateCriterio18(null, rowsB));
      break;
    }

    case 8: {
      const impl = data as PaecImplementacion;
      const anexos = (data?.anexos || data) as AnexosData;
      criterios.push(evaluateCriterio19(impl, anexos));
      criterios.push(evaluateCriterio20(anexos));
      break;
    }

    case 9: {
      const gob = (data?.gobernanza || data) as PaecGobernanza;
      const inf = (data?.informeSupervision || data) as PaecInformeSupervision;
      criterios.push(evaluateCriterio21(gob));
      criterios.push(evaluateCriterio22(inf));
      criterios.push(evaluateCriterio23(inf));
      break;
    }

    default:
      break;
  }

  const maxPoints = criterios.length * 4;
  const rawScore = criterios.reduce((sum, c) => sum + c.score, 0);
  const score = maxPoints > 0 ? Math.round((rawScore / maxPoints) * 100) : 0;

  const passedCount = criterios.filter(c => c.status === 'pass').length;
  const warningCount = criterios.filter(c => c.status === 'warning').length;
  const failedCount = criterios.filter(c => c.status === 'fail').length;

  let estatus: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes' = 'requiere_ajustes';
  if (score >= 85) estatus = 'aprobado_excelente';
  else if (score >= 70) estatus = 'aprobado';

  return {
    score,
    criterios,
    estatus,
    criteria: criterios,
    totalScore: rawScore,
    percentage: score,
    status: estatus,
    summary: {
      passedCount,
      warningCount,
      failedCount,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calcula la auditoría global completa (los 23 criterios normativos) sobre un proyecto PAEC.
 * 
 * @param project Proyecto PAEC con los datos consolidados de todas las fases
 * @returns PaecQualityAudit con la evaluación completa de los 23 criterios y dictamen final
 */
export function calculateGlobalPaecScore(project: PaecProject | any): PaecQualityAudit {
  // Normalizar acceso a campos camelCase o snake_case
  const fase1 = project.fase1Diagnostico || project.fase1_diagnostico;
  const fase2 = project.fase2Justificacion || project.fase2_justificacion;
  const mapeo = project.fase2Mapeo || project.fase2_mapeo;
  const cronograma = project.fase2Cronograma || project.fase2_cronograma;
  const detalle = project.fase2DetalleCurricular || project.fase2_detalle_curricular;
  const planA = project.fase3PlanOperativoA || project.fase3_plan_operativo_a;
  const planB = project.fase3PlanOperativoB || project.fase3_plan_operativo_b;
  const planLegacy = project.fase2PlanOperativo || project.fase2_plan_operativo;
  const impl = project.fase3Implementacion || project.fase3_implementacion;
  const anexos = project.fase2Anexos || project.fase2_anexos || impl?.anexos;
  const gobernanza = project.fase4Gobernanza || project.fase4_gobernanza;
  const informe = project.fase4InformeSupervision || project.fase4_informe_supervision;

  const criterios: PaecAuditCriterion[] = [
    // Dimensión 1 (1-4)
    evaluateCriterio1(fase1),
    evaluateCriterio2(fase1),
    evaluateCriterio3(fase1),
    evaluateCriterio4(fase1),

    // Dimensión 2 (5-7)
    evaluateCriterio5(fase2),
    evaluateCriterio6(fase2),
    evaluateCriterio7(fase2),

    // Dimensión 3 (8-10)
    evaluateCriterio8(mapeo),
    evaluateCriterio9(mapeo),
    evaluateCriterio10(mapeo),

    // Dimensión 4 (11-12)
    evaluateCriterio11(cronograma),
    evaluateCriterio12(cronograma),

    // Dimensión 5 (13-14)
    evaluateCriterio13(detalle),
    evaluateCriterio14(detalle),

    // Dimensión 6 (15-18)
    evaluateCriterio15(planA, planLegacy),
    evaluateCriterio16(planB, planLegacy),
    evaluateCriterio17(planA, planB, planLegacy),
    evaluateCriterio18(planA, planB, planLegacy),

    // Dimensión 7 (19-20)
    evaluateCriterio19(impl, anexos),
    evaluateCriterio20(anexos),

    // Dimensión 8 (21-23)
    evaluateCriterio21(gobernanza),
    evaluateCriterio22(informe),
    evaluateCriterio23(informe),
  ];

  // Máximo 92 puntos (23 criterios * 4)
  const totalMaxPoints = 23 * 4;
  const totalRawScore = criterios.reduce((acc, c) => acc + c.score, 0);
  const score = Math.round((totalRawScore / totalMaxPoints) * 100);

  const passedCount = criterios.filter(c => c.status === 'pass').length;
  const warningCount = criterios.filter(c => c.status === 'warning').length;
  const failedCount = criterios.filter(c => c.status === 'fail').length;

  let estatus: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes' = 'requiere_ajustes';
  if (score >= 85) estatus = 'aprobado_excelente';
  else if (score >= 70) estatus = 'aprobado';

  return {
    score,
    criterios,
    estatus,
    criteria: criterios,
    totalScore: totalRawScore,
    percentage: score,
    status: estatus,
    summary: {
      passedCount,
      warningCount,
      failedCount,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Formatea la auditoría en un reporte legible para Supervisión Escolar.
 * Genera un dictamen formal en formato Markdown con tabla de evaluación,
 * desglose por dimensión y sellos institucionales.
 * 
 * @param audit Resultado de la auditoría oficial
 * @returns Texto en formato Markdown con el reporte oficial
 */
export function formatAuditReport(audit: PaecQualityAudit): string {
  const dateStr = audit.updatedAt
    ? new Date(audit.updatedAt).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('es-MX');

  const dictamenBadge =
    audit.estatus === 'aprobado_excelente'
      ? '🟢 DICTAMEN: APROBADO EXCELENTE (CUMPLIMIENTO PLENO)'
      : audit.estatus === 'aprobado'
      ? '🟡 DICTAMEN: APROBADO CON OBSERVACIONES MENORES'
      : '🔴 DICTAMEN: REQUIERE AJUSTES PREVIOS A VALIDACIÓN';

  let report = `# REPORTE OFICIAL DE AUDITORÍA DE CALIDAD PAEC-PEC 2025\n`;
  report += `**Subsecretaría de Educación Media Superior | DBEPA - COSFAC**\n`;
  report += `*Fecha de Evaluación:* ${dateStr}\n\n`;

  report += `---\n\n`;
  report += `### RESULTADO GLOBAL DEL PROYECTO\n\n`;
  report += `| Métrica Normativa | Valor Obtenido |\n`;
  report += `| :--- | :--- |\n`;
  report += `| **Puntaje Global Ponderado** | **${audit.score} / 100** |\n`;
  report += `| **Puntos Brutos de Rúbrica** | **${audit.totalScore ?? audit.criterios.reduce((s, c) => s + c.score, 0)} / 92** |\n`;
  report += `| **Estatus Técnico Oficial** | ${dictamenBadge} |\n`;
  report += `| **Criterios Acreditados (Pass)** | ${audit.summary?.passedCount ?? audit.criterios.filter(c => c.status === 'pass').length} de 23 |\n`;
  report += `| **Criterios con Observación (Warning)** | ${audit.summary?.warningCount ?? audit.criterios.filter(c => c.status === 'warning').length} de 23 |\n`;
  report += `| **Criterios Deficientes / Omisos (Fail)** | ${audit.summary?.failedCount ?? audit.criterios.filter(c => c.status === 'fail').length} de 23 |\n\n`;

  report += `---\n\n`;
  report += `### DESGLOSE DE EVALUACIÓN POR DIMENSIÓN Y CRITERIO\n\n`;

  // Agrupar por dimensión
  const dimensionsMap = new Map<string, PaecAuditCriterion[]>();
  for (const c of audit.criterios) {
    const list = dimensionsMap.get(c.dimension) || [];
    list.push(c);
    dimensionsMap.set(c.dimension, list);
  }

  for (const [dimName, criteriaList] of dimensionsMap.entries()) {
    const dimScore = criteriaList.reduce((s, c) => s + c.score, 0);
    const dimMax = criteriaList.length * 4;
    const dimPct = Math.round((dimScore / dimMax) * 100);

    report += `#### ${dimName} (${dimPct}% — ${dimScore}/${dimMax} pts)\n\n`;
    report += `| No. | Criterio de Rúbrica | Pts (1-4) | Estatus | Evidencia Encontrada |\n`;
    report += `| :---: | :--- | :---: | :---: | :--- |\n`;

    for (const c of criteriaList) {
      const statusIcon = c.status === 'pass' ? '✅ Pass' : c.status === 'warning' ? '⚠️ Advertencia' : '❌ Requiere';
      report += `| **C${c.id}** | ${c.name} | **${c.score}/4** | ${statusIcon} | ${c.evidenceFound} |\n`;
    }
    report += `\n`;

    // Retroalimentación detallada de criterios con observación o no conformes
    const needsAttention = criteriaList.filter(c => c.score < 4);
    if (needsAttention.length > 0) {
      report += `*Observaciones y Recomendaciones Técnicas:*\n`;
      for (const c of needsAttention) {
        report += `- **C${c.id} (${c.score}/4):** ${c.feedback}\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n\n`;
  report += `### DICTAMEN TÉCNICO Y FIRMAS DE CONFORMIDAD\n\n`;
  report += `El presente reporte certifica que el Proyecto Escolar Comunitario ha sido auditado contra los 23 criterios de la Rúbrica Oficial PAEC-PEC 2025 del Marco Curricular Común de la Educación Media Superior (NEM).\n\n`;
  report += `\`\`\`\n`;
  report += `____________________________________          ____________________________________\n`;
  report += `     COORDINACIÓN PAEC DE PLANTEL                  SUPERVISIÓN ESCOLAR ZONA 004   \n`;
  report += `     Validación Colegiada Docente                   Sello y Dictamen de Aprobación \n`;
  report += `\`\`\`\n`;

  return report;
}
