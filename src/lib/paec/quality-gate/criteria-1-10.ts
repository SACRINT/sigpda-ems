import type {
  PaecAuditCriterion,
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
} from '@/types/paec';
import { DIMENSIONS, hasDigits, hasPercentage, type LooseTableRow } from './shared';

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
  let feedback = 'Justificación ausente o sin evidencia de las 4 vertientes del criterio normativo.';
  let evidenceFound = `0/4 vertientes institucionales detectadas.`;

  if (vertientesCount === 4) {
    score = 4;
    status = 'pass';
    feedback = 'Criterio normativo completamente sustentado en sus 4 vertientes: Magnitud, Interés, Factibilidad y Oportunidad.';
    evidenceFound = `4/4 vertientes técnicas MCCEMS explícitas y justificadas en propósitos y alcance.`;
  } else if (vertientesCount === 3) {
    score = 3;
    status = 'pass';
    feedback = 'Criterio normativo justificado adecuadamente. Se recomienda explicitar con mayor fuerza la Oportunidad temporal o Factibilidad.';
    evidenceFound = `3/4 vertientes institucionales sustentadas.`;
  } else if (vertientesCount >= 1) {
    score = 2;
    status = 'warning';
    feedback = 'Sustentación parcial del criterio normativo. Falta argumentar viabilidad técnica (Factibilidad) o impacto poblacional (Magnitud).';
    evidenceFound = `${vertientesCount}/4 vertientes identificadas.`;
  }

  return {
    id: 7,
    name: 'Criterio normativo 4 vertientes: Magnitud, Interés, Factibilidad, Oportunidad',
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

  const mccemsPattern = /lengua\s*y\s*comunicaci[oó]n|lenguaje|pensamiento\s*matem[aá]tico|matem[aá]ticas|conciencia\s*hist[oó]rica|cultura\s*digital|ciencias\s*(?:naturales|sociales|experimentales)|materia\s*y\s*sus\s*interacciones|conservaci[oó]n|ecosistemas|reacciones|organismos|humanidades|ingl[eé]s|lengua\s*extranjera|socioemocional|pr[aá]ctica\s*y\s*colaboraci[oó]n|artes|salud|orientaci[oó]n|tutor[ií]a|cuidado\s*f[ií]sico|bienestar|sexualidad|deport|laboral|m[oó]dulo|subm[oó]dulo|capacitaci[oó]n|administraci[oó]n|contabilidad|turismo|dom[oó]tica|alimentos|dibujo|c[aá]lculo|probabilidad|estad[ií]stica|f[ií]sica|qu[ií]mica|biolog[ií]a|derecho|econom[ií]a|psicolog[ií]a|filosof[ií]a|sociedad|comunicaci[oó]n/i;
  const obsoletePattern = /[aá]lgebra|\bqu[ií]mica\s*i\b|\bqu[ií]mica\s*ii\b|\bf[ií]sica\s*i\b|\bf[ií]sica\s*ii\b|\bbiolog[ií]a\s*i\b|\bbiolog[ií]a\s*ii\b|taller\s*de\s*lectura|geometr[ií]a\s*y\s*trigonometr[ií]a|[eé]tica\s*y\s*valores|\binform[aá]tica\s*i\b/i;

  let mccemsCount = 0;
  let obsoleteCount = 0;

  for (const r of rows) {
    const name = r.uacName || '';
    if (obsoletePattern.test(name)) {
      obsoleteCount++;
    } else if (mccemsPattern.test(name)) {
      mccemsCount++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Nomenclatura desactualizada o fuera del Marco Curricular Común (MCCEMS 2025).';
  let evidenceFound = `${obsoleteCount} nombres de planes antiguos detectados.`;

  if (obsoleteCount === 0) {
    score = 4;
    status = 'pass';
    if (mccemsCount === rows.length) {
      feedback = 'Nomenclatura oficial NOM-MCCEMS impecable. Todas las UACs corresponden al rediseño curricular de la NEM.';
    } else {
      feedback = `Nomenclatura vigente sin planes antiguos detectados (${mccemsCount}/${rows.length} UACs con validación directa de catálogo NOM-MCCEMS).`;
    }
    evidenceFound = `${mccemsCount}/${rows.length} UACs validadas bajo nomenclatura NOM-MCCEMS (0 nombres obsoletos).`;
  } else if (obsoleteCount <= 2) {
    score = 3;
    status = 'pass';
    feedback = 'Nomenclatura mayoritariamente correcta. Se detectaron algunas UACs con nombres de planes anteriores; se sugiere homogeneizar conforme al catálogo oficial MCCEMS.';
    evidenceFound = `${obsoleteCount} nombre(s) de planes anteriores detectados (${mccemsCount}/${rows.length} UACs vigentes).`;
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

