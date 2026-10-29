import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { buildPilotWorkbook } from './pilot-workbooks';

export const PHYSICS_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-physics',
  subjectName: 'Física I',
  title: 'Movimiento, energía y seguridad vial',
  blockName: 'Modela movimiento y energía para tomar decisiones seguras en la comunidad.',
  topic: 'Movimiento rectilíneo y conservación de la energía',
  focus:
    'Analizar la distancia de frenado de una bicicleta y usar la conservación de la energía para proponer un límite de velocidad frente a una escuela.',
  story:
    'En la calle que rodea el plantel, estudiantes y familias cruzan entre bicicletas y automóviles. Después de un frenado brusco, el comité escolar quiere saber qué distancia necesita una bicicleta para detenerse y cómo justificar un límite de velocidad con datos, no con impresiones.',
  question:
    '¿Cómo podemos usar la velocidad y la energía de una bicicleta para decidir un límite seguro frente a la escuela?',
  analogy:
    'Frenar una bicicleta se parece a detener una piedra que rueda: a mayor velocidad, la energía acumulada es mayor y se necesita más distancia para disiparla.',
  explanation:
    'La energía cinética depende de la masa y del cuadrado de la velocidad. Al frenar, la fricción transforma esa energía en calor y la distancia recorrida aumenta con la velocidad. Comparar varios escenarios permite justificar un límite de velocidad y una zona de frenado segura.',
  procedure:
    'El docente modela el problema: registra velocidad y distancia de frenado, calcula la energía cinética para cada caso, compara los resultados y relaciona la diferencia con el espacio disponible en la calle.',
  visual: 'Gráfica de energía cinética contra velocidad y esquema de fuerzas durante el frenado.',
  solvedProblem:
    'Una bicicleta de 20 kg viaja a 5 m/s y frena en 4 m. ¿Qué ocurre con la distancia si la velocidad se duplica y la fricción se mantiene constante?',
  solvedSteps: [
    'Identificamos los datos de masa, velocidad y distancia de frenado.',
    'Calculamos la energía cinética inicial y comparamos el escenario de velocidad duplicada.',
    'Interpretamos por qué la distancia de frenado no crece de forma proporcional a la velocidad.',
  ],
  interpretation:
    'La comparación muestra que pequeños aumentos de velocidad pueden exigir mucho más espacio para detenerse y justifican un límite preventivo.',
  misconception:
    'Suponer que duplicar la velocidad solo duplica la distancia de frenado.',
  correct:
    'La energía cinética crece con el cuadrado de la velocidad, por lo que la distancia de frenado aumenta más rápido que la velocidad.',
  reasoning:
    'Al duplicar la velocidad se cuadruplica la energía que debe disiparse, aunque otros factores como la fricción también influyan.',
  guided:
    'En equipos, comparen dos velocidades de frenado, registren la energía calculada y propongan una zona segura frente al plantel.',
  autonomous:
    'Documenta un tramo de tu comunidad, estima la velocidad habitual y elabora una recomendación de seguridad con evidencia física.',
  checkpoint:
    '¿Qué relación existe entre velocidad, energía cinética y distancia de frenado, y cómo sustenta un límite de velocidad?',
  criteria: [
    'Identifico las variables de movimiento y energía en una situación real.',
    'Calculo y comparo la energía cinética en dos escenarios.',
    'Explico por qué la distancia de frenado aumenta con la velocidad.',
    'Propongo una medida de seguridad basada en evidencia.',
  ],
  artifactName: 'Protocolo escolar de velocidad segura',
  communityUtility:
    'Aporta evidencia física para regular la velocidad y proteger a quienes cruzan la calle frente a la escuela.',
  rubric: [
    'Identificación de variables y datos',
    'Cálculo y comparación de energía',
    'Interpretación del frenado',
    'Propuesta de seguridad justificada',
  ],
});

export const BIOLOGY_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-biology',
  subjectName: 'Biología I',
  title: 'Redes tróficas y salud del ecosistema',
  blockName: 'Explica las relaciones del ecosistema y el efecto de una alteración local.',
  topic: 'Redes tróficas, biodiversidad y equilibrio ecológico',
  focus:
    'Analizar cómo la desaparición de un polinizador afecta una red trófica y proponer una acción de conservación para la comunidad.',
  story:
    'En la milpa comunitaria, las familias notaron menos abejas y una caída en la producción de calabaza. El comité quiere saber si el cambio se relaciona con el uso de pesticidas y qué acción puede proteger a los polinizadores sin poner en riesgo la cosecha.',
  question:
    '¿Qué ocurre en la red trófica cuando desaparece un polinizador y cómo podemos conservar el equilibrio del ecosistema?',
  analogy:
    'Una red trófica se parece a una cuerda de titiritero: si se corta un hilo, el movimiento se altera en varios puntos aunque el hilo cortado parezca pequeño.',
  explanation:
    'Los organismos de un ecosistema se conectan por relaciones de alimentación y polinización. Una alteración puede propagarse a productores, consumidores y descomponedores. La biodiversidad aporta redundancia: varias especies pueden cumplir funciones parecidas y sostener el sistema ante perturbaciones.',
  procedure:
    'El docente reconstruye la red trófica local, identifica productores, consumidores y polinizadores, simula la pérdida de una especie y analiza qué nodos quedan afectados.',
  visual: 'Red de relaciones entre cultivos, polinizadores, herbívoros, depredadores y descomponedores.',
  solvedProblem:
    'Una red incluye calabaza, abeja, pulgón, mariquita y hongo descomponedor. ¿Qué efectos tiene retirar a la abeja del sistema?',
  solvedSteps: [
    'Identificamos los nodos y las relaciones de alimentación y polinización.',
    'Simulamos la pérdida de la abeja y señalamos los nodos que dependen de ella.',
    'Evaluamos una acción de conservación y una alternativa de control de plagas.',
  ],
  interpretation:
    'La pérdida del polinizador reduce la reproducción de la calabaza y puede alterar a otros organismos de la red; la conservación debe considerar el sistema completo.',
  misconception:
    'Creer que una sola especie puede eliminarse sin consecuencias si no es un cultivo de consumo directo.',
  correct:
    'Cada especie cumple una función dentro de la red y su pérdida puede propagarse a otros niveles tróficos.',
  reasoning:
    'Las relaciones de dependencia y competencia conectan a los organismos, por lo que una alteración local puede modificar la disponibilidad de alimento y refugio.',
  guided:
    'En equipos, dibujen una red trófica local, retiren un nodo y expliquen qué relaciones se debilitan y qué acción de conservación proponen.',
  autonomous:
    'Observa un espacio verde de tu comunidad, registra al menos cinco organismos y elabora un mapa de relaciones con una recomendación de conservación.',
  checkpoint:
    '¿Cómo se propaga la pérdida de un polinizador en la red trófica y qué evidencia sustenta una acción de conservación?',
  criteria: [
    'Identifico productores, consumidores y descomponedores.',
    'Represento relaciones tróficas y de polinización.',
    'Explico efectos directos e indirectos de una alteración.',
    'Propongo una acción de conservación fundamentada.',
  ],
  artifactName: 'Mapa de biodiversidad y conservación local',
  communityUtility:
    'Ayuda a la milpa comunitaria a proteger polinizadores y mantener la producción sin dañar el ecosistema.',
  rubric: [
    'Identificación de organismos y relaciones',
    'Representación de la red trófica',
    'Análisis de efectos en cascada',
    'Propuesta de conservación viable',
  ],
});

export const HEALTH_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-health',
  subjectName: 'Ciencias de la Salud',
  title: 'Prevención y respuesta ante emergencias',
  blockName: 'Aplica protocolos de prevención y atención inicial en la comunidad.',
  topic: 'Higiene, signos de alerta y primeros auxilios',
  focus:
    'Diseñar un protocolo comunitario para reconocer signos de alerta, activar la atención y evitar riesgos durante una emergencia.',
  story:
    'En la cooperativa, una persona se mareó durante una jornada de trabajo. Algunas personas quisieron moverla de inmediato; otras buscaron agua sin revisar si respiraba. El comité quiere un protocolo claro para actuar sin improvisar y para prevenir incidentes similares.',
  question:
    '¿Qué pasos debemos seguir para reconocer una emergencia, proteger a la persona y activar la ayuda adecuada?',
  analogy:
    'Un protocolo de emergencia funciona como una lista de verificación de vuelo: cada paso tiene un orden y evita que la urgencia haga olvidar lo esencial.',
  explanation:
    'La atención inicial prioriza la seguridad de quien auxilia, la evaluación de conciencia y respiración, y la activación de servicios de emergencia. Un protocolo escrito reduce decisiones improvisadas y define cuándo no se debe mover a una persona. La prevención incluye higiene, hidratación y señalización de riesgos.',
  procedure:
    'El docente modela la secuencia: asegurar la escena, evaluar conciencia y respiración, pedir ayuda, mantener a la persona segura y registrar lo ocurrido para mejorar el protocolo.',
  visual: 'Flujo de decisión para seguridad, evaluación, activación de ayuda y registro.',
  solvedProblem:
    'Una persona se marea y está consciente pero débil. ¿Qué debe hacer el equipo antes de moverla y cómo debe registrar la atención?',
  solvedSteps: [
    'Revisamos la seguridad de la escena y verificamos si la persona responde.',
    'Activamos ayuda y evitamos moverla sin evaluar sus signos de alerta.',
    'Registramos los hechos, las decisiones tomadas y la evolución observada.',
  ],
  interpretation:
    'Seguir el protocolo protege a la persona y al equipo, y deja evidencia para mejorar la prevención en la cooperativa.',
  misconception:
    'Mover a una persona mareada de inmediato o darle alimentos sin evaluar su estado.',
  correct:
    'Primero se asegura la escena, se evalúa a la persona y se activa ayuda profesional antes de intervenir.',
  reasoning:
    'Una intervención sin evaluación puede agravar una lesión o retrasar la atención especializada.',
  guided:
    'En parejas, representen una emergencia y verbalicen cada paso del protocolo antes de actuar.',
  autonomous:
    'Elabora un protocolo de emergencia para tu casa o centro de trabajo e incluye señalización, teléfonos y registro de incidentes.',
  checkpoint:
    '¿Cómo se ordena la respuesta ante una emergencia y qué evidencia permite mejorar la prevención?',
  criteria: [
    'Reconozco signos de alerta y riesgos inmediatos.',
    'Aplico el orden de seguridad, evaluación y activación de ayuda.',
    'Registro decisiones y evolución de la persona.',
    'Propongo medidas de prevención para la comunidad.',
  ],
  artifactName: 'Protocolo comunitario de prevención y emergencia',
  communityUtility:
    'Orienta una respuesta segura y coordinada ante emergencias en espacios comunitarios y de trabajo.',
  rubric: [
    'Reconocimiento de signos de alerta',
    'Secuencia correcta del protocolo',
    'Registro claro de la atención',
    'Medidas de prevención pertinentes',
  ],
});

export const LITERATURE_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-literature',
  subjectName: 'Lengua y Literatura',
  title: 'Lectura crítica y argumentación',
  blockName: 'Interpreta un texto y sostiene una tesis con evidencia textual.',
  topic: 'Argumento, voz narrativa y evidencia en el texto',
  focus:
    'Sostener una interpretación sobre la voz narrativa de un cuento y defenderla con citas, premisas y una objeción razonada.',
  story:
    'En el club de lectura, dos estudiantes discuten el final de un cuento. Una dice que el narrador es testigo de los hechos; otra sostiene que conoce pensamientos que un testigo no podría saber. El grupo necesita distinguir una opinión de una interpretación apoyada en el texto.',
  question:
    '¿Cómo podemos sostener una interpretación literaria con evidencia y responder a una objeción?',
  analogy:
    'Interpretar un cuento se parece a resolver un caso: la tesis es la hipótesis, las citas son las pistas y la objeción es la versión que debe ponerse a prueba.',
  explanation:
    'Una interpretación literaria se sostiene con una tesis clara, premisas basadas en citas y una consideración de objeciones. La voz narrativa, el punto de vista y la selección de detalles orientan la lectura. Una conclusión es más sólida cuando reconoce los límites de la evidencia y responde a una lectura alternativa.',
  procedure:
    'El docente reconstruye el argumento del club: formula la tesis, selecciona dos citas, distingue una objeción y evalúa si la conclusión se sostiene con el texto.',
  visual: 'Mapa argumental con tesis, premisas textuales, objeción y conclusión.',
  solvedProblem:
    'El narrador describe lo que piensa un personaje que está solo. ¿Qué tesis sobre la voz narrativa se sostiene y qué objeción debe responderse?',
  solvedSteps: [
    'Formulamos la tesis: el narrador es omnisciente porque accede a la conciencia del personaje.',
    'Seleccionamos una cita que muestra un pensamiento no observado por otros personajes.',
    'Respondemos la objeción: una deducción del narrador testigo no explica el detalle íntimo.',
  ],
  interpretation:
    'La tesis se sostiene si la cita demuestra un acceso a la conciencia que no puede atribuirse a un testigo; la objeción obliga a precisar el concepto de omnisciencia.',
  misconception:
    'Confundir una opinión personal con una interpretación respaldada por el texto.',
  correct:
    'Una interpretación se sostiene con evidencia textual y responde a las lecturas alternativas.',
  reasoning:
    'Las citas permiten verificar la tesis y distinguir lo que el texto afirma de lo que el lector supone.',
  guided:
    'En parejas, elijan un pasaje, formulen una tesis, seleccionen una cita y anticipen una objeción.',
  autonomous:
    'Escribe una reseña breve de un cuento con tesis, dos citas, una objeción y una conclusión.',
  checkpoint:
    '¿Qué distingue una interpretación literaria de una opinión y cómo se responde a una objeción?',
  criteria: [
    'Formulo una tesis interpretativa clara.',
    'Selecciono citas pertinentes como premisas.',
    'Incorporo y respondo una objeción.',
    'Sostengo una conclusión con evidencia textual.',
  ],
  artifactName: 'Reseña argumentada de lectura',
  communityUtility:
    'Fortalece la lectura crítica y la discusión pública de textos en la comunidad escolar.',
  rubric: [
    'Claridad de la tesis',
    'Pertinencia de las citas',
    'Calidad de la objeción',
    'Solidez de la conclusión',
  ],
});

export const HISTORY_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-history',
  subjectName: 'Historia de México',
  title: 'Causalidad histórica y memoria local',
  blockName: 'Explica procesos históricos y su relación con la memoria de la comunidad.',
  topic: 'Causalidad, fuentes y memoria colectiva',
  focus:
    'Analizar un cambio en la comunidad a partir de fuentes orales y escritas, distinguiendo causas, consecuencias y memoria.',
  story:
    'El archivo municipal conserva fotografías de una plaza que hoy tiene otro uso. Las personas mayores recuerdan ferias y mercados; los documentos hablan de obras y decisiones políticas. El grupo quiere reconstruir qué cambió y por qué, sin reducir la historia a una sola causa.',
  question:
    '¿Cómo podemos explicar un cambio local con varias fuentes y distinguir causas, consecuencias y recuerdos?',
  analogy:
    'La historia se parece a un tejido: cada fuente es un hilo y ninguna por sí sola explica el dibujo completo.',
  explanation:
    'Los procesos históricos tienen causas múltiples y consecuencias que se entrelazan. Las fuentes escritas, orales y visuales ofrecen perspectivas distintas y deben contrastarse. La memoria colectiva no es una copia exacta del pasado: selecciona, interpreta y transmite experiencias.',
  procedure:
    'El docente modela el análisis: ubica el cambio en una línea de tiempo, clasifica las fuentes, identifica actores y distingue causas económicas, políticas y sociales.',
  visual: 'Línea de tiempo con actores, fuentes y relaciones causales.',
  solvedProblem:
    'La plaza cambió de mercado a espacio deportivo. ¿Qué causas se pueden sostener con una foto, un acta y un testimonio?',
  solvedSteps: [
    'Ubicamos los hechos y actores en una línea de tiempo.',
    'Contrastamos la foto, el acta y el testimonio para identificar coincidencias y silencios.',
    'Distinguimos una causa documentada de una interpretación basada en la memoria.',
  ],
  interpretation:
    'El cambio no tuvo una sola causa: coincidieron decisiones políticas, transformaciones económicas y nuevas prácticas de la comunidad.',
  misconception:
    'Creer que una fuente oral es falsa por no ser escrita o que un documento oficial explica todo el proceso.',
  correct:
    'Las fuentes se contrastan y cada una aporta evidencia limitada sobre el proceso histórico.',
  reasoning:
    'Toda fuente responde a un contexto y a intereses; la explicación histórica se construye con varias evidencias.',
  guided:
    'En equipos, comparen dos fuentes sobre un cambio local y elaboren una línea de tiempo con causas y consecuencias.',
  autonomous:
    'Entrevista a una persona de tu comunidad sobre un cambio del lugar donde vive y contrasta su relato con otra fuente.',
  checkpoint:
    '¿Cómo se distinguen causas, consecuencias y memoria al explicar un cambio histórico local?',
  criteria: [
    'Ubico hechos y actores en una línea de tiempo.',
    'Clasifico y contrasto fuentes históricas.',
    'Distingo causas múltiples y consecuencias.',
    'Reconozco el papel de la memoria colectiva.',
  ],
  artifactName: 'Línea de tiempo y archivo de memoria local',
  communityUtility:
    'Permite a la comunidad explicar su pasado con fuentes diversas y preservar la memoria de sus espacios.',
  rubric: [
    'Ubicación temporal y actores',
    'Contraste de fuentes',
    'Explicación multicausal',
    'Uso crítico de la memoria',
  ],
});

export const TECHNOLOGY_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-technology',
  subjectName: 'Tecnología e Ingeniería',
  title: 'Automatización y pensamiento computacional',
  blockName: 'Diseña soluciones técnicas con sensores, decisiones y control.',
  topic: 'Sensores, lógica de decisión y automatización',
  focus:
    'Diseñar un sistema sencillo de riego automatizado que use sensores y reglas de decisión para ahorrar agua en el invernadero escolar.',
  story:
    'El invernadero del plantel pierde agua porque el riego depende de la memoria de quienes lo atienden. Un grupo propone usar un sensor de humedad y una bomba, pero no sabe cómo convertir la necesidad en un diagrama de bloques ni cómo probar que el sistema funciona.',
  question:
    '¿Cómo podemos traducir una necesidad del invernadero en un sistema automatizado verificable?',
  analogy:
    'Un algoritmo se parece a una receta: recibe ingredientes, sigue reglas en orden y produce un resultado que se puede comprobar.',
  explanation:
    'Un sistema de control recibe una entrada, la compara con un umbral y activa una salida. El sensor mide humedad, la unidad de control decide si riega y la bomba ejecuta la acción. Probar el sistema exige definir condiciones, registrar resultados y ajustar las reglas.',
  procedure:
    'El docente modela el diseño: define entradas y salidas, escribe la regla de decisión, dibuja el diagrama de bloques y prueba un caso con humedad baja y otro con humedad suficiente.',
  visual: 'Diagrama de bloques con sensor, control, actuador y registro de resultados.',
  solvedProblem:
    'Diseña una regla para activar la bomba cuando la humedad sea menor al 30 % y detenerla al llegar al 60 %.',
  solvedSteps: [
    'Definimos la entrada, el umbral y la salida del sistema.',
    'Escribimos la regla de decisión y la representamos en un diagrama de bloques.',
    'Probamos dos escenarios y registramos si la salida corresponde a la condición.',
  ],
  interpretation:
    'El sistema funciona si la regla es clara y las pruebas demuestran que la bomba responde a la humedad medida.',
  misconception:
    'Creer que programar es escribir código sin definir antes las entradas, las reglas y las salidas.',
  correct:
    'Todo sistema automatizado parte de un problema, un diagrama de bloques y pruebas verificables.',
  reasoning:
    'Sin reglas explícitas y pruebas, no es posible saber si el sistema resuelve la necesidad o solo se mueve.',
  guided:
    'En equipos, dibujen el diagrama de bloques de un sistema de riego y prueben la regla con tres valores de humedad.',
  autonomous:
    'Diseña un sistema automatizado para un problema de tu casa o escuela; incluye entradas, reglas, salidas y una prueba.',
  checkpoint:
    '¿Cómo se pasa de una necesidad a un diagrama de bloques y qué evidencia demuestra que el sistema funciona?',
  criteria: [
    'Identifico entradas, procesos y salidas del sistema.',
    'Represento la lógica de decisión en un diagrama.',
    'Pruebo el sistema con escenarios definidos.',
    'Evalúo si la solución atiende la necesidad.',
  ],
  artifactName: 'Prototipo de riego automatizado y bitácora de pruebas',
  communityUtility:
    'Reduce el consumo de agua y permite que el invernadero escolar funcione con reglas verificables.',
  rubric: [
    'Definición de entradas y salidas',
    'Claridad del diagrama de bloques',
    'Pruebas y registro de resultados',
    'Pertinencia de la solución',
  ],
});

export const LABOR_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-labor',
  subjectName: 'Formación para el Trabajo',
  title: 'Procesos técnicos y seguridad operativa',
  blockName: 'Ejecuta procedimientos técnicos con calidad y seguridad.',
  topic: 'Procedimiento operativo, control de calidad y seguridad',
  focus:
    'Documentar un procedimiento seguro para una tarea del taller, identificar riesgos y definir puntos de control de calidad.',
  story:
    'En el taller de la escuela, el equipo debe preparar materiales para una práctica. La última vez, una herramienta quedó fuera de su lugar y un integrante casi sufrió un accidente. El grupo necesita un procedimiento escrito que cualquiera pueda seguir sin depender de la memoria.',
  question:
    '¿Cómo podemos documentar una tarea técnica para que sea segura, repetible y verificable?',
  analogy:
    'Un procedimiento operativo se parece a una receta de cocina profesional: cada paso, herramienta y punto de control importa para obtener el mismo resultado sin riesgos.',
  explanation:
    'Un procedimiento operativo describe la secuencia, los materiales, las medidas de seguridad y los criterios de aceptación. Los puntos de control permiten detectar errores antes de continuar. La seguridad no es un paso final: se integra en cada etapa del proceso.',
  procedure:
    'El docente modela la documentación: enumera pasos, señala riesgos, define equipo de protección y establece una lista de verificación antes y después de la tarea.',
  visual: 'Diagrama de operación con pasos, riesgos y puntos de control.',
  solvedProblem:
    'Documenta la preparación de una mezcla de taller con tres pasos, dos riesgos y un criterio de calidad.',
  solvedSteps: [
    'Dividimos la tarea en pasos observables y ordenados.',
    'Identificamos riesgos y definimos la protección necesaria.',
    'Establecemos un criterio de aceptación y un registro de la ejecución.',
  ],
  interpretation:
    'El procedimiento permite repetir la tarea con seguridad y detectar desviaciones antes de que afecten el resultado.',
  misconception:
    'Creer que un procedimiento es solo una lista de pasos y omitir riesgos o criterios de calidad.',
  correct:
    'Un procedimiento incluye secuencia, seguridad, recursos y verificación del resultado.',
  reasoning:
    'Sin puntos de control no se puede saber si el proceso se ejecutó correctamente ni corregir a tiempo.',
  guided:
    'En equipos, escriban un procedimiento para una tarea del taller y revisen que incluya riesgos y control de calidad.',
  autonomous:
    'Documenta una tarea de tu casa o trabajo con pasos, riesgos, protección y un criterio de aceptación.',
  checkpoint:
    '¿Qué hace que un procedimiento técnico sea seguro, repetible y verificable?',
  criteria: [
    'Secuencio los pasos de una tarea técnica.',
    'Identifico riesgos y medidas de protección.',
    'Defino criterios de calidad y puntos de control.',
    'Registro la ejecución para mejorar el proceso.',
  ],
  artifactName: 'Manual de operación segura del taller',
  communityUtility:
    'Estandariza tareas técnicas y reduce accidentes en talleres escolares y comunitarios.',
  rubric: [
    'Claridad de la secuencia',
    'Identificación de riesgos',
    'Control de calidad',
    'Registro y mejora del proceso',
  ],
});

export const GENERAL_DEMO_WORKBOOK: ActiveWorkTextbook = buildPilotWorkbook({
  id: 'sacrint-demo-general',
  subjectName: 'Asignatura sin catálogo',
  title: 'Proyecto comunitario e investigación',
  blockName: 'Investiga una necesidad, decide con evidencia y comunica una acción.',
  topic: 'Investigación, evidencia y acción comunitaria',
  focus:
    'Diseñar una investigación breve sobre una necesidad de la comunidad y convertir los hallazgos en una acción viable.',
  story:
    'Un grupo de estudiantes quiere mejorar un espacio común, pero no sabe si el problema es la falta de bancas, la basura o la iluminación. Han escuchado opiniones distintas y necesitan observar, preguntar y decidir con evidencia antes de actuar.',
  question:
    '¿Cómo podemos pasar de una preocupación comunitaria a una acción fundamentada en evidencia?',
  analogy:
    'Investigar se parece a armar un mapa antes de caminar: primero se recogen puntos, luego se traza una ruta y finalmente se comprueba si lleva al destino.',
  explanation:
    'Un proyecto comunitario parte de una pregunta, define fuentes de evidencia y distingue hallazgos de opiniones. La observación y la consulta permiten priorizar necesidades. Una acción viable considera recursos, responsables y criterios de éxito.',
  procedure:
    'El docente modela el proceso: formula la pregunta, selecciona fuentes, registra hallazgos, prioriza una necesidad y define una acción con indicadores.',
  visual: 'Mapa conceptual de pregunta, evidencia, decisión y acción.',
  solvedProblem:
    'El grupo observa basura y bancas dañadas. ¿Qué evidencia necesita para elegir una primera acción?',
  solvedSteps: [
    'Formulamos una pregunta que pueda responderse con observación y consulta.',
    'Registramos hallazgos y separamos patrones de opiniones aisladas.',
    'Elegimos una acción viable y definimos cómo sabremos si funcionó.',
  ],
  interpretation:
    'La evidencia permite priorizar una acción y justificarla ante la comunidad; también revela supuestos que deben revisarse.',
  misconception:
    'Elegir la primera solución que aparece sin observar, preguntar ni definir criterios de éxito.',
  correct:
    'La acción se elige después de recoger evidencia y se evalúa con indicadores claros.',
  reasoning:
    'Sin evidencia, el proyecto puede resolver un síntoma y dejar intacta la necesidad principal.',
  guided:
    'En equipos, formulen una pregunta comunitaria, registren tres hallazgos y propongan una acción con un indicador.',
  autonomous:
    'Diseña una investigación breve sobre una necesidad de tu comunidad y presenta la evidencia que sostiene tu propuesta.',
  checkpoint:
    '¿Cómo se pasa de una preocupación a una acción fundamentada y cómo se comprueba su efecto?',
  criteria: [
    'Formulo una pregunta de investigación comunitaria.',
    'Registro evidencia y distingo hallazgos de opiniones.',
    'Priorizo una necesidad con criterios explícitos.',
    'Propongo una acción viable con indicadores.',
  ],
  artifactName: 'Carpeta de proyecto comunitario',
  communityUtility:
    'Ayuda a la comunidad a decidir acciones con evidencia y a evaluar si realmente atienden la necesidad.',
  rubric: [
    'Claridad de la pregunta',
    'Calidad de la evidencia',
    'Priorización de la necesidad',
    'Viabilidad de la acción',
  ],
});
