import type { DisciplinaryAdapterV2 } from '@/lib/prompts/disciplinary-adapters';
import { MAX_WORDS_PER_SESSION } from '../content-budget';

export type CanonicalMissionType = 'foundation' | 'lab' | 'project' | 'evaluation';

export interface CanonicalSessionPlanOptions {
  firstSession?: number;
}

/**
 * Fuente única de verdad (SSoT) del presupuesto de palabras por SessionPlan (V2).
 * Alineado con `content-budget.ts` (1,125–1,250 palabras totales por sesión con narrativa):
 * la suma de los mínimos de todos los campos (incluyendo `practica[].solucion` y `sintesisVisual`,
 * ambos contabilizados por `countSessionPlanWords`) es 1,096 palabras ≤ targetMin (1,120) ≤ targetMax (1,250).
 */
export const SESSION_PLAN_WORD_CONTRACT = {
  targetMin: 1120,
  targetMax: MAX_WORDS_PER_SESSION,
  targetIdeal: 1185,
  fields: {
    objetivo: { min: 20, max: 35 },
    motivacion: { min: 65, max: 95 },
    saberesPrevios: { min: 45, max: 65 },
    contenido: { min: 320, max: 440 },
    ejemploResuelto: { min: 220, max: 300 },
    practicaEnunciadoPerItem: { min: 45, max: 75, count: 2 },
    practicaPistaPerItem: { min: 18, max: 30, count: 2 },
    practicaSolucionPerItem: { min: 20, max: 40, count: 2 },
    aplicacion: { min: 55, max: 85 },
    autoevaluacionPerItem: { min: 8, max: 15, count: 2 },
    recursosTituloPerItem: { min: 5, max: 10, count: 2 },
    productoIntegrador: { min: 45, max: 65 },
    sintesisVisualConceptoBreve: { min: 25, max: 38 },
    sintesisVisualFormulaORegla: { min: 3, max: 12 },
    sintesisVisualEjemploPlanteamiento: { min: 20, max: 38 },
    sintesisVisualEjemploPasosPerItem: { min: 10, max: 20, minCount: 2, maxCount: 3 },
    sintesisVisualEjemploConclusion: { min: 10, max: 20 },
    sintesisVisualMapaDefinicion: { min: 18, max: 26 },
    sintesisVisualMapaCriterio: { min: 14, max: 22 },
    sintesisVisualMapaError: { min: 12, max: 20 },
    sintesisVisualMapaCorreccion: { min: 12, max: 20 },
  },
} as const;

/**
 * Suma exacta de los mínimos declarados en `SESSION_PLAN_WORD_CONTRACT` (1,096 palabras).
 * Permite verificar como invariante determinista que `sum(min) <= targetMax`.
 */
export function computeSessionPlanContractMinWords(): number {
  const f = SESSION_PLAN_WORD_CONTRACT.fields;
  return (
    f.objetivo.min +
    f.motivacion.min +
    f.saberesPrevios.min +
    f.contenido.min +
    f.ejemploResuelto.min +
    f.practicaEnunciadoPerItem.min * f.practicaEnunciadoPerItem.count +
    f.practicaPistaPerItem.min * f.practicaPistaPerItem.count +
    f.practicaSolucionPerItem.min * f.practicaSolucionPerItem.count +
    f.aplicacion.min +
    f.autoevaluacionPerItem.min * f.autoevaluacionPerItem.count +
    f.recursosTituloPerItem.min * f.recursosTituloPerItem.count +
    f.productoIntegrador.min +
    f.sintesisVisualConceptoBreve.min +
    f.sintesisVisualFormulaORegla.min +
    f.sintesisVisualEjemploPlanteamiento.min +
    f.sintesisVisualEjemploPasosPerItem.min * f.sintesisVisualEjemploPasosPerItem.minCount +
    f.sintesisVisualEjemploConclusion.min +
    f.sintesisVisualMapaDefinicion.min +
    f.sintesisVisualMapaCriterio.min +
    f.sintesisVisualMapaError.min +
    f.sintesisVisualMapaCorreccion.min
  );
}

export function buildCanonicalSessionPlanInstructions(
  adapter: DisciplinaryAdapterV2,
  missionType: CanonicalMissionType,
  options: CanonicalSessionPlanOptions = {}
): string {
  const firstSession = options.firstSession ?? 1;
  const f = SESSION_PLAN_WORD_CONTRACT.fields;
  const missionFocus: Record<CanonicalMissionType, string> = {
    foundation: 'fundamentación, concepto cero e intuición inicial',
    lab: adapter.practiceSpaceLabel.toLowerCase(),
    project: 'avance del proyecto integrador y producto del bloque',
    evaluation: 'cierre, síntesis y evaluación formativa del bloque',
  };
  const actionVerbs = adapter.requiresQuantitativeData
    ? '"tú", "observa", "analiza", "calcula", "comprueba"'
    : '"tú", "observa", "analiza", "argumenta", "redacta"';
  const practicalTotalMin = SESSION_PLAN_WORD_CONTRACT.targetMin + 30;
  const practicalContenidoMin = f.contenido.min + 25;
  const practicalContenidoMax = 435;
  const practicalEjemploMin = f.ejemploResuelto.min + 30;

  return `CONTRATO CANÓNICO V2 DE "sessionPlans" (${missionFocus[missionType]}; inicia en la sesión ${firstSession}):
ESTRUCTURA OBLIGATORIA DE CADA SESIÓN (${SESSION_PLAN_WORD_CONTRACT.targetMin} a ${SESSION_PLAN_WORD_CONTRACT.targetMax} palabras totales por sesión, incluyendo práctica con solucionario docente y sintesisVisual):
META OBLIGATORIA DE EXTENSIÓN: redacta entre ${practicalTotalMin} y ${SESSION_PLAN_WORD_CONTRACT.targetMax} palabras totales por sesión, con ${practicalContenidoMin} a ${practicalContenidoMax} palabras en "contenido" y ${practicalEjemploMin} a ${f.ejemploResuelto.max} palabras en "ejemploResuelto". No entregues borradores abreviados ni resumas las últimas sesiones del paquete.
Escribe SIEMPRE en segunda persona dirigida al estudiante (${actionVerbs}).
PROHIBIDO usar lenguaje dirigido al docente ("el docente explica", "activar saberes", "dictamen formativo", "el estudiantado").

Para CADA sesión solicitada incluye exactamente estos campos:
(a) "sessionNumber": número entero exacto de la sesión.
(b) "objetivo": ${f.objetivo.min} a ${f.objetivo.max} palabras; qué aprenderás y lograrás hoy, en presente o segunda persona natural. PROHIBIDO iniciar con verbos administrativos en futuro aislados o repetir el número de sesión dentro del texto.
(c) "motivacion": ${f.motivacion.min} a ${f.motivacion.max} palabras; situación real y cercana al estudiante, conectada de forma natural con el bloque o proyecto.
(d) "saberesPrevios": ${f.saberesPrevios.min} a ${f.saberesPrevios.max} palabras; conceptos o habilidades previas y una pregunta breve de activación.
(e) "contenido": OBLIGATORIO de ${practicalContenidoMin} a ${practicalContenidoMax} palabras en EXACTAMENTE 3 párrafos separados por doble salto de línea (\\n\\n), de 115 a 145 palabras CADA párrafo:
    - Párrafo 1 (115–145 palabras): definición formal de los conceptos nuevos, su significado preciso y alcance en la disciplina.
    - Párrafo 2 (115–145 palabras): principios, leyes, fórmulas completas o estructura metodológica paso a paso, explicando cada elemento, unidad o variable.
    - Párrafo 3 (115–145 palabras): criterios de interpretación, errores frecuentes y cómo verificar que el resultado o análisis es correcto.
    PROHIBIDO rellenar con frases grandilocuentes o repetir el mismo párrafo con otras palabras.
(f) "ejemploResuelto": OBLIGATORIO de ${practicalEjemploMin} a ${f.ejemploResuelto.max} palabras con distribución obligatoria por bloque:
    - "Planteamiento:": 50 a 70 palabras con contexto y datos o fuente completa.
    - "Paso 1:", "Paso 2:" y "Paso 3:": 40 a 55 palabras CADA paso con desarrollo explícito.
    - "Paso 4: Conclusión:" o "Paso 4: Resultado:": 30 a 45 palabras iniciando LITERALMENTE con "Paso 4: Conclusión:" o "Paso 4: Resultado:" para cerrar con verificación e interpretación concreta.
    ${adapter.workedExampleDirective}
    REGLA DE FORMATO: "Planteamiento:", "Paso 1:", "Paso 2:", "Paso 3:" y "Paso 4: Conclusión:" SIEMPRE en líneas separadas mediante salto de línea (\\n). NUNCA pegues "Paso N:" después de un punto en la misma línea.
(g) "practica": arreglo de EXACTAMENTE 2 ejercicios progresivos y AUTOCONTENIDOS:
    - "enunciado": ${f.practicaEnunciadoPerItem.min} a ${f.practicaEnunciadoPerItem.max} palabras; incluye contexto, todos los datos o el fragmento necesario y una consigna final explícita con verbo imperativo o pregunta directa. PROHIBIDO remitir a otro ejercicio ("del ejercicio anterior", "con los datos del problema previo").
    - "pista": ${f.practicaPistaPerItem.min} a ${f.practicaPistaPerItem.max} palabras; orientación metodológica específica y distinta para cada ejercicio (única ayuda visible en el libro del estudiante).
    - "solucion": arreglo de 3 a 5 cadenas ("Paso 1: ...", "Paso 2: ...", "Respuesta final: ...", ~${f.practicaSolucionPerItem.min} a ${f.practicaSolucionPerItem.max} palabras en total) de USO EXCLUSIVO para el solucionario docente (no se imprime en el libro del estudiante).
(h) "aplicacion": ${f.aplicacion.min} a ${f.aplicacion.max} palabras; transferencia al entorno cotidiano o avance concreto del proyecto.
(i) "autoevaluacion": arreglo de 2 preguntas reflexivas específicas sobre el dominio del tema (${f.autoevaluacionPerItem.min} a ${f.autoevaluacionPerItem.max} palabras cada una).
(j) "recursos": arreglo de 2 recursos del catálogo curado o portales institucionales oficiales. PROHIBIDO google.com/search, youtube.com/results o URLs inventadas.
(k) "productoIntegrador": ${f.productoIntegrador.min} a ${f.productoIntegrador.max} palabras; evidencia o avance concreto que incorporas al portafolio.
(l) "sintesisVisual": objeto OBLIGATORIO para 08_Presentaciones y 09_Infografías:
    - "conceptoBreve": ${f.sintesisVisualConceptoBreve.min} a ${f.sintesisVisualConceptoBreve.max} palabras; oración completa con sujeto, verbo conjugado y predicado que explica qué es y cómo funciona el concepto central (PROHIBIDO entregar solo un título o sintagma nominal sin verbo).
    - "formulaOReglaClave": ${adapter.keyFormulaOrRuleDirective}
    - "ejemploBreve": DEBE sintetizar el MISMO caso y las MISMAS ecuaciones/datos o fuentes de "ejemploResuelto" (PROHIBIDO inventar otro ejercicio distinto o telegráfico):
      * "planteamiento": ${f.sintesisVisualEjemploPlanteamiento.min} a ${f.sintesisVisualEjemploPlanteamiento.max} palabras autónomas con contexto, datos/fuente y meta clara (>= 45 caracteres).
      * "pasos": ${f.sintesisVisualEjemploPasosPerItem.minCount} o ${f.sintesisVisualEjemploPasosPerItem.maxCount} pasos completos de ${f.sintesisVisualEjemploPasosPerItem.min} a ${f.sintesisVisualEjemploPasosPerItem.max} palabras que muestren el desarrollo y la conclusión o valor verificado.
      * "conclusion": ${f.sintesisVisualEjemploConclusion.min} a ${f.sintesisVisualEjemploConclusion.max} palabras con el resultado concreto y su interpretación.
    - "mapaConceptual": { "definicionClave": ${f.sintesisVisualMapaDefinicion.min} a ${f.sintesisVisualMapaDefinicion.max} palabras sin tautologías; "criterioDesarrollo": ${f.sintesisVisualMapaCriterio.min} a ${f.sintesisVisualMapaCriterio.max} palabras; "errorComun": ${f.sintesisVisualMapaError.min} a ${f.sintesisVisualMapaError.max} palabras; "correccionBreve": ${f.sintesisVisualMapaCorreccion.min} a ${f.sintesisVisualMapaCorreccion.max} palabras }

REGLAS DE HIGIENE TIPOGRÁFICA Y MATEMÁTICA:
1. Usa símbolos Unicode limpios: √, ², ³, ≠, ≤, ≥, ≈, °, ×, ÷, π, Δ.
2. PROHIBIDO escribir "raiz(...)", "sqrt(...)", "!=", "\\frac", "\\begin{vmatrix}", "\\begin{pmatrix}", "\\begin{bmatrix}", "\\\\", "$...$" o subíndices con guion bajo como "x_v", "D_x" o "M_(simple)". Para determinantes usa notación lineal clara, p. ej. D = |a1, b1 ; a2, b2| = (a1·b2) - (a2·b1).
3. Contextualiza en "motivacion" y "aplicacion" sin repetir mecánicamente "en Puebla" ni "PAEC" en cada párrafo, paso o ejercicio, y SIN introducir analogías de laboratorio químico ni seguridad en taller cuando la asignatura no es experimental ni técnica.
4. Sintaxis JSON estricta: usa comillas simples dentro de textos y evita comillas dobles sin escapar.

AUTOCHEQUEO ANTES DE RESPONDER (OBLIGATORIO PARA CADA SESIÓN):
Cuenta las palabras reales de "contenido", "ejemploResuelto", "practica" y el total de la sesión ANTES de escribir el JSON final:
- ¿Cada párrafo de "contenido" tiene 115–145 palabras (3 párrafos = 345–435 palabras en total)?
- ¿"ejemploResuelto" suma 250–300 palabras (Planteamiento 50–70, Pasos 1–3 de 40–55 c/u y cierre LITERAL con "Paso 4: Conclusión:" o "Paso 4: Resultado:" de 30–45 palabras)?
- ¿Cada "enunciado" de "practica" tiene 45–75 palabras y cada "pista" 18–30 palabras?
- ¿La sesión completa suma ${practicalTotalMin}–${SESSION_PLAN_WORD_CONTRACT.targetMax} palabras e incluye "sintesisVisual" completo?
Si algún campo está por debajo del rango objetivo, REESCRÍBELO y amplíalo con detalle disciplinar real antes de responder.`;
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
            'Comprendes con precisión el concepto central de esta sesión, identificas sus elementos fundamentales y los aplicas paso a paso para resolver una situación concreta de tu entorno escolar con evidencia verificable.',
          motivacion:
            'En tu plantel y en tu comunidad se presentan cotidianamente situaciones reales que requieren analizar información antes de tomar una decisión responsable. Cuando observas con atención los registros disponibles, conversas con tus compañeros sobre las causas del problema y distingues qué datos ya conoces frente a los que necesitas averiguar, descubres que la intuición inicial no basta. Por eso hoy estudiarás una herramienta estructurada para interpretar hechos con rigor.',
          saberesPrevios:
            'Antes de comenzar, recupera los conceptos fundamentales revisados en las sesiones previas y piensa en cómo organizabas la información de un caso similar en tu cuaderno. Reflexiona sobre qué criterios utilizaste para distinguir un dato principal de uno secundario y responde: ¿qué relación encuentras con el reto de hoy?',
          contenido:
            'Para comprender con rigor el propósito formativo de esta sesión es necesario partir de una definición clara del concepto central, identificar cada uno de sus componentes estructurales y distinguir en qué tipo de situaciones reales resulta pertinente emplearlo. Cuando analizamos un fenómeno o problema de nuestro entorno escolar o comunitario, con frecuencia disponemos de descripciones generales que no bastan para tomar decisiones fundamentadas ni para explicar con precisión qué factores intervienen. Establecer definiciones operativas, categorías de análisis y criterios de observación nos permite transformar impresiones iniciales en afirmaciones verificables. De este modo, cada término clave adquiere un sentido específico dentro de la asignatura y sirve como punto de partida sólido para organizar la información disponible antes de iniciar cualquier procedimiento.\n\nEn un segundo nivel de análisis, el modelo, método o principio rector de la sesión articula de forma ordenada los pasos que conectan la información inicial con la respuesta o interpretación buscada. Cada fase cumple una función determinada: primero se seleccionan los datos o evidencias relevantes, después se relacionan mediante reglas explícitas o procedimientos sistemáticos y finalmente se verifica la consistencia interna de los resultados intermedios. Comprender esta estructura evita la aplicación mecánica de recetas memorizadas sin sentido, porque muestra por qué cada paso precede al siguiente y qué sucede cuando falta un dato o cambia alguna condición del contexto. Así desarrollas autonomía intelectual para elegir la estrategia más adecuada frente a situaciones nuevas, argumentar el orden de tu procedimiento y anticipar posibles desviaciones.\n\nFinalmente, interpretar los hallazgos exige contrastar el resultado obtenido con las condiciones reales del problema y comunicar las conclusiones con claridad, precisión y respaldo en evidencias. Un resultado aislado carece de valor formativo si no se explica qué significa en términos prácticos, cuáles son sus alcances y qué limitaciones presenta frente a factores externos. Por ello, conviene revisar de manera crítica la coherencia de las unidades, las categorías empleadas o los argumentos construidos antes de emitir una respuesta definitiva. Al detectar errores frecuentes —como confundir variables, omitir condiciones iniciales o apresurar inferencias sin sustento—, se consolida un pensamiento analítico capaz de justificar decisiones responsables en el ámbito académico, personal y comunitario. Esta revisión reflexiva cierra el ciclo de aprendizaje y prepara para retos mayores.',
          ejemploResuelto:
            'Planteamiento: En el plantel se analiza una situación real del entorno en la que intervienen dos registros comparables medidos al inicio y al cierre de una jornada semanal de observación. Se dispone de la totalidad de los datos de partida, las condiciones de trabajo del equipo y una pregunta concreta que requiere explicar el comportamiento observado y fundamentar una decisión práctica con evidencias verificables.\nPaso 1: Identifica y organiza todos los datos relevantes proporcionados en el planteamiento, distingue las magnitudes o categorías principales de la información secundaria, verifica que los registros estén completos en el mismo marco de referencia y formula con precisión qué incógnita o criterio de decisión se debe resolver.\nPaso 2: Selecciona el principio, modelo o criterio de análisis adecuado de acuerdo con el propósito de la sesión y plantea la relación explícita entre los elementos identificados en el paso anterior, cuidando el orden correcto de comparación y la coherencia de las categorías o unidades utilizadas.\nPaso 3: Desarrolla de manera ordenada el procedimiento completo mostrando cada transformación intermedia, comparación documental o cálculo necesario sin omitir pasos, comprueba que no existan inconsistencias entre los valores obtenidos y registra el resultado parcial con el nivel de detalle requerido para su verificación independiente por otros estudiantes.\nPaso 4: Conclusión: Se obtiene un resultado coherente que confirma la tendencia observada en la jornada semanal, se interpreta su significado práctico en términos de las unidades o criterios del contexto escolar y se formula una recomendación fundamentada, clara y verificable para orientar las acciones del equipo.',
          practica: [
            {
              enunciado:
                'En una brigada escolar de seguimiento comunitario se registraron dos mediciones completas al inicio y al final de la semana bajo condiciones controladas de observación, junto con las notas de campo del equipo. Con base en todos los datos presentados en este escenario, aplica el procedimiento estudiado, determina el resultado solicitado y justifica tu decisión.',
              pista:
                'Organiza primero los datos conocidos del registro inicial y final, identifica la relación aplicable en este caso y verifica la coherencia de unidades antes de concluir.',
              solucion: [
                'Paso 1: Registrar los datos iniciales, finales y la incógnita del caso.',
                'Paso 2: Aplicar el criterio correspondiente y desarrollar cada paso en orden.',
                'Respuesta final: Resultado verificado e interpretado con coherencia en el contexto.',
              ],
            },
            {
              enunciado:
                'Durante una segunda jornada de trabajo colaborativo en el plantel se recopiló un nuevo conjunto de evidencias y registros comparativos con una condición adicional que modifica el comportamiento inicial. Analiza detalladamente la información completa de este segundo caso, resuelve lo que se solicita paso a paso y explica por qué tu conclusión es válida.',
              pista:
                'Contrasta la condición adicional de esta segunda jornada con el criterio central de la sesión y comprueba cada paso intermedio antes de redactar tu conclusión.',
              solucion: [
                'Paso 1: Diferenciar los datos principales de la condición adicional planteada.',
                'Paso 2: Desarrollar el procedimiento completo y comprobar la consistencia intermedia.',
                'Respuesta final: Conclusión argumentada y respaldada con evidencia verificable.',
              ],
            },
          ],
          aplicacion:
            'Transfiere lo aprendido en esta sesión a una situación real de tu vida cotidiana o al siguiente avance del proyecto transversal de tu bloque. Describe en tu cuaderno qué problema específico seleccionaste, qué datos o evidencias reales recabaste en tu entorno cercano, qué decisión fundamentada tomarías a partir de tu análisis y cómo este hallazgo aporta a tu equipo.',
          autoevaluacion: [
            '¿Puedo explicar el concepto central de hoy con mis propias palabras y un ejemplo?',
            '¿Cómo compruebo que mi procedimiento y mi conclusión son coherentes con los datos?',
          ],
          recursos: [
            {
              titulo: 'Portal institucional de consulta académica de educación media superior',
              url: 'https://www.gob.mx/sep',
              tipo: 'web',
            },
            {
              titulo: 'Acervo oficial de consulta estadística y documental curada',
              url: 'https://www.inegi.org.mx/',
              tipo: 'lectura',
            },
          ],
          productoIntegrador:
            'Incorporas a tu portafolio de evidencias una ficha completa de trabajo que incluya la organización de los datos o fuentes del caso analizado, el desarrollo ordenado del procedimiento con su verificación paso a paso y una reflexión escrita sobre cómo este resultado aporta al producto del bloque.',
          sintesisVisual: {
            conceptoBreve:
              'El concepto central de esta sesión permite interpretar una situación concreta, organizar sus elementos observables con rigor y tomar decisiones fundamentadas con evidencia verificable en tu entorno.',
            formulaOReglaClave:
              adapter.keyFormulaOrRuleDirective.includes('Ecuación')
                ? '12x + 300 = 1800'
                : 'Criterio central → Evidencia → Interpretación verificable',
            ejemploBreve: {
              planteamiento:
                'Un caso de tu entorno presenta datos completos y una pregunta que exige aplicar el concepto central para obtener una respuesta verificable.',
              pasos: [
                'Identifica los datos principales y el criterio que relaciona las variables del caso.',
                'Aplica el procedimiento completo paso a paso y registra cada transformación intermedia.',
                'Comprueba el resultado con la situación inicial y comunica la conclusión final.',
              ],
              conclusion:
                'El resultado obtenido es coherente con los datos y permite sustentar una decisión argumentada.',
            },
            mapaConceptual: {
              definicionClave:
                'El concepto central organiza los elementos observables del caso y establece la relación formal que permite interpretarlos con rigor.',
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
