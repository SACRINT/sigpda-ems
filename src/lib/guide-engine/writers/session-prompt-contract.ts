import type { DisciplinaryAdapterV2 } from '@/lib/prompts/disciplinary-adapters';

export type CanonicalMissionType = 'foundation' | 'lab' | 'project' | 'evaluation';

export interface CanonicalSessionPlanOptions {
  firstSession?: number;
}

export function buildCanonicalSessionPlanInstructions(
  adapter: DisciplinaryAdapterV2,
  missionType: CanonicalMissionType,
  options: CanonicalSessionPlanOptions = {}
): string {
  const firstSession = options.firstSession ?? 1;
  const missionFocus: Record<CanonicalMissionType, string> = {
    foundation: 'fundamentación, concepto cero e intuición inicial',
    lab: 'práctica, taller, laboratorio o estudio de caso',
    project: 'avance del proyecto integrador y producto del bloque',
    evaluation: 'cierre, síntesis y evaluación formativa del bloque',
  };

  return `CONTRATO CANÓNICO V2 DE "sessionPlans" (${missionFocus[missionType]}; inicia en la sesión ${firstSession}):
ESTRUCTURA OBLIGATORIA DE CADA SESIÓN (~780 a 920 palabras por sesión):
Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "observa", "analiza", "calcula", "redacta").
PROHIBIDO usar lenguaje dirigido al docente ("el docente explica", "activar saberes", "dictamen formativo", "el estudiantado").

Para CADA sesión solicitada incluye exactamente estos campos:
(a) "sessionNumber": número entero exacto de la sesión.
(b) "objetivo": 20 a 35 palabras; qué aprenderás y lograrás hoy, en presente o segunda persona natural. PROHIBIDO iniciar con verbos administrativos en futuro aislados o repetir el número de sesión dentro del texto.
(c) "motivacion": 70 a 100 palabras; situación real y cercana al estudiante, conectada de forma natural con el bloque o proyecto.
(d) "saberesPrevios": 45 a 70 palabras; conceptos o habilidades previas y una pregunta breve de activación.
(e) "contenido": OBLIGATORIO de 320 a 440 palabras en EXACTAMENTE 3 párrafos separados por doble salto de línea (\\n\\n), de 105 a 145 palabras cada uno:
    - Párrafo 1: definición formal de los conceptos nuevos y su significado preciso.
    - Párrafo 2: principios, leyes, fórmulas completas o estructura metodológica paso a paso, explicando cada elemento o variable.
    - Párrafo 3: criterios de interpretación, errores frecuentes y cómo verificar que el resultado o análisis es correcto.
    PROHIBIDO rellenar con frases grandilocuentes o repetir el mismo párrafo con otras palabras.
(f) "ejemploResuelto": OBLIGATORIO de 220 a 300 palabras. ${adapter.workedExampleDirective}
    REGLA DE FORMATO: "Planteamiento:", "Paso 1:", "Paso 2:", "Paso 3:" y "Paso 4:" SIEMPRE en líneas separadas mediante salto de línea (\\n). NUNCA pegues "Paso N:" después de un punto en la misma línea.
(g) "practica": arreglo de EXACTAMENTE 2 ejercicios progresivos y AUTOCONTENIDOS:
    - "enunciado": 45 a 80 palabras; incluye contexto, todos los datos o el fragmento necesario y una consigna final explícita con verbo imperativo o pregunta directa. PROHIBIDO remitir a otro ejercicio ("del ejercicio anterior", "con los datos del problema previo").
    - "pista": 20 a 35 palabras; orientación metodológica específica y distinta para cada ejercicio.
    - "solucion": arreglo de 3 a 5 cadenas ("Paso 1: ...", "Paso 2: ...", "Respuesta final: ...") con desarrollo completo.
(h) "aplicacion": 60 a 90 palabras; transferencia al entorno cotidiano o avance concreto del proyecto.
(i) "autoevaluacion": arreglo de 2 preguntas reflexivas específicas sobre el dominio del tema.
(j) "recursos": arreglo de 2 recursos del catálogo curado o portales institucionales oficiales. PROHIBIDO google.com/search, youtube.com/results o URLs inventadas.
(k) "productoIntegrador": 45 a 70 palabras; evidencia o avance concreto que incorporas al portafolio.
(l) "sintesisVisual": objeto estructurado para 08_Presentaciones y 09_Infografías:
    - "conceptoBreve": 25 a 38 palabras; oración completa con sujeto, verbo conjugado y predicado que explica qué es y cómo funciona el concepto central (PROHIBIDO entregar solo un título o sintagma nominal sin verbo).
    - "formulaOReglaClave": ${adapter.keyFormulaOrRuleDirective}
    - "ejemploBreve": DEBE sintetizar el MISMO caso y las MISMAS ecuaciones/datos de "ejemploResuelto" (PROHIBIDO inventar otro ejercicio distinto o telegráfico como "x + y = 10. Hallar x, y"):
      * "planteamiento": 22 a 40 palabras autónomas con contexto, datos y meta clara (>= 45 caracteres).
      * "pasos": 2 o 3 pasos completos de 10 a 22 palabras que muestren la sustitución/operación y el valor final despejado o inferencia verificada.
      * "conclusion": 10 a 20 palabras con el resultado concreto y su interpretación.
    - "mapaConceptual": { "definicionClave": 18 a 28 palabras sin tautologías; "criterioDesarrollo": 14 a 24 palabras; "errorComun": 12 a 22 palabras; "correccionBreve": 12 a 22 palabras }

REGLAS DE HIGIENE TIPOGRÁFICA Y MATEMÁTICA:
1. Usa símbolos Unicode limpios: √, ², ³, ≠, ≤, ≥, ≈, °, ×, ÷, π, Δ.
2. PROHIBIDO escribir "raiz(...)", "sqrt(...)", "!=", "\\frac", "\\begin{vmatrix}", "\\begin{pmatrix}", "\\begin{bmatrix}", "\\\\", "$...$" o subíndices con guion bajo como "x_v", "D_x" o "M_(simple)". Para determinantes usa notación lineal clara, p. ej. D = |a1, b1 ; a2, b2| = (a1·b2) - (a2·b1).
3. Contextualiza en "motivacion" y "aplicacion" sin repetir mecánicamente "en Puebla" ni "PAEC" en cada párrafo, paso o ejercicio, y SIN introducir analogías de laboratorio químico ni seguridad en taller cuando la asignatura no es experimental ni técnica.
4. Sintaxis JSON estricta: usa comillas simples dentro de textos y evita comillas dobles sin escapar.`;
}

export function buildCanonicalSessionPlanJsonExample(
  adapter: DisciplinaryAdapterV2,
  firstSession = 1
): string {
  return JSON.stringify(
    {
      sessionPlans: [
        {
          sessionNumber: firstSession,
          objetivo:
            'Comprendes el concepto central de la sesión y lo aplicas para resolver una situación de tu entorno con evidencia verificable.',
          motivacion:
            'En tu comunidad se presenta una situación concreta que exige tomar decisiones informadas. Observas los datos disponibles, identificas qué necesitas averiguar y reconoces por qué el tema de hoy te permite responder con rigor.',
          saberesPrevios:
            'Recuerda los conceptos antecedentes de la asignatura y la experiencia del bloque anterior. Responde: ¿qué relación encuentras entre esos saberes y la situación que acabas de leer?',
          contenido:
            'Párrafo 1: La definición formal del concepto central precisa su significado, sus elementos y el tipo de problemas que permite comprender.\n\nPárrafo 2: El principio, modelo o estructura metodológica organiza los pasos que seguirás, explica cada variable o categoría y muestra cómo se relacionan entre sí.\n\nPárrafo 3: Los criterios de interpretación te permiten comprobar el resultado, detectar errores frecuentes y justificar tus decisiones con evidencia.',
          ejemploResuelto:
            'Planteamiento: Se presenta un caso situado con datos completos y una pregunta verificable.\nPaso 1: Identificas los datos, elementos o fuentes relevantes y defines qué buscarás.\nPaso 2: Aplicas el criterio, principio, modelo o fórmula que corresponde al caso.\nPaso 3: Desarrollas el procedimiento paso a paso y registras cada transformación o inferencia.\nPaso 4: Verificas el resultado, lo interpretas con unidades o evidencia y formulas una conclusión.',
          practica: [
            {
              enunciado:
                'Una situación de tu comunidad presenta datos concretos y una necesidad de decisión. Con esa información completa, determina el resultado solicitado y justifica el procedimiento que elegiste.',
              pista:
                'Organiza primero los datos conocidos, identifica la relación o criterio aplicable y verifica las unidades o categorías antes de concluir.',
              solucion: [
                'Paso 1: Registrar los datos y la incógnita del caso.',
                'Paso 2: Aplicar el criterio o procedimiento correspondiente.',
                'Respuesta final: Resultado verificado e interpretado en el contexto.',
              ],
            },
            {
              enunciado:
                'Otra situación del entorno ofrece información adicional y una meta distinta. Analiza el caso con tus propios recursos, resuelve lo que se pide y explica por qué tu respuesta es coherente.',
              pista:
                'Contrasta los datos con el criterio central de la sesión y comprueba el resultado antes de comunicar tu conclusión.',
              solucion: [
                'Paso 1: Diferenciar los datos relevantes de los secundarios.',
                'Paso 2: Desarrollar el procedimiento y comprobar la coherencia.',
                'Respuesta final: Conclusión argumentada con evidencia.',
              ],
            },
          ],
          aplicacion:
            'Transfiere lo aprendido a una situación cotidiana o al avance de tu proyecto del bloque. Explica qué decisión tomarías, con qué evidencia la sustentas y qué aprendizaje incorporas a tu portafolio.',
          autoevaluacion: [
            '¿Puedo explicar el concepto central con mis propias palabras y un ejemplo?',
            '¿Cómo compruebo que mi resultado o interpretación es coherente con los datos?',
          ],
          recursos: [
            {
              titulo: 'Portal institucional de consulta académica',
              url: 'https://www.gob.mx/sep',
              tipo: 'web',
            },
            {
              titulo: 'Recurso de consulta del catálogo curado',
              url: 'https://www.inegi.org.mx/',
              tipo: 'lectura',
            },
          ],
          productoIntegrador:
            'Incorporas a tu portafolio una evidencia concreta de la sesión: el desarrollo, la verificación y una breve reflexión sobre su utilidad en el proyecto.',
          sintesisVisual: {
            conceptoBreve:
              'El concepto central de esta sesión permite interpretar una situación concreta, organizar sus elementos y tomar decisiones fundamentadas con evidencia verificable.',
            formulaOReglaClave:
              adapter.keyFormulaOrRuleDirective.includes('Ecuación')
                ? '12x + 300 = 1800'
                : 'Criterio central → Evidencia → Interpretación verificable',
            ejemploBreve: {
              planteamiento:
                'Un caso de tu entorno presenta datos completos y una pregunta que exige aplicar el concepto central para obtener una respuesta verificable.',
              pasos: [
                'Identifica los datos y el criterio que relaciona las variables del caso.',
                'Aplica el procedimiento completo y registra cada transformación.',
                'Comprueba el resultado con la situación inicial y comunica la conclusión.',
              ],
              conclusion:
                'El resultado obtenido es coherente con los datos y permite sustentar una decisión argumentada.',
            },
            mapaConceptual: {
              definicionClave:
                'El concepto central organiza los elementos del caso y establece la relación que permite interpretarlos con rigor.',
              criterioDesarrollo:
                'Aplica el criterio paso a paso y conserva la relación completa entre datos, procedimiento y resultado.',
              errorComun:
                'Omitir datos relevantes o aplicar un criterio que no corresponde al tipo de situación analizada.',
              correccionBreve:
                'Verifica la correspondencia entre datos y criterio antes de concluir, y comprueba el resultado en el contexto.',
            },
          },
        },
      ],
    },
    null,
    2
  );
}
