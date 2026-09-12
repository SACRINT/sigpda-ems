/**
 * Resilience & Troubleshooting Agent
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Agente de Resiliencia del motor de Libros de Trabajo.
 * Genera la matriz formativa "¿Qué hacer si falla?" (Zona de Depuración) del bloque:
 * - Diagnóstico de síntomas visibles de error frecuente en alumnos.
 * - Causa técnica explicada con precisión.
 * - Solución metódica paso a paso.
 * - Medida preventiva para evitar reincidencia.
 *
 * En BT: Enfocado en errores de código, fallas de hardware, conexiones y normas NOM/ISO.
 * En BGE: Enfocado en errores conceptuales, dificultades de cálculo y experimentos fallidos.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import type { CanonicalSeed, TroubleshootItem } from '@/types/work-textbook';

export interface ResilienceInput {
  uacName: string;
  subsystem: 'bge' | 'bt';
  blockName: string;
  teacherId?: string;
  canonicalSeed?: CanonicalSeed;
  writerWarnings?: string[];
  sampleTopics?: string[];
}

export async function generateTroubleshootingMatrix(
  input: ResilienceInput
): Promise<TroubleshootItem[]> {
  // 1. Si la semilla canónica ya cuenta con errores comunes pre-validados, aprovecharlos
  const seedErrors = (input.canonicalSeed?.content?.commonErrors || []).map((err, i) => ({
    id: err.id || `tb-seed-${i + 1}`,
    symptom: err.symptom,
    cause: err.cause || err.rootCause || 'Parámetros descalibrados o error de sintaxis',
    solution: err.solution || (Array.isArray(err.solutionSteps) ? err.solutionSteps.join('. ') : 'Verificar procedimiento'),
    prevention: err.prevention || err.preventionTip || 'Consultar el manual y revisar conexiones',
    rootCause: err.rootCause || err.cause || 'Parámetros descalibrados o error de sintaxis',
    solutionSteps: Array.isArray(err.solutionSteps) ? err.solutionSteps : [err.solution || 'Verificar procedimiento'],
    preventionTip: err.preventionTip || err.prevention || 'Consultar el manual y revisar conexiones',
  }));

  if (seedErrors.length >= 5) {
    return seedErrors.slice(0, 8);
  }

  const isBt = input.subsystem === 'bt';
  const focusDomain = isBt
    ? 'errores de código y sintaxis, excepciones de terminal, fallas de circuitos y protoboard, calibración de instrumental y normas de seguridad industrial NOM'
    : 'errores conceptuales de fondo, dificultades en despejes o cálculo numérico, fallas en experimentos caseros/escolares y sesgos de argumentación';

  const warningsContext = input.writerWarnings && input.writerWarnings.length > 0
    ? `\nADVERTENCIAS DETECTADAS POR OTROS REDACTORES A MITIGAR:\n${input.writerWarnings.map((w) => `- ${w}`).join('\n')}`
    : '';

  const systemInstruction = `Eres un docente titular de taller y laboratorio en Educación Media Superior en Puebla (MCCEMS / DBEPA).
Tu tarea es generar la "Zona de Depuración: ¿Qué hacer si falla?" para el bloque formativo de la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).

ENFOQUE FORMATIVO OBLIGATORIO:
Genera un arreglo de entre 5 y 8 casos reales de problemas y errores comunes que enfrentan los estudiantes (${focusDomain}).
${warningsContext}

Para cada problema debes proporcionar exactamente:
1. symptom: Descripción concisa y exacta de lo que el alumno observa (ej: "El código no compila y arroja 'ModuleNotFoundError'" o "El valor experimental de densidad resulta negativo").
2. cause: Causa técnica o conceptual subyacente (ej: "Falta instalar o importar la librería requerida en el entorno").
3. solution: Solución paso a paso para que el alumno lo resuelva de forma autónoma (ej: "1. Abre la terminal. 2. Ejecuta pip install math. 3. Agrega import math al inicio").
4. prevention: Medida preventiva clara (ej: "Siempre declara los módulos y dependencias en la cabecera antes de escribir la lógica").

Devuelve EXCLUSIVAMENTE un arreglo JSON válido con este formato:
[
  {
    "symptom": "Descripción del problema...",
    "cause": "Causa técnica...",
    "solution": "Solución paso a paso...",
    "prevention": "Medida de prevención..."
  }
]`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Bloque: ${input.blockName}
Tópicos del bloque: ${input.sampleTopics?.join(', ') || 'Contenidos formativos del bloque'}
Semillas técnicas previas: ${seedErrors.map((s) => s.symptom).join('; ') || 'Ninguna'}

Genera los 5 a 8 casos más relevantes de la matriz "¿Qué hacer si falla?":`;

  try {
    const rawResponse = await generateWithRotation(systemInstruction, prompt, input.teacherId);
    const parsed = robustJsonParse(rawResponse);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const generatedItems: TroubleshootItem[] = parsed.map((item: any, idx: number) => {
        const cause = item.cause || item.rootCause || 'Parámetros no verificados o error procedimental';
        const solution = item.solution || (Array.isArray(item.solutionSteps) ? item.solutionSteps.join('. ') : 'Verificar parámetros y reintentar');
        const prevention = item.prevention || item.preventionTip || 'Realizar inspección previa antes de operar';

        const solutionSteps = Array.isArray(item.solutionSteps)
          ? item.solutionSteps
          : solution.split(/\d+\.\s+/).map((s: string) => s.trim()).filter(Boolean);

        return {
          id: `tb-${input.subsystem}-${idx + 1}`,
          symptom: item.symptom || 'Falla imprevista en el procedimiento',
          cause,
          solution,
          prevention,
          rootCause: cause,
          solutionSteps: solutionSteps.length > 0 ? solutionSteps : [solution],
          preventionTip: prevention,
        };
      });

      // Combinar semilla previa con los nuevos ítems generados
      const merged = [...seedErrors, ...generatedItems];
      return merged.slice(0, 8);
    }
  } catch (err) {
    console.error('[generateTroubleshootingMatrix] Error:', err);
  }

  // Fallback estructurado de resiliencia
  if (isBt) {
    return [
      {
        id: 'tb-bt-1',
        symptom: 'El código no compila o la terminal arroja NameError / SyntaxError',
        cause: 'Variables no declaradas antes de su uso, sangría inconsistente o llaves/paréntesis sin cerrar.',
        solution: '1. Revisa el número de línea indicado en la consola. 2. Corrige la indentación a 4 espacios uniformes. 3. Verifica que la variable esté inicializada.',
        prevention: 'Habilita el linter de sintaxis en el editor y compila pequeñas funciones de manera incremental.',
        rootCause: 'Variables no declaradas antes de su uso, sangría inconsistente o llaves/paréntesis sin cerrar.',
        solutionSteps: [
          'Revisa el número de línea indicado en la consola de la terminal.',
          'Corrige la indentación a 4 espacios uniformes.',
          'Verifica que todas las variables y módulos estén inicializados antes de llamarlos.',
        ],
        preventionTip: 'Habilita el linter de sintaxis en el editor y compila pequeñas funciones de manera incremental.',
      },
      {
        id: 'tb-bt-2',
        symptom: 'El circuito no responde al ser energizado o el componente no enciende',
        cause: 'Falso contacto en el protoboard, polaridad invertida en diodos/capacitores o sobrecarga en la fuente.',
        solution: '1. Desenergiza de inmediato la fuente. 2. Verifica la continuidad de las líneas con el multímetro. 3. Confirma la polaridad ánodo/cátodo.',
        prevention: 'Aplica el código de colores normado (rojo para positivo, negro para tierra) antes de conectar la energía.',
        rootCause: 'Falso contacto en el protoboard, polaridad invertida en diodos/capacitores o sobrecarga en la fuente.',
        solutionSteps: [
          'Desenergiza de inmediato la fuente por seguridad.',
          'Verifica la continuidad de las líneas con el multímetro en modo acústico.',
          'Confirma la orientación y polaridad de cada semiconductor.',
        ],
        preventionTip: 'Aplica el código de colores normado (rojo para positivo, negro para tierra) antes de conectar la energía.',
      },
      {
        id: 'tb-bt-3',
        symptom: 'Discrepancia severa entre la simulación virtual y el montaje físico',
        cause: 'Omisión de tolerancias en componentes físicos o caída de tensión por resistencia interna de cables.',
        solution: '1. Mide el voltaje real en los nodos del circuito físico. 2. Compara con los valores teóricos. 3. Sustituye cables con alta resistencia parásita.',
        prevention: 'Mide siempre los valores reales de resistencias y capacitores con el multímetro antes de insertarlos.',
        rootCause: 'Omisión de tolerancias en componentes físicos o caída de tensión por resistencia interna de cables.',
        solutionSteps: [
          'Mide el voltaje real en los nodos del circuito físico bajo carga.',
          'Compara con las lecturas teóricas del simulador.',
          'Sustituye puentes de cable que presenten holgura o corrosión.',
        ],
        preventionTip: 'Mide siempre los valores reales de resistencias y capacitores con el multímetro antes de insertarlos.',
      },
      {
        id: 'tb-bt-4',
        symptom: 'El sensor entrega lecturas inestables o ruido continuo',
        cause: 'Falta de capacitor de desacople en la alimentación o cableado de señal excesivamente largo cerca de fuentes electromagnéticas.',
        solution: '1. Coloca un capacitor cerámico de 100nF en paralelo entre VCC y GND cerca del sensor. 2. Aleja los cables de motores o transformadores.',
        prevention: 'Diseña el cableado separando líneas de señal analógica de líneas de potencia.',
        rootCause: 'Falta de capacitor de desacople en la alimentación o interferencia electromagnética externa.',
        solutionSteps: [
          'Coloca un capacitor cerámico de 100nF entre VCC y GND lo más próximo posible al sensor.',
          'Separa el tendido de cables de señal de los actuadores de potencia.',
        ],
        preventionTip: 'Diseña el cableado separando líneas de señal analógica de líneas de potencia.',
      },
      {
        id: 'tb-bt-5',
        symptom: 'Falla al transferir el firmware al microcontrolador',
        cause: 'Puerto serie (COM) ocupado por otro proceso o controlador USB-Serial no reconocido.',
        solution: '1. Cierra monitores seriales abiertos. 2. Desconecta y reconecta el cable USB. 3. Selecciona el puerto COM correcto en el IDE.',
        prevention: 'Verifica la asignación del puerto en el Administrador de Dispositivos antes de compilar.',
        rootCause: 'Puerto serie (COM) ocupado por otro proceso o controlador USB-Serial no reconocido.',
        solutionSteps: [
          'Cierra cualquier terminal o monitor serial abierto.',
          'Desconecta y reconecta el cable USB.',
          'Selecciona nuevamente la placa y el puerto COM activo en el menú de configuración.',
        ],
        preventionTip: 'Verifica la asignación del puerto en el Administrador de Dispositivos antes de compilar.',
      },
    ];
  }

  return [
    {
      id: 'tb-bge-1',
      symptom: 'Los resultados calculados difieren drásticamente entre los integrantes del equipo',
      cause: 'Uso de unidades heterogéneas o redondeo prematuro de decimales en pasos intermedios.',
      solution: '1. Convierte todos los datos al Sistema Internacional antes de operar. 2. Mantén 3 cifras decimales intermedias y redondea solo al final.',
      prevention: 'Elabora una tabla de datos con unidades explícitas antes de iniciar los cálculos.',
      rootCause: 'Uso de unidades heterogéneas o redondeo prematuro de decimales en pasos intermedios.',
      solutionSteps: [
        'Convierte todos los datos al Sistema Internacional antes de realizar cualquier operación.',
        'Conserva al menos tres cifras decimales en las operaciones intermedias y redondea únicamente el resultado final.',
        'Revisa conjuntamente la fórmula y jerarquía de operaciones.',
      ],
      preventionTip: 'Elabora una tabla de datos con unidades explícitas antes de iniciar los cálculos.',
    },
    {
      id: 'tb-bge-2',
      symptom: 'Dificultad para plantear la hipótesis inicial ante el fenómeno comunitario observado',
      cause: 'Falta de distinción clara entre la causa (variable independiente) y el efecto (variable dependiente).',
      solution: '1. Identifica qué variable modificas tú. 2. Define qué cambio medible esperas observar. 3. Redacta: "Si modifico [X], entonces ocurrirá [Y]".',
      prevention: 'Escribe la pregunta detonadora en el centro de la mesa antes de debatir.',
      rootCause: 'Falta de delimitación de las variables dependiente e independiente.',
      solutionSteps: [
        'Pregúntate: "¿Qué condición o factor manipulamos directamente en esta prueba?"',
        'Pregúntate: "¿Qué magnitud esperamos que cambie como consecuencia?"',
        'Redacta la hipótesis en formato condicional comprobable.',
      ],
      preventionTip: 'Escribe la pregunta detonadora en el centro de la mesa antes de debatir.',
    },
    {
      id: 'tb-bge-3',
      symptom: 'La gráfica experimental no muestra una tendencia clara o los puntos están muy dispersos',
      cause: 'Muestreo insuficiente o errores de paralelaje y tiempo de reacción al tomar las lecturas.',
      solution: '1. Repite las mediciones al menos 3 veces para calcular la media aritmética. 2. Ajusta la escala de los ejes cartesianos de forma proporcional.',
      prevention: 'Asigna a un solo compañero la tarea del cronómetro y a otro el registro visual para evitar variaciones individuales.',
      rootCause: 'Muestreo insuficiente o error en la toma manual de datos.',
      solutionSteps: [
        'Realiza tres repeticiones por cada punto experimental y obtén el promedio.',
        'Escala adecuadamente los ejes cartesianos en papel milimetrado.',
      ],
      preventionTip: 'Asigna a un solo compañero la tarea del cronómetro y a otro el registro visual para evitar variaciones individuales.',
    },
    {
      id: 'tb-bge-4',
      symptom: 'Confusión al interpretar el significado físico de una constante o coeficiente',
      cause: 'Memorización de la fórmula sin asociarla a la analogía física o propiedad intrínseca del material.',
      solution: '1. Revisa la analogía del "Concepto Cero". 2. Analiza las unidades del coeficiente (ej: J/kg°C indica cuánta energía absorbe un kilogramo para subir un grado).',
      prevention: 'Siempre analiza las dimensiones y unidades de cada magnitud antes de sustituir valores.',
      rootCause: 'Memorización de la fórmula sin asociarla a la analogía física.',
      solutionSteps: [
        'Regresa a la sección Concepto Cero de la guía y revisa la analogía cotidiana.',
        'Desglosa las unidades de la constante paso por paso.',
      ],
      preventionTip: 'Siempre analiza las dimensiones y unidades de cada magnitud antes de sustituir valores.',
    },
    {
      id: 'tb-bge-5',
      symptom: 'El equipo no logra llegar a un consenso sobre la conclusión de la investigación',
      cause: 'Opiniones basadas en intuición personal y no en la evidencia empírica recolectada en la tabla.',
      solution: '1. Coloca la tabla de datos frente al equipo. 2. Contrasta cada afirmación contra los números registrados. 3. Acepta solo argumentos sustentados en datos.',
      prevention: 'Nombrar un relator en cada equipo responsable de anotar solo hechos observados y mediciones comprobables.',
      rootCause: 'Opiniones subjetivas no sustentadas en los datos empíricos obtenidos.',
      solutionSteps: [
        'Coloca la tabla de mediciones al centro del equipo.',
        'Revisa si los datos respaldan o refutan la hipótesis inicial.',
        'Redacta la conclusión basándote exclusivamente en las evidencias registradas.',
      ],
      preventionTip: 'Nombrar un relator en cada equipo responsable de anotar solo hechos observados y mediciones comprobables.',
    },
  ];
}
