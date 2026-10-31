/**
 * orchestrator.ts — Orquestador Central de Planeaciones V2 (Nivel 1)
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Implementa el contrato formal IProgramSystem de Plataforma Nivel 2 y orquesta
 * la evaluación cuantitativa/cualitativa de planeaciones didácticas bajo el modelo
 * del Anexo 12 USICAMM / Guía Laboral MCCEMS y el patrón Strangler Fig
 * (controlado por la feature flag PLANEACION_ORCHESTRATOR_V2).
 */

import type { IProgramSystem, HealthCheckResult, ProgramId } from '@/lib/platform/interfaces';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  evaluarPlaneacion,
  type InputEvaluacion,
  type ResultadoEvaluacion,
} from '@/lib/planeaciones-evaluator';
import {
  SecuenciaGenerateInputSchema,
  SecuenciaUpdateInputSchema,
  type SecuenciaGenerateInputDTO,
} from '@/lib/ai-schemas';
import { logger } from '@/lib/logger';
import { generatePlanningPDF } from '@/lib/planning-pdf-renderer';
import type { Planning } from '@/types/planning';
import { getPlanningById } from '@/lib/db';

export class PlaneacionOrchestratorError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PlaneacionOrchestratorError';
    this.status = status;
  }
}

export interface SecuenciaInput {
  blockIndex: number;
  totalHours?: number;
  planningId?: string;
  sessions?: unknown[];
  retoSituado?: unknown;
  uacName?: string;
  blockName?: string;
  contenidoFormativo?: string;
  saberes?: {
    saber?: string;
    saberHacer?: string;
    saberSer?: string;
  } | null;
  learningOutcome?: string;
  methodology?: string;
  paecContext?: string;
}

export interface PlaneacionGenInput {
  asignatura: string;
  semestre: number;
  docenteNombre?: string;
  textoPlanificacion?: string;
  component?: string;
  plantel?: string;
  bloques?: number;
  horasSemanales?: number;
  contextoComunitario?: string;
  planningId?: string;
  teacherId?: string;
  isPremium?: boolean;
}

export interface RenderPdfOptions {
  planning?: Planning;
  logos?: { gobierno?: string; sep?: string; supervision?: string };
}

export interface IPlaneacionOrchestrator extends IProgramSystem {
  evaluate(input: InputEvaluacion): Promise<ResultadoEvaluacion>;
  generate(input: PlaneacionGenInput): Promise<Record<string, unknown>>;
  buildSequence(input: SecuenciaInput): Promise<Record<string, unknown>>;
  renderPDF(idOrPlanning?: string | Planning, options?: RenderPdfOptions): Promise<Buffer>;
}

// ============================================================================
// HITOS PEDAGÓGICOS PROGRESIVOS MCCEMS (H-1 / REG-3)
// Garantiza unicidad sustantiva por sesión a lo largo de las 3 fases formativas.
// ============================================================================
export const APERTURA_SESSION_MILESTONES = [
  {
    title: 'Exploración Diagnóstica y Problematización Situada',
    teachingActivity: 'Presentación del detonador situado y dinamización de saberes previos con preguntas generadoras.',
    learningActivity: 'Análisis de la problemática comunitaria, lluvia de ideas y planteamiento de hipótesis iniciales.',
    evidence: 'Cuestionario diagnóstico y mapa conceptual inicial',
    evaluation: 'Lista de cotejo diagnóstica',
  },
  {
    title: 'Recuperación de Saberes y Delimitación del Reto',
    teachingActivity: 'Modelado metodológico para la delimitación del problema y vinculación con el contexto local.',
    learningActivity: 'Identificación de variables clave, saberes contextuales y formulación de objetivos del equipo.',
    evidence: 'Matriz de contextualización comunitaria y preguntas guía',
    evaluation: 'Guía de observación formativa',
  },
  {
    title: 'Organización de Equipos y Ruta de Trabajo',
    teachingActivity: 'Asesoría en distribución de roles colaborativos y definición del cronograma de indagación.',
    learningActivity: 'Acuerdo de roles de equipo, definición de metas de aprendizaje y plan de trabajo situado.',
    evidence: 'Ruta de trabajo colaborativo y acuerdos de equipo',
    evaluation: 'Rúbrica de trabajo colaborativo',
  },
  {
    title: 'Indagación Inicial y Marco de Referencia',
    teachingActivity: 'Orientación en la búsqueda de fuentes pertinentes y conceptos nodales del área.',
    learningActivity: 'Exploración bibliográfica y de campo sobre necesidades prioritarias de la comunidad.',
    evidence: 'Ficha de registro de fuentes y conceptos nodales',
    evaluation: 'Lista de cotejo de indagación documental',
  },
];

export const DESARROLLO_SESSION_MILESTONES = [
  {
    title: 'Fundamentación Teórica y Análisis de Variables',
    teachingActivity: 'Explicación dialogada de principios disciplinares y modelado de relaciones entre variables.',
    learningActivity: 'Análisis conceptual de variables críticas y resolución de ejercicios formativos introductorios.',
    evidence: 'Reporte de análisis conceptual y ejercicios resueltos',
    evaluation: 'Escala estimativa de dominio conceptual',
  },
  {
    title: 'Modelado Metodológico y Procedimientos Clave',
    teachingActivity: 'Demostración guiada del procedimiento metodológico y resolución de problemas tipo.',
    learningActivity: 'Práctica guiada en pares para replicar y adaptar el procedimiento al caso situado.',
    evidence: 'Algoritmo de solución o diagrama de flujo metodológico',
    evaluation: 'Lista de cotejo procesual',
  },
  {
    title: 'Diseño Preliminar y Bosquejo del Artefacto',
    teachingActivity: 'Asesoría técnica en criterios de diseño, viabilidad y pertinencia contextual.',
    learningActivity: 'Elaboración del boceto o esquema preliminar del artefacto o propuesta de solución.',
    evidence: 'Boceto técnico preliminar con especificaciones básicas',
    evaluation: 'Rúbrica de diseño técnico preliminar',
  },
  {
    title: 'Presupuestación y Selección de Recursos',
    teachingActivity: 'Orientación en análisis de costos, insumos sustentables y aprovechamiento de recursos locales.',
    learningActivity: 'Estimación presupuestaria, catálogo de insumos y evaluación de factibilidad económica.',
    evidence: 'Tabla de presupuesto de insumos y justificación de materiales',
    evaluation: 'Lista de cotejo presupuestaria',
  },
  {
    title: 'Experimentación y Prueba de Parámetros',
    teachingActivity: 'Supervisión de prácticas de laboratorio o taller con énfasis en seguridad y precisión.',
    learningActivity: 'Experimentación con variables de control, toma de mediciones y registro en bitácora.',
    evidence: 'Bitácora de mediciones y datos experimentales',
    evaluation: 'Rúbrica de práctica experimental',
  },
  {
    title: 'Construcción y Ensamblaje del Prototipo',
    teachingActivity: 'Acompañamiento técnico en procesos de construcción, montaje y seguridad operativa.',
    learningActivity: 'Construcción colaborativa del prototipo aplicando técnicas disciplinares apropiadas.',
    evidence: 'Avance físico o digital del prototipo construido',
    evaluation: 'Guía de observación técnica de taller',
  },
  {
    title: 'Aplicación de Principios Disciplinares y Ajuste de Parámetros',
    teachingActivity: 'Guía en aplicación de criterios disciplinares, proporción operativa y optimización de recursos.',
    learningActivity: 'Aplicación de herramientas disciplinares y criterios prácticos para optimizar el desempeño.',
    evidence: 'Memoria operativa y justificación disciplinar',
    evaluation: 'Rúbrica de aplicación disciplinar',
  },
  {
    title: 'Validación Técnica y Pruebas de Funcionamiento',
    teachingActivity: 'Asesoría en diseño de protocolos de prueba y criterios de tolerancia técnica.',
    learningActivity: 'Ejecución de pruebas funcionales, registro de fallas y verificación de desempeño.',
    evidence: 'Protocolo de pruebas y matriz de resultados funcionales',
    evaluation: 'Lista de cotejo de validación técnica',
  },
  {
    title: 'Análisis de Rendimiento y Ajuste de Tolerancias',
    teachingActivity: 'Retroalimentación focalizada sobre puntos críticos identificados en las pruebas.',
    learningActivity: 'Ajuste de parámetros, calibración de componentes y optimización del artefacto.',
    evidence: 'Registro de calibración y ajustes implementados',
    evaluation: 'Escala de valoración de mejoras técnicas',
  },
  {
    title: 'Integración Socioproductiva y Pertinencia Local',
    teachingActivity: 'Facilitación del diálogo sobre impacto comunitario, sustentabilidad y ética del proyecto.',
    learningActivity: 'Evaluación del impacto social y ambiental de la solución en el entorno comunitario.',
    evidence: 'Ficha de impacto socioambiental y pertinencia comunitaria',
    evaluation: 'Rúbrica de responsabilidad social y ética',
  },
  {
    title: 'Sistematización de Datos y Análisis de Tendencias',
    teachingActivity: 'Orientación en representación gráfica de datos, estadística descriptiva e inferencias.',
    learningActivity: 'Construcción de gráficas comparativas e interpretación estadística de resultados.',
    evidence: 'Gráficos interpretativos y síntesis estadística de desempeño',
    evaluation: 'Rúbrica de análisis de datos',
  },
  {
    title: 'Documentación Técnica y Manual Operativo',
    teachingActivity: 'Revisión de estándares de redacción técnica, diagramación y normatividad aplicable.',
    learningActivity: 'Redacción de instructivos de operación, diagramas de conexión y fichas técnicas.',
    evidence: 'Borrador del manual operativo o guía técnica de usuario',
    evaluation: 'Lista de cotejo de documentación técnica',
  },
  {
    title: 'Revisión Cruzada y Coevaluación Inter-Equipos',
    teachingActivity: 'Moderación de sesiones de crítica constructiva y coevaluación entre equipos.',
    learningActivity: 'Revisión cruzada de prototipos entre pares y registro de recomendaciones de mejora.',
    evidence: 'Instrumento de coevaluación técnica entre pares',
    evaluation: 'Rúbrica de evaluación formativa entre pares',
  },
  {
    title: 'Refinamiento e Iteración del Artefacto',
    teachingActivity: 'Asesoría personalizada para resolver observaciones técnicas de la coevaluación.',
    learningActivity: 'Implementación de mejoras al prototipo basadas en la retroalimentación recibida.',
    evidence: 'Bitácora de iteración y evidencia fotográfica de mejoras',
    evaluation: 'Guía de verificación de adecuaciones',
  },
  {
    title: 'Prueba de Esfuerzo y Validación de Calidad',
    teachingActivity: 'Supervisión de pruebas integrales bajo condiciones simuladas de operación real.',
    learningActivity: 'Simulación de escenarios operativos reales y verificación de resistencia y durabilidad.',
    evidence: 'Reporte de prueba integral de esfuerzo y calidad',
    evaluation: 'Rúbrica de calidad y confiabilidad del producto',
  },
  {
    title: 'Integración Final del Producto y Acabados',
    teachingActivity: 'Supervisión de detalles finales, presentación estética y seguridad de uso.',
    learningActivity: 'Ensamblaje definitivo, control de calidad y preparación del artefacto terminado.',
    evidence: 'Artefacto o producto terminado con control de calidad aprobado',
    evaluation: 'Lista de cotejo de producto concluido',
  },
  {
    title: 'Estructuración de la Memoria del Proyecto',
    teachingActivity: 'Orientación en la integración de la memoria técnica y estructura del informe final.',
    learningActivity: 'Consolidación de evidencias, metodología, resultados y conclusiones en memoria técnica.',
    evidence: 'Memoria técnica estructurada del proyecto situado',
    evaluation: 'Rúbrica analítica de informe técnico',
  },
  {
    title: 'Diseño de Recursos y Medios de Divulgación',
    teachingActivity: 'Asesoría en diseño de infografías, carteles científicos o apoyos multimedia.',
    learningActivity: 'Diseño de recursos visuales y material expositivo para la difusión comunitaria.',
    evidence: 'Cartel científico, infografía o presentación interactiva',
    evaluation: 'Rúbrica de comunicación visual y divulgación',
  },
  {
    title: 'Ensayo General de Demostración Práctica',
    teachingActivity: 'Simulación de plenaria y retroalimentación en técnica expositiva y argumentación.',
    learningActivity: 'Ensayo de exposición, defensa argumentativa y resolución de cuestionamientos técnicos.',
    evidence: 'Guion de presentación y lista de verificación de demostración',
    evaluation: 'Escala estimativa de expresión oral y argumentación',
  },
  {
    title: 'Verificación Integral de Entregables y Cierre Técnico',
    teachingActivity: 'Revisión final de portafolios de evidencias y cotejo contra rúbrica sumativa.',
    learningActivity: 'Cotejo y organización final de carpetas de evidencias y artefactos por equipo.',
    evidence: 'Portafolio de evidencias completo debidamente integrado',
    evaluation: 'Lista de cotejo integral de evidencias',
  },
];

export const CIERRE_SESSION_MILESTONES = [
  {
    title: 'Socialización Comunitaria y Demostración Integral',
    teachingActivity: 'Coordinación de la plenaria pública de socialización con la comunidad escolar.',
    learningActivity: 'Exposición y demostración práctica del artefacto o solución ante el grupo y comunidad.',
    evidence: 'Exposición pública y demostración práctica del artefacto',
    evaluation: 'Rúbrica analítica de desempeño y socialización',
  },
  {
    title: 'Evaluación Formativa y Coevaluación del Impacto',
    teachingActivity: 'Aplicación de instrumentos de evaluación integral y diálogo reflexivo sobre logros.',
    learningActivity: 'Coevaluación grupal, valoración del impacto social y autoevaluación de competencias.',
    evidence: 'Instrumento de coevaluación y rúbrica sumativa completada',
    evaluation: 'Rúbrica sumativa institucional MCCEMS',
  },
  {
    title: 'Síntesis Metacognitiva y Plan de Transferencia',
    teachingActivity: 'Guía de la reflexión metacognitiva sobre aprendizajes logrados y retos superados.',
    learningActivity: 'Elaboración de síntesis metacognitiva personal y propuesta de continuidad comunitaria.',
    evidence: 'Texto reflexivo de metacognición y plan de mejora continua',
    evaluation: 'Escala estimativa de metacognición',
  },
  {
    title: 'Cierre Institucional y Registro de Logros',
    teachingActivity: 'Cierre pedagógico, retroalimentación final colectiva y asentamiento de evidencias.',
    learningActivity: 'Entrega final del portafolio consolidado y acuerdos de seguimiento del proyecto.',
    evidence: 'Portafolio final dictaminado y rúbrica firmada',
    evaluation: 'Dictamen de acreditación formativa',
  },
];

export class PlaneacionOrchestrator implements IPlaneacionOrchestrator {
  public readonly programId: ProgramId = 'planeaciones';
  public readonly version: string = '2.0.0';

  /**
   * Evalúa una planeación didáctica ejecutando la rúbrica oficial (Anexo 12 / Guía Laboral).
   */
  public async evaluate(input: InputEvaluacion): Promise<ResultadoEvaluacion> {
    if (!input.textoPlanificacion || input.textoPlanificacion.trim().length < 50) {
      throw new PlaneacionOrchestratorError(
        'El contenido de la planeación es demasiado corto o inválido para evaluar.',
        400
      );
    }

    logger.info(`[planeaciones-orchestrator] Evaluating planning for UAC: ${input.asignatura}, semester: ${input.semestre}`);

    const resultado = await evaluarPlaneacion(input);
    return resultado;
  }

  /**
   * Generación integral de planeación didáctica basada en Tres Saberes y NEM (Fase 1).
   */
  public async generate(input: PlaneacionGenInput): Promise<Record<string, unknown>> {
    if (!input || typeof input !== 'object') {
      throw new PlaneacionOrchestratorError(
        'El parámetro input es requerido y debe ser un objeto válido para generar la planeación.',
        400
      );
    }

    if (!input.asignatura || typeof input.asignatura !== 'string' || input.asignatura.trim().length === 0) {
      throw new PlaneacionOrchestratorError(
        'La asignatura (UAC) es obligatoria para generar la planeación didáctica.',
        400
      );
    }

    if (typeof input.semestre !== 'number' || input.semestre < 1 || input.semestre > 6) {
      throw new PlaneacionOrchestratorError(
        'El semestre es obligatorio y debe ser un número entero entre 1 y 6.',
        400
      );
    }

    logger.info(`[planeaciones-orchestrator] Generating planning for UAC: ${input.asignatura}, semester: ${input.semestre}`);

    const component = input.component || (input.semestre >= 5 ? 'fundamental_5_6' : 'fundamental_1_4');
    const totalBlocks = input.bloques || 3;
    const weeklyHours = input.horasSemanales || (component === 'laboral' ? 18 : 4);

    return {
      success: true,
      uacName: input.asignatura.trim(),
      semester: input.semestre,
      component,
      weeklyHours,
      totalBlocks,
      teacherName: input.docenteNombre || 'Docente Titular',
      communityContext: input.contextoComunitario || 'Contexto de Vinculación Regional Puebla NEM',
      tresSaberes: {
        conceptual: `Saberes conceptuales fundamentales para ${input.asignatura.trim()}`,
        procedimental: `Aplicación metodológica y desarrollo de habilidades prácticas en semestre ${input.semestre}`,
        actitudinal: 'Colaboración, pensamiento crítico, responsabilidad social y ética comunitaria',
      },
      status: 'DRAFT_ESTRUCTURADO',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Construcción de secuencias didácticas por momentos pedagógicos (Fase 1).
   * Valida parámetros con SecuenciaGenerateInputSchema y SecuenciaUpdateInputSchema.
   */
  public async buildSequence(input: SecuenciaInput): Promise<Record<string, unknown>> {
    if (!input || typeof input !== 'object') {
      throw new PlaneacionOrchestratorError(
        'El parámetro input es requerido y debe ser un objeto válido para construir la secuencia.',
        400
      );
    }

    const parseResult = SecuenciaGenerateInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new PlaneacionOrchestratorError(
        `Parámetros inválidos para construcción de secuencia: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
        400
      );
    }

    // Si se proveen sesiones explícitas, validar esquema de actualización estructurada
    if (input.sessions && Array.isArray(input.sessions)) {
      const updateResult = SecuenciaUpdateInputSchema.safeParse(input);
      if (!updateResult.success) {
        throw new PlaneacionOrchestratorError(
          `Estructura de sesiones inválida: ${updateResult.error.issues.map((i) => i.message).join(', ')}`,
          400
        );
      }
      return {
        success: true,
        blockIndex: updateResult.data.blockIndex,
        sessions: updateResult.data.sessions,
        retoSituado: updateResult.data.retoSituado,
        totalHours: input.totalHours ?? updateResult.data.sessions.length,
      };
    }

    const {
      blockIndex,
      totalHours: customHours,
      uacName,
      blockName,
      contenidoFormativo,
      saberes,
      learningOutcome,
      methodology,
    }: SecuenciaGenerateInputDTO = parseResult.data;
    const hours = customHours && customHours > 0 ? customHours : 12;
    const sessionsCount = hours;

    const cleanBlockTitle = (blockName || '')
      .replace(/^(bloque|prop[oó]sito|unidad|actividad)\s*[\d,\sy]+:\s*/i, '')
      .trim();
    const rawTopics = (contenidoFormativo || cleanBlockTitle || '')
      .split(/[,;·•]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 3);
    const hasBlockContext = Boolean(cleanBlockTitle || rawTopics.length > 0 || saberes?.saber || saberes?.saberHacer);
    const blockTheme = cleanBlockTitle || rawTopics[0] || '';
    const saberFocus = saberes?.saber ? saberes.saber.replace(/\.$/, '') : '';
    const hacerFocus = saberes?.saberHacer ? saberes.saberHacer.replace(/\.$/, '') : '';
    const serFocus = saberes?.saberSer ? saberes.saberSer.replace(/\.$/, '') : '';
    const metLabel = methodology ? ` (${methodology})` : '';

    // Distribución pedagógica oficial MCCEMS por fases (Apertura, Desarrollo, Cierre)
    let aperturaCount = 1;
    let cierreCount = 1;
    if (sessionsCount >= 16) {
      aperturaCount = 3;
      cierreCount = 3;
    } else if (sessionsCount >= 10) {
      aperturaCount = 2;
      cierreCount = 2;
    }
    const desarrolloCount = Math.max(1, sessionsCount - aperturaCount - cierreCount);

    const sessions = [];
    let sessionNumber = 1;

    // Fase 1: Apertura (Diagnóstico, detonador situado, motivación y saberes previos)
    for (let i = 0; i < aperturaCount; i++) {
      const idx = hasBlockContext ? (i + blockIndex) % APERTURA_SESSION_MILESTONES.length : i % APERTURA_SESSION_MILESTONES.length;
      const milestone = APERTURA_SESSION_MILESTONES[idx];
      const cycle = Math.floor(i / APERTURA_SESSION_MILESTONES.length);
      const cycleSuffix = cycle > 0 ? ` (Etapa ${cycle + 1})` : '';
      const actSuffix = cycle > 0 ? ` (Etapa diagnóstica ${cycle + 1} · Sesión ${sessionNumber})` : '';
      const subTopic = rawTopics[i % Math.max(1, rawTopics.length)] || blockTheme;
      const titleSuffix = hasBlockContext && subTopic ? ` — ${subTopic}` : '';
      const contextTeaching = hasBlockContext && blockTheme
        ? ` Enfoque en ${blockTheme}${uacName ? ` (${uacName})` : ''}.`
        : '';
      const contextLearning = hasBlockContext && saberFocus
        ? ` Vinculación con el saber: ${saberFocus}.`
        : '';

      sessions.push({
        sessionNum: sessionNumber,
        phase: 'Apertura' as const,
        title: `Sesión ${sessionNumber}: ${milestone.title}${titleSuffix}${cycleSuffix}`,
        teachingActivity: `${milestone.teachingActivity}${contextTeaching}${actSuffix}`,
        learningActivity: `${milestone.learningActivity}${contextLearning}${actSuffix}`,
        evidence: milestone.evidence,
        evaluation: milestone.evaluation,
      });
      sessionNumber++;
    }

    // Fase 2: Desarrollo (Construcción activa, modelado docente, práctica guiada y autónoma)
    for (let i = 0; i < desarrolloCount; i++) {
      const idx = hasBlockContext
        ? (i + blockIndex * 3) % DESARROLLO_SESSION_MILESTONES.length
        : i % DESARROLLO_SESSION_MILESTONES.length;
      const milestone = DESARROLLO_SESSION_MILESTONES[idx];
      const cycle = Math.floor(i / DESARROLLO_SESSION_MILESTONES.length);
      const cycleSuffix = cycle > 0 ? ` (Ciclo ${cycle + 1})` : '';
      const actSuffix = cycle > 0 ? ` (Profundización ciclo ${cycle + 1} · Sesión ${sessionNumber})` : '';
      const subTopic = rawTopics[i % Math.max(1, rawTopics.length)] || blockTheme;
      const titleSuffix = hasBlockContext && subTopic ? ` — ${subTopic}` : '';
      const contextTeaching = hasBlockContext
        ? ` Mediación sobre ${subTopic || blockTheme}${metLabel}.`
        : '';
      const contextLearning = hasBlockContext
        ? ` Práctica activa sobre ${subTopic || blockTheme}${hacerFocus ? `: ${hacerFocus}` : ''}.`
        : '';

      sessions.push({
        sessionNum: sessionNumber,
        phase: 'Desarrollo' as const,
        title: `Sesión ${sessionNumber}: ${milestone.title}${titleSuffix}${cycleSuffix}`,
        teachingActivity: `${milestone.teachingActivity}${contextTeaching}${actSuffix}`,
        learningActivity: `${milestone.learningActivity}${contextLearning}${actSuffix}`,
        evidence: milestone.evidence,
        evaluation: milestone.evaluation,
      });
      sessionNumber++;
    }

    // Fase 3: Cierre (Síntesis, evaluación formativa, metacognición y producto integrador)
    for (let i = 0; i < cierreCount; i++) {
      const idx = hasBlockContext ? (i + blockIndex) % CIERRE_SESSION_MILESTONES.length : i % CIERRE_SESSION_MILESTONES.length;
      const milestone = CIERRE_SESSION_MILESTONES[idx];
      const cycle = Math.floor(i / CIERRE_SESSION_MILESTONES.length);
      const cycleSuffix = cycle > 0 ? ` (Etapa ${cycle + 1})` : '';
      const actSuffix = cycle > 0 ? ` (Consolidación ${cycle + 1} · Sesión ${sessionNumber})` : '';
      const titleSuffix = hasBlockContext && blockTheme ? ` — ${blockTheme}` : '';
      const contextTeaching = hasBlockContext && learningOutcome
        ? ` Verificación del propósito: ${learningOutcome}.`
        : '';
      const contextLearning = hasBlockContext && serFocus
        ? ` Reflexión actitudinal: ${serFocus}.`
        : '';

      sessions.push({
        sessionNum: sessionNumber,
        phase: 'Cierre' as const,
        title: `Sesión ${sessionNumber}: ${milestone.title}${titleSuffix}${cycleSuffix}`,
        teachingActivity: `${milestone.teachingActivity}${contextTeaching}${actSuffix}`,
        learningActivity: `${milestone.learningActivity}${contextLearning}${actSuffix}`,
        evidence: milestone.evidence,
        evaluation: milestone.evaluation,
      });
      sessionNumber++;
    }

    logger.info(`[planeaciones-orchestrator] Sequence built successfully for block ${blockIndex} with ${sessions.length} sessions`);

    return {
      success: true,
      blockIndex,
      totalHours: hours,
      sessions,
      distribution: {
        apertura: aperturaCount,
        desarrollo: desarrolloCount,
        cierre: cierreCount,
      },
    };
  }

  /**
   * Renderizado a PDF de la planeación didáctica oficial (Contrato N1 — Fase 2).
   * Delega en planning-pdf-renderer.ts para tipografía Lato/Montserrat y diseño oficial Carta.
   */
  public async renderPDF(
    idOrPlanning?: string | Planning,
    options?: RenderPdfOptions
  ): Promise<Buffer> {
    if (!idOrPlanning && !options?.planning) {
      throw new PlaneacionOrchestratorError(
        'Se requiere un ID o una instancia de Planeación para renderizar el PDF.',
        400
      );
    }

    let planning: Planning | null = null;

    if (typeof idOrPlanning === 'object' && idOrPlanning !== null) {
      planning = idOrPlanning as Planning;
    } else if (options?.planning) {
      planning = options.planning;
    } else if (typeof idOrPlanning === 'string') {
      try {
        const rawPlanning = await getPlanningById(idOrPlanning);
        if (!rawPlanning) {
          throw new PlaneacionOrchestratorError(
            `Planeación con ID ${idOrPlanning} no encontrada en la base de datos.`,
            404
          );
        }
        planning = {
          id: rawPlanning.id,
          teacherId: rawPlanning.teacher_id,
          uacName: rawPlanning.uac_name,
          semester: rawPlanning.semester,
          component: rawPlanning.component,
          curriculumName: rawPlanning.curriculum_name || '',
          paecContext: rawPlanning.paec_context || '',
          extractedData: rawPlanning.extracted_data,
          contentJson: rawPlanning.content_json,
          status: rawPlanning.status,
          createdAt: rawPlanning.created_at,
          updatedAt: rawPlanning.updated_at,
          sequenceJson: rawPlanning.sequence_json,
          evaluationJson: rawPlanning.evaluation_json,
        };
      } catch (err) {
        if (err instanceof PlaneacionOrchestratorError) {
          throw err;
        }
        logger.error('[planeaciones-orchestrator] Error al consultar planeación de BD:', { error: err });
        throw new PlaneacionOrchestratorError(
          `Error al consultar la planeación ${idOrPlanning}: ${(err as Error).message}`,
          500
        );
      }
    }

    if (!planning) {
      throw new PlaneacionOrchestratorError(
        'Estructura de planeación no disponible para renderizado.',
        400
      );
    }

    try {
      const doc = await generatePlanningPDF(planning, options?.logos);
      const arrayBuffer = doc.output('arraybuffer');
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (err instanceof PlaneacionOrchestratorError) {
        throw err;
      }
      logger.error('[planeaciones-orchestrator] Error en renderizado editorial de PDF:', { error: err });
      throw new PlaneacionOrchestratorError(
        `Fallo en el motor editorial al generar PDF: ${(err as Error).message}`,
        500
      );
    }
  }

  /**
   * Comprueba la salud del subsistema Planeaciones (Contrato Nivel 2).
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    const checks: Record<string, boolean> = {
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      // Credencial de IA base disponible (en producción el pool dinámico reside en api_keys)
      aiServiceConfigured: Boolean(process.env.GEMINI_API_KEY),
      featureFlagService: typeof isFeatureEnabled === 'function',
    };

    const isAllPassing = Object.values(checks).every(Boolean);

    return {
      status: isAllPassing ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retorna métricas del subsistema Planeaciones para agregación de plataforma (Contrato Nivel 2).
   */
  public async getMetrics(tenantId: string): Promise<Record<string, unknown>> {
    return {
      programId: this.programId,
      version: this.version,
      tenantId,
      flags: {
        PLANEACION_ORCHESTRATOR_V2: isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2'),
      },
    };
  }
}

// Instancia singleton para el Sistema Central de Planeaciones V2
export const planeacionesOrchestrator = new PlaneacionOrchestrator();
