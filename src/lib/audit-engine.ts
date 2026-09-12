/**
 * audit-engine.ts
 * Motor de Auditoría y Alineación Pedagógica Inteligente (SIGPDA-EMS)
 *
 * Evalúa las planeaciones docentes contra el catálogo curricular oficial de la SEP/SEMS
 * considerando las 4 dimensiones clave:
 *  1. Alineación con propósitos formativos / progresiones
 *  2. Cobertura de contenidos temáticos
 *  3. Secuenciación lógica (Apertura, Desarrollo, Cierre)
 *  4. Adecuación de evidencias e instrumentos de evaluación
 */

import { neon } from '@neondatabase/serverless';
import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';

export interface DimensionAudit {
  score: number; // 0 a 100
  weight: number; // 0 a 1
  status: 'cumple' | 'parcial' | 'no_cumple';
  feedback: string;
}

export interface DimensionScores {
  propositos_alineacion: DimensionAudit;
  cobertura_contenidos: DimensionAudit;
  secuenciacion_logica: DimensionAudit;
  adecuacion_evidencias: DimensionAudit;
}

export interface AuditFindings {
  fortalezas: string[];
  desalineaciones: string[];
  omisiones_detectadas: string[];
  propositos_cubiertos: string[];
  propositos_omitidos: string[];
}

export interface AuditRecommendation {
  dimension: 'propositos_alineacion' | 'cobertura_contenidos' | 'secuenciacion_logica' | 'adecuacion_evidencias' | 'general';
  severidad: 'alta' | 'media' | 'baja';
  mensaje: string;
}

export interface AuditReport {
  id?: string;
  planning_id: string;
  teacher_id?: string;
  uac_name: string;
  semester: number;
  component: string;
  subsystem: string;
  overall_score: number;
  compliance_level: 'excelente' | 'satisfactorio' | 'requiere_mejora' | 'no_alineado';
  dimension_scores: DimensionScores;
  findings: AuditFindings;
  recommendations: AuditRecommendation[];
  official_program_ref?: any;
  audited_by: string;
  created_at?: string;
}

export async function runPedagogicalAudit(planningId: string, options: { teacherId?: string, isPremium?: boolean } = {}): Promise<AuditReport> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada.');
  }

  const sql = neon(process.env.DATABASE_URL);

  // 1. Obtener la planeación
  const plannings = await sql`
    SELECT id, teacher_id, uac_name, semester, component, curriculum_name, paec_context, extracted_data, content_json, status
    FROM plannings
    WHERE id = ${planningId}::uuid
    LIMIT 1
  `;

  if (!plannings || plannings.length === 0) {
    throw new Error(`No se encontró la planeación con ID: ${planningId}`);
  }

  const plan = plannings[0];
  const teacherId = options.teacherId || plan.teacher_id;

  // 2. Obtener el programa oficial de referencia desde programs_catalog
  let officialPrograms = await sql`
    SELECT id, uac_name, semester, component, subsystem, model_type, total_hours, learning_outcome, activities, contenidos_formativos, evidences
    FROM programs_catalog
    WHERE uac_name ILIKE ${plan.uac_name} AND semester = ${plan.semester}
    LIMIT 1
  `;

  if (!officialPrograms || officialPrograms.length === 0) {
    // Búsqueda flexible por nombre de UAC
    officialPrograms = await sql`
      SELECT id, uac_name, semester, component, subsystem, model_type, total_hours, learning_outcome, activities, contenidos_formativos, evidences
      FROM programs_catalog
      WHERE (uac_name ILIKE ${'%' + plan.uac_name + '%'} OR ${plan.uac_name} ILIKE '%' || uac_name || '%') AND semester = ${plan.semester}
      LIMIT 1
    `;
  }

  const officialProgram = officialPrograms?.[0] || null;

  // 3. Preparar el contexto pedagógico para la IA
  const officialRef = officialProgram ? {
    uac_name: officialProgram.uac_name,
    semester: officialProgram.semester,
    component: officialProgram.component,
    learning_outcome: officialProgram.learning_outcome,
    activities: officialProgram.activities || [],
    contenidos_formativos: officialProgram.contenidos_formativos || [],
    evidences: officialProgram.evidences || []
  } : {
    uac_name: plan.uac_name,
    semester: plan.semester,
    component: plan.component || 'fundamental',
    learning_outcome: 'Cumplimiento de las competencias oficiales del MCCEMS.',
    activities: [],
    contenidos_formativos: [],
    evidences: []
  };

  const planContent = plan.content_json || plan.extracted_data || {};

  const systemPrompt = `Eres un Auditor Pedagógico de Alto Nivel de la SEMS (Subsecretaría de Educación Media Superior) y especialista en el Marco Curricular Común (MCCEMS) de México.

Tu misión es auditar con rigor técnico, normativo y pedagógico la planeación docente suministrada, contrastándola directamente contra el Programa Oficial de Estudio de la asignatura.

Debes evaluar 4 Dimensiones Específicas:
1. ALINEACIÓN CON PROPÓSITOS FORMATIVOS / PROGRESIONES (Ponderación 30%):
   - ¿La planeación atiende los propósitos formativos o progresiones oficiales del programa?
   - ¿Se omitió algún propósito clave o se incluyeron elementos ajenos?
2. COBERTURA DE CONTENIDOS TEMÁTICOS (Ponderación 25%):
   - ¿Se abordan los contenidos formativos y temas de estudio oficiales establecidos?
   - ¿El nivel de profundidad y aplicación es adecuado al semestre?
3. SECUENCIACIÓN LÓGICA Y MOMENTOS DIDÁCTICOS (Ponderación 25%):
   - ¿La secuencia didáctica tiene estructura clara: Apertura (saberes previos), Desarrollo (construcción y aplicación) y Cierre (evaluación y síntesis)?
   - ¿La dosificación horaria es realista y coherente?
4. ADECUACIÓN DE EVIDENCIAS E INSTRUMENTOS (Ponderación 20%):
   - ¿Las evidencias de aprendizaje (productos/desempeños) e instrumentos de evaluación (rúbricas, listas de cotejo) son pertinentes y congruentes con los resultados esperados?

FORMATO DE RESPUESTA:
Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta (sin texto introductorio ni markdown adicional):

{
  "overall_score": 88,
  "compliance_level": "satisfactorio",
  "dimension_scores": {
    "propositos_alineacion": {
      "score": 90,
      "weight": 0.30,
      "status": "cumple",
      "feedback": "Justificación concisa..."
    },
    "cobertura_contenidos": {
      "score": 85,
      "weight": 0.25,
      "status": "cumple",
      "feedback": "Justificación concisa..."
    },
    "secuenciacion_logica": {
      "score": 95,
      "weight": 0.25,
      "status": "cumple",
      "feedback": "Justificación concisa..."
    },
    "adecuacion_evidencias": {
      "score": 80,
      "weight": 0.20,
      "status": "parcial",
      "feedback": "Justificación concisa..."
    }
  },
  "findings": {
    "fortalezas": ["Fortaleza 1", "Fortaleza 2"],
    "desalineaciones": ["Desalineación o inconsistencia detectada..."],
    "omisiones_detectadas": ["Contenido o propósito no abordado..."],
    "propositos_cubiertos": ["Propósito 1...", "Propósito 2..."],
    "propositos_omitidos": []
  },
  "recommendations": [
    {
      "dimension": "cobertura_contenidos",
      "severidad": "alta",
      "mensaje": "Recomendación accionable y concreta para el docente..."
    }
  ]
}`;

  const userPrompt = `AUDITORÍA PEDAGÓGICA SOLICITADA:

=== DATOS DE LA ASIGNATURA Y PROGRAMA OFICIAL DE REFERENCIA ===
Asignatura Oficial: ${officialRef.uac_name}
Semestre: ${officialRef.semester}° Semestre
Componente Curricular: ${officialRef.component}
Meta / Resultado Oficial de Aprendizaje: ${officialRef.learning_outcome}

Propósitos Formativos / Progresiones Oficiales:
${JSON.stringify(officialRef.activities, null, 2)}

Contenidos Formativos / Temas Oficiales:
${JSON.stringify(officialRef.contenidos_formativos, null, 2)}

Evidencias Sugeridas Oficiales:
${JSON.stringify(officialRef.evidences, null, 2)}

=== DATOS DE LA PLANEACIÓN DOCENTE A AUDITAR ===
Nombre de la UAC en Planeación: ${plan.uac_name}
Semestre: ${plan.semester}° Semestre
Contexto PAEC / Comunitario: ${plan.paec_context || 'No especificado'}
Contenido de la Planeación Didáctica (Secuencias, Actividades, Evidencias):
${JSON.stringify(planContent, null, 2)}

Realiza la auditoría exhaustiva y devuelve el objeto JSON con la evaluación de las 4 dimensiones.`;

  // 4. Ejecutar con IA mediante src/lib/ai-provider
  const rawAiResponse = await generateWithRotation(systemPrompt, userPrompt, teacherId, options.isPremium);
  const parsed = robustJsonParse(rawAiResponse);

  // 5. Normalizar puntuación y nivel de cumplimiento
  const overallScore = Math.max(0, Math.min(100, Math.round(Number(parsed.overall_score) || 0)));
  const complianceLevel =
    overallScore >= 90 ? 'excelente' :
    overallScore >= 75 ? 'satisfactorio' :
    overallScore >= 60 ? 'requiere_mejora' : 'no_alineado';

  const dimensionScores: DimensionScores = {
    propositos_alineacion: {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.dimension_scores?.propositos_alineacion?.score) || overallScore))),
      weight: 0.30,
      status: parsed.dimension_scores?.propositos_alineacion?.status || (overallScore >= 75 ? 'cumple' : 'parcial'),
      feedback: parsed.dimension_scores?.propositos_alineacion?.feedback || 'Evaluación de alineación de propósitos completada.'
    },
    cobertura_contenidos: {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.dimension_scores?.cobertura_contenidos?.score) || overallScore))),
      weight: 0.25,
      status: parsed.dimension_scores?.cobertura_contenidos?.status || (overallScore >= 75 ? 'cumple' : 'parcial'),
      feedback: parsed.dimension_scores?.cobertura_contenidos?.feedback || 'Evaluación de cobertura de contenidos temáticos.'
    },
    secuenciacion_logica: {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.dimension_scores?.secuenciacion_logica?.score) || overallScore))),
      weight: 0.25,
      status: parsed.dimension_scores?.secuenciacion_logica?.status || (overallScore >= 75 ? 'cumple' : 'parcial'),
      feedback: parsed.dimension_scores?.secuenciacion_logica?.feedback || 'Evaluación de momentos didácticos (Apertura, Desarrollo, Cierre).'
    },
    adecuacion_evidencias: {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.dimension_scores?.adecuacion_evidencias?.score) || overallScore))),
      weight: 0.20,
      status: parsed.dimension_scores?.adecuacion_evidencias?.status || (overallScore >= 75 ? 'cumple' : 'parcial'),
      feedback: parsed.dimension_scores?.adecuacion_evidencias?.feedback || 'Evaluación de pertinencia de instrumentos de evaluación.'
    }
  };

  const findings: AuditFindings = {
    fortalezas: Array.isArray(parsed.findings?.fortalezas) ? parsed.findings.fortalezas : ['Planeación estructurada conforme a los lineamientos institucionales.'],
    desalineaciones: Array.isArray(parsed.findings?.desalineaciones) ? parsed.findings.desalineaciones : [],
    omisiones_detectadas: Array.isArray(parsed.findings?.omisiones_detectadas) ? parsed.findings.omisiones_detectadas : [],
    propositos_cubiertos: Array.isArray(parsed.findings?.propositos_cubiertos) ? parsed.findings.propositos_cubiertos : [],
    propositos_omitidos: Array.isArray(parsed.findings?.propositos_omitidos) ? parsed.findings.propositos_omitidos : []
  };

  const recommendations: AuditRecommendation[] = Array.isArray(parsed.recommendations) ? parsed.recommendations : [
    {
      dimension: 'general',
      severidad: 'media',
      mensaje: 'Revisar la integración de los contenidos formativos para asegurar el 100% de cobertura del programa oficial.'
    }
  ];

  // 6. Guardar o actualizar en Neon DB (tabla audit_results)
  // Limpiar auditoría previa si existía para esta planeación
  await sql`DELETE FROM audit_results WHERE planning_id = ${planningId}::uuid`;

  const inserted = await sql`
    INSERT INTO audit_results (
      planning_id,
      teacher_id,
      uac_name,
      semester,
      component,
      subsystem,
      overall_score,
      compliance_level,
      dimension_scores,
      findings,
      recommendations,
      official_program_ref,
      audited_by,
      created_at,
      updated_at
    ) VALUES (
      ${planningId}::uuid,
      ${teacherId ? teacherId : null}::uuid,
      ${plan.uac_name},
      ${plan.semester},
      ${plan.component || 'fundamental'},
      ${officialProgram?.subsystem || 'bge'},
      ${overallScore},
      ${complianceLevel},
      ${JSON.stringify(dimensionScores)},
      ${JSON.stringify(findings)},
      ${JSON.stringify(recommendations)},
      ${JSON.stringify(officialRef)},
      'ia_pedagogica_v2',
      NOW(),
      NOW()
    )
    RETURNING id, created_at
  `;

  return {
    id: inserted[0]?.id,
    planning_id: planningId,
    teacher_id: teacherId,
    uac_name: plan.uac_name,
    semester: plan.semester,
    component: plan.component || 'fundamental',
    subsystem: officialProgram?.subsystem || 'bge',
    overall_score: overallScore,
    compliance_level: complianceLevel,
    dimension_scores: dimensionScores,
    findings,
    recommendations,
    official_program_ref: officialRef,
    audited_by: 'ia_pedagogica_v2',
    created_at: inserted[0]?.created_at
  };
}
