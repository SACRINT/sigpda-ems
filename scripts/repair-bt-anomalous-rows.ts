/**
 * repair-bt-anomalous-rows.ts — Repara las 7 filas BT detectadas por la auditoría.
 *
 * Fuente: programas oficiales PDF de Soporte y Gestión de TI e Inteligencia
 * Artificial. No inventa contenido: reconstruye actividades divididas por la
 * extracción de tablas y completa temas truncados con el texto oficial.
 *
 * Uso:
 *   npx tsx scripts/repair-bt-anomalous-rows.ts            # dry-run
 *   npx tsx scripts/repair-bt-anomalous-rows.ts --apply    # aplica + respaldo
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const APPLY = process.argv.includes('--apply');

type Saberes = { saber: string; saberSer: string; saberHacer: string };
type Activity = {
  name: string;
  hours: number;
  order: number;
  temas: string[];
  saberes: Saberes;
};

const IDS = {
  programacion: '7f77a94f-540d-4f98-bfd4-2bcd220d7d1d',
  sistemasOperativos: 'e46c1c28-120c-4631-bfa7-6e33cdf9e666',
  preventivo: '957fdbb9-db48-4769-b64c-922f5550c843',
  hardware: '392b648b-6171-40f3-9a55-4785782a1142',
  lenguaje: '30d150d9-97f9-4a57-9eff-0fcdd6e1016b',
  vision: '3ef81aa1-597c-43b9-9fbb-eeb74a12e7c0',
  correctivo: 'fc58c5d7-674d-48d7-aea3-d187739902dc',
  redesConvergentes: 'e1ff512d-5e26-4235-a56f-fb190d77e408',
} as const;

const SABER_HACER_OVERRIDES: Record<string, string> = {
  [`${IDS.redesConvergentes}:1`]:
    'Elabora cables de red conforme a los estándares oficiales y comprueba la conectividad, manipulando las herramientas con responsabilidad, generando un ambiente de trabajo organizado, seguro y optimizando los recursos. Instala el cableado estructurado tendiendo conexiones de red entre los puntos designados, asegurándose de cumplir con los estándares de calidad y seguridad; utilizando herramientas de cableado estructurado, canaletas y ductos, generando un ambiente de trabajo organizado y seguro; optimizando los recursos. Realiza pruebas de conectividad verificando que los dispositivos se conecten a la red a la velocidad y calidad adecuadas; trabajando de forma colaborativa para identificar y resolver problemas. Documenta la instalación de la red incluyendo el etiquetado de los nodos y especificaciones de los elementos de cableado estructurado y configuración de los dispositivos para futuras referencias y mantenimiento. Trabaja con ética, responsabilidad, de forma colaborativa y orientado al logro de metas.',
  [`${IDS.redesConvergentes}:4`]:
    'Selecciona la capa del modelo OSI o TCP/IP a operar de acuerdo con los servicios y protocolos de interconexión de dispositivos; empleando herramientas de búsqueda de información y de inteligencia artificial; actuando de manera autónoma. Instala sistema operativo de red, utilizando servidor físico o software de virtualización para optimizar el uso de recursos. Realiza el registro de la instalación y características técnicas en otro idioma; trabajando con responsabilidad y orientado al logro de metas. Configura servicios de red (DNS, Active Directory, impresión, correo, archivos, web; protocolos DHCP, FTP) para gestionar la conectividad, la autenticación en la red y la escalabilidad. Registra la configuración correspondiente con responsabilidad. Detecta problemas de conectividad, utilizando herramientas de monitoreo; analizando tendencias para predecir necesidades futuras. Entrega el reporte final al jefe inmediato; comunicándose de forma asertiva y en otro idioma; trabajando con ética y responsabilidad.',
  [`${IDS.programacion}:1`]:
    'Analiza algoritmos con base en procesos que simulan la inteligencia humana, partiendo de un diagnóstico que considere su viabilidad, etapas de implementación y necesidades contextuales de hardware y software para su aplicación, fomentando el desarrollo de habilidades de empoderamiento, ciudadanía activa y aprendizaje, siguiendo instrucciones de un superior, registrándolo en un documento con un lenguaje técnico. Presenta propuesta de solución a sus superiores, considerando herramientas de inteligencia artificial, utilizando las tecnologías de información para su desarrollo, cumpliendo los siguientes criterios: Resumen ejecutivo, presentación del problema, definición de objetivos, recursos necesarios y conclusión, empleando pensamiento sistémico, de forma ética, con base en los recursos disponibles, fomentando el desarrollo de habilidades de ciudadanía activa y empleabilidad.',
  [`${IDS.preventivo}:1`]:
    'Identifica el tipo, generalidades, modelo, descripción, componentes, especificaciones de marca y modelo del equipo informático, considerando el manual de usuario. Durante la revisión registra la información de forma clara, con responsabilidad y ética. Verifica el funcionamiento del equipo, revisando las condiciones en las que se usa el dispositivo informático y la existencia de fallas en el hardware y software, consultando al usuario o los reportes de servicio, historial y plan de mantenimiento existente; actuando con autonomía y responsabilidad.',
  [`${IDS.preventivo}:2`]:
    'Prepara el área de trabajo, dispositivos, herramientas e insumos; considerando las normas de seguridad e higiene; actuando con responsabilidad, autonomía y autocuidado. Limpia el hardware del equipo y dispositivos móviles, retirando polvo de carcasa, periféricos, elementos internos y componentes específicos; siguiendo guías digitales o del fabricante, así como las normas de seguridad e higiene; actuando con responsabilidad, autonomía y autocuidado. Inspecciona el software instalado para verificar su funcionamiento, considerando actualizaciones disponibles, licencias y permisos; trabajando con responsabilidad y orientado al logro de metas. Gestiona copias de seguridad y puntos de restauración en los diferentes sistemas operativos para protección en los equipos de cómputo y dispositivos; actuando con responsabilidad, trabajando en forma autónoma y orientado al logro de metas. Implementa el sistema de seguridad para evitar amenazas en los equipos de cómputo y dispositivos móviles, actuando con responsabilidad y ética. Optimiza el rendimiento de los equipos de cómputo y dispositivos móviles administrando el almacenamiento, comprimiendo y eliminando archivos innecesarios, sincronizando en la nube, y creando particiones de manera manual utilizando aplicaciones de utilería; trabajando con responsabilidad y orientado al logro de metas. Realiza plan de mantenimiento determinando metas y objetivos, estableciendo presupuesto; considerando las obligaciones legales vigentes y deslinde de responsabilidades; actuando con ética y responsabilidad. Realiza un informe de mantenimiento considerando información general, descripción del equipo o sistemas, tipo de mantenimiento, actividades realizadas, materiales y herramientas utilizadas; así como observaciones y recomendaciones. Lo anterior, lo presenta para firma y aprobación, comunicando de forma clara y asertiva los hallazgos.',
  [`${IDS.preventivo}:3`]:
    'Recaba información sobre funcionamiento y fallas en equipo y dispositivos, reportadas por el usuario o revisando el reporte de servicio de mantenimiento; comunicándose de manera asertiva, trabajando con autonomía y orientado al logro de metas. Inspecciona físicamente los dispositivos informáticos, identificando sus características (componentes, especificaciones de marca, modelo, técnicas principales y fallas), condiciones de uso y mantenimiento, utilizando el manual del fabricante. Trabaja con autonomía, responsabilidad y ética. Realiza pruebas de funcionamiento a los dispositivos informáticos (hardware y software), mediante la técnica de prueba y error, considerando la bitácora de reportes de mantenimiento y condiciones ambientales (temperatura, humedad, movimiento, entre otros) para proponer posibles soluciones; actuando con responsabilidad y autonomía.',
  [`${IDS.correctivo}:1`]:
    'Prepara el área de trabajo, equipo, insumos, indumentaria y herramientas, considerando los principios básicos de electrónica (corriente, voltaje y resistencia), siguiendo las normas de seguridad e higiene vigentes; actuando con responsabilidad, autonomía y autocuidado. Verifica el ensamble y funcionamiento del hardware, así como el software de los equipos y aplicaciones; siguiendo la normatividad de seguridad vigente, trabajando de manera autónoma y responsable, procurando el autocuidado y resolviendo problemas. Restablece el software al estado original de fábrica, respaldando información del dispositivo informático, considerando las políticas de confidencialidad y protección de datos personales; actuando con ética y responsabilidad. Reinstala software de aplicación y utilerías de acuerdo con las necesidades del usuario, considerando las políticas de confidencialidad y protección de datos personales con ética y responsabilidad. Corrige la falla detectada de acuerdo con el diagnóstico; verificando el funcionamiento del equipo y haciendo los ajustes necesarios con responsabilidad y autonomía; aplicando la normatividad de seguridad vigente. Realiza el reporte de servicio, informando la reparación del equipo, comunicando de forma escrita en otro idioma los resultados, actuando con responsabilidad y autonomía.',
};

const HARDWARE_ACTIVITIES: Activity[] = [
  {
    name: 'Determina el hardware y dispositivos periféricos del equipo de cómputo a ensamblar',
    hours: 64,
    order: 1,
    temas: [
      'Identifica componentes del hardware (arquitectura, tipos y subclasificaciones), especificaciones técnicas, compatibilidad de los dispositivos, durabilidad, ciclo de vida y disposición final; utilizando manuales del fabricante para el ensamble del equipo de cómputo requerido por el cliente o jefe superior; actuando con autonomía, empleando el pensamiento crítico y enfocado al logro de metas.',
      'Selecciona los componentes y dispositivos periféricos en relación con la gama del equipo (baja, media, alta); considerando el presupuesto, las necesidades y requerimientos del usuario; priorizando hardware con criterios de sostenibilidad (eficiencia energética y certificaciones, garantía y responsabilidad extendida del fabricante); decidiendo con pensamiento crítico, autonomía y enfocado al logro de metas.',
      'Clasifica los dispositivos del equipo en gama baja, media y alta; considerando su tipo de uso, durabilidad y ciclo de vida.',
      'Cotiza costos de hardware y dispositivos periféricos con diferentes proveedores, comunicando de forma clara y asertiva al cliente o a su jefe inmediato, la opción que se apegue a las necesidades, requerimientos y características; actuando con ética y responsabilidad.',
    ],
    saberes: {
      saber: 'Submódulo 1: Instala hardware en equipos de cómputo. Identifica componentes del hardware (arquitectura, tipos y subclasificaciones), especificaciones técnicas, compatibilidad de los dispositivos, durabilidad, ciclo de vida y disposición final; utilizando manuales del fabricante para el ensamble del equipo de cómputo requerido por el cliente o jefe superior; actuando con autonomía, empleando el pensamiento crítico y enfocado al logro de metas.',
      saberSer:
        'Actúa con respeto a la diversidad, ética profesional, comunicación efectiva, responsabilidad y autonomía al desarrollar determina el hardware y dispositivos periféricos del equipo de cómputo a ensamblar.',
      saberHacer:
        'Identifica componentes del hardware (arquitectura, tipos y subclasificaciones), especificaciones técnicas, compatibilidad de los dispositivos, durabilidad, ciclo de vida y disposición final; utilizando manuales del fabricante para el ensamble del equipo de cómputo requerido por el cliente o jefe superior; actuando con autonomía, empleando el pensamiento crítico y enfocado al logro de metas. Selecciona los componentes y dispositivos periféricos en relación con la gama del equipo (baja, media, alta); considerando el presupuesto, las necesidades y requerimientos del usuario; priorizando hardware con criterios de sostenibilidad (eficiencia energética y certificaciones, garantía y responsabilidad extendida del fabricante); decidiendo con pensamiento crítico, autonomía y enfocado al logro de metas. Clasifica los dispositivos del equipo en gama baja, media y alta; considerando su tipo de uso, durabilidad y ciclo de vida. Cotiza costos de hardware y dispositivos periféricos con diferentes proveedores, comunicando de forma clara y asertiva al cliente o a su jefe inmediato, la opción que se apegue a las necesidades, requerimientos y características; actuando con ética y responsabilidad.',
    },
  },
  {
    name: 'Ensambla hardware en el equipo de cómputo.',
    hours: 64,
    order: 2,
    temas: [
      'Prepara el área de trabajo, dispositivos, herramientas, insumos, verificando que cuente con todos los componentes y herramientas; aplicando normas de seguridad e higiene, actuando con responsabilidad y autocuidado.',
      'Instala los dispositivos internos y periféricos atendiendo los manuales de instalación; aplicando las normas de seguridad y realizando los ajustes necesarios de forma autónoma, con responsabilidad y cumpliendo las metas.',
      'Entrega el reporte al jefe inmediato, comunicando de forma clara, el estatus del equipo ensamblado; utilizando la comunicación escrita y lenguaje técnico en otro idioma, actuando con responsabilidad.',
    ],
    saberes: {
      saber: 'Submódulo 1: Instala hardware en equipos de cómputo. Prepara el área de trabajo, dispositivos, herramientas, insumos, verificando que cuente con todos los componentes y herramientas; aplicando normas de seguridad e higiene, actuando con responsabilidad y autocuidado.',
      saberSer:
        'Actúa con respeto a la diversidad, ética profesional, comunicación efectiva, responsabilidad y autonomía al desarrollar ensambla hardware en el equipo de cómputo.',
      saberHacer:
        'Prepara el área de trabajo, dispositivos, herramientas, insumos, verificando que cuente con todos los componentes y herramientas; aplicando normas de seguridad e higiene, actuando con responsabilidad y autocuidado. Instala los dispositivos internos y periféricos atendiendo los manuales de instalación; aplicando las normas de seguridad y realizando los ajustes necesarios de forma autónoma, con responsabilidad y cumpliendo las metas. Entrega el reporte al jefe inmediato, comunicando de forma clara, el estatus del equipo ensamblado; utilizando la comunicación escrita y lenguaje técnico en otro idioma, actuando con responsabilidad.',
    },
  },
  {
    name: 'Configura hardware y dispositivos periféricos del equipo de cómputo.',
    hours: 64,
    order: 3,
    temas: [
      'Establece parámetros para habilitar el funcionamiento del equipo (opciones del BIOS, memorias RAM, funcionalidades específicas, crossfire de las tarjetas de video, entre otras); considerando los manuales de los componentes y guías digitales, actuando con responsabilidad y orientado al logro de metas.',
      'Verifica el reconocimiento de controladores y dispositivos periféricos, siguiendo las guías o manuales del fabricante, validando el funcionamiento del equipo, actuando con responsabilidad y autonomía.',
      'Elabora reporte y documentación de la configuración, entregándolo al jefe inmediato, al que comunica el estado final del equipo; utilizando la comunicación escrita y lenguaje técnico en otro idioma; actuando con responsabilidad y orientado al logro de metas.',
    ],
    saberes: {
      saber: 'Submódulo 1: Instala hardware en equipos de cómputo. Establece parámetros para habilitar el funcionamiento del equipo (opciones del BIOS, memorias RAM, funcionalidades específicas, crossfire de las tarjetas de video, entre otras); considerando los manuales de los componentes y guías digitales, actuando con responsabilidad y orientado al logro de metas.',
      saberSer:
        'Actúa con respeto a la diversidad, ética profesional, comunicación efectiva, responsabilidad y autonomía al desarrollar configura hardware y dispositivos periféricos del equipo de cómputo.',
      saberHacer:
        'Establece parámetros para habilitar el funcionamiento del equipo (opciones del BIOS, memorias RAM, funcionalidades específicas, crossfire de las tarjetas de video, entre otras); considerando los manuales de los componentes y guías digitales, actuando con responsabilidad y orientado al logro de metas. Verifica el reconocimiento de controladores y dispositivos periféricos, siguiendo las guías o manuales del fabricante, validando el funcionamiento del equipo, actuando con responsabilidad y autonomía. Elabora reporte y documentación de la configuración, entregándolo al jefe inmediato, al que comunica el estado final del equipo; utilizando la comunicación escrita y lenguaje técnico en otro idioma; actuando con responsabilidad y orientado al logro de metas.',
    },
  },
];

const VISION_ACTIVITIES: Activity[] = [
  {
    name: 'Identifica procesos de extracción de contenido audiovisual para visión artificial',
    hours: 40,
    order: 1,
    temas: [
      'Identifica algoritmos de manipulación de imágenes, detección de características y segmentación avanzada en modelos de inteligencia artificial, trabajando en forma individual o colaborativa.',
      'Caracteriza sistemas de visión artificial en modelos de machine learning para la solución de problemas con inteligencia artificial; trabajando en forma colaborativa, ética y responsable de acuerdo con un contexto específico.',
      'Cataloga metadatos de imágenes obtenidas del hardware y software para la generación de contenido de visión artificial, fomentando la autonomía y colaboración con ética.',
    ],
    saberes: {
      saber: 'Submódulo 3: Soluciona problemas con visión artificial. Identifica algoritmos de manipulación de imágenes, detección de características y segmentación avanzada en modelos de inteligencia artificial, trabajando en forma individual o colaborativa.',
      saberSer:
        'Actúa con respeto a la diversidad, ética profesional, comunicación efectiva, responsabilidad y autonomía al desarrollar identifica procesos de extracción de contenido audiovisual para visión artificial.',
      saberHacer:
        'Identifica algoritmos de manipulación de imágenes, detección de características y segmentación avanzada en modelos de inteligencia artificial, trabajando en forma individual o colaborativa. Caracteriza sistemas de visión artificial en modelos de machine learning para la solución de problemas con inteligencia artificial; trabajando en forma colaborativa, ética y responsable de acuerdo con un contexto específico. Cataloga metadatos de imágenes obtenidas del hardware y software para la generación de contenido de visión artificial, fomentando la autonomía y colaboración con ética.',
    },
  },
  {
    name: 'Aplica técnicas de visión artificial empleando PLN',
    hours: 40,
    order: 2,
    temas: [
      'Conoce funciones matemáticas convolucionales en datos de entrada (input) para analizar imágenes pixel por pixel, extrayendo características de los metadatos en sistemas de visión artificial en un enfoque colaborativo y con pensamiento lógico, fomentando la autonomía y el autoconocimiento.',
      'Enlista servicios de terceros (interfaces de programación de aplicaciones) en el análisis y generación de contenido audiovisual disponible en el mercado, integrando voz y datos en las aplicaciones de inteligencia artificial, considerando las necesidades específicas del cliente, trabajando en forma creativa, individual o colaborativa y fomentando el logro de metas.',
      'Genera contenido audiovisual en servicios de terceros, públicos y privados, con repositorios de visión artificial, cubriendo las necesidades específicas del cliente, trabajando en forma creativa, ética, responsable y fomentando la autonomía en el trabajo.',
    ],
    saberes: {
      saber: 'Submódulo 3: Soluciona problemas con visión artificial. Conoce funciones matemáticas convolucionales en datos de entrada (input) para analizar imágenes pixel por pixel, extrayendo características de los metadatos en sistemas de visión artificial en un enfoque colaborativo y con pensamiento lógico, fomentando la autonomía y el autoconocimiento.',
      saberSer:
        'Actúa con respeto a la diversidad, ética profesional, comunicación efectiva, responsabilidad y autonomía al desarrollar aplica técnicas de visión artificial empleando PLN.',
      saberHacer:
        'Conoce funciones matemáticas convolucionales en datos de entrada (input) para analizar imágenes pixel por pixel, extrayendo características de los metadatos en sistemas de visión artificial en un enfoque colaborativo y con pensamiento lógico, fomentando la autonomía y el autoconocimiento. Enlista servicios de terceros (interfaces de programación de aplicaciones) en el análisis y generación de contenido audiovisual disponible en el mercado, integrando voz y datos en las aplicaciones de inteligencia artificial, considerando las necesidades específicas del cliente, trabajando en forma creativa, individual o colaborativa y fomentando el logro de metas. Genera contenido audiovisual en servicios de terceros, públicos y privados, con repositorios de visión artificial, cubriendo las necesidades específicas del cliente, trabajando en forma creativa, ética, responsable y fomentando la autonomía en el trabajo.',
    },
  },
];

interface Row {
  id: string;
  uac_name: string;
  total_hours: number;
  activities: Activity[];
  contenidos_formativos: unknown;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function cleanSaberSer(value: string): string {
  return value.replace(/\.\.+$/, '.').replace(/\s+/g, ' ').trim();
}

function rebuildActivities(row: Row): Activity[] {
  if (row.id === IDS.hardware) return HARDWARE_ACTIVITIES;
  if (row.id === IDS.vision) return VISION_ACTIVITIES;
  if (row.id === IDS.redesConvergentes) {
    const first = row.activities.find((activity) => activity.order === 1)!;
    const fourth = row.activities.find((activity) => activity.order === 4)!;
    const firstHacer = SABER_HACER_OVERRIDES[`${row.id}:1`]!;
    const fourthHacer = SABER_HACER_OVERRIDES[`${row.id}:4`]!;
    return [
      {
        ...first,
        temas: splitSentences(firstHacer),
        saberes: { ...first.saberes, saberSer: cleanSaberSer(first.saberes.saberSer), saberHacer: firstHacer },
      },
      {
        name: 'Configura redes convergentes para la conectividad.',
        hours: 40,
        order: 2,
        temas: [
          'Configura las direcciones IP correspondientes en los dispositivos terminales de la red de forma manual, utilizando los protocolos de direccionamiento IPv4 e IPv6; considerando clases, rangos, máscara de subred y puerta de enlace; calculando las direcciones adecuadas conforme al mapeo de la red. Trabaja con responsabilidad, tomando decisiones con autonomía y de forma colaborativa, comunicándose asertivamente.',
          'Configura los dispositivos de interconexión y dispositivos IoT según el diseño de la red; asegurándose de brindar el rendimiento óptimo para dotar de seguridad lógica, utilizando elementos como contraseñas, redes inalámbricas ocultas o filtrado de direcciones MAC. Trabaja con responsabilidad, tomando decisiones con autonomía y de forma colaborativa, comunicándose asertivamente.',
          'Realiza pruebas de conectividad y de carga, verificando que los dispositivos se conecten a la red a la velocidad y la calidad adecuadas, trabajando en forma colaborativa para identificar y resolver problemas.',
          'Integra tecnologías de red (voz, datos, video, VoIP) en una sola infraestructura, utilizando herramientas de modelado de redes para simular diferentes escenarios; trabajando de manera colaborativa y manejando comandos en un segundo idioma.',
          'Crea redes virtuales privadas utilizando software, verificando su funcionamiento y conectividad; atendiendo normatividad empresarial e internacional vigentes; registrando la configuración y parámetros de las redes virtuales; actuando con responsabilidad y autonomía.',
        ],
        saberes: {
          saber: 'Submódulo 2: Administra redes convergentes para la conectividad. Configura las direcciones IP correspondientes en los dispositivos terminales de la red de forma manual, utilizando los protocolos de direccionamiento IPv4 e IPv6; considerando clases, rangos, máscara de subred y puerta de enlace; calculando las direcciones adecuadas conforme al mapeo de la red. Trabaja con responsabilidad, tomando decisiones con autonomía y de forma colaborativa, comunicándose asertivamente.',
          saberSer:
            'Actúa con respeto a la diversidad, ética profesional, comunicación efectiva, responsabilidad y autonomía al desarrollar configura redes convergentes para la conectividad.',
          saberHacer:
            'Configura las direcciones IP correspondientes en los dispositivos terminales de la red de forma manual, utilizando los protocolos de direccionamiento IPv4 e IPv6; considerando clases, rangos, máscara de subred y puerta de enlace; calculando las direcciones adecuadas conforme al mapeo de la red. Trabaja con responsabilidad, tomando decisiones con autonomía y de forma colaborativa, comunicándose asertivamente. Configura los dispositivos de interconexión y dispositivos IoT según el diseño de la red; asegurándose de brindar el rendimiento óptimo para dotar de seguridad lógica, utilizando elementos como contraseñas, redes inalámbricas ocultas o filtrado de direcciones MAC. Trabaja con responsabilidad, tomando decisiones con autonomía y de forma colaborativa, comunicándose asertivamente. Realiza pruebas de conectividad y de carga, verificando que los dispositivos se conecten a la red a la velocidad y la calidad adecuadas, trabajando en forma colaborativa para identificar y resolver problemas. Integra tecnologías de red (voz, datos, video, VoIP) en una sola infraestructura, utilizando herramientas de modelado de redes para simular diferentes escenarios; trabajando de manera colaborativa y manejando comandos en un segundo idioma. Crea redes virtuales privadas utilizando software, verificando su funcionamiento y conectividad; atendiendo normatividad empresarial e internacional vigentes; registrando la configuración y parámetros de las redes virtuales; actuando con responsabilidad y autonomía.',
        },
      },
      {
        ...fourth,
        order: 3,
        temas: splitSentences(fourthHacer),
        saberes: { ...fourth.saberes, saberSer: cleanSaberSer(fourth.saberes.saberSer), saberHacer: fourthHacer },
      },
    ];
  }

  return row.activities.map((activity) => {
    const saberHacer =
      SABER_HACER_OVERRIDES[`${row.id}:${activity.order}`] ?? activity.saberes.saberHacer;
    return {
      ...activity,
      hours: row.id === IDS.preventivo && activity.order === 3 ? 26 : activity.hours,
      temas: splitSentences(saberHacer),
      saberes: {
        ...activity.saberes,
        saberSer: cleanSaberSer(activity.saberes.saberSer),
        saberHacer,
      },
    };
  });
}

function mirrorContents(activities: Activity[]): unknown {
  return activities.map((activity) => ({
    order: activity.order,
    temas: activity.temas,
    saberes: activity.saberes,
    actividad: activity.name,
  }));
}

function validateRow(row: Row, activities: Activity[]): string[] {
  const errors: string[] = [];
  const forbidden = /X X X|Ensambla Prepara|Procedimiento de|^Configura$|^hardware y$|^Aplica técnicas de visión$|^artificial empleando PLN$/i;
  const dangling = /(?:^|\s)(?:y|de|del|el|la|los|las|con|para|en|al|por|un|una)\.?$/i;

  for (const activity of activities) {
    if (forbidden.test(activity.name)) errors.push(`Nombre anómalo: "${activity.name}"`);
    if (activity.temas.length === 0) errors.push(`Sin temas: "${activity.name}"`);
    if (!activity.saberes.saber || !activity.saberes.saberHacer || !activity.saberes.saberSer) {
      errors.push(`Saberes incompletos: "${activity.name}"`);
    }
    for (const tema of activity.temas) {
      if (dangling.test(tema)) errors.push(`Tema truncado en "${activity.name}": "${tema}"`);
    }
  }

  const hours = activities.reduce((total, activity) => total + activity.hours, 0);
  if (hours !== row.total_hours) {
    errors.push(`Horas ${hours} != total_hours ${row.total_hours}`);
  }

  return errors;
}

async function main(): Promise<void> {
  console.log(`=== REPARAR FILAS BT AN?MALAS (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  const ids = Object.values(IDS);
  const rows = (await sql`
    SELECT id, uac_name, total_hours, activities, contenidos_formativos
    FROM programs_catalog
    WHERE id = ANY(${ids}::uuid[])
    ORDER BY uac_name
  `) as unknown as Row[];

  if (rows.length !== ids.length) {
    console.error(`Se esperaban ${ids.length} filas y se encontraron ${rows.length}.`);
    process.exit(1);
  }

  const updates: Array<{ row: Row; activities: Activity[] }> = [];
  let hasErrors = false;

  for (const row of rows) {
    const activities = rebuildActivities(row);
    const errors = validateRow(row, activities);
    console.log(
      `\n- ${row.uac_name}: ${row.activities.length} -> ${activities.length} actividades, ` +
        `${activities.reduce((sum, a) => sum + a.hours, 0)} h`
    );
    if (errors.length > 0) {
      hasErrors = true;
      for (const error of errors) console.error(`  [ERROR] ${error}`);
    }
    updates.push({ row, activities });
  }

  if (hasErrors) {
    console.error('\nValidación fallida. No se aplicó nada.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDry-run: no se escribió nada. Ejecuta con --apply para reparar.');
    return;
  }

  const backup = `programs_catalog_backup_bt7_${Date.now()}`;
  await sql.query(`CREATE TABLE ${backup} AS SELECT * FROM programs_catalog`);
  console.log(`\nRespaldo creado: ${backup}`);

  for (const { row, activities } of updates) {
    const contents = mirrorContents(activities);
    await sql`
      UPDATE programs_catalog
      SET activities = ${JSON.stringify(activities)}::jsonb,
          contenidos_formativos = ${JSON.stringify(contents)}::jsonb
      WHERE id = ${row.id}
    `;
    console.log(`[OK] ${row.uac_name}`);
  }

  console.log(`\nReparadas ${updates.length} filas (7 solicitadas + 1 adicional).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
