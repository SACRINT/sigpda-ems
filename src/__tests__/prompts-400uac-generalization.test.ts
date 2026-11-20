/**
 * prompts-400uac-generalization.test.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Pruebas permanentes de regresión para escalamiento a 400+ UAC:
 * 1. Clasificador disciplinar determinista (casos reportados, verdaderos positivos,
 *    falsos positivos por substring y barrido completo del catálogo canónico de 204 UAC).
 * 2. Invariante matemático del contrato de palabras y umbrales de densidad (sin tope 720).
 * 3. Paridad de contexto disciplinar en `session-plan-completion.ts`.
 * 4. Pureza disciplinar en prompts de foundation, lab, project y evaluation
 *    (cero NOM/ISO, Seguridad, NÚMEROS o Laboratorio en humanidades/comunicación).
 * 5. Gate de `sintesisVisual` en `evaluateSessionPlanDensity` y `generateShardedSessionPlans`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();
vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: (...args: unknown[]) => mockGenerate(...args),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getDisciplinaryAdapter,
  type DisciplinaryDomainId,
} from '@/lib/prompts/disciplinary-adapters';
import { MAX_WORDS_PER_SESSION, MIN_WORDS_PER_SESSION } from '@/lib/guide-engine/content-budget';
import {
  buildCanonicalSessionPlanInstructions,
  computeSessionPlanContractMinWords,
  SESSION_PLAN_WORD_CONTRACT,
} from '@/lib/guide-engine/writers/session-prompt-contract';
import {
  densityThresholdsFor,
  evaluateSessionPlanDensity,
  generateShardedSessionPlans,
  sessionPlanWordTarget,
  validateVisualSynthesisDeficits,
  type SessionShardContext,
} from '@/lib/guide-engine/writers/session-shard';
import {
  generateMissingSessionPlans,
  resolveCompletionAdapter,
} from '@/lib/guide-engine/writers/session-plan-completion';
import { generateFoundationMission } from '@/lib/guide-engine/writers/foundation-writer';
import { generateLabMission } from '@/lib/guide-engine/writers/lab-writer';
import { generateProjectMission } from '@/lib/guide-engine/writers/project-writer';
import { generateEvaluationSection } from '@/lib/guide-engine/writers/evaluation-writer';
import { createWriterScheduler } from '@/lib/guide-engine/writer-scheduler';
import type { WriterInput } from '@/lib/guide-engine/writers/writer-contract';
import type { SessionPlan, SessionVisualSynthesis } from '@/types/work-textbook';

const words = (n: number, token = 'concepto') => Array.from({ length: n }, () => token).join(' ');

const VALID_VISUAL_SYNTHESIS: SessionVisualSynthesis = {
  conceptoBreve:
    'La lectura crítica analiza la intención comunicativa de un texto y permite evaluar la validez de sus argumentos con evidencia verificable.',
  formulaOReglaClave: 'Tesis + Evidencia Verificable + Garantía → Conclusión',
  ejemploBreve: {
    planteamiento:
      'Un boletín escolar propone reorganizar los espacios de estudio comunitario y presenta tres argumentos para sustentar su postura.',
    pasos: [
      'Identifica la tesis central en el primer párrafo del boletín comunitario.',
      'Contrasta las evidencias documentales con las opiniones sin respaldo explícito.',
      'Formula una valoración crítica sobre la coherencia entre premisas y conclusión.',
    ],
    conclusion: 'El texto resulta convincente porque respalda su tesis con evidencias verificables.',
  },
  mapaConceptual: {
    definicionClave: 'La lectura crítica evalúa tesis, evidencias e intención comunicativa de forma reflexiva.',
    criterioDesarrollo: 'Distingue hechos verificables de opiniones y revisa la conexión lógica entre premisas.',
    errorComun: 'Aceptar una conclusión sin comprobar si las evidencias realmente la respaldan.',
    correccionBreve: 'Subraya la tesis, verifica las fuentes citadas y contrasta posibles objeciones.',
  },
};

function makeCompleteSessionPlan(sessionNumber: number, includeVisual = true): SessionPlan {
  const base: SessionPlan = {
    sessionNumber,
    objetivo: `Analizas los principios centrales de la sesión ${sessionNumber} y los aplicas en un caso real de tu comunidad escolar.`,
    motivacion: words(80, 'contexto'),
    saberesPrevios: `${words(55, 'saber')} ¿Qué relación identificas con tu experiencia previa?`,
    contenido: [
      `${words(130, 'definicion')}.`,
      `${words(130, 'procedimiento')}.`,
      `${words(130, 'verificacion')}.`,
    ].join('\n\n'),
    ejemploResuelto: [
      `Planteamiento: ${words(55, 'situacion')}.`,
      `Paso 1: ${words(55, 'analisis')}.`,
      `Paso 2: ${words(55, 'criterio')}.`,
      `Paso 3: ${words(55, 'desarrollo')}.`,
      `Paso 4: ${words(55, 'contraste')}.`,
      'Conclusión: El análisis demuestra que la propuesta es coherente y cumple el criterio = 100%.',
    ].join('\n'),
    practica: [
      {
        enunciado: `${words(55, 'enunciado')} Explica y justifica tu conclusión con evidencias concretas.`,
        pista: words(25, 'orientacion'),
        solucion: [
          'Paso 1: Identificar los elementos centrales del caso.',
          'Paso 2: Aplicar el criterio analítico correspondiente.',
          'Respuesta final: Conclusión fundamentada con evidencias.',
        ],
      },
      {
        enunciado: `${words(55, 'situacion')} Determina qué argumento resulta más sólido y por qué.`,
        pista: words(25, 'estrategia'),
        solucion: [
          'Paso 1: Contrastar los datos disponibles en el caso.',
          'Paso 2: Evaluar la coherencia entre premisa y conclusión.',
          'Respuesta final: Elección justificada del argumento.',
        ],
      },
    ],
    aplicacion: words(70, 'aplicacion'),
    autoevaluacion: [
      '¿Puedo explicar el concepto central con mis propias palabras y un ejemplo situado?',
      '¿Verifiqué la coherencia entre las evidencias y mi conclusión final?',
    ],
    recursos: [
      { titulo: 'Portal institucional SEP de consulta', url: 'https://www.gob.mx/sep', tipo: 'web' },
      { titulo: 'Repositorio público INEGI', url: 'https://www.inegi.org.mx/', tipo: 'lectura' },
    ],
    productoIntegrador: words(55, 'portafolio'),
  };
  if (includeVisual) {
    base.sintesisVisual = VALID_VISUAL_SYNTHESIS;
  }
  return base;
}

describe('1. Clasificador disciplinar determinista (400+ UAC)', () => {
  it.each<[string, string, string, DisciplinaryDomainId]>([
    // Casos críticos reportados en auditoría
    ['Lenguaje y Comunicación I. Leer y escribir para pensar juntos', 'fundamental', 'Leer y escribir para pensarnos juntos', 'lengua_comunicacion_literatura'],
    ['Ciencias Naturales, Experimentales y Tecnología I. Invitación a la Ciencia. Naturaleza de la materia', 'fundamental', 'Invitación a la ciencia', 'ciencias_quimica_biologia_ambiental'],
    ['Ciencias Naturales, Experimentales y Tecnología II. El poder de la energía', 'fundamental', 'El poder de la energía', 'ciencias_fisica_ingenieria'],
    ['Ciencias Naturales, Experimentales y Tecnología III. Nuestro hogar. El sistema terrestre', 'fundamental', 'Nuestro hogar', 'ciencias_quimica_biologia_ambiental'],
    ['Ciencias Naturales, Experimentales y Tecnología IV. El poder de la química', 'fundamental', 'El poder de la química', 'ciencias_quimica_biologia_ambiental'],
    ['Ciencias Naturales, Experimentales y Tecnología V', 'fundamental', 'Del átomo al universo', 'ciencias_fisica_ingenieria'],
    ['Ciencias Naturales, Experimentales y Tecnología VI', 'fundamental', '¿Qué es la vida? Evolución y biodiversidad', 'ciencias_quimica_biologia_ambiental'],
    ['Mecánica Dental', 'Formación Laboral', 'Mecánica Dental', 'formacion_laboral_salud_clinica'],
    ['Ciencias de la Salud', 'Formación Laboral', 'Enfermería', 'formacion_laboral_salud_clinica'],
    ['Geografía', 'Currículum Fundamental', '', 'conciencia_historica_ciencias_sociales'],
    ['Geografía Humana', 'Currículum Fundamental', '', 'conciencia_historica_ciencias_sociales'],
    ['Geografía Física', 'Currículum Fundamental', '', 'ciencias_quimica_biologia_ambiental'],
    ['Estética y Belleza', 'Formación Laboral', 'Estética y Belleza', 'formacion_laboral_servicios_gestion_turismo'],
    ['Preparación de Alimentos Artesanales', 'Formación Laboral', 'Gastronomía', 'formacion_laboral_servicios_gestion_turismo'],
    ['Francés', 'Currículum Ampliado', '', 'lengua_extranjera_general'],
    ['Fotografía', 'Currículum Ampliado', '', 'artes_educacion_artistica_cultural'],
    ['Cine', 'Currículum Ampliado', '', 'artes_educacion_artistica_cultural'],
    ['Periodismo', 'Currículum Ampliado', '', 'lengua_comunicacion_literatura'],
    ['Comunicación Social', 'Currículum Ampliado', '', 'lengua_comunicacion_literatura'],
    ['Corte y Confección', 'Formación Laboral', 'Corte y Confección', 'formacion_laboral_servicios_gestion_turismo'],
    ['Diseño de Modas', 'Formación Laboral', 'Diseño', 'formacion_laboral_servicios_gestion_turismo'],
    ['Comunicación Gráfica', 'Formación Laboral', 'Comunicación Gráfica', 'artes_educacion_artistica_cultural'],
    ['Arte y Cultura I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'artes_educacion_artistica_cultural'],
    ['Actividades Artísticas y Culturales', 'ampliado', 'Currículum Ampliado', 'artes_educacion_artistica_cultural'],
    ['Salud Integral I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'socioemocional_tutoria_educacion_integral'],
    ['Psicología I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'conciencia_historica_ciencias_sociales'],
    ['Procesos Contables I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'formacion_laboral_servicios_gestion_turismo'],
    ['Análisis de Fenómenos Físicos I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'ciencias_fisica_ingenieria'],
    ['Análisis de Fenómenos y Procesos Biológicos', 'ffe_optativa', 'Formación Propedéutica Optativa', 'ciencias_quimica_biologia_ambiental'],
    ['Comunicación y Sociedad I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'lengua_comunicacion_literatura'],
    ['Pensamiento Literario', 'ffeo', 'Formación Fundamental Extendida Obligatoria', 'lengua_comunicacion_literatura'],
    ['Espacio y Sociedad', 'ffeo', 'Formación Fundamental Extendida Obligatoria', 'conciencia_historica_ciencias_sociales'],
    ['Nutrición', 'Formación Laboral', 'Nutrición', 'formacion_laboral_salud_clinica'],
    ['Primeros Auxilios', 'Formación Laboral', 'Salud', 'formacion_laboral_salud_clinica'],
    ['Dibujo', 'Currículum Ampliado', '', 'artes_educacion_artistica_cultural'],
  ])('clasifica correctamente "%s" (%s | %s) → %s', (uac, comp, career, expected) => {
    expect(getDisciplinaryAdapter(uac, comp, career).id).toBe(expected);
  });

  it.each<[string, string, string, DisciplinaryDomainId]>([
    // Verdaderos positivos históricos que deben conservarse
    ['Pensamiento Matemático III', 'fundamental', '', 'pensamiento_matematico'],
    ['Pensamiento Matemático Aplicado a las Finanzas I', 'ffe_optativa', 'Formación Propedéutica Optativa', 'pensamiento_matematico'],
    ['Taller de Pensamiento Variacional I', 'Fundamental Extendido', '', 'pensamiento_matematico'],
    ['Física', 'Currículum Fundamental', '', 'ciencias_fisica_ingenieria'],
    ['Educación Física', 'Currículum Fundamental', '', 'actividades_fisicas_deportivas_salud'],
    ['Actividades Físicas y Deportivas', 'Formación Socioemocional', '', 'actividades_fisicas_deportivas_salud'],
    ['Dibujo Técnico I', 'Componente Propedéutico', '', 'dibujo_tecnico_diseno_arquitectura'],
    ['Inglés I. To Be, or Not to be, That is the Question', 'fundamental', '', 'lengua_extranjera_ingles'],
    ['Experiencia Estética', 'ffe_optativa', '', 'humanidades_filosofia_logica_etica'],
    ['Bioética', 'Currículum Ampliado', '', 'humanidades_filosofia_logica_etica'],
    ['Instalaciones Residenciales', 'Formación Laboral', 'Instalaciones Residenciales', 'formacion_laboral_industrial_agro_salud'],
    ['Sistemas Eléctricos', 'Formación Laboral', 'Sistemas Eléctricos', 'formacion_laboral_industrial_agro_salud'],
    ['Laboratorio de Investigación', 'ffeo', 'Formación Fundamental Extendida Obligatoria', 'indagacion_interdisciplinaria_general'],
  ])('conserva verdadero positivo "%s" → %s', (uac, comp, career, expected) => {
    expect(getDisciplinaryAdapter(uac, comp, career).id).toBe(expected);
  });

  it('evita falsos positivos por substring ("artes" en artesanales, "cad" en aplicado/diagnosticado, "logica" en agroecologicas/odontologica) y no usa laboral como default industrial', () => {
    // "artes" dentro de "artesanales"
    expect(
      getDisciplinaryAdapter('Preparación de Alimentos Artesanales', 'laboral', 'Gastronomía').id
    ).toBe('formacion_laboral_servicios_gestion_turismo');

    // "cad" dentro de "diagnosticado", "especificada", "indicadas", "aplicado"
    expect(
      getDisciplinaryAdapter(
        'Asiste especialistas del área en las necesidades del paciente diagnosticado',
        'laboral',
        'Área de la Salud'
      ).id
    ).toBe('formacion_laboral_salud_clinica');
    expect(
      getDisciplinaryAdapter(
        'Prepara materiales en cantidad y calidad especificada para mezclas',
        'laboral',
        'Instalaciones Residenciales'
      ).id
    ).toBe('formacion_laboral_industrial_agro_salud');
    expect(
      getDisciplinaryAdapter(
        'Pensamiento Matemático Aplicado a las Finanzas II',
        'ffe_optativa',
        'Formación Propedéutica Optativa'
      ).id
    ).toBe('pensamiento_matematico');

    // "logica" dentro de "agroecológicas" y "médicoodontológica"
    expect(
      getDisciplinaryAdapter(
        'Aplica técnicas agroecológicas de conservación de suelo y agua',
        'laboral',
        'Agricultura Sostenible de Traspatio'
      ).id
    ).toBe('formacion_laboral_industrial_agro_salud');
    expect(
      getDisciplinaryAdapter(
        'Apoya actividades de diseño de prótesis y aparatología dental de acuerdo con la prescripción médicoodontológica',
        'laboral',
        'Mecánica Dental'
      ).id
    ).toBe('formacion_laboral_salud_clinica');

    // component="laboral" desconocido NO cae a industrial por defecto
    expect(
      getDisciplinaryAdapter('Taller de Proyecto Comunitario Desconocido', 'laboral', 'Programa Nuevo').id
    ).toBe('indagacion_interdisciplinaria_general');

    // Francés NO recibe prompt exclusivo de Inglés
    const french = getDisciplinaryAdapter('Francés', 'Currículum Ampliado', '');
    expect(french.id).toBe('lengua_extranjera_general');
    expect(french.workbookVoiceDirective).not.toMatch(/\ben inglés\b/i);
    expect(french.allowedDigitalTools.join(' ')).not.toMatch(/Cambridge English|British Council/i);
  });

  it('cubre las 204 UAC únicas del catálogo canónico con solo 1 fallback legítimo (Laboratorio de Investigación)', () => {
    const rows = JSON.parse(
      readFileSync(join(process.cwd(), 'scripts/data/curriculum_canonical_203.json'), 'utf8')
    ) as Array<{ uac_name?: string; component?: string; curriculum_name?: string; career_or_program_name?: string }>;

    const seen = new Set<string>();
    const fallbacks: string[] = [];
    const industrialHealthOrCulinaryLeaks: string[] = [];

    for (const row of rows) {
      const uac = (row.uac_name || '').trim();
      if (!uac) continue;
      const career = (row.curriculum_name || row.career_or_program_name || '').trim();
      const key = `${uac}|${row.component || ''}|${career}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const adapter = getDisciplinaryAdapter(uac, row.component || '', career);
      if (adapter.id === 'indagacion_interdisciplinaria_general') {
        fallbacks.push(uac);
      }
      if (
        adapter.id === 'formacion_laboral_industrial_agro_salud' &&
        /salud|dental|culinari|alimentos artesanales|redes y mantenimiento|tecnologia informatica|comunicacion grafica/i.test(
          `${uac} ${career}`
        )
      ) {
        industrialHealthOrCulinaryLeaks.push(`${uac} (${career})`);
      }
    }

    expect(seen.size).toBe(204);
    expect(fallbacks).toEqual(['Laboratorio de Investigación']);
    expect(industrialHealthOrCulinaryLeaks).toEqual([]);
  });
});

describe('2. Invariante matemático del contrato de palabras y umbrales de densidad', () => {
  it('mantiene coherencia estricta entre suma de mínimos, rango objetivo y content-budget.ts', () => {
    const sumMin = computeSessionPlanContractMinWords();
    expect(sumMin).toBeLessThanOrEqual(SESSION_PLAN_WORD_CONTRACT.targetMin);
    expect(SESSION_PLAN_WORD_CONTRACT.targetMin).toBeLessThanOrEqual(SESSION_PLAN_WORD_CONTRACT.targetMax);
    expect(SESSION_PLAN_WORD_CONTRACT.targetMax).toBe(MAX_WORDS_PER_SESSION);
    expect(SESSION_PLAN_WORD_CONTRACT.targetMin).toBeGreaterThanOrEqual(MIN_WORDS_PER_SESSION - 10);

    // El texto del prompt refleja exactamente la fuente única (nunca el viejo "~780 a 920")
    const instructions = buildCanonicalSessionPlanInstructions(
      getDisciplinaryAdapter('Pensamiento Matemático I'),
      'foundation'
    );
    expect(instructions).toContain(
      `${SESSION_PLAN_WORD_CONTRACT.targetMin} a ${SESSION_PLAN_WORD_CONTRACT.targetMax} palabras`
    );
    expect(instructions).not.toContain('780 a 920');
    expect(instructions).toContain('USO EXCLUSIVO para el solucionario docente');
  });

  it('alinea sessionPlanWordTarget y densityThresholdsFor sin tope artificial en 720', () => {
    // Misión estándar de 4 sesiones con ideal 1,188/sesión → 4,752 palabras
    const target = sessionPlanWordTarget(4752, 4);
    expect(target).toBe(SESSION_PLAN_WORD_CONTRACT.targetMin);

    const thresholds = densityThresholdsFor(target, true, true);
    expect(thresholds.minTotalWords).toBeGreaterThanOrEqual(990);
    expect(thresholds.minTotalWords).not.toBe(720);
    expect(thresholds.minContenidoWords).toBe(320);
    expect(thresholds.minEjemploWords).toBe(220);
    expect(thresholds.requireVisualSynthesis).toBe(true);

    // Escala monotónicamente cuando sube targetWordsPerPlan
    expect(densityThresholdsFor(1250).minTotalWords).toBeGreaterThan(
      densityThresholdsFor(1120).minTotalWords
    );
  });
});

describe('3. Paridad de contexto en session-plan-completion.ts', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('resuelve el mismo adaptador que el writer cuando recibe component y curriculumName/careerOrProgramName', async () => {
    const uac = 'Asiste especialistas del área en las necesidades del paciente diagnosticado';
    const expected = getDisciplinaryAdapter(uac, 'laboral', 'Área de la Salud');
    const resolved = resolveCompletionAdapter({
      uacName: uac,
      component: 'laboral',
      curriculumName: 'Área de la Salud',
    });
    expect(resolved.id).toBe('formacion_laboral_salud_clinica');
    expect(resolved.id).toBe(expected.id);

    // También verifica el prompt real enviado a generateWithRotation
    let capturedSystem = '';
    let capturedUser = '';
    mockGenerate.mockImplementation(async (sys: string, user: string) => {
      capturedSystem = sys;
      capturedUser = user;
      return JSON.stringify({ sessionPlans: [makeCompleteSessionPlan(5)] });
    });

    await generateMissingSessionPlans({
      missionType: 'lab',
      uacName: uac,
      blockName: 'Bloque 1',
      subsystem: 'bt',
      component: 'laboral',
      curriculumName: 'Área de la Salud',
      coveredSessions: [4, 5],
      missingSessions: [5],
      existingPlans: [makeCompleteSessionPlan(4)],
    });

    expect(capturedSystem).toContain(expected.displayName);
    expect(capturedUser).toContain('EPP clínico');
    expect(capturedUser).toContain('RPBI');
    expect(capturedUser).toContain(
      `${SESSION_PLAN_WORD_CONTRACT.targetMin} a ${SESSION_PLAN_WORD_CONTRACT.targetMax} palabras`
    );
  });
});

describe('4. Pureza disciplinar en prompts de foundation, lab, project y evaluation', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  function makePromptCaptureInput(
    uacName: string,
    component: string,
    curriculumName: string,
    subsystem: 'bge' | 'bt' = 'bge'
  ): WriterInput {
    return {
      planning: {
        id: 'p-test',
        teacherId: 't-test',
        uacName,
        semester: 1,
        component,
        curriculumName,
      } as never,
      blockIndex: 0,
      blockName: 'Bloque 1',
      sessions: [1, 2, 3].map((n) => ({
        sessionNum: n,
        phase: 'Desarrollo',
        title: `Sesión ${n}`,
        focus: `Foco ${n}`,
      })) as never,
      missions: [
        { missionIndex: 1, title: 'Misión 1', sessionNumbers: [1], sessionTopic: 'Tema 1', focus: 'Foco 1', missionType: 'foundation', targetPages: 4, targetWords: 1200 },
        { missionIndex: 2, title: 'Misión 2', sessionNumbers: [2], sessionTopic: 'Tema 2', focus: 'Foco 2', missionType: 'lab', targetPages: 4, targetWords: 1200 },
        { missionIndex: 3, title: 'Misión 3', sessionNumbers: [3], sessionTopic: 'Tema 3', focus: 'Foco 3', missionType: 'project', targetPages: 4, targetWords: 1200 },
        { missionIndex: 4, title: 'Misión 4', sessionNumbers: [3], sessionTopic: 'Tema 4', focus: 'Foco 4', missionType: 'evaluation', targetPages: 4, targetWords: 1200 },
      ],
      paecContext: 'Convivencia escolar y lectura comunitaria',
      studentProfile: 'Estudiantes de primer semestre',
      subsystem,
      uacName,
      component,
      curriculumName,
      targetWords: { min: 3375, ideal: 3563, max: 3750 },
    };
  }

  function mockMinimalWriterSuccess(sessionNum: number) {
    mockGenerate.mockImplementation(async () =>
      JSON.stringify({
        phenomenonStory: 'Una situación concreta en la comunidad escolar invita a reflexionar.',
        detonatingQuestion: '¿Cómo argumentamos una postura con evidencias verificables?',
        physicalAnalogy: 'Un diálogo informado funciona como una mesa donde cada evidencia sostiene un punto de apoyo.',
        coreExplanation: words(180, 'explicacion'),
        iDoDemo: 'Desarrollo modelado paso a paso.',
        weDoPractice: 'Práctica guiada en equipo.',
        youDoChallenge: 'Paso 1: a. Paso 2: b. Paso 3: c. Paso 4: d. Paso 5: e.',
        labTitle: 'Taller de análisis',
        objective: 'Analizar argumentos en contexto.',
        materialsList: ['✓ Cuaderno'],
        stepByStepProcedure: words(80, 'paso'),
        dataTableColumns: ['Fuente', 'Tesis'],
        executableCodeOrProtocol: words(80, 'guia'),
        autonomousChallenge: 'Paso 1: a. Paso 2: b. Paso 3: c. Paso 4: d. Paso 5: e.',
        reflectionQuestions: ['¿Qué aprendiste?'],
        quickTroubleshooting: [],
        artifactName: 'Gaceta argumentativa comunitaria',
        communityUtility: words(80, 'impacto'),
        learningObjectives: ['Objetivo 1', 'Objetivo 2', 'Objetivo 3'],
        requiredMaterials: ['Cuaderno de notas'],
        executionSteps: ['1. Planear', '2. Redactar'],
        deliveryCriteria: ['Entrega completa'],
        registrationFormat: 'Bitácora de proyecto con avances y fuentes verificadas en el equipo.',
        phases: [{ phaseNum: 1, title: 'Fase 1', allocatedHours: 2, deliverables: ['Borrador'], instructions: 'Instrucciones' }],
        technicalSpecs: ['Sustento documental'],
        acceptanceCriteria: ['Claridad y coherencia'],
        rubricSummary: [{ criterion: 'Coherencia', excellent: 'A', good: 'B', sufficient: 'C', insufficient: 'D' }],
        rubric: [
          {
            criterion: 'Argumentación',
            weightPercent: 100,
            levels: [
              { levelName: 'Excelente', points: 10, descriptor: 'Excelente' },
              { levelName: 'Bueno', points: 8, descriptor: 'Bueno' },
              { levelName: 'Suficiente', points: 6, descriptor: 'Suficiente' },
              { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Apoyo' },
            ],
          },
        ],
        checklist: [{ item: 'Sustenta con fuentes verificables', category: 'Argumentación' }],
        tieredExercises: [
          { level: 'basico', exercises: [{ number: 1, statement: 'E1', hint: 'H1' }, { number: 2, statement: 'E2', hint: 'H2' }] },
          { level: 'intermedio', exercises: [{ number: 3, statement: 'E3', hint: 'H3' }, { number: 4, statement: 'E4', hint: 'H4' }] },
          { level: 'avanzado', exercises: [{ number: 5, statement: 'E5', hint: 'H5' }, { number: 6, statement: 'E6', hint: 'H6' }] },
        ],
        criticalThinkingQuiz: [{ questionNumber: 1, question: '¿Por qué?', scenario: 'Escenario', answerExplanation: 'Explicación' }],
        metacognitiveReflection: { prompts: ['¿Qué aprendizaje consolidaste en este bloque?'] },
        sessionPlans: [makeCompleteSessionPlan(sessionNum)],
      })
    );
  }

  it('elimina NOM/ISO, Seguridad, NÚMEROS y 2x+5=15 de los 4 writers en Humanidades y Lenguaje y Comunicación', async () => {
    const humInput = makePromptCaptureInput(
      'Pensamiento Filosófico y Humanidades I',
      'fundamental',
      'Vivir aquí y ahora',
      'bge'
    );

    // Foundation
    mockMinimalWriterSuccess(1);
    await generateFoundationMission(humInput);
    const foundationSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(foundationSys).not.toContain('con NÚMEROS');
    expect(foundationSys).not.toContain('2x+5=15');
    expect(foundationSys).not.toContain('datos cuantitativos');

    // Lab
    mockGenerate.mockReset();
    mockMinimalWriterSuccess(2);
    await generateLabMission(humInput);
    const labUser = String(mockGenerate.mock.calls[0]?.[1] || '');
    expect(labUser).not.toContain('Laboratorio/Taller');
    expect(labUser).not.toContain('rigor experimental');

    // Project
    mockGenerate.mockReset();
    mockMinimalWriterSuccess(3);
    await generateProjectMission(humInput);
    const projectSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(projectSys).not.toContain('NOM/ISO');
    expect(projectSys).not.toContain('Parámetros:');
    expect(projectSys).not.toContain('Diagnóstico técnico');

    // Evaluation
    mockGenerate.mockReset();
    mockMinimalWriterSuccess(3);
    await generateEvaluationSection(humInput);
    const evalSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(evalSys).not.toContain('"category": "Seguridad"');
    expect(evalSys).not.toContain('Verifica parámetros y condiciones de seguridad');
    expect(evalSys).not.toContain('Lista de verificación técnica');
    expect(evalSys).not.toContain('variable X = valor');
    expect(evalSys).toContain('Validez Argumentativa');
  });

  it('conserva bioseguridad y NOM-SSA en Mecánica Dental y rigor cuantitativo sin NOM/ISO en Pensamiento Matemático I', async () => {
    const dentalInput = makePromptCaptureInput('Mecánica Dental', 'laboral', 'Mecánica Dental', 'bt');
    mockMinimalWriterSuccess(3);
    await generateProjectMission(dentalInput);
    const dentalProjectSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(dentalProjectSys).toContain('NOM-SSA');
    expect(dentalProjectSys).toContain('BIOSEGURIDAD');

    mockGenerate.mockReset();
    mockMinimalWriterSuccess(3);
    await generateEvaluationSection(dentalInput);
    const dentalEvalSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(dentalEvalSys).toContain('Bioseguridad y EPP Clínico');

    const mathInput = makePromptCaptureInput('Pensamiento Matemático I', 'fundamental', 'Pensamiento aritmético', 'bge');
    mockGenerate.mockReset();
    mockMinimalWriterSuccess(1);
    await generateFoundationMission(mathInput);
    const mathFoundationSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(mathFoundationSys).toContain('datos cuantitativos');

    mockGenerate.mockReset();
    mockMinimalWriterSuccess(3);
    await generateProjectMission(mathInput);
    const mathProjectSys = String(mockGenerate.mock.calls[0]?.[0] || '');
    expect(mathProjectSys).not.toContain('NOM/ISO');
  });
});

describe('5. Gate de sintesisVisual en session-shard.ts', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('detecta ausencia o incompletitud de sintesisVisual en evaluateSessionPlanDensity', () => {
    const thresholds = densityThresholdsFor(1120, false, true);
    const withoutVisual = makeCompleteSessionPlan(1, false);
    const reportMissing = evaluateSessionPlanDensity(withoutVisual, thresholds);
    expect(reportMissing.ok).toBe(false);
    expect(reportMissing.deficits.join(' ')).toMatch(/sintesisVisual/i);

    const incompleteVisual = makeCompleteSessionPlan(1, true);
    incompleteVisual.sintesisVisual = {
      ...VALID_VISUAL_SYNTHESIS,
      conceptoBreve: 'Solo título corto',
      ejemploBreve: { planteamiento: 'Corto', pasos: ['Paso 1'], conclusion: 'Fin' },
    };
    const visualIssues = validateVisualSynthesisDeficits(incompleteVisual);
    expect(visualIssues.length).toBeGreaterThanOrEqual(2);

    const complete = makeCompleteSessionPlan(1, true);
    const reportOk = evaluateSessionPlanDensity(complete, thresholds);
    expect(reportOk.deficits).toEqual([]);
    expect(reportOk.ok).toBe(true);
  });

  it('dispara reparación quirúrgica cuando el modelo omite sintesisVisual en generateShardedSessionPlans', async () => {
    mockGenerate.mockImplementation(async (_sys: string, user: string) => {
      const isRepair = /REPARACIÓN/.test(user);
      const m = /exactamente \d+: ([\d, ]+)\)/.exec(user);
      const nums = m ? m[1].split(',').map((s) => parseInt(s.trim(), 10)) : [1];
      return JSON.stringify({
        sessionPlans: nums.map((n) => makeCompleteSessionPlan(n, isRepair || n !== 2)),
      });
    });

    const ctx: SessionShardContext = {
      input: {
        planning: { teacherId: 't1', semester: 1 },
        blockIndex: 0,
        blockName: 'Bloque 1',
        sessions: [1, 2].map((n) => ({ sessionNum: n, phase: 'Desarrollo', title: `T${n}`, focus: `F${n}` })),
        missions: [],
        paecContext: 'Lectura comunitaria',
        studentProfile: 'BGE',
        subsystem: 'bge',
        uacName: 'Lenguaje y Comunicación I',
        component: 'fundamental',
        targetWords: { min: 2250, ideal: 2376, max: 2500 },
        scheduler: createWriterScheduler({ maxConcurrency: 2, jitterMs: 0 }),
      } as never,
      missionType: 'foundation',
      missionTitle: 'Misión 1',
      coveredSessions: [1, 2],
      disciplineName: 'Lengua, Comunicación y Literatura',
      fallbackContext: { uacName: 'Lenguaje y Comunicación I' },
      targetWordsPerPlan: 1120,
    };

    const { plans, diagnostics } = await generateShardedSessionPlans(ctx);
    expect(diagnostics.repairedSessions).toEqual([2]);
    expect(diagnostics.stillDeficient).toEqual([]);
    expect(plans.find((p) => p.sessionNumber === 2)?.sintesisVisual?.conceptoBreve).toBeTruthy();
  });
});
