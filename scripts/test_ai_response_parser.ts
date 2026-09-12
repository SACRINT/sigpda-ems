import { parseAIResponse } from '../src/lib/ai-response-parser';
import { generateWithRetry, getAIMetrics, resetAIMetrics } from '../src/lib/ai-retry-manager';
import {
  SecuenciaResponseSchema,
  PaecPaso1Schema,
  PaecPaso2Schema,
  PaecPaso3Schema,
  PaecPaso4Schema,
  PaecPaso5Schema,
  PaecPaso6BlockSchema,
  PaecPaso7Schema,
} from '../src/lib/ai-schemas';

async function runTests() {
  console.log('================================================================');
  console.log('  SIGPDA-EMS: TEST UNITARIO & INTEGRACIÓN DEL MOTOR DE IA');
  console.log('================================================================\n');

  resetAIMetrics();

  // Test 1: Markdown fence + trailing comma + Spanish key 'sesiones'
  console.log('Test 1: Reparación de markdown fences, trailing commas y clave en español "sesiones"...');
  const dirtyJson = `
\`\`\`json
{
  "sesiones": [
    {
      "sessionNum": 1,
      "phase": "Apertura",
      "title": "Introducción y Encuadre Pedagógico",
      "teachingActivity": "Presentación del propósito formativo y reactivación de saberes previos.",
      "learningActivity": "Lluvia de ideas guiada y resolución de cuestionario exploratorio en equipos.",
      "evidence": "Cuestionario diagnóstico resuelto en libreta.",
      "evaluation": "Lista de cotejo formativa.",
    },
    {
      "sessionNum": 2,
      "phase": "Desarrollo",
      "title": "Modelado Conceptual y Práctica Guiada",
      "teachingActivity": "Explicación del marco teórico y resolución de problemas tipo en pizarrón.",
      "learningActivity": "Ejercicios colaborativos en binas aplicando las fórmulas estudiadas.",
      "evidence": "Problemario resuelto y argumentado.",
      "evaluation": "Rúbrica analítica.",
    },
  ],
}
\`\`\`
  `;

  const res1 = parseAIResponse(dirtyJson, SecuenciaResponseSchema, { contextName: 'test_secuencia_dirty' });
  if (!res1.success || res1.data.sessions.length !== 2) {
    throw new Error(`Test 1 falló: ${res1.error}`);
  }
  console.log(`✅ Test 1 PASS — 2 sesiones parseadas con éxito (${res1.warnings.length} advertencias reparadas)`);

  // Test 2: Arreglo directo sin objeto envolvente
  console.log('\nTest 2: Normalización de arreglo JSON directo [ ... ]...');
  const directArrayJson = `
  [
    {
      "sessionNum": 1,
      "phase": "Cierre",
      "title": "Evaluación Formativa y Conclusiones",
      "teachingActivity": "Moderación de plenaria de coevaluación y retroalimentación grupal.",
      "learningActivity": "Exposición breve de evidencias y autoevaluación reflexiva.",
      "evidence": "Ficha metacognitiva y rúbrica completada.",
      "evaluation": "Heteroevaluación formativa."
    }
  ]
  `;
  const res2 = parseAIResponse(directArrayJson, SecuenciaResponseSchema, { contextName: 'test_direct_array' });
  if (!res2.success || res2.data.sessions[0].phase !== 'Cierre') {
    throw new Error(`Test 2 falló: ${res2.error}`);
  }
  console.log('✅ Test 2 PASS — Arreglo directo normalizado a { sessions: [...] }');

  // Test 3: Rechazo de campos faltantes con Zod
  console.log('\nTest 3: Validación estricta con Zod (rechazar campos faltantes o vacíos)...');
  const invalidJson = JSON.stringify({
    sessions: [
      {
        sessionNum: 1,
        phase: 'Desarrollo',
        title: '', // Inválido: min 1
        teachingActivity: 'Docente explica',
        learningActivity: '', // Inválido: min 1
      },
    ],
  });
  const res3 = parseAIResponse(invalidJson, SecuenciaResponseSchema, { contextName: 'test_invalid_fields' });
  if (res3.success) {
    throw new Error('Test 3 falló: debió rechazar el schema por campos vacíos');
  }
  console.log(`✅ Test 3 PASS — Rechazó correctamente con mensaje Zod: "${res3.error}"`);

  // Test 4: Schemas de PAEC
  console.log('\nTest 4: Validación de Schemas PAEC (Paso 1 y Paso 6)...');
  const paso1Data = {
    tabla1: [{ col1: 'Geografía', col2: 'Urbana periférica con servicios básicos' }],
    tabla2: [{ col1: 'Matrícula', col2: '520 estudiantes en 12 grupos' }],
    tabla3: [{ aspect: 'Fortalezas', analysis: 'Cuerpo docente comprometido y con posgrado' }],
    tabla4: [{ col1: 'Fase 1', col2: 'Asamblea escolar y votación democrática' }],
  };
  const resPaso1 = parseAIResponse(JSON.stringify(paso1Data), PaecPaso1Schema);
  if (!resPaso1.success) throw new Error(`Paso 1 falló: ${resPaso1.error}`);

  const paso6Data = [
    {
      phase: 'Fase 1',
      activity: 'Encuesta diagnóstica',
      uac: 'Lengua y Comunicación I',
      progression: 'Prop. 2',
      strategy: 'ABP',
      week: 'Semana 1',
      responsibles: 'Mtro. Juan',
      evaluationInstrument: 'Rúbrica',
    },
  ];
  const resPaso6 = parseAIResponse(JSON.stringify(paso6Data), PaecPaso6BlockSchema);
  if (!resPaso6.success) throw new Error(`Paso 6 falló: ${resPaso6.error}`);
  console.log('✅ Test 4 PASS — Schemas PAEC Paso 1 y Paso 6 validados');

  // Test 5: generateWithRetry con simulación de recuperación en Intento 2
  console.log('\nTest 5: Simulación de generateWithRetry (recuperación guiada en intento 2)...');
  let calls = 0;
  const mockGenerateFn = async (sys: string, user: string, opts: { temperature: number }) => {
    calls++;
    if (calls === 1) {
      // Intento 1: Devuelve JSON malformado o campos incompletos
      return 'Respuesta con error de la IA: { "sessions": [ { "sessionNum": 1, "title": "" } ] }';
    }
    // Intento 2: Corrige tras recibir el feedback de corrección
    return JSON.stringify({
      sessions: [
        {
          sessionNum: 1,
          phase: 'Apertura',
          title: 'Sesión Recuperada Exitosamente',
          teachingActivity: 'Encuadre y motivación con detonador cognitivo.',
          learningActivity: 'Análisis de caso práctico en equipos colaborativos.',
          evidence: 'Mapa mental elaborado en plenaria.',
          evaluation: 'Guía de observación docente.',
        },
      ],
    });
  };

  const retryResult = await generateWithRetry(
    'System prompt',
    'User prompt',
    SecuenciaResponseSchema,
    {
      route: 'test_retry_recovery',
      maxRetries: 3,
      customGenerateFn: mockGenerateFn,
    }
  );

  if (retryResult.attempts !== 2 || retryResult.data.sessions[0].title !== 'Sesión Recuperada Exitosamente') {
    throw new Error(`Test 5 falló: intentos esperados 2, obtenidos ${retryResult.attempts}`);
  }
  console.log(`✅ Test 5 PASS — Recuperado en intento ${retryResult.attempts}/3`);

  // Test 6: Verificación de Observabilidad
  console.log('\nTest 6: Verificación de Métricas de Observabilidad...');
  const currentMetrics = getAIMetrics();
  console.log('Métricas recopiladas:', JSON.stringify(currentMetrics, null, 2));
  if (!currentMetrics.attemptsTotalByRoute['test_retry_recovery']) {
    throw new Error('Test 6 falló: no se registraron los intentos por ruta');
  }
  if (currentMetrics.retrySuccessCount < 1) {
    throw new Error('Test 6 falló: retrySuccessCount debió ser >= 1');
  }
  console.log('✅ Test 6 PASS — Observabilidad y métricas 100% operativas\n');

  console.log('================================================================');
  console.log('  RESULTADO: ✅ TODOS LOS TESTS DE ARQUITECTURA PASARON (6/6)');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Error en test de arquitectura:', err);
  process.exit(1);
});
