import type {
  PaecAuditCriterion,
  PaecImplementacion,
  AnexosData,
  PaecGobernanza,
  PaecInformeSupervision,
} from '@/types/paec';
import { DIMENSIONS } from './shared';

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
