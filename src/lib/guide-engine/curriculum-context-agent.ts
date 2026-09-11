/**
 * Curriculum Context Agent
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Agente 1 del motor de Libros de Trabajo.
 * Extrae y estructura el contexto curricular oficial de la UAC (BGE o BT),
 * inyectando normativas oficiales (NOM/ISO), aprendizajes de trayectoria,
 * orientaciones pedagógicas y vinculación con el PAEC escolar.
 */

import { findBgeUac, getBgeNormativeContext } from '@/lib/bge-catalog';
import type { TeacherContext } from '@/types/planning';

export interface CurriculumContext {
  uacName: string;
  semester: number;
  subsystem: 'bge' | 'bt';
  component: string;
  targetPages: { min: number; max: number };
  targetWords: { min: number; max: number };
  disciplineArea: string;
  pedagogicalOrientation: string;
  applicableNorms: string[];
  safetyRules: string[];
  paecConnection: {
    projectName: string;
    communityProblem: string;
    suggestedHooks: string[];
  };
  studentProfile: {
    contextDescription: string;
    scaffoldingAdvice: string;
  };
}

export function extractCurriculumContext(params: {
  uacName: string;
  semester: number;
  subsystem?: string;
  component?: string;
  teacherContext: TeacherContext;
}): CurriculumContext {
  const isBt = (params.subsystem || '').toLowerCase().includes('bt') ||
               (params.subsystem || '').toLowerCase().includes('tecnol') ||
               (params.subsystem || '').toLowerCase().includes('cecyte') ||
               (params.subsystem || '').toLowerCase().includes('cbtis') ||
               (params.subsystem || '').toLowerCase().includes('cbta');

  const subsystem: 'bge' | 'bt' = isBt ? 'bt' : 'bge';
  const semester = params.semester || 1;
  const uacName = params.uacName.trim();

  // 1. Determinar metas de extensión según el subsistema
  const targetPages = subsystem === 'bt' ? { min: 50, max: 80 } : { min: 35, max: 50 };
  const targetWords = subsystem === 'bt' ? { min: 25000, max: 40000 } : { min: 17500, max: 25000 };

  // 2. Extracción de contexto normativo específico
  let disciplineArea = 'Formación Propedéutica y Fundamental';
  let pedagogicalOrientation = 'Aprendizaje activo basado en fenómenos y situaciones de la vida cotidiana.';
  let applicableNorms: string[] = [];
  let safetyRules: string[] = [];
  let suggestedHooks: string[] = [];

  if (subsystem === 'bt') {
    disciplineArea = 'Formación Técnica / Tecnológica Profesional';
    pedagogicalOrientation = 'Formación basada en competencias laborales, proyectos tecnológicos reales, estándares de industria y control de calidad.';
    applicableNorms = [
      'NOM-001-SEDE (Instalaciones Eléctricas / Seguridad)',
      'NOM-017-STPS (Equipo de protección personal en talleres y laboratorios)',
      'Estándares internacionales de buenas prácticas de ingeniería y documentación técnica'
    ];
    safetyRules = [
      'Uso obligatorio de bata, calzado cerrado y gafas de seguridad en área de prácticas.',
      'Inspección previa del instrumental, cableado y fuentes de alimentación antes de energizar.',
      'Prohibido el consumo de alimentos o líquidos en el laboratorio de cómputo y taller.',
      'Control de versiones estricto y respaldos periódicos de proyectos y código fuente.'
    ];
    suggestedHooks = [
      'Automatización y monitoreo de recursos para pequeños negocios locales',
      'Desarrollo de prototipos de bajo costo para resolver necesidades técnicas comunitarias',
      'Mantenimiento preventivo de equipos y diseño de sistemas eficientes de energía'
    ];
  } else {
    // BGE Fundamental o Laboral
    const bgeNorm = getBgeNormativeContext(uacName);
    disciplineArea = bgeNorm.disciplineArea;
    pedagogicalOrientation = bgeNorm.focus;
    suggestedHooks = bgeNorm.phenomenonSuggestions;
    applicableNorms = [
      'Marco Curricular Común de la Educación Media Superior (MCCEMS 2025-2026)',
      'Normativa DBEPA Puebla para la Socioformación y Aprendizaje Dialógico'
    ];
    safetyRules = [
      'Cuidado y respeto mutuo en el trabajo colaborativo en mesas de debate.',
      'Manejo seguro de materiales caseros de bajo costo en actividades de indagación.',
      'Uso ético y responsable de fuentes de información y herramientas digitales.'
    ];
  }

  // 3. Vinculación con el PAEC escolar
  const paecProblem = params.teacherContext.paecProblem || 'Mejora del entorno escolar y convivencia comunitaria';
  const paecProject = params.teacherContext.paecProjectName || 'Proyecto Escolar Comunitario PAEC';

  // 4. Perfil del estudiante
  const studentDesc = params.teacherContext.studentContext || 'Grupo heterogéneo de Educación Media Superior';
  const scaffoldingAdvice = 'Aplicar andamiaje Vygotskiano: arrancar cada concepto desde una analogía física inmediata (Concepto Cero) antes de formalizar la teoría.';

  return {
    uacName,
    semester,
    subsystem,
    component: params.component || (subsystem === 'bt' ? 'laboral' : 'fundamental'),
    targetPages,
    targetWords,
    disciplineArea,
    pedagogicalOrientation,
    applicableNorms,
    safetyRules,
    paecConnection: {
      projectName: paecProject,
      communityProblem: paecProblem,
      suggestedHooks,
    },
    studentProfile: {
      contextDescription: studentDesc,
      scaffoldingAdvice,
    },
  };
}
