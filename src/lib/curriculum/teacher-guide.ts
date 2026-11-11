import type {
  CurriculumTrajectory,
  TrajectoryActivity,
  TrajectoryNode,
} from './trajectory-types';

export interface TeacherGuideOptions {
  generatedAt?: string;
}

interface ActivityGuide {
  demo: string;
  guided: string;
  challenge: string;
  errors: string[];
  evidence: string;
  safety: string;
}

const ACTIVITY_GUIDES: Record<string, ActivityGuide> = {
  'IR-3.1-A1': {
    demo: 'Recorrido guiado por una vivienda real o maqueta: el docente señala instalación eléctrica, hidráulica, sanitaria y de gas en cada espacio y usa tarjetas de color para clasificarlas.',
    guided: 'En parejas, los estudiantes ubican las instalaciones en un plano sencillo y elaboran una tabla “espacio–instalación–servicio”; comparan con otra pareja.',
    challenge: 'Cada equipo diagnostica un caso (cocina, baño o patio), identifica las instalaciones presentes y las que faltan, y presenta una conclusión breve.',
    errors: [
      'Confundir la instalación sanitaria con la hidráulica; aclarar que una conduce agua limpia y la otra desagua.',
      'Olvidar la instalación de gas o reducirla a la eléctrica; usar la lista de cotejo de las cuatro instalaciones.',
      'Registrar sin ubicar el espacio; exigir que toda anotación indique el espacio y la instalación.',
    ],
    evidence: 'Tabla comparativa y croquis simple con las cuatro instalaciones identificadas por espacio.',
    safety: 'Observación visual; no tocar tableros, contactos, tuberías ni llaves de gas. La visita se realiza con supervisión docente.',
  },
  'IR-3.1-A2': {
    demo: 'El docente proyecta un plano y modela la lectura de símbolos: identifica el símbolo, lo nombra, lo colorea y explica a qué instalación pertenece.',
    guided: 'En parejas, los estudiantes decodifican un plano impreso, colorean los símbolos por instalación y construyen una leyenda.',
    challenge: 'Cada equipo elabora una leyenda propia para un espacio comunitario y la expone; el grupo verifica que los símbolos sean consistentes.',
    errors: [
      'Mezclar símbolos eléctricos con hidráulicos; usar la leyenda oficial como referencia.',
      'Inventar símbolos sin explicación; exigir que cada símbolo tenga nombre y significado.',
      'Ignorar la escala o la orientación del plano; recordar que el símbolo no sustituye la lectura dimensional.',
    ],
    evidence: 'Plano anotado con leyenda de símbolos y explicación de cada instalación.',
    safety: 'Actividad de gabinete; no se intervienen instalaciones reales.',
  },
  'IR-3.1-A3': {
    demo: 'El docente dibuja un croquis paso a paso: delimita el espacio, mide, aplica escala, ubica símbolos y agrega una leyenda.',
    guided: 'En parejas, los estudiantes miden un aula o taller con cinta métrica y elaboran un croquis a escala con símbolos básicos.',
    challenge: 'Cada equipo levanta el croquis de un espacio comunitario, incorpora dimensiones y símbolos, y lo somete a revisión de pares.',
    errors: [
      'No medir o estimar a ojo; usar cinta métrica y registrar las medidas.',
      'Perder la escala o la proporción; verificar el croquis con una medida de control.',
      'Omitir símbolos o leyenda; aplicar la lista de cotejo de croquis.',
    ],
    evidence: 'Croquis a escala con dimensiones, símbolos, leyenda y medidas de control.',
    safety: 'Medir sin subir a muros ni techos; usar cinta métrica con cuidado y mantener despejadas las rutas.',
  },
  'IR-3.2-A1': {
    demo: 'El docente presenta muestras de materiales y explica criterios de selección: tipo de instalación, certificación, costo, proveedor y disponibilidad local.',
    guided: 'En parejas, los estudiantes clasifican muestras por instalación y completan una tabla con uso, norma o certificación y proveedor.',
    challenge: 'Cada equipo compara tres proveedores locales para un material y recomienda la mejor opción con criterios técnicos y de costo.',
    errors: [
      'Elegir solo por precio; incorporar certificación, durabilidad y disponibilidad.',
      'Usar material para gas en agua o viceversa; verificar la especificación del fabricante.',
      'Ignorar la certificación; revisar sellos, etiquetas y fichas técnicas.',
    ],
    evidence: 'Tabla comparativa de materiales con criterios de selección y fuentes consultadas.',
    safety: 'Manipular muestras con guantes; no abrir recipientes presurizados ni probar sustancias desconocidas.',
  },
  'IR-3.2-A2': {
    demo: 'El docente calcula cantidades para un baño o cocina sencilla: mide, identifica tramos, cuenta conexiones y explica el factor de desperdicio.',
    guided: 'En parejas, los estudiantes cuantifican tubería, conexiones, codos y pegamento para un plano pequeño.',
    challenge: 'Cada equipo cuantifica los materiales de un espacio comunitario, estima costo y justifica el factor de desperdicio.',
    errors: [
      'No incluir conexiones o codos; recorrer el plano tramo por tramo.',
      'Olvidar el factor de desperdicio; agregar un porcentaje razonado y documentado.',
      'Confundir diámetros o tipos de tubería; verificar la especificación en el plano.',
    ],
    evidence: 'Tabla de cuantificación con tramos, piezas, factor de desperdicio y costo estimado.',
    safety: 'Solo conteo y medición; no cortar ni unir tuberías en esta actividad.',
  },
  'IR-3.2-A3': {
    demo: 'El docente muestra sellos, etiquetas y fichas técnicas; explica cómo distinguir un material certificado de uno sin respaldo.',
    guided: 'En parejas, los estudiantes inspeccionan muestras y registran certificación, norma, lote y fecha de caducidad cuando aplique.',
    challenge: 'Cada equipo audita una lista de compra y acepta o rechaza materiales con justificación técnica.',
    errors: [
      'Aceptar sellos falsos o ilegibles; verificar con el proveedor o el fabricante.',
      'No registrar el lote o la norma; usar una ficha de inspección.',
      'Confundir calidad con apariencia; priorizar especificación y certificación.',
    ],
    evidence: 'Lista de verificación de calidad con decisión aceptado/rechazado y justificación.',
    safety: 'Guantes para manipular muestras; no probar ni quemar materiales.',
  },
  'IR-4.1-A1': {
    demo: 'El docente presenta el EPP, explica su función y muestra cómo detectar deterioro, caducidad o talla incorrecta.',
    guided: 'En parejas, los estudiantes inspeccionan un kit de EPP con una lista de cotejo y separan lo aceptable de lo rechazable.',
    challenge: 'Cada equipo arma un kit de seguridad para una visita comunitaria y justifica cada elemento.',
    errors: [
      'Usar guantes rotos o húmedos; revisar antes de cada práctica.',
      'Omitir lentes o calzado adecuado; usar la lista de cotejo del kit.',
      'Usar EPP de talla incorrecta; verificar ajuste y movilidad.',
    ],
    evidence: 'Lista de cotejo del EPP y kit de seguridad armado.',
    safety: 'Crítico: el EPP dañado se retira de inmediato; el docente verifica cada kit antes de usarlo.',
  },
  'IR-4.1-A2': {
    demo: 'El docente modela la colocación correcta del EPP para trabajos eléctricos, hidrosanitarios y de gas, y explica las limitaciones de cada equipo.',
    guided: 'En parejas, los estudiantes colocan el EPP, realizan una tarea simulada y verifican ajuste, visibilidad y movilidad.',
    challenge: 'Cada equipo ejecuta un simulacro de tarea con EPP y registra incidentes, riesgos y mejoras.',
    errors: [
      'Retirar los guantes durante la tarea; designar un observador de seguridad.',
      'Usar ropa suelta o cabello suelto; revisar antes de iniciar.',
      'No proteger los ojos al cortar o taladrar; usar lentes de forma permanente.',
    ],
    evidence: 'Registro de observación de EPP y bitácora de incidentes del simulacro.',
    safety: 'Crítico: supervisión directa del docente; no se energiza ningún circuito.',
  },
  'IR-4.1-A3': {
    demo: 'El docente modela el levantamiento y traslado seguro de cargas, la ruta de circulación y la señalización del área.',
    guided: 'En parejas, los estudiantes trasladan materiales ligeros por una ruta marcada y aplican técnicas de manejo manual.',
    challenge: 'Cada equipo planifica y ejecuta una ruta de traslado para el proyecto comunitario, con señalización y registro de riesgos.',
    errors: [
      'Levantar con la espalda; flexionar las piernas y mantener la carga cerca del cuerpo.',
      'Bloquear salidas o rutas de emergencia; delimitar y señalizar.',
      'Transportar más peso del permitido; dividir la carga o usar apoyo.',
    ],
    evidence: 'Plan de traslado, lista de verificación de ruta y registro de incidencias.',
    safety: 'Crítico: límites de peso, trabajo en equipo y calzado de seguridad; no correr ni improvisar rutas.',
  },
  'IR-4.2-A1': {
    demo: 'El docente clasifica herramientas por categoría y uso, e inspecciona mangos, filos, aislamiento y estado general.',
    guided: 'En parejas, los estudiantes ordenan un kit de herramientas y elaboran un inventario con criterios de uso y mantenimiento.',
    challenge: 'Cada equipo diseña un tablero o kit de herramientas para el proyecto y presenta su organización.',
    errors: [
      'Mezclar herramientas de corte con herramientas de medición; separar por categoría.',
      'Usar mangos sueltos o filos dañados; retirar y reportar.',
      'No contar las herramientas al inicio y al cierre; usar inventario.',
    ],
    evidence: 'Inventario de herramientas y propuesta de organización del kit.',
    safety: 'Manipular herramientas de corte con guantes; mantener filos protegidos y contar al finalizar.',
  },
  'IR-4.2-A2': {
    demo: 'El docente demuestra el corte y la ranura en material de práctica con la herramienta correcta, EPP y control de polvo.',
    guided: 'En parejas, los estudiantes practican cortes y ranuras en material de desecho, verificando profundidad y acabado.',
    challenge: 'Cada equipo ejecuta un corte o ranura en un muro de práctica bajo supervisión y evalúa el resultado con una lista de cotejo.',
    errors: [
      'No usar lentes, mascarilla o protección auditiva; revisar EPP antes de iniciar.',
      'Elegir una hoja o disco incorrecto; verificar el material y la herramienta.',
      'Cortar demasiado profundo o sin control; marcar, guiar y avanzar por pasos.',
    ],
    evidence: 'Pieza de práctica con corte/ranura y lista de cotejo de ejecución segura.',
    safety: 'Crítico: protección ocular, auditiva y respiratoria; herramienta en buen estado; supervisión directa.',
  },
  'IR-4.2-A3': {
    demo: 'El docente demuestra cortes y ranuras alrededor de tubería y cableado en una maqueta desenergizada, con bloqueo y verificación.',
    guided: 'En parejas, los estudiantes marcan y ejecutan un corte en una maqueta, cuidando no dañar tuberías ni conductores.',
    challenge: 'Cada equipo realiza una ranura y comprueba el ajuste de la tubería o canalización en la maqueta; documenta el proceso.',
    errors: [
      'Cortar cerca de cable energizado; verificar ausencia de tensión y usar maqueta desenergizada.',
      'Dañar la tubería o el aislamiento; controlar profundidad y usar guía.',
      'No verificar el ajuste final; probar con el elemento real antes de cerrar.',
    ],
    evidence: 'Maqueta con ranura terminada, ajuste verificado y registro del proceso.',
    safety: 'Crítico: desenergizar, verificar con multímetro y bloquear; no trabajar con energía.',
  },
  'IR-5.1-A1': {
    demo: 'El docente muestra formas, dimensiones y manejo de muebles, tuberías y conexiones, y explica cómo planear el tendido sin forzar piezas.',
    guided: 'En parejas, los estudiantes identifican formas y proponen un recorrido para una instalación sencilla.',
    challenge: 'Cada equipo planea la ubicación de muebles, tuberías y conexiones en un espacio comunitario y justifica la ruta.',
    errors: [
      'Forzar piezas o uniones; respetar radios de curvatura y especificaciones.',
      'Ignorar el espacio disponible; medir y trazar antes de colocar.',
      'Levantar muebles de forma insegura; usar técnica y apoyo.',
    ],
    evidence: 'Croquis de recorrido y lista de verificación de manejo seguro.',
    safety: 'Guantes y calzado de seguridad; levantar con las piernas y solicitar apoyo para piezas pesadas.',
  },
  'IR-5.1-A2': {
    demo: 'El docente presenta materiales de plomería, hidráulica y gas, y explica dimensiones, presiones y compatibilidad.',
    guided: 'En parejas, los estudiantes clasifican muestras por sistema, dimensión y uso.',
    challenge: 'Cada equipo selecciona materiales para una vivienda de tamaño definido y justifica la elección.',
    errors: [
      'Usar diámetros incorrectos; verificar el cálculo y el plano.',
      'Mezclar materiales de gas y agua; revisar especificación y norma.',
      'Ignorar la compatibilidad entre conexiones; probar el ajuste en seco.',
    ],
    evidence: 'Tabla de clasificación y selección de materiales con justificación técnica.',
    safety: 'No abrir gas; manipular muestras con guantes y en área ventilada.',
  },
  'IR-5.1-A3': {
    demo: 'El docente demuestra la limpieza de muebles, tuberías y conexiones y explica el uso seguro de productos.',
    guided: 'En parejas, los estudiantes limpian una maqueta y registran productos, dosis y precauciones.',
    challenge: 'Cada equipo elabora un protocolo de limpieza para el espacio comunitario y lo prueba en una maqueta.',
    errors: [
      'Mezclar productos químicos; usar solo lo indicado y en área ventilada.',
      'Usar agua cerca de componentes eléctricos; desenergizar y secar.',
      'No usar guantes o no ventilar; revisar la ficha de seguridad.',
    ],
    evidence: 'Protocolo de limpieza y registro antes/después de la maqueta.',
    safety: 'Crítico: guantes, ventilación y prohibición de mezclar cloro con amoniaco; no limpiar equipos energizados.',
  },
  'IR-5.2-A1': {
    demo: 'El docente presenta cimentación, cadenas, castillos, muros, losas y acabados, así como los agregados y sus proporciones.',
    guided: 'En parejas, los estudiantes identifican elementos constructivos en un plano o maqueta y elaboran una lista.',
    challenge: 'Cada equipo arma una maqueta a escala con materiales reciclados y explica la función de cada elemento.',
    errors: [
      'Omitir elementos estructurales; usar la lista de cotejo del sistema constructivo.',
      'Alterar el orden de armado; seguir la secuencia del proceso.',
      'Maqueta inestable; verificar uniones y base.',
    ],
    evidence: 'Maqueta y lista de cotejo de elementos constructivos.',
    safety: 'Cuidado con bordes filosos y polvo; usar guantes y limpiar el área.',
  },
  'IR-5.2-A2': {
    demo: 'El docente planifica la ruta, el acomodo y el traslado de materiales al sitio de la obra, con señalización y EPP.',
    guided: 'En parejas, los estudiantes trasladan materiales ligeros a un sitio marcado y registran tiempos y riesgos.',
    challenge: 'Cada equipo ejecuta el plan de traslado para el proyecto comunitario y evalúa la eficiencia y la seguridad.',
    errors: [
      'Sobrecargar o transportar de forma insegura; dividir la carga.',
      'No señalizar la ruta; delimitar y avisar.',
      'Dañar materiales por mal acomodo; proteger esquinas y tuberías.',
    ],
    evidence: 'Plan de traslado, registro de tiempos y lista de verificación de seguridad.',
    safety: 'Crítico: trabajo en equipo, calzado de seguridad y rutas despejadas.',
  },
  'IR-5.2-A3': {
    demo: 'El docente instala un mueble o accesorio en una maqueta siguiendo el plano, y explica anclaje, nivel y tolerancias.',
    guided: 'En parejas, los estudiantes instalan un accesorio en una maqueta y verifican nivel y fijación.',
    challenge: 'Cada equipo instala muebles o accesorios en el espacio comunitario conforme al plano y documenta el proceso.',
    errors: [
      'Altura o ubicación incorrecta; verificar el plano antes de perforar.',
      'Anclaje insuficiente; usar taquetes y tornillos adecuados.',
      'No verificar nivel; usar nivel y ajustar antes de fijar.',
    ],
    evidence: 'Accesorio instalado, verificación de nivel y lista de cotejo.',
    safety: 'Herramienta eléctrica con protección ocular y auditiva; desconectar antes de cambiar brocas.',
  },
  'IR-6.1-A1': {
    demo: 'El docente presenta opciones de instalaciones residenciales sustentables (eléctrica, hidrosanitaria y gas) y explica criterios de eficiencia.',
    guided: 'En parejas, los estudiantes clasifican ejemplos por tipo de instalación y criterio de sustentabilidad.',
    challenge: 'Cada equipo propone una mejora sustentable para un espacio comunitario y justifica su viabilidad.',
    errors: [
      'Confundir eficiencia con sustentabilidad; considerar agua, energía, residuos y costo.',
      'Ignorar el mantenimiento; incluir un plan mínimo.',
      'Proponer soluciones sin presupuesto; estimar costo y alternativas.',
    ],
    evidence: 'Tabla de clasificación y propuesta de mejora sustentable.',
    safety: 'Actividad de análisis; no intervenir instalaciones energizadas.',
  },
  'IR-6.1-A2': {
    demo: 'El docente recorre un espacio con una lista de viabilidad: acceso, ventilación, iluminación, humedad, espacio y seguridad.',
    guided: 'En parejas, los estudiantes evalúan un espacio y registran hallazgos con evidencia fotográfica o croquis.',
    challenge: 'Cada equipo elabora un informe de viabilidad con recomendaciones y prioridades.',
    errors: [
      'Ignorar ventilación o humedad; incluir en la lista.',
      'No documentar con evidencia; usar fotos, croquis y medidas.',
      'Confundir deseos con viabilidad; priorizar seguridad y normativa.',
    ],
    evidence: 'Informe de viabilidad con lista de cotejo y recomendaciones.',
    safety: 'Inspección visual; no subir a techos ni abrir tableros.',
  },
  'IR-6.1-A3': {
    demo: 'El docente dibuja el croquis de una instalación sustentable con símbolos, dimensiones y especificaciones.',
    guided: 'En parejas, los estudiantes dibujan una sección del croquis y verifican coherencia con la viabilidad.',
    challenge: 'Cada equipo entrega el croquis completo de la instalación sustentable con memoria técnica breve.',
    errors: [
      'Omitir símbolos o dimensiones; usar la leyenda y medir.',
      'Contradecir el informe de viabilidad; revisar antes de dibujar.',
      'No incluir especificaciones; anotar materiales y capacidades.',
    ],
    evidence: 'Croquis completo y memoria técnica de la instalación sustentable.',
    safety: 'Actividad de gabinete; no se intervienen instalaciones.',
  },
  'IR-6.2-A1': {
    demo: 'El docente clasifica material sobrante con el criterio de las tres R y separa residuos peligrosos.',
    guided: 'En parejas, los estudiantes clasifican una muestra mixta y etiquetan los grupos.',
    challenge: 'Cada equipo clasifica el material sobrante del proyecto y propone un destino para cada fracción.',
    errors: [
      'Mezclar residuos peligrosos con reciclables; usar la lista de residuos.',
      'No limpiar o etiquetar; preparar el material antes de clasificar.',
      'Clasificar sin criterio; usar las tres R y la ficha de material.',
    ],
    evidence: 'Tabla de clasificación, etiquetas y propuesta de destino.',
    safety: 'Guantes y cuidado con bordes; no manipular residuos desconocidos.',
  },
  'IR-6.2-A2': {
    demo: 'El docente modela una entrada de bitácora: fecha, responsable, material, cantidad, unidad, origen y destino.',
    guided: 'En parejas, los estudiantes registran una muestra y revisan que no falten campos.',
    challenge: 'Cada equipo lleva la bitácora diaria del proyecto y la presenta al cierre del bloque.',
    errors: [
      'Registros incompletos; usar el formato de bitácora.',
      'No indicar unidades o responsable; completar todos los campos.',
      'No fechar; registrar al momento de la actividad.',
    ],
    evidence: 'Bitácora de material sobrante con registros completos.',
    safety: 'Actividad de registro; no manipular residuos sin EPP.',
  },
  'IR-6.2-A3': {
    demo: 'El docente muestra ejemplos de reúso seguro y explica criterios de resistencia, limpieza y acabado.',
    guided: 'En parejas, los estudiantes diseñan un objeto útil con material sobrante y verifican su seguridad.',
    challenge: 'Cada equipo construye un prototipo para el espacio comunitario y presenta el impacto de las tres R.',
    errors: [
      'Reutilizar material contaminado o estructuralmente inseguro; verificar origen y estado.',
      'No considerar resistencia; probar antes de usar.',
      'Sin acabado o limpieza; preparar el material y documentar.',
    ],
    evidence: 'Prototipo, ficha de seguridad y hoja de impacto de las tres R.',
    safety: 'EPP para corte y lijado; no reutilizar materiales con riesgo sanitario o eléctrico.',
  },
};

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br/>').trim();
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(cell).join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(' | ')} |`);
  return [head, separator, ...body].join('\n');
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function numberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function semesterLabel(semester: number): string {
  return `${semester}.º`;
}

function activityGuide(activity: TrajectoryActivity): ActivityGuide {
  return (
    ACTIVITY_GUIDES[activity.id] ?? {
      demo: `El docente modela la actividad “${activity.name}” con material real o maqueta y explicita los criterios de seguridad.`,
      guided: `En parejas, los estudiantes realizan la actividad “${activity.name}” con acompañamiento y lista de cotejo.`,
      challenge: `Cada equipo repite la actividad en un contexto distinto, documenta el proceso y verifica el resultado.`,
      errors: [
        'Omitir pasos o criterios de seguridad; usar la lista de cotejo.',
        'No documentar el proceso; registrar evidencias y decisiones.',
      ],
      evidence: activity.description,
      safety: 'Supervisión docente y EPP básico; no energizar circuitos ni intervenir instalaciones reales.',
    }
  );
}

function uacSection(node: TrajectoryNode, index: number): string {
  const lines: string[] = [];
  lines.push(`### 3.${index} ${node.id} — ${node.uacName}`);
  lines.push('');
  lines.push(
    table(
      ['Campo', 'Valor'],
      [
        ['Semestre', semesterLabel(node.semester)],
        ['Carga horaria', `${node.totalHours} h · ${node.weeklyHours} h semanales · ${node.blocks} bloques de 18 h`],
        ['Prerrequisitos', node.prerequisites.length ? node.prerequisites.join(', ') : 'Ninguno'],
        ['Resultado de aprendizaje', node.learningOutcome],
        ['Hito del proyecto', node.projectMilestone],
        ['SINCO 2019', node.sinco.join('; ')],
        ['SCIAN 2023', node.scian.join('; ')],
      ]
    )
  );
  lines.push('');
  lines.push('**Contenidos oficiales de la UAC:**');
  lines.push('');
  lines.push(bulletList(node.contents));
  lines.push('');

  node.keyActivities.forEach((activity, activityIndex) => {
    const guide = activityGuide(activity);
    lines.push(`#### Actividad ${activityIndex + 1} — ${activity.name} (${activity.hours} h)`);
    lines.push('');
    lines.push('**Contenidos de la actividad:**');
    lines.push('');
    lines.push(bulletList(activity.contents));
    lines.push('');
    lines.push(`**Descripción oficial:** ${activity.description}`);
    lines.push('');
    lines.push('**Didáctica de taller (3 momentos):**');
    lines.push('');
    lines.push(
      bulletList([
        `**Demostración técnica (docente):** ${guide.demo}`,
        `**Práctica guiada (parejas):** ${guide.guided}`,
        `**Reto autónomo (equipo):** ${guide.challenge}`,
      ])
    );
    lines.push('');
    lines.push('**Errores comunes y prevención:**');
    lines.push('');
    lines.push(bulletList(guide.errors));
    lines.push('');
    lines.push(`**Evidencia y criterio de logro:** ${guide.evidence}`);
    lines.push('');
    lines.push(`**Seguridad específica:** ${guide.safety}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function buildTeacherGuideMarkdown(
  trajectory: CurriculumTrajectory,
  options: TeacherGuideOptions = {}
): string {
  const generatedAt = options.generatedAt ?? new Date().toISOString().slice(0, 10);
  const nodes = trajectory.nodes;
  const totalActivities = nodes.reduce((total, node) => total + node.keyActivities.length, 0);
  const totalContents = new Set(nodes.flatMap((node) => node.contents)).size;

  const lines: string[] = [];
  lines.push('# Guía Didáctica de Oficio para el Docente — Instalaciones Residenciales 2024');
  lines.push('');
  lines.push('**Formación Laboral Básico — Bachillerato General Estatal (BGE)**  ');
  lines.push('**Generación 2023–2026 · Acuerdo 09/08/23 · SEP Puebla · MCCEMS**');
  lines.push('');
  lines.push(`**Versión 1.0 · ${generatedAt}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 1. Ficha de identificación institucional');
  lines.push('');
  lines.push(
    table(
      ['Campo', 'Valor'],
      [
        ['Componente', 'Formación Laboral Básico, Nivel 2'],
        ['Subsistema', 'Bachillerato General Estatal (BGE)'],
        ['Generación', '2023–2026'],
        ['Acuerdo', 'Acuerdo número 09/08/23 (MCCEMS)'],
        ['Documento oficial', `${trajectory.sourceDocument} (SEP Puebla)`],
        ['Páginas de referencia', trajectory.sourcePages],
        ['Duración', `${trajectory.durationSemesters} semestres: 3.º, 4.º, 5.º y 6.º`],
        ['UAC', String(trajectory.totalUacs)],
        ['Actividades clave', `${totalActivities} (3 por UAC; 6 por semestre)`],
        ['Contenidos oficiales', `${totalContents} temas (5 por UAC)`],
        ['Carga horaria', `${trajectory.totalHours} h: 54 h por UAC, 3 h semanales, 3 bloques de 18 h`],
        ['Proyecto integrador', trajectory.project.name],
        ['Versión de la guía', `1.0 · ${generatedAt}`],
      ]
    )
  );
  lines.push('');
  lines.push('**Mapa de las 8 UAC:**');
  lines.push('');
  lines.push(
    table(
      ['Semestre', 'UAC', 'Horas', 'Prerrequisitos', 'Hito del proyecto'],
      nodes.map((node) => [
        semesterLabel(node.semester),
        `${node.id} — ${node.uacName}`,
        String(node.totalHours),
        node.prerequisites.length ? node.prerequisites.join(', ') : '—',
        node.projectMilestone,
      ])
    )
  );
  lines.push('');
  lines.push(
    '**Perfil de egreso.** El egresado interpreta croquis de instalaciones residenciales básicas, prepara y traslada materiales, usa equipo de seguridad, realiza cortes y ranuras, coloca elementos constructivos, muebles, tuberías y conexiones, y recupera materiales de reúso y reciclables. La guía traduce ese perfil en decisiones de aula seguras, observables y evaluables.'
  );
  lines.push('');
  lines.push('**Cómo usar esta guía:**');
  lines.push('');
  lines.push(
    numberedList([
      'Lea la ficha y el mapa de UAC para ubicar el semestre, la carga horaria y el hito del proyecto.',
      'Antes de cada actividad, revise el módulo 2 (seguridad) y el kit del módulo 4.',
      'Use la secuencia de tres momentos del módulo 3: demostración, práctica guiada y reto autónomo.',
      'Evalúe con la lista de cotejo y la rúbrica del módulo 5; registre evidencias en el portafolio.',
      'Conecte la actividad con el proyecto comunitario del módulo 6 y documente el avance en la bitácora.',
    ])
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 2. Seguridad en taller y protocolos normativos');
  lines.push('');
  lines.push(
    '> **Principio rector:** ninguna práctica escolar justifica exponer a una persona a un riesgo eléctrico, químico o de altura. El docente no necesita ser electricista, pero sí debe reconocer límites, verificar condiciones y detener la actividad cuando no haya seguridad.'
  );
  lines.push('');
  lines.push('### 2.1 Marco normativo de referencia');
  lines.push('');
  lines.push(
    table(
      ['Norma o referencia', 'Propósito', 'Aplicación en el taller'],
      [
        [
          'NOM-001-SEDE-2012',
          'Instalaciones eléctricas de utilización.',
          'Practicar solo en circuitos de baja tensión, desenergizados y con materiales certificados; no intervenir la instalación del plantel.',
        ],
        [
          'NOM-031-STPS-2011',
          'Construcción: condiciones de seguridad y salud en el trabajo.',
          'Planificar traslados, cortes, ranuras, orden y limpieza; usar EPP y señalización.',
        ],
        [
          'NOM-017-STPS-2008',
          'Equipo de protección personal: selección, uso y manejo.',
          'Seleccionar, revisar y usar EPP adecuado a cada actividad.',
        ],
        [
          'NOM-026-STPS-2008',
          'Colores y señales de seguridad e higiene.',
          'Señalizar áreas de trabajo, rutas de evacuación y riesgos.',
        ],
        [
          'NOM-029-STPS-2011',
          'Mantenimiento de instalaciones eléctricas: condiciones de seguridad.',
          'Aplicar bloqueo y etiquetado, verificación de ausencia de tensión y trabajo en parejas.',
        ],
        [
          'ISO 9001:2015',
          'Sistemas de gestión de calidad.',
          'Documentar evidencias, bitácoras, listas de cotejo y mejora continua.',
        ],
        [
          'STPS',
          'Seguridad y salud en el trabajo.',
          'Consultar guías, protocolos y normativa vigente antes de cada práctica.',
        ],
      ]
    )
  );
  lines.push('');
  lines.push(
    '> **Nota de vigencia:** la escuela debe verificar la versión vigente de cada norma y contar con el apoyo de un especialista para cualquier trabajo con energía. Esta guía es un documento de trabajo académico, no sustituye la normativa oficial ni la supervisión técnica.'
  );
  lines.push('');
  lines.push('### 2.2 Equipo de Protección Personal (EPP)');
  lines.push('');
  lines.push(
    table(
      ['EPP', 'Cuándo usarlo', 'Criterio de verificación'],
      [
        [
          'Guantes dieléctricos',
          'Manejo de componentes eléctricos y herramientas.',
          'Clase y tensión adecuadas; sin roturas, humedad ni caducidad vencida.',
        ],
        [
          'Lentes de seguridad',
          'Cortes, taladros, lijado, limpieza y proyecciones.',
          'Lentes completos, ajustados y sin rayaduras que obstruyan la visión.',
        ],
        [
          'Calzado de seguridad',
          'Taller, traslado de materiales y visitas.',
          'Suela antiderrapante, protección de dedos y buen estado.',
        ],
        [
          'Casco',
          'Áreas con riesgo de caída de objetos.',
          'Suspensión interior en buen estado; ajuste correcto.',
        ],
        [
          'Ropa de algodón y ajustada',
          'Trabajo con herramientas y componentes eléctricos.',
          'Sin partes sueltas, sin fibras sintéticas cerca de calor y sin accesorios colgantes.',
        ],
        [
          'Protección auditiva',
          'Uso de herramienta eléctrica ruidosa.',
          'Tapones u orejeras limpias y colocadas correctamente.',
        ],
        [
          'Mascarilla',
          'Polvo, lijado y mezclas.',
          'Ajuste al rostro y filtro adecuado al tipo de partícula.',
        ],
      ]
    )
  );
  lines.push('');
  lines.push(
    '**Regla de baja tensión:** para prácticas escolares, priorice circuitos de 12 V, maquetas desenergizadas y simuladores. No se permite trabajar con 127 V o 220 V sin un especialista y un protocolo escrito.'
  );
  lines.push('');
  lines.push('### 2.3 Reglas de oro del taller');
  lines.push('');
  lines.push(
    numberedList([
      '**Desenergizar y verificar:** abra el circuito, bloquee y compruebe ausencia de tensión con multímetro antes de tocar.',
      '**Bloquear y etiquetar:** use candado o etiqueta cuando el equipo lo permita; nadie retira el bloqueo sin autorización.',
      '**Usar EPP completo:** guantes, lentes, calzado y ropa adecuada; revise el EPP antes de cada práctica.',
      '**Trabajar en parejas con supervisión:** nunca realice una práctica eléctrica en solitario.',
      '**Detenerse ante la duda:** si hay olor a quemado, chispa, cable pelado, humedad o duda técnica, suspenda y reporte.',
    ])
  );
  lines.push('');
  lines.push('### 2.4 Uso seguro del multímetro');
  lines.push('');
  lines.push(
    bulletList([
      'Verifique la categoría de seguridad (CAT), el estado de las puntas y el fusible antes de medir.',
      'Seleccione función y escala antes de conectar; no cambie de función con las puntas en el circuito.',
      'Mida tensión en paralelo y continuidad o resistencia solo en circuitos sin energía.',
      'No mida resistencia en un circuito energizado; descargue capacitores antes de medir.',
      'Registre la lectura, la escala y la condición del circuito; una lectura sin contexto no es evidencia.',
    ])
  );
  lines.push('');
  lines.push('### 2.5 Protocolo ante incidentes');
  lines.push('');
  lines.push(
    numberedList([
      'Cortar la energía desde el interruptor general solo si es seguro hacerlo.',
      'No tocar a una persona que sigue en contacto con la fuente; usar un objeto aislante y llamar a emergencias.',
      'Llamar al 911 y avisar de inmediato a la autoridad escolar y al responsable del taller.',
      'Aplicar primeros auxilios solo si se está capacitado; no mover a la persona si hay sospecha de lesión grave.',
      'Usar extintor ABC o CO2 solo si el fuego es incipiente y existe una ruta de escape segura.',
      'Registrar el incidente, las causas y las acciones de mejora en la bitácora escolar.',
    ])
  );
  lines.push('');
  lines.push('> **Nunca use agua en un incendio eléctrico.** Si no puede controlar la situación, evacúe y espere a los servicios de emergencia.'
  );
  lines.push('');
  lines.push('### 2.6 Checklist antes de iniciar una práctica');
  lines.push('');
  lines.push(
    table(
      ['Verificación', 'Sí/No', 'Observaciones'],
      [
        ['El área está despejada, iluminada y ventilada.', '', ''],
        ['El circuito está desenergizado y verificado con multímetro.', '', ''],
        ['El EPP está completo y en buen estado.', '', ''],
        ['Las herramientas están íntegras y son las adecuadas.', '', ''],
        ['Hay botiquín, extintor y ruta de evacuación identificados.', '', ''],
        ['El docente explicó los riesgos y el protocolo de emergencia.', '', ''],
        ['Un compañero observa y apoya la práctica.', '', ''],
        ['Los materiales y residuos tienen un lugar seguro.', '', ''],
        ['Se cuenta con el permiso y la supervisión institucional.', '', ''],
      ]
    )
  );
  lines.push('');
  lines.push('### 2.7 Adaptaciones para planteles sin laboratorio');
  lines.push('');
  lines.push(
    bulletList([
      'Iniciar con simuladores virtuales (PhET, Tinkercad) y maquetas de cartón o material reciclado.',
      'Usar circuitos de 12 V con baterías, resistencias y LEDs para demostrar continuidad, serie y paralelo.',
      'Trabajar con componentes reales desenergizados y herramientas de práctica antes de cualquier visita.',
      'Organizar visitas comunitarias de observación, sin intervención, con supervisión y consentimiento.',
      'Rotar equipos y roles para que todos manipulen, registren y evalúen sin saturar el espacio.',
    ])
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 3. Desglose secuenciado de las 24 actividades clave');
  lines.push('');
  lines.push(
    '**Propósito del módulo.** Convertir cada actividad clave en una secuencia de taller de 18 h, con tres momentos: demostración técnica del docente, práctica guiada en parejas y reto autónomo con comprobación funcional. Las sugerencias son ajustables al contexto del plantel, pero no deben reducir los criterios de seguridad ni los contenidos oficiales.'
  );
  lines.push('');
  lines.push('**Organización sugerida de una sesión de 3 h:**');
  lines.push('');
  lines.push(
    table(
      ['Momento', 'Tiempo', 'Propósito'],
      [
        ['Apertura y demostración', '30 min', 'Activar saberes previos, explicar el reto y modelar el procedimiento seguro.'],
        ['Práctica guiada', '90 min', 'Ejecutar en parejas con lista de cotejo y retroalimentación inmediata.'],
        ['Reto autónomo y cierre', '60 min', 'Resolver un caso nuevo, verificar el resultado y documentar la evidencia.'],
      ]
    )
  );
  lines.push('');
  lines.push(
    '**Regla de oro:** ninguna actividad se ejecuta con energía en 127 V o 220 V. Las prácticas con componentes reales se realizan desenergizadas o con baja tensión (12 V) y supervisión directa.'
  );
  lines.push('');
  lines.push('**Progresión semestral:**');
  lines.push('');
  lines.push(
    table(
      ['Semestre', 'Enfoque', 'UAC', 'Hito del proyecto'],
      [
        ['3.º', 'Diagnóstico y cuantificación', 'IR-3.1, IR-3.2', 'Diagnóstico y croquis del espacio comunitario'],
        ['4.º', 'Seguridad y habilitación', 'IR-4.1, IR-4.2', 'Preparación segura y habilitación del espacio'],
        ['5.º', 'Acondicionamiento', 'IR-5.1, IR-5.2', 'Acondicionamiento y colocación de elementos constructivos'],
        ['6.º', 'Instalación sustentable y cierre', 'IR-6.1, IR-6.2', 'Instalación sustentable y recuperación de sobrantes'],
      ]
    )
  );
  lines.push('');

  nodes.forEach((node, index) => {
    lines.push(uacSection(node, index + 1));
    lines.push('---');
    lines.push('');
  });

  lines.push('## 4. Kit de materiales de bajo costo y simuladores virtuales');
  lines.push('');
  lines.push(
    '**Criterio de selección.** El kit debe permitir practicar sin energía, con materiales accesibles, reutilizables y seguros. Los componentes reales se usan desenergizados; la simulación sustituye la práctica cuando no hay laboratorio.'
  );
  lines.push('');
  lines.push('### 4.1 Kit físico mínimo');
  lines.push('');
  lines.push(
    table(
      ['Recurso', 'Uso', 'Alternativa de bajo costo'],
      [
        ['Multímetro digital', 'Medir tensión, continuidad y resistencia.', 'Multímetro básico con CAT II y puntas en buen estado.'],
        ['Cable THW 12/14 AWG', 'Prácticas de conexión y continuidad.', 'Retazos de cable donados, desenergizados y verificados.'],
        ['Chalupas, apagadores y sockets', 'Armado de circuitos de práctica.', 'Componentes usados en buen estado o simuladores.'],
        ['Tubería conduit/PVC y conexiones', 'Trazado, cortes y uniones.', 'Tubos de cartón, popotes rígidos o PVC de reúso.'],
        ['Cinta de aislar y conectores', 'Aislamiento y uniones seguras.', 'Cinta aislante nueva; no usar cinta adhesiva común.'],
        ['Herramienta básica', 'Pinza, desarmador, pelacables, arco de sierra.', 'Herramienta escolar en buen estado; préstamo supervisado.'],
        ['EPP', 'Guantes, lentes, calzado, mascarilla.', 'Kit escolar compartido, revisado antes de cada uso.'],
        ['Señalización', 'Delimitar áreas y rutas.', 'Cartulinas, conos o cinta de precaución.'],
        ['Extintor y botiquín', 'Respuesta a emergencias.', 'Equipo institucional verificado y vigente.'],
        ['Maquetas', 'Simular muros, instalaciones y espacios.', 'Cartón, madera de reúso, botellas y tapas.'],
      ]
    )
  );
  lines.push('');
  lines.push('### 4.2 Simuladores virtuales y recursos gratuitos');
  lines.push('');
  lines.push(
    table(
      ['Simulador', 'Uso didáctico', 'Acceso'],
      [
        [
          'PhET — Kit de Construcción de Circuitos',
          'Armar circuitos, medir voltaje y corriente, explorar serie y paralelo.',
          'https://phet.colorado.edu/es/simulations/circuit-construction-kit-dc',
        ],
        [
          'Tinkercad Circuits',
          'Diseñar circuitos, simular Arduino y documentar el montaje.',
          'https://www.tinkercad.com/circuits',
        ],
        [
          'Falstad Circuit Simulator',
          'Visualizar corriente y voltaje en tiempo real.',
          'https://www.falstad.com/circuit/',
        ],
        [
          'Sweet Home 3D',
          'Croquis, distribución de espacios y mobiliario.',
          'https://www.sweethome3d.com/',
        ],
        [
          'GeoGebra',
          'Escalas, geometría y proporciones para croquis.',
          'https://www.geogebra.org/',
        ],
      ]
    )
  );
  lines.push('');
  lines.push(
    '> **Verificación de enlaces:** los enlaces se incluyen como apoyo didáctico; el docente debe comprobarlos antes de la clase y prever una alternativa sin internet.'
  );
  lines.push('');
  lines.push('### 4.3 Ruta para planteles sin laboratorio');
  lines.push('');
  lines.push(
    numberedList([
      'Simular el circuito o la instalación en PhET o Tinkercad y registrar lecturas.',
      'Construir una maqueta con material reciclado y repetir el procedimiento sin energía.',
      'Trabajar con componentes reales desenergizados y verificar con multímetro.',
      'Realizar una visita de observación a un espacio comunitario, sin intervenir instalaciones.',
      'Evaluar con lista de cotejo y portafolio; documentar limitaciones y aprendizajes.',
    ])
  );
  lines.push('');
  lines.push('### 4.4 Gestión y cuidado de materiales');
  lines.push('');
  lines.push(
    bulletList([
      'Inventariar el kit al inicio y al cierre de cada bloque; reportar faltantes o daños.',
      'Reutilizar retazos y materiales donados solo si son seguros y están limpios.',
      'Separar residuos y aplicar las tres R; no reutilizar material contaminado.',
      'Guardar herramientas y componentes en un lugar seco, ordenado y fuera del alcance de personas no autorizadas.',
      'Solicitar apoyo institucional para EPP, extintores y mantenimiento de herramientas.',
    ])
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 5. Evaluación formativa y rúbricas DBEPA');
  lines.push('');
  lines.push(
    '**Enfoque.** La evaluación es parte del aprendizaje: se recoge evidencia mientras se trabaja, se retroalimenta de inmediato y se valora el desempeño con criterios públicos. La calificación suma evidencia de Saber, Hacer y Ser, no solo el producto final.'
  );
  lines.push('');
  lines.push('### 5.1 Lista de cotejo de desempeño técnico');
  lines.push('');
  lines.push(
    table(
      ['Criterio', 'Sí/No', 'Observaciones'],
      [
        ['Porta el EPP completo y en buen estado.', '', ''],
        ['Verifica que el circuito esté desenergizado antes de intervenir.', '', ''],
        ['Selecciona y usa la herramienta correcta.', '', ''],
        ['Mide y registra con unidades y escala correctas.', '', ''],
        ['Ejecuta el procedimiento conforme a la secuencia demostrada.', '', ''],
        ['Mantiene orden y limpieza en el área de trabajo.', '', ''],
        ['Documenta el proceso y el resultado en la bitácora.', '', ''],
        ['Trabaja en equipo y respeta los roles de seguridad.', '', ''],
        ['Identifica riesgos y propone una mejora.', '', ''],
        ['Cierra la práctica con materiales y residuos en su lugar.', '', ''],
      ]
    )
  );
  lines.push('');
  lines.push('### 5.2 Rúbrica analítica por bloque');
  lines.push('');
  lines.push('**Criterios y ponderación sugerida:**');
  lines.push('');
  lines.push(
    table(
      ['Dimensión', 'Criterio', 'Ponderación'],
      [
        ['Saber', 'Comprende conceptos, símbolos, materiales y normativa de la instalación.', '30 %'],
        ['Hacer', 'Ejecuta el procedimiento con seguridad, precisión y documentación.', '50 %'],
        ['Ser', 'Asume responsabilidad, colabora y mantiene una cultura de seguridad.', '20 %'],
      ]
    )
  );
  lines.push('');
  lines.push('**Descriptores de desempeño:**');
  lines.push('');
  lines.push(
    table(
      ['Criterio', 'Destacado (4)', 'Satisfactorio (3)', 'En proceso (2)', 'Insuficiente (1)'],
      [
        [
          'Comprensión técnica (Saber)',
          'Explica con precisión conceptos, símbolos y normativa; justifica decisiones.',
          'Explica los conceptos principales con apoyo mínimo.',
          'Identifica conceptos aislados con errores conceptuales.',
          'No explica o confunde los conceptos básicos.',
        ],
        [
          'Ejecución segura (Hacer)',
          'Ejecuta con autonomía, EPP, orden y verificación; anticipa riesgos.',
          'Ejecuta con supervisión y cumple los pasos de seguridad.',
          'Ejecuta con apoyo frecuente y omite pasos de seguridad.',
          'Ejecuta de forma insegura o no completa el procedimiento.',
        ],
        [
          'Documentación (Hacer)',
          'Registra evidencia completa, ordenada y con unidades; usa la bitácora.',
          'Registra evidencia suficiente con omisiones menores.',
          'Registra de forma incompleta o desordenada.',
          'No registra o registra sin datos verificables.',
        ],
        [
          'Trabajo colaborativo (Ser)',
          'Coordina, escucha y apoya; asigna roles de seguridad.',
          'Colabora y cumple su rol.',
          'Participa de forma irregular o requiere mediación.',
          'No colabora o interfiere con el trabajo del equipo.',
        ],
        [
          'Responsabilidad y seguridad (Ser)',
          'Cumple todas las reglas, reporta riesgos y cuida el material.',
          'Cumple las reglas con recordatorios aislados.',
          'Cumple de forma parcial y requiere supervisión constante.',
          'Pone en riesgo a otros o daña materiales.',
        ],
      ]
    )
  );
  lines.push('');
  lines.push(
    '> **Nota de ponderación:** la propuesta 30/50/20 es una referencia para la academia. El colectivo docente puede ajustarla con base en el enfoque del plantel, siempre que la decisión quede documentada y sea comunicada al estudiantado.'
  );
  lines.push('');
  lines.push('### 5.3 Retroalimentación formativa');
  lines.push('');
  lines.push(
    numberedList([
      'Describir la evidencia observada sin etiquetar a la persona.',
      'Contrastar con el criterio de la lista de cotejo o la rúbrica.',
      'Acordar una acción concreta de mejora para la siguiente práctica.',
      'Registrar el avance y dar seguimiento en la bitácora del equipo.',
    ])
  );
  lines.push('');
  lines.push('### 5.4 Evidencias por semestre');
  lines.push('');
  lines.push(
    table(
      ['Semestre', 'Hito', 'Evidencia integradora'],
      [
        ['3.º', 'Diagnóstico y croquis del espacio comunitario', 'Croquis con simbología, tabla de instalaciones y cuantificación de materiales.'],
        ['4.º', 'Preparación segura y habilitación del espacio', 'Checklist de EPP, plan de traslado y registro de cortes y ranuras.'],
        ['5.º', 'Acondicionamiento y colocación de elementos constructivos', 'Bitácora de limpieza, elementos colocados y muebles/accesorios instalados.'],
        ['6.º', 'Instalación sustentable y recuperación de sobrantes', 'Croquis de instalación sustentable, instalación colocada y bitácora de reúso.'],
      ]
    )
  );
  lines.push('');
  lines.push('### 5.5 Checklist de consistencia para la planeación');
  lines.push('');
  lines.push(
    'Use esta lista antes de cargar una planeación en la plataforma. Su objetivo es evitar errores 422 por inconsistencia estructural y asegurar que la IA reciba datos completos y coherentes.'
  );
  lines.push('');
  lines.push(
    table(
      ['Verificación', 'Sí/No', 'Observaciones'],
      [
        ['La UAC coincide con el catálogo oficial: ID, nombre y semestre.', '', ''],
        ['La carga horaria es 54 h; 3 bloques de 18 h; 18 sesiones por bloque si se usa sesiones.', '', ''],
        ['Las 3 actividades clave están presentes y suman 54 h.', '', ''],
        ['Los contenidos provienen de la fuente oficial y no hay placeholders.', '', ''],
        ['El resultado de aprendizaje y el hito del proyecto están alineados.', '', ''],
        ['Cada bloque tiene evidencia, instrumento y criterio de logro.', '', ''],
        ['No hay campos vacíos, duplicados ni horas que no sumen.', '', ''],
        ['La rúbrica usa Saber, Hacer y Ser con ponderación consistente.', '', ''],
      ]
    )
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 6. Proyecto integrador de aula-comunidad (PAEC)');
  lines.push('');
  lines.push(
    `**Descripción.** ${trajectory.project.description}`
  );
  lines.push('');
  lines.push(`**Producto final.** ${trajectory.project.finalProduct}`);
  lines.push('');
  lines.push('### 6.1 Hitos por semestre');
  lines.push('');
  lines.push(
    table(
      ['Semestre', 'Hito', 'UAC vinculadas', 'Evidencia', 'Descripción'],
      trajectory.project.milestones.map((milestone) => [
        semesterLabel(milestone.semester),
        milestone.title,
        milestone.linkedUacs.join(', '),
        milestone.evidence,
        milestone.description,
      ])
    )
  );
  lines.push('');
  lines.push('### 6.2 Orientaciones por semestre');
  lines.push('');
  lines.push('#### Semestre 3.º — Diagnóstico y croquis');
  lines.push('');
  lines.push(
    bulletList([
      'Visitar un espacio comunitario y levantar un diagnóstico visual de instalaciones, sin intervenir.',
      'Elaborar croquis con simbología, medidas y tabla de materiales.',
      'Presentar el diagnóstico a la comunidad y acordar el alcance del proyecto.',
      'Evidencia: croquis, tabla de instalaciones y cuantificación de materiales.',
    ])
  );
  lines.push('');
  lines.push('#### Semestre 4.º — Seguridad y habilitación');
  lines.push('');
  lines.push(
    bulletList([
      'Elaborar el plan de seguridad, EPP y traslado de materiales.',
      'Practicar cortes y ranuras en maqueta o muro de práctica, nunca en instalación energizada.',
      'Documentar el proceso con checklist y registro fotográfico.',
      'Evidencia: checklist de EPP, plan de traslado y registro de cortes y ranuras.',
    ])
  );
  lines.push('');
  lines.push('#### Semestre 5.º — Acondicionamiento');
  lines.push('');
  lines.push(
    bulletList([
      'Limpiar y preparar muebles, tuberías y conexiones en maqueta o espacio autorizado.',
      'Colocar elementos constructivos básicos y accesorios conforme al plano.',
      'Mantener bitácora de limpieza, materiales y avances.',
      'Evidencia: bitácora, elementos colocados y muebles/accesorios instalados.',
    ])
  );
  lines.push('');
  lines.push('#### Semestre 6.º — Instalación sustentable y cierre');
  lines.push('');
  lines.push(
    bulletList([
      'Clasificar y recuperar material sobrante con las tres R.',
      'Documentar la instalación sustentable y su mantenimiento.',
      'Presentar el producto final y el impacto comunitario.',
      'Evidencia: croquis de instalación sustentable, instalación colocada y bitácora de reúso.',
    ])
  );
  lines.push('');
  lines.push('### 6.3 Diagnóstico eléctrico de hogares locales');
  lines.push('');
  lines.push(
    'El diagnóstico es **visual y educativo**: no se intervienen instalaciones ni se abre el tablero. El objetivo es que el estudiante aprenda a observar, registrar y recomendar la revisión por un especialista.'
  );
  lines.push('');
  lines.push(
    table(
      ['Aspecto', 'Qué observar', 'Acción segura'],
      [
        ['Tablero', 'Interruptores, etiquetas, signos de calentamiento u olor a quemado.', 'Registrar y recomendar revisión por electricista; no abrir.'],
        ['Contactos', 'Carcasas rotas, sobrecalentamiento, chispas, adaptadores múltiples.', 'No usar; señalar y reportar.'],
        ['Cables', 'Aislamiento pelado, empalmes improvisados, cables sobre muebles.', 'No tocar; recomendar corrección por especialista.'],
        ['Iluminación', 'Luminarias sin protección, cables colgantes, humedad.', 'Registrar y proponer mejora con apoyo institucional.'],
        ['Humedad', 'Filtraciones cerca de contactos o tablero.', 'Alejar a las personas y reportar.'],
        ['Puesta a tierra', 'Contactos sin tierra o con adaptador que la elimina.', 'Recomendar revisión; no improvisar.'],
      ]
    )
  );
  lines.push('');
  lines.push('### 6.4 Eficiencia energética y reducción de riesgos');
  lines.push('');
  lines.push(
    table(
      ['Medida', 'Beneficio', 'Costo relativo'],
      [
        ['Sustituir lámparas por LED', 'Menor consumo y menos calor.', 'Bajo'],
        ['Usar temporizadores o sensores', 'Evita luces encendidas innecesariamente.', 'Medio'],
        ['Mantener limpias las luminarias', 'Mejor iluminación con el mismo consumo.', 'Bajo'],
        ['Revisar fugas y aislamiento', 'Menos desperdicio de agua y energía.', 'Medio'],
        ['Capacitar en hábitos seguros', 'Menos accidentes y mejor mantenimiento.', 'Bajo'],
      ]
    )
  );
  lines.push('');
  lines.push(
    bulletList([
      'Enseñar a identificar olores, chispas, cables pelados y contactos calientes.',
      'Promover el uso de reguladores y protección contra sobrecargas.',
      'Recomendar la revisión periódica por un electricista certificado.',
      'No permitir que el estudiantado intervenga instalaciones energizadas.',
      'Documentar las mejoras y su impacto en la comunidad.',
    ])
  );
  lines.push('');
  lines.push('### 6.5 Vinculación con el PAEC');
  lines.push('');
  lines.push(
    numberedList([
      'Identificar un espacio comunitario y sus necesidades reales con participación de la comunidad.',
      'Definir un alcance acotado y seguro: diagnóstico, maqueta, propuesta o mejora documentada.',
      'Establecer acuerdos con autoridades, familias o comité comunitario.',
      'Registrar evidencias, responsables y fechas en la bitácora del proyecto.',
      'Presentar resultados y recomendaciones; derivar los trabajos técnicos a especialistas.',
    ])
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 7. Bibliografía y recursos curados');
  lines.push('');
  lines.push('### 7.1 Fuentes oficiales y normativas');
  lines.push('');
  lines.push(
    bulletList([
      'SEP Puebla. (2024). *Instalaciones Residenciales*. Programa de estudio de Formación Laboral Básico, Generación 2023–2026. `Instalaciones_Residenciales_2024.pdf`.',
      'Acuerdo número 09/08/23 por el que se establece, regula y modifica el Marco Curricular Común de la Educación Media Superior.',
      'NOM-001-SEDE-2012. Instalaciones eléctricas (utilización).',
      'NOM-031-STPS-2011. Construcción — Condiciones de seguridad y salud en el trabajo.',
      'NOM-017-STPS-2008. Equipo de protección personal — Selección, uso y manejo en los centros de trabajo.',
      'NOM-026-STPS-2008. Colores y señales de seguridad e higiene, e identificación de riesgos por fluidos conducidos en tuberías.',
      'NOM-029-STPS-2011. Mantenimiento de las instalaciones eléctricas en los centros de trabajo — Condiciones de seguridad.',
      'ISO 9001:2015. Sistemas de gestión de calidad — Requisitos.',
      'CONAGUA. Información técnica y normativa sobre agua e instalaciones hidráulicas.',
      'STPS. Seguridad y salud en el trabajo. Guías y protocolos vigentes.',
    ])
  );
  lines.push('');
  lines.push('### 7.2 Recursos técnicos y simuladores');
  lines.push('');
  lines.push(
    table(
      ['Recurso', 'Tipo', 'Uso', 'Acceso'],
      [
        ['PhET — Kit de Construcción de Circuitos', 'Simulador', 'Circuitos, serie, paralelo y mediciones.', 'https://phet.colorado.edu/es/simulations/circuit-construction-kit-dc'],
        ['Tinkercad Circuits', 'Simulador', 'Diseño y simulación de circuitos.', 'https://www.tinkercad.com/circuits'],
        ['Falstad Circuit Simulator', 'Simulador', 'Visualización de corriente y voltaje.', 'https://www.falstad.com/circuit/'],
        ['Sweet Home 3D', 'Software libre', 'Croquis y distribución de espacios.', 'https://www.sweethome3d.com/'],
        ['GeoGebra', 'Software libre', 'Escalas, geometría y proporciones.', 'https://www.geogebra.org/'],
      ]
    )
  );
  lines.push('');
  lines.push('### 7.3 Criterios para seleccionar recursos');
  lines.push('');
  lines.push(
    bulletList([
      'Que el recurso sea gratuito, seguro y accesible desde el plantel o el teléfono.',
      'Que tenga versión en español o interfaz intuitiva.',
      'Que permita practicar sin energía y sin riesgo para el estudiantado.',
      'Que cuente con respaldo técnico o documentación para el docente.',
      'Que pueda usarse sin internet o con una alternativa impresa.',
    ])
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 8. Nota de revisión humana y trazabilidad');
  lines.push('');
  lines.push(
    'Esta guía integra información oficial del programa, la trayectoria validada de las 8 UAC y sugerencias didácticas para el docente. Antes de su uso institucional definitivo, se recomienda la revisión de la **Academia Estatal de Formación Laboral y TIC — Coordinación de Zona Escolar**, particularmente en:'
  );
  lines.push('');
  lines.push(
    bulletList([
      'Pertinencia de los protocolos de seguridad y de los límites de intervención en cada plantel.',
      'Viabilidad de los materiales, simuladores y visitas comunitarias.',
      'Alineación de la evaluación con el Anexo 12 y con los acuerdos de la academia.',
      'Actualización normativa y verificación de la vigencia de las NOM citadas.',
      'Articulación con el PAEC y con las condiciones reales del espacio comunitario.',
    ])
  );
  lines.push('');
  lines.push(
    table(
      ['Elemento', 'Fuente', 'Estado'],
      [
        ['UAC, horas y actividades clave', 'Programa oficial `Instalaciones_Residenciales_2024.pdf`', 'Verificado'],
        ['Contenidos formativos', 'Catálogo enriquecido `official_pdf_2024`', 'Verificado'],
        ['Trayectoria y prerrequisitos', '`trajectory-validator.ts`', 'DAG sin ciclos'],
        ['Seguridad y normativa', 'NOM, STPS y buenas prácticas de taller', 'Para revisión de academia'],
        ['Evaluación y rúbricas', 'Propuesta didáctica DBEPA', 'Para revisión de academia'],
        ['Proyecto integrador', 'Articulación curricular validada', 'Para revisión de academia'],
      ]
    )
  );
  lines.push('');
  lines.push('**Fin del documento.**');
  lines.push('');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
