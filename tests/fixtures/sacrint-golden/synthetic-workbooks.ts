import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';

function makeSession(overrides: Partial<SessionPlan>): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: 'Analizar el fenómeno central de la sesión y aplicar sus criterios en casos prácticos.',
    motivacion: 'Observar una situación cotidiana del plantel permite comprender el impacto práctico del tema.',
    saberesPrevios: 'Recuerda los conceptos básicos vistos en sesiones anteriores del curso.',
    contenido: 'El principio fundamental organiza los elementos del sistema de forma ordenada y verificable.',
    ejemploResuelto:
      'Planteamiento: Analiza un caso escolar concreto.\nPaso 1: Identifica las variables relevantes.\nPaso 2: Aplica la regla disciplinar paso a paso.\nConclusión: El resultado verifica la consistencia del procedimiento.',
    practica: [
      {
        enunciado:
          'Resuelve el caso planteado registrando los datos iniciales, aplica el procedimiento estudiado y redacta tu conclusión fundamentada.',
        pista: 'Revisa primero los datos clave antes de ejecutar el procedimiento.',
      },
      {
        enunciado:
          'Contrasta dos escenarios del entorno escolar, determina cuál cumple el criterio técnico y sustenta tu elección con evidencia.',
        pista: 'Compara los resultados paso a paso usando el criterio central.',
      },
    ],
    aplicacion: 'Aplica este procedimiento en una actividad práctica de tu plantel escolar y documenta los hallazgos.',
    autoevaluacion: ['¿Apliqué correctamente el procedimiento central y fundamenté mi conclusión?'],
    recursos: [],
    productoIntegrador: 'Registro analítico documentado para el portafolio del bloque.',
    ...overrides,
  };
}

function makeWorkbook(
  subjectName: string,
  semester: string,
  missionTitle: string,
  sessionTopic: string,
  sessionPlans: SessionPlan[]
): ActiveWorkTextbook {
  const mission = {
    title: missionTitle,
    progressionReference: 'Propósito Formativo 1',
    sessionTopic,
    sessionFocus: sessionTopic,
    durationHours: sessionPlans.length,
    paecConnection: 'Proyecto comunitario escolar de diagnóstico y mejora.',
    phenomenonHook: {
      story: sessionPlans[0]?.motivacion || 'Situación real del entorno escolar.',
      detonatingQuestion: '¿Cómo se explica y aplica este principio en situaciones cotidianas?',
    },
    conceptZero: {
      coreExplanation: sessionPlans[0]?.contenido || 'Principio disciplinar fundamental.',
      physicalAnalogy: 'Relación práctica con un proceso observable del entorno.',
      contrastTable: [
        {
          commonMisconception: 'Aplicar el procedimiento sin verificar las condiciones iniciales.',
          correctConcept: 'Comprobar cada dato y regla antes de emitir la conclusión final.',
          reasoning: 'La validación previa evita errores sistemáticos de interpretación.',
        },
      ],
      solvedExample: {
        problemStatement: sessionPlans[0]?.ejemploResuelto || 'Caso resuelto de muestra.',
        solutionSteps: [
          'Identifica los datos y condiciones iniciales del problema.',
          'Ejecuta la regla principal con precisión.',
        ],
        interpretation: 'El resultado demuestra la validez práctica del principio estudiado.',
      },
    },
    iDoSection: {
      stepByStepDemo: 'Demostración guiada paso a paso del procedimiento central.',
      visualOrDiagram: 'Esquema conceptual de apoyo.',
    },
    weDoSection: {
      guidedPractice: 'Resolución colaborativa en equipos con verificación guiada.',
      workbookElements: [],
    },
    youDoSection: {
      autonomousChallenge: 'Resolución autónoma de un caso aplicado al plantel.',
      workbookElements: [],
    },
    metacognitiveTrafficLight: {
      red: 'Necesito repasar los conceptos base antes de resolver el ejercicio.',
      yellow: 'Resuelvo el procedimiento con apoyo de mis apuntes.',
      green: 'Explico el principio y resuelvo casos nuevos con autonomía.',
    },
    troubleshooting: [],
    formativeCheckpoint: {
      question: 'Verifica la coherencia de tus pasos y la claridad de tu conclusión.',
      criteriaChecklist: ['Procedimiento completo', 'Conclusión fundamentada'],
      reflectionPrompts: ['¿Qué criterio fue clave para evitar errores?'],
    },
    sessionPlans,
  } as unknown as MissionSection;

  return {
    schemaVersion: '2.0',
    subsystem: 'BGE',
    coverData: {
      subjectName,
      semester,
      blockNumber: 1,
      blockTitle: 'Bloque 1 (Corte 1): Propósitos Formativos 1 y 2',
      teacherName: 'Docente Demo',
      schoolName: 'Plantel Demo EMS',
      paecProjectName: 'Proyecto Comunitario Escolar Demo',
    },
    missions: [mission],
  } as unknown as ActiveWorkTextbook;
}

export function buildSyntheticGoldenWorkbooks(): Record<string, ActiveWorkTextbook> {
  const mathWb = makeWorkbook(
    'Pensamiento Matemático III',
    '3er Semestre',
    'Modelación algebraica y geométrica aplicada',
    'Funciones lineales, cuadráticas, sistemas 2x2 y geometría',
    [
      makeSession({
        sessionNumber: 1,
        objetivo: 'Modelar el costo total mensual mediante una función lineal C(x) = 150x + 400',
        contenido: 'Una función lineal relaciona dos variables con razón de cambio constante mediante C(x) = 150x + 400.',
        ejemploResuelto:
          'Planteamiento: Un taller cobra una cuota fija de $400 más $150 por hora (C(x) = 150x + 400).\nPaso 1: Evalúa C(4) = 150(4) + 400 = 1000.\nPaso 2: Verifica el incremento de $150 por cada hora adicional.\nConclusión: Cuatro horas de uso del taller cuestan $1000 en total.',
        practica: [
          {
            enunciado:
              'Calcula el costo total para x = 6 horas usando C(x) = 150x + 400 y determina cuántas horas corresponden a $1300.',
            pista: 'Sustituye primero x = 6 y luego despeja x en 150x + 400 = 1300.',
          },
          {
            enunciado:
              'Plantea una función lineal para un servicio con cuota base de $250 y tarifa de $80 por hora, luego calcula el monto para 5 horas.',
            pista: 'Identifica la pendiente m = 80 y la ordenada al origen b = 250.',
          },
        ],
        sintesisVisual: {
          conceptoBreve: 'La función lineal C(x) = mx + b modela relaciones con pendiente constante m y valor inicial b.',
          formulaOReglaClave: 'C(x) = 150x + 400',
          mapaConceptual: {
            definicionClave: 'La pendiente mide el cambio constante por unidad y b fija el valor en x = 0.',
            criterioDesarrollo: 'Identificar correctamente qué dato es fijo y cuál varía por unidad.',
            errorComun: 'Intercambiar la pendiente m con el término independiente b al armar la ecuación.',
            correccionBreve: 'Multiplicar por x únicamente la tasa variable y sumar el costo fijo.',
          },
          ejemploBreve: {
            planteamiento: 'Un taller escolar cobra C(x) = 150x + 400 por x horas de uso.',
            pasos: ['Sustituye x = 4 en 150(4) + 400.', 'Suma 600 + 400 = 1000 pesos.'],
            conclusion: 'El costo total por cuatro horas equivale exactamente a $1000.',
          },
        },
      }),
      makeSession({
        sessionNumber: 2,
        objetivo: 'Analizar la trayectoria parabólica de f(x) = -2x² + 16x determinando vértice y raíces',
        contenido: 'Una función cuadrática f(x) = ax² + bx + c describe una parábola cuyo vértice determina el máximo o mínimo.',
        ejemploResuelto:
          'Planteamiento: Determina la altura máxima de f(x) = -2x² + 16x.\nPaso 1: Calcula x_v = -16 / (2(-2)) = 4.\nPaso 2: Evalúa f(4) = -2(16) + 16(4) = 32.\nConclusión: El vértice está en (4, 32) y las raíces son x = 0 y x = 8.',
        practica: [
          {
            enunciado:
              'Determina el vértice y las raíces de f(x) = -x² + 10x indicando el valor máximo alcanzado.',
            pista: 'Usa x_v = -b / (2a) y factoriza x(-x + 10) = 0.',
          },
          {
            enunciado:
              'Resuelve la ecuación cuadrática x² - 5x + 6 = 0 por factorización y comprueba ambas soluciones.',
            pista: 'Busca dos números que sumen -5 y multipliquen +6.',
          },
        ],
        sintesisVisual: {
          conceptoBreve: 'Toda parábola f(x) = ax² + bx + c abre hacia abajo si a < 0 y alcanza su máximo en x_v = -b/(2a).',
          formulaOReglaClave: 'f(x) = -2x² + 16x',
          mapaConceptual: {
            definicionClave: 'El vértice fija el extremo de la parábola y las raíces sus cruces con el eje x.',
            criterioDesarrollo: 'Verificar el signo de a antes de interpretar si el vértice es máximo o mínimo.',
            errorComun: 'Omitir el signo negativo del coeficiente a al sustituir en -b/(2a).',
            correccionBreve: 'Conservar los signos completos de a y b en cada sustitución numérica.',
          },
          ejemploBreve: {
            planteamiento: 'Determina el punto máximo de la parábola f(x) = -2x² + 16x.',
            pasos: ['Calcula x_v = -16 / (-4) = 4.', 'Evalúa f(4) = -32 + 64 = 32.'],
            conclusion: 'La altura máxima es 32 unidades en x = 4.',
          },
        },
      }),
      makeSession({
        sessionNumber: 3,
        objetivo: 'Resolver sistemas de ecuaciones lineales 2x2 encontrando la intersección de rectas',
        contenido: 'Un sistema lineal 2x2 busca el par ordenado (x, y) que satisface simultáneamente dos ecuaciones.',
        ejemploResuelto:
          'Planteamiento: Resuelve el sistema x + y = 10 y 2x - y = 5.\nPaso 1: Suma ambas ecuaciones para obtener 3x = 15, entonces x = 5.\nPaso 2: Sustituye x = 5 en x + y = 10 y obtén y = 5.\nConclusión: Las rectas se cruzan en el punto único (5, 5).',
        practica: [
          {
            enunciado:
              'Resuelve el sistema 2x + y = 12 y x - y = 3 por reducción y verifica la solución sustituyendo en ambas ecuaciones.',
            pista: 'Suma las dos ecuaciones para cancelar la variable y.',
          },
          {
            enunciado:
              'Resuelve el sistema x + 2y = 14 y x = 2y por sustitución y escribe las coordenadas del punto de intersección.',
            pista: 'Sustituye x = 2y en la primera ecuación para hallar y.',
          },
        ],
        sintesisVisual: {
          conceptoBreve: 'La solución de un sistema 2x2 coincide con el punto donde se intersecan ambas rectas en el plano.',
          formulaOReglaClave: 'x + y = 10  |  2x - y = 5',
          mapaConceptual: {
            definicionClave: 'El método de reducción elimina una incógnita combinando ambas ecuaciones.',
            criterioDesarrollo: 'Comprobar siempre el par (x, y) en las dos ecuaciones originales.',
            errorComun: 'Verificar la solución solo en una ecuación y dejar un error de signo sin detectar.',
            correccionBreve: 'Sustituir x e y en las dos igualdades para confirmar consistencia.',
          },
          ejemploBreve: {
            planteamiento: 'Resuelve el sistema 2x2 formado por x + y = 10 y 2x - y = 5.',
            pasos: ['Suma ecuaciones: 3x = 15 → x = 5.', 'Sustituye x = 5: 5 + y = 10 → y = 5.'],
            conclusion: 'La intersección única del sistema corresponde al punto (5, 5).',
          },
        },
      }),
    ]
  );

  const laboralWb = makeWorkbook(
    'Instalaciones Eléctricas Residenciales (Formación Laboral)',
    '4to Semestre',
    'Verificación de continuidad y seguridad eléctrica',
    'Procedimiento operativo estándar con EPP y multímetro',
    [
      makeSession({
        sessionNumber: 1,
        objetivo: 'Ejecutar la prueba de continuidad en circuitos residenciales cumpliendo normas de seguridad y EPP',
        contenido:
          'Antes de medir continuidad se desenergiza el circuito en el tablero, se verifica ausencia de tensión y se coloca el multímetro en escala de ohmios.',
        ejemploResuelto:
          'Planteamiento: Comprueba continuidad en un conductor fase de 15 m.\nPaso 1: Baja el interruptor termomagnético y verifica 0 V con multímetro.\nPaso 2: Conecta puntas en modo continuidad y confirma lectura 0.2 Ω.\nConclusión: El conductor mantiene continuidad íntegra sin interrupciones.',
        practica: [
          {
            enunciado:
              'Aplica el protocolo de bloqueo y etiquetado en un circuito de prueba, mide la resistencia de continuidad y registra la lectura en ohmios.',
            pista: 'Confirma siempre 0 V antes de cambiar el selector a continuidad.',
          },
          {
            enunciado:
              'Evalúa una lectura de circuito abierto (OL) en un contacto dúplex, identifica dos causas probables y propone la corrección segura.',
            pista: 'Revisa terminales flojas y estado físico del conductor desenergizado.',
          },
        ],
        sintesisVisual: {
          conceptoBreve: 'La prueba de continuidad requiere circuito desenergizado, EPP dieléctrico y verificación previa de 0 V.',
          formulaOReglaClave: 'Desenergizar → 0 V → Continuidad (Ω)',
          mapaConceptual: {
            definicionClave: 'El procedimiento estándar previene descargas y protege el multímetro.',
            criterioDesarrollo: 'Confirmar ausencia de tensión en cada terminal antes de medir resistencia.',
            errorComun: 'Medir continuidad con el circuito energizado dañando el fusible interno del equipo.',
            correccionBreve: 'Aplicar primero medición de voltaje alterno para validar 0 V.',
          },
          ejemploBreve: {
            planteamiento: 'Verificación de continuidad en circuito de alumbrado residencial.',
            pasos: ['Abre el breaker y comprueba 0 V en terminales.', 'Mide continuidad y confirma 0.2 Ω.'],
            conclusion: 'El conductor cumple continuidad segura conforme a la norma NOM-001.',
          },
        },
      }),
    ]
  );

  const quimicaWb = makeWorkbook(
    'Química I. Materia y reacciones',
    '1er Semestre',
    'Balanceo de ecuaciones químicas por tanteo',
    'Ley de conservación de la masa en reacciones de combustión',
    [
      makeSession({
        sessionNumber: 1,
        objetivo: 'Balancear ecuaciones químicas por tanteo verificando la conservación de átomos en reactivos y productos',
        contenido:
          'En una reacción química la masa total se conserva: el número de átomos de cada elemento debe coincidir en reactivos y productos, como en 2H2 + O2 → 2H2O.',
        ejemploResuelto:
          'Planteamiento: Balancea la síntesis del agua H2 + O2 → H2O.\nPaso 1: Coloca coeficiente 2 en H2O para igualar 2 átomos de oxígeno.\nPaso 2: Coloca coeficiente 2 en H2 para igualar 4 átomos de hidrógeno: 2H2 + O2 → 2H2O.\nConclusión: Reactivos y productos conservan exactamente 4 H y 2 O.',
        practica: [
          {
            enunciado:
              'Balancea por tanteo la combustión del metano CH4 + O2 → CO2 + H2O y comprueba el conteo de átomos por elemento.',
            pista: 'Ajusta primero carbono, luego hidrógeno y al final oxígeno.',
          },
          {
            enunciado:
              'Balancea la ecuación Fe + O2 → Fe2O3 asignando coeficientes estequiométricos enteros mínimos.',
            pista: 'Iguala primero los átomos de oxígeno buscando el mínimo común múltiplo de 2 y 3.',
          },
        ],
        sintesisVisual: {
          conceptoBreve: 'Balancear una ecuación ajusta coeficientes estequiométricos para conservar átomos sin alterar subíndices.',
          formulaOReglaClave: '2H₂ + O₂ → 2H₂O',
          mapaConceptual: {
            definicionClave: 'La ley de Lavoisier exige igual número de átomos antes y después de la reacción.',
            criterioDesarrollo: 'Modificar únicamente coeficientes delante de cada fórmula química.',
            errorComun: 'Cambiar los subíndices de las fórmulas moleculares para forzar el conteo.',
            correccionBreve: 'Conservar intactas las fórmulas y multiplicar mediante coeficientes enteros.',
          },
          ejemploBreve: {
            planteamiento: 'Balancea la ecuación H2 + O2 → H2O por método de tanteo.',
            pasos: ['Ajusta oxígeno con 2H2O.', 'Ajusta hidrógeno con 2H2 para obtener 2H2 + O2 → 2H2O.'],
            conclusion: 'La ecuación balanceada conserva 4 átomos de H y 2 de O.',
          },
        },
      }),
    ]
  );

  const historiaWb = makeWorkbook(
    'Conciencia Histórica I. Procesos sociales',
    '2do Semestre',
    'Independencia de México (1810–1821)',
    'Independencia de México 1810–1821',
    [
      makeSession({
        sessionNumber: 1,
        objetivo: 'Explicar las causas de la Independencia de México (1810–1821)',
        contenido:
          'Las reformas borbónicas, la desigualdad estamental y la crisis monárquica española de 1808 detonaron el proceso insurgente de 1810 a 1821.',
        ejemploResuelto:
          'Planteamiento: Analiza la relación entre crisis imperial de 1808 e inicio insurgente de 1810.\nPaso 1: Identifica el vacío de legitimidad en la Nueva España tras la invasión napoleónica.\nPaso 2: Vincula las demandas criollas e indígenas con la convocatoria de Dolores.\nConclusión: La convergencia de crisis externa y desigualdad interna precipitó la emancipación.',
        practica: [
          {
            enunciado:
              'Ordena cronológicamente cuatro hitos entre 1808 y 1821 y explica la relación causal entre ellos.',
            pista: 'Distingue antecedentes externos, etapa insurgente y consumación.',
          },
          {
            enunciado:
              'Compara las demandas sociales de Hidalgo y Morelos en el documento Sentimientos de la Nación.',
            pista: 'Enfócate en abolición de la esclavitud, soberanía popular y división de poderes.',
          },
        ],
        sintesisVisual: {
          conceptoBreve: 'Los procesos históricos articulan antecedentes estructurales, coyunturas políticas y transformaciones sociales duraderas.',
          formulaOReglaClave: 'Crisis 1808 → Insurgencia 1810 → Consumación 1821',
          mapaConceptual: {
            definicionClave: 'La multicausalidad evita explicar procesos complejos por un solo hecho aislado.',
            criterioDesarrollo: 'Relacionar causas económicas, sociales y políticas con sus consecuencias.',
            errorComun: 'Memorizar fechas sueltas sin analizar qué detonó cada etapa histórica.',
            correccionBreve: 'Conectar cada fecha con los actores y transformaciones sociales que impulsó.',
          },
          ejemploBreve: {
            planteamiento: 'Conexión entre crisis monárquica de 1808 y levantamiento de 1810.',
            pasos: ['Ubica el debilitamiento virreinal tras 1808.', 'Analiza la movilización social de 1810.'],
            conclusion: 'El proceso transformó la estructura política novohispana hacia un Estado independiente.',
          },
        },
      }),
    ]
  );

  const socioWb = makeWorkbook(
    'Desarrollo Socioemocional',
    '1er Semestre',
    'Autorregulación emocional y convivencia escolar',
    'Gestión emocional y acuerdos comunitarios',
    [
      makeSession({
        sessionNumber: 1,
        objetivo: 'Establecer acuerdos de convivencia democrática en el aula mediante escucha activa',
        motivacion: 'En los espacios comunes del plantel surgen diferencias sobre el uso equitativo de horarios.',
        contenido: 'Los acuerdos claros construidos por consenso fortalecen la convivencia escolar diaria.',
        aplicacion: 'Revisa las normas del aula y propón mejoras colaborativas con tu equipo.',
        productoIntegrador: 'Carta de acuerdos grupales firmada por el equipo.',
        sintesisVisual: {
          conceptoBreve: 'La convivencia democrática se construye con diálogo respetuoso y compromisos verificables.',
          formulaOReglaClave: 'Diálogo + Escucha → Acuerdos',
          mapaConceptual: {
            definicionClave: 'Los acuerdos colectivos previenen conflictos y fortalecen la pertenencia.',
            criterioDesarrollo: 'Escuchar todas las propuestas antes de someter un acuerdo a consenso.',
            errorComun: 'Imponer reglas sin consultar las necesidades reales del grupo.',
            correccionBreve: 'Integrar las distintas posturas en compromisos verificables.',
          },
          ejemploBreve: {
            planteamiento: 'Un grupo organiza turnos equitativos para mantener limpio el salón.',
            pasos: ['Escucha propuestas de cada equipo.', 'Acuerda roles rotativos semanales.'],
            conclusion: 'El acuerdo consensual mejora el clima escolar.',
          },
        },
      }),
      makeSession({
        sessionNumber: 2,
        objetivo: 'Aplicar estrategias de regulación emocional ante situaciones de estrés académico',
        contenido:
          'Reconoce la emoción de ansiedad o frustración cuando percibes saturación de tareas escolares. ' +
          'Analiza tu interpretación y los pensamientos automáticos que intensifican la preocupación. ' +
          'Elige una respuesta de comunicación asertiva en lugar de reaccionar impulsivamente con tu equipo. ' +
          'Aplica respiración profunda y pausas breves para lograr regulación y equilibrio emocional sostenido.',
        sintesisVisual: {
          conceptoBreve: 'Nombrar lo que sentimos abre espacio para elegir conductas constructivas ante la presión.',
          formulaOReglaClave: 'Pausa + Conciencia → Autorregulación',
          mapaConceptual: {
            definicionClave: 'La gestión afectiva evita respuestas impulsivas ante presión escolar.',
            criterioDesarrollo: 'Distinguir hechos objetivos de suposiciones catastróficas.',
            errorComun: 'Reprimir el malestar hasta explotar frente a los demás.',
            correccionBreve: 'Pedir un minuto de pausa antes de responder en conflicto.',
          },
          ejemploBreve: {
            planteamiento: 'Un equipo discute antes de entregar su exposición final.',
            pasos: ['Detiene la discusión treinta segundos.', 'Acuerda dividir las láminas pendientes.'],
            conclusion: 'La pausa evita agresiones y permite concluir a tiempo.',
          },
        },
      }),
    ]
  );

  const afdPhysicalWb = makeWorkbook(
    'Actividades Físicas y Deportivas',
    '1er Semestre',
    'Circuito motor con control fisiológico',
    'Dosificación del esfuerzo físico y vuelta a la calma',
    [
      makeSession({
        sessionNumber: 1,
        objetivo: 'Ejecutar un circuito motor regulando frecuencia cardíaca e intensidad con escala de Borg',
        contenido:
          'Inicia con un calentamiento de movilidad articular durante ocho minutos para preparar tendones y articulaciones. ' +
          'Registra tu frecuencia basal en reposo antes de comenzar la activación cardiovascular progresiva. ' +
          'Ejecuta el circuito motor de tres estaciones controlando el esfuerzo percibido con la escala de Borg entre niveles cuatro y siete. ' +
          'Cierra la sesión con vuelta a la calma, estiramientos suaves e hidratación constante para favorecer la recuperación.',
        sintesisVisual: {
          conceptoBreve: 'El control del esfuerzo físico evita lesiones y optimiza la condición cardiovascular.',
          formulaOReglaClave: 'FC Basal + Escala Borg → Seguridad',
          mapaConceptual: {
            definicionClave: 'Dosificar la carga motora protege el sistema cardiorrespiratorio.',
            criterioDesarrollo: 'Monitorear pulso antes y después de cada bloque motor.',
            errorComun: 'Saltar la preparación previa o superar el esfuerzo seguro.',
            correccionBreve: 'Respetar tiempos de pausa y registro fisiológico.',
          },
          ejemploBreve: {
            planteamiento: 'Un equipo realiza trote y saltos midiendo su pulso.',
            pasos: ['Toma pulso en la muñeca durante 15 segundos.', 'Multiplica por cuatro para estimar ppm.'],
            conclusion: 'El registro confirma que la intensidad se mantuvo en zona segura.',
          },
        },
      }),
    ]
  );

  return {
    SYN_MATH: mathWb,
    SYN_LABORAL: laboralWb,
    SYN_QUIMICA: quimicaWb,
    SYN_HISTORIA: historiaWb,
    SYN_SOCIO: socioWb,
    SYN_AFD_PHYS: afdPhysicalWb,
  };
}
