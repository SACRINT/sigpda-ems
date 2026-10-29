import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { buildPilotWorkbook } from './pilot-workbooks';

export const ARTS_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-arts',
  subjectName: 'Artes',
  title: 'Color, composición y memoria comunitaria',
  blockName: 'Explora lenguajes artísticos y comunica una memoria local con una obra.',
  topic: 'Elementos del lenguaje visual: color, forma y composición',
  focus:
    'Analizar cómo el color y la composición dirigen la mirada en un mural comunitario y crear una propuesta visual que comunique una memoria del barrio.',
  story:
    'En la colonia, el muro junto a la cancha se ha llenado de anuncios y rayones. Un colectivo de jóvenes quiere pintar un mural que recupere la historia de las familias que llegaron hace décadas. Tienen fotografías e ideas, pero no saben cómo organizar el color y las formas para que el mensaje se entienda sin palabras.',
  question:
    '¿Cómo podemos usar color, forma y composición para contar una memoria de nuestra comunidad sin palabras?',
  analogy:
    'Componer un mural se parece a preparar una comida: los ingredientes aislados no dicen nada; el orden, la proporción y el contraste crean el sabor que se recuerda.',
  explanation:
    'El lenguaje visual organiza color, forma, textura y espacio. El contraste dirige la mirada; la jerarquía define qué se observa primero; el ritmo repite elementos para producir movimiento. Una paleta limitada y una composición clara comunican mejor que muchos elementos sin relación.',
  procedure:
    'El docente modela la lectura de un mural: identifica el punto focal, la paleta, las jerarquías y el ritmo; después boceta tres encuadres y elige uno justificando sus decisiones visuales.',
  visual: 'Bocetos de composición con punto focal, paleta y ritmo.',
  solvedProblem:
    'Un mural tiene tres figuras y un fondo saturado. ¿Cómo reorganizarlo para que la figura principal se lea primero?',
  solvedSteps: [
    'Identificamos el punto focal y los elementos que compiten con él.',
    'Reducimos la paleta y aumentamos el contraste de la figura principal.',
    'Revisamos la composición con una lectura rápida de tres segundos.',
  ],
  interpretation:
    'El contraste y la jerarquía hacen que la mirada llegue primero al mensaje central; la paleta limitada da unidad al mural.',
  misconception: 'Creer que agregar más colores y detalles hace más expresiva una obra.',
  correct:
    'La expresividad depende de decisiones de contraste, jerarquía y ritmo, no de la cantidad de elementos.',
  reasoning:
    'Demasiados estímulos compiten entre sí y dispersan la lectura; la selección deliberada concentra la atención.',
  guided:
    'En equipos, elaboren dos bocetos del mural con paletas distintas y expliquen cuál comunica mejor la memoria elegida.',
  autonomous:
    'Crea una propuesta visual para un espacio de tu comunidad: define paleta, punto focal y el relato que quieres comunicar.',
  checkpoint: '¿Cómo dirigen el color y la composición la mirada y el mensaje de una obra?',
  criteria: [
    'Identifico punto focal, paleta y jerarquía en una obra.',
    'Aplico contraste y ritmo en un boceto propio.',
    'Justifico mis decisiones visuales con lenguaje artístico.',
    'Comunico una memoria comunitaria con una propuesta visual.',
  ],
  artifactName: 'Mural comunitario: memoria y color',
  communityUtility:
    'Devuelve al barrio un relato visual de su historia y abre un espacio de encuentro junto a la cancha.',
  rubric: [
    'Lectura del lenguaje visual',
    'Uso intencionado del color',
    'Composición y jerarquía',
    'Relato comunitario y presentación',
  ],
});

export const PHYSICAL_EDUCATION_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-physical-education',
  subjectName: 'Educación Física',
  title: 'Ritmo cardiaco, esfuerzo y salud en equipo',
  blockName: 'Diseña una sesión de activación física segura para la comunidad escolar.',
  topic: 'Capacidades físicas, intensidad y recuperación',
  focus:
    'Medir la frecuencia cardiaca antes, durante y después del esfuerzo para diseñar una rutina segura y progresiva para estudiantes.',
  story:
    'En el torneo interno de básquetbol, varios estudiantes se marearon por iniciar a máxima intensidad sin calentar. El comité deportivo quiere una rutina de calentamiento y recuperación basada en datos, no en imitaciones.',
  question:
    '¿Cómo podemos usar la frecuencia cardiaca y la percepción de esfuerzo para diseñar una activación física segura?',
  analogy:
    'El cuerpo funciona como un motor: arrancar en frío a toda velocidad desgasta; calentar y subir revoluciones por etapas protege el rendimiento.',
  explanation:
    'La frecuencia cardiaca aumenta con la intensidad del esfuerzo y desciende durante la recuperación. El calentamiento eleva la temperatura muscular y prepara las articulaciones; la recuperación gradual evita mareos. La escala de percepción de esfuerzo complementa la medición cuando no hay pulsómetro.',
  procedure:
    'El docente modela una sesión: registra el pulso en reposo, guía el calentamiento, controla la intensidad con pausas y registra el pulso al final de la recuperación.',
  visual: 'Curva de frecuencia cardiaca durante calentamiento, esfuerzo y recuperación.',
  solvedProblem:
    'Un estudiante pasa de 70 a 170 ppm en dos minutos y se marea. ¿Qué ajustes debe hacer la rutina?',
  solvedSteps: [
    'Comparamos el pulso de reposo con el pulso durante el esfuerzo.',
    'Identificamos que la subida fue abrupta y sin calentamiento suficiente.',
    'Rediseñamos la sesión con progresión de intensidad y pausas de recuperación.',
  ],
  interpretation:
    'Una progresión gradual mantiene el esfuerzo en un rango seguro y la recuperación guiada reduce el riesgo de mareo.',
  misconception: 'Pensar que más intensidad desde el inicio produce mejores resultados.',
  correct: 'La progresión y la recuperación son parte del entrenamiento y protegen la salud.',
  reasoning:
    'El cuerpo necesita adaptarse al esfuerzo de forma gradual; saltar etapas aumenta el riesgo de lesión o desmayo.',
  guided:
    'En parejas, registren el pulso en reposo y después de una activación moderada; comparen los datos y propongan una progresión.',
  autonomous:
    'Diseña una rutina de 15 minutos para tu grupo con calentamiento, esfuerzo y recuperación, y explica cómo verificarías su seguridad.',
  checkpoint: '¿Cómo indican la frecuencia cardiaca y la percepción de esfuerzo si una rutina es segura?',
  criteria: [
    'Registro la frecuencia cardiaca antes y después del esfuerzo.',
    'Relaciono intensidad, pulso y recuperación.',
    'Diseño una progresión segura de activación física.',
    'Justifico la rutina con datos y criterios de salud.',
  ],
  artifactName: 'Protocolo de activación física segura',
  communityUtility:
    'Protege la salud de quienes participan en torneos y promueve rutinas basadas en evidencia.',
  rubric: [
    'Registro y lectura de datos',
    'Relación intensidad-recuperación',
    'Diseño de la progresión',
    'Seguridad y trabajo en equipo',
  ],
});

export const SOCIOEMOTIONAL_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-socioemotional',
  subjectName: 'Desarrollo Socioemocional',
  title: 'Emociones, decisiones y convivencia',
  blockName: 'Reconoce y regula emociones para tomar decisiones responsables en grupo.',
  topic: 'Regulación emocional y toma de decisiones',
  focus:
    'Analizar una situación de conflicto escolar, identificar emociones e interpretaciones y ensayar una respuesta regulada.',
  story:
    'Un comentario en el chat del grupo provocó una pelea. Algunas personas respondieron con enojo inmediato; otras se aislaron. La tutora propone reconstruir lo ocurrido para distinguir la emoción de la interpretación y elegir una respuesta que no dañe a nadie.',
  question:
    '¿Cómo podemos distinguir lo que sentimos de lo que interpretamos para responder sin dañar a otras personas?',
  analogy:
    'Una emoción es como una alarma: avisa que algo importante ocurre, pero no decide por ti lo que debes hacer.',
  explanation:
    'Las emociones son respuestas ante estímulos y cumplen una función de alerta. La interpretación que hacemos de la situación influye en la intensidad de la emoción. La regulación consiste en reconocer, nombrar y elegir una respuesta; no en eliminar lo que sentimos. Estrategias como la respiración, la pausa y la reformulación ayudan a decidir.',
  procedure:
    'El docente modela el análisis: describe el hecho observable, separa la emoción de la interpretación, identifica la necesidad y compara dos respuestas posibles con sus consecuencias.',
  visual: 'Flujo de regulación: emoción, interpretación, respuesta y regulación.',
  solvedProblem:
    'Un mensaje del chat parece burlón. Siento enojo y quiero responder con un insulto. ¿Cómo puedo elegir una respuesta regulada?',
  solvedSteps: [
    'Describimos el hecho observable sin juzgar la intención.',
    'Nombramos la emoción y la interpretación que la intensifica.',
    'Elegimos una respuesta con pausa y verificamos sus consecuencias.',
  ],
  interpretation:
    'Separar el hecho de la interpretación permite elegir una respuesta que cuide la convivencia y la propia dignidad.',
  misconception: 'Creer que regular una emoción significa ocultarla o no sentirla.',
  correct: 'Regular es reconocer, nombrar y decidir cómo responder, sin negar la emoción.',
  reasoning:
    'Las emociones cumplen una función; la regulación evita que una interpretación apresurada conduzca a decisiones dañinas.',
  guided:
    'En parejas, analicen un conflicto reciente: hecho, emoción, interpretación y dos respuestas con consecuencias.',
  autonomous:
    'Escribe un plan personal de regulación para una situación que te cueste manejar e incluye señales, pausa y respuesta elegida.',
  checkpoint: '¿Qué diferencia hay entre sentir una emoción y elegir una respuesta regulada?',
  criteria: [
    'Describo hechos observables sin atribuir intenciones.',
    'Nombro emociones e interpretaciones con precisión.',
    'Comparo respuestas y sus consecuencias.',
    'Diseño un plan de regulación personal y aplicable.',
  ],
  artifactName: 'Acuerdo de convivencia y regulación emocional',
  communityUtility:
    'Ayuda al grupo a resolver conflictos con acuerdos claros y a cuidar el bienestar de todas las personas.',
  rubric: [
    'Descripción de hechos y emociones',
    'Análisis de interpretaciones',
    'Evaluación de consecuencias',
    'Plan de regulación viable',
  ],
});
