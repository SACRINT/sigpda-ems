/**
 * generate-curriculum-knowledge-pages.ts — Genera/actualiza las páginas
 * curriculares de la Capa de Conocimiento a partir de `programs_catalog`.
 *
 * No usa IA: asigna cada UAC a una familia curricular, escribe el frontmatter
 * con `uac_slugs` y conserva el cuerpo editorial de las páginas existentes.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const WIKI_ROOT = join(process.cwd(), 'src', 'knowledge', 'wiki', 'curriculo');

interface CatalogRow {
  component: string;
  curriculum_name: string;
  uac_name: string;
}

interface NewPage {
  slug: string;
  titulo: string;
  fuente: string;
  enfoque: string;
  saberes: string;
  planeacion: string;
  comunidad: string;
}

const LABORAL_FAMILIES: Record<string, string> = {
  administracion: 'administracion-y-contabilidad',
  'administración': 'administracion-y-contabilidad',
  'administración emprendimientos': 'administracion-y-contabilidad',
  'administración de recursos humanos': 'administracion-y-contabilidad',
  contabilidad: 'administracion-y-contabilidad',
  logística: 'administracion-y-contabilidad',
  'salud integral y estilos de vida': 'salud-comunitaria',
  'área de la salud': 'salud-comunitaria',
  'mecánica dental': 'salud-comunitaria',
  'diseño gráfico digital': 'comunicacion-grafica',
  'comunicación gráfica': 'comunicacion-grafica',
  'preparación de alimentos y bebidas': 'alimentos-y-reposteria',
  'procesos culinarios y repostería': 'alimentos-y-reposteria',
  'preparación de alimentos artesanales': 'alimentos-y-reposteria',
  agroindustrias: 'alimentos-y-reposteria',
  'sistemas eléctricos': 'sistemas-electricos-y-domotica',
  domótica: 'sistemas-electricos-y-domotica',
  'refrigeración y aire acondicionado': 'sistemas-electricos-y-domotica',
  'fuentes alternas de energía': 'sistemas-electricos-y-domotica',
  electrónica: 'sistemas-electricos-y-domotica',
  mecatrónica: 'sistemas-electricos-y-domotica',
  'mantenimiento industrial': 'sistemas-electricos-y-domotica',
  'instrumentación industrial': 'sistemas-electricos-y-domotica',
  'mecánica naval': 'sistemas-electricos-y-domotica',
  agropecuario: 'agroecologia-y-recursos-naturales',
  'agricultura sostenible de traspatio': 'agroecologia-y-recursos-naturales',
  'recursos hídricos': 'agroecologia-y-recursos-naturales',
  'servicios ecosistémicos': 'agroecologia-y-recursos-naturales',
  biotecnología: 'agroecologia-y-recursos-naturales',
  turismo: 'turismo-y-hospitalidad',
  'servicios de hospedaje': 'turismo-y-hospitalidad',
  'recreaciones y servicios acuáticos': 'turismo-y-hospitalidad',
  programación: 'computacion-y-redes',
  'soporte y gestión de ti': 'computacion-y-redes',
  'inteligencia artificial': 'computacion-y-redes',
  ciberseguridad: 'computacion-y-redes',
  'redes y mantenimiento': 'computacion-y-redes',
  ofimática: 'computacion-y-redes',
  'tecnología informática': 'computacion-y-redes',
  'instalaciones residenciales': 'instalaciones-residenciales',
};

const FUNDAMENTAL_FAMILIES: Record<string, string> = {
  'to be, or not to be, that is the question (a1)': 'ingles',
  'once upon a time (a1-a2)': 'ingles',
  'a picture is worth a thousand words (a2)': 'ingles',
  'life is a journey, not a destination (a2+)': 'ingles',
  'pensamiento aritmético': 'pensamiento-matematico',
  'introducción al álgebra': 'pensamiento-matematico',
  'pensamiento algebraico e introducción a geometría plana': 'pensamiento-matematico',
  'trigonometría y geometría analítica': 'pensamiento-matematico',
  'cálculo diferencial': 'pensamiento-matematico',
  'pensamiento estadístico y probabilístico': 'pensamiento-matematico',
  'invitación a la ciencia': 'ciencias-naturales-interacciones',
  '¿qué es la vida? evolución y biodiversidad': 'ciencias-naturales-interacciones',
  'del átomo al universo': 'ciencias-naturales-interacciones',
  'el poder de la química': 'ciencias-naturales-interacciones',
  'el poder de la energía': 'ciencias-naturales-interacciones',
  'nuestro hogar': 'ciencias-naturales-interacciones',
  'estado, ciudadanía y relaciones de poder': 'ciencias-sociales',
  'organización, relaciones sociales y económicas': 'ciencias-sociales',
  'coordenadas de la historia': 'conciencia-historica',
  'la experiencia histórica': 'conciencia-historica',
  'navegar en el tiempo: investigaciones históricas': 'conciencia-historica',
  'libertad para imaginar, poder para comunicar': 'lengua-y-comunicacion',
  'leer y escribir para pensarnos juntos': 'lengua-y-comunicacion',
  'describir culturas, apropiarse de las palabras': 'lengua-y-comunicacion',
  'uso y difusión del conocimiento': 'humanidades',
  'el sentido de la vida': 'humanidades',
  'vivir aquí y ahora': 'humanidades',
  'estar juntos': 'humanidades',
  'las dinámicas de la realidad actual: la condición estudiantil': 'humanidades',
  'aprendizaje individual y colaborativo': 'humanidades',
  'ciudadanía digital': 'cultura-digital',
};

const FFE_FAMILIES: Record<string, string> = {
  'arte y cultura i': 'humanidades',
  'arte y cultura ii': 'humanidades',
  'comunicación y sociedad i': 'humanidades',
  'comunicación y sociedad ii': 'humanidades',
  'pensamiento filosófico i': 'humanidades',
  'pensamiento filosófico ii': 'humanidades',
  'raíces etimológicas del español i': 'humanidades',
  'raíces etimológicas del español ii': 'humanidades',
  'lógica y pensamiento crítico': 'humanidades',
  'experiencia estética': 'humanidades',
  'derecho y sociedad i': 'conciencia-historica',
  'derecho y sociedad ii': 'conciencia-historica',
  'análisis de fenómenos físicos i': 'ciencias-naturales-interacciones',
  'análisis de fenómenos físicos ii': 'ciencias-naturales-interacciones',
  'análisis de fenómenos y procesos biológicos': 'ciencias-naturales-interacciones',
  'organización del flujo de materia y energía en los organismos i': 'ciencias-naturales-interacciones',
  'organización del flujo de materia y energía en los organismos ii': 'ciencias-naturales-interacciones',
  'temas selectos de biología': 'ciencias-naturales-interacciones',
  'pensamiento matemático aplicado a las finanzas i': 'pensamiento-matematico',
  'pensamiento matemático aplicado a las finanzas ii': 'pensamiento-matematico',
  'taller de pensamiento variacional i': 'pensamiento-matematico',
  'taller de pensamiento variacional ii': 'pensamiento-matematico',
  'taller de probabilidad y estadística i': 'pensamiento-matematico',
  'taller de probabilidad y estadística ii': 'pensamiento-matematico',
  'fundamentos de administración i': 'administracion-y-contabilidad',
  'fundamentos de administración ii': 'administracion-y-contabilidad',
  'procesos contables i': 'administracion-y-contabilidad',
  'procesos contables ii': 'administracion-y-contabilidad',
  'economía i. la función de los agentes económicos en la sociedad': 'administracion-y-contabilidad',
  'economía ii. política económica y política pública mexicana': 'administracion-y-contabilidad',
  'salud integral i': 'salud-comunitaria',
  'salud integral ii': 'salud-comunitaria',
  'inglés v': 'ingles',
  'inglés vi': 'ingles',
  'dibujo técnico i': 'comunicacion-grafica',
  'dibujo técnico ii': 'comunicacion-grafica',
  'temas selectos de ciencias sociales i': 'ciencias-sociales',
  'temas selectos de ciencias sociales ii': 'ciencias-sociales',
  'psicología i': 'recursos-socioemocionales',
  'psicología ii': 'recursos-socioemocionales',
};

const FFEO_FAMILIES: Record<string, string> = {
  'pensamiento literario': 'humanidades',
  'taller de cultura digital i': 'cultura-digital',
  'laboratorio de investigación': 'ciencias-naturales-interacciones',
  'taller de ciencias i': 'ciencias-naturales-interacciones',
  'taller de ciencias ii.': 'ciencias-naturales-interacciones',
  'temas selectos de matemáticas i': 'pensamiento-matematico',
  'temas selectos de matemáticas ii': 'pensamiento-matematico',
  'espacio y sociedad': 'ciencias-sociales',
};

const NEW_PAGES: NewPage[] = [
  {
    slug: 'curriculo/humanidades',
    titulo: 'Humanidades — Pensamiento Crítico, Ética y Expresión Cultural',
    fuente: 'db:programs_catalog?familia=humanidades',
    enfoque:
      'Las Humanidades en el MCCEMS articulan la pregunta por el sentido de la vida, la convivencia, la memoria y la producción cultural con la formación de una ciudadanía crítica. La familia reúne las UAC de Humanidades I-III, Pensamiento Literario, Arte y Cultura, Comunicación y Sociedad, Pensamiento Filosófico, Raíces Etimológicas y Lógica y Pensamiento Crítico. Su centro es la interpretación de textos, imágenes y prácticas culturales para construir argumentos propios y reconocer la pluralidad de perspectivas.',
    saberes:
      'Los saberes conceptuales incluyen argumentación, falacias, géneros discursivos, estética, ética, derechos humanos y patrimonio cultural. El saber hacer se expresa en análisis de fuentes, ensayos, debates, lectura crítica, escritura académica y producción de narrativas comunitarias. El saber ser comprende empatía, escucha, respeto a la diferencia, responsabilidad intellectual y compromiso con la convivencia democrática.',
    planeacion:
      'La planeación debe partir de preguntas auténticas y textos breves situados en Puebla: crónicas locales, obras literarias, casos de discriminación, dilemas éticos o manifestaciones artísticas. Conviene combinar seminario socrático, análisis de fuentes, escritura procesual y presentaciones públicas. Las evidencias deben mostrar progresión conceptual y no solo opinión: tesis, evidencia, contraargumento y conclusión.',
    comunidad:
      'El vínculo comunitario se concreta en archivos de memoria barrial, revistas escolares, exposiciones, círculos de lectura intergeneracionales y campañas de derechos humanos. Estas acciones permiten que el PAEC recupere la palabra de estudiantes y familias, fortalezca la identidad local y traduzca el pensamiento humanista en participación pública.',
  },
  {
    slug: 'curriculo/cultura-digital',
    titulo: 'Cultura Digital — Ciudadanía, Datos y Creación Responsable',
    fuente: 'db:programs_catalog?familia=cultura-digital',
    enfoque:
      'Cultura Digital forma estudiantes capaces de usar, comprender y transformar tecnologías digitales sin perder autonomía, privacidad ni sentido crítico. La familia integra Ciudadanía Digital I-II y Taller de Cultura Digital, con énfasis en alfabetización digital, verificación de información, identidad digital, seguridad, colaboración en línea y creación de contenidos accesibles.',
    saberes:
      'El saber conceptual abarca arquitectura de internet, datos, algoritmos, derechos digitales, licencias, brecha digital y riesgos como desinformación, phishing o violencia en línea. El saber hacer incluye búsqueda avanzada, curación de fuentes, producción multimedia, uso de hojas de cálculo, colaboración en la nube y medidas básicas de ciberseguridad. El saber ser promueve netiqueta, empatía digital, pensamiento crítico y responsabilidad frente a la huella digital.',
    planeacion:
      'Las secuencias deben usar casos reales de la comunidad: noticias virales, cadenas de WhatsApp, formularios escolares, trámites o proyectos de difusión. Se recomienda combinar laboratorio, aprendizaje basado en proyectos y diseño de productos digitales con alternativas offline. La evaluación debe valorar la verificación de fuentes, la accesibilidad y la protección de datos, no la simple memorización de herramientas.',
    comunidad:
      'El PAEC puede beneficiarse con brigadas de alfabetización digital para familias, repositorios de recursos escolares, mapas digitales de servicios comunitarios y campañas contra la desinformación. El enfoque debe reducir la brecha digital y garantizar que la tecnología fortalezca la participación, no que excluya a quienes tienen conectividad limitada.',
  },
  {
    slug: 'curriculo/conciencia-historica',
    titulo: 'Conciencia Histórica — Fuentes, Tiempo y Ciudadanía',
    fuente: 'db:programs_catalog?familia=conciencia-historica',
    enfoque:
      'Conciencia Histórica desarrolla la capacidad de situar acontecimientos, reconocer causas y consecuencias, contrastar interpretaciones y comprender cómo las sociedades construyen memoria. La familia incluye Coordenadas de la Historia, La Experiencia Histórica, Navegar en el Tiempo y Derecho y Sociedad, con vínculos directos a la formación ciudadana y al análisis de las relaciones de poder.',
    saberes:
      'Los saberes conceptuales incluyen temporalidad, causalidad, cambio y continuidad, fuentes primarias y secundarias, historiografía, derechos y instituciones. El saber hacer comprende lectura de fuentes, elaboración de líneas de tiempo, formulación de preguntas históricas, análisis de evidencias y argumentación escrita. El saber ser implica pensamiento crítico, respeto a la memoria de las víctimas, empatía histórica y compromiso con la verdad y la justicia.',
    planeacion:
      'La planeación debe organizarse como investigación histórica: pregunta, corpus de fuentes, contextualización, interpretación y comunicación. Son pertinentes el análisis de archivos locales, entrevistas de historia oral, museos virtuales, juicios históricos y debates sobre derechos. Las evidencias deben distinguir hechos, interpretaciones y opiniones, y mostrar uso explícito de fuentes.',
    comunidad:
      'El vínculo comunitario puede concretarse en archivos de memoria, rutas patrimoniales, exposiciones sobre la historia del plantel o campañas de defensa de derechos. El PAEC encuentra aquí una oportunidad para recuperar la memoria colectiva, fortalecer la identidad local y formar ciudadanía informada frente a los problemas actuales.',
  },
  {
    slug: 'curriculo/recursos-socioemocionales',
    titulo: 'Recursos Socioemocionales — Bienestar, Salud y Convivencia',
    fuente: 'db:programs_catalog?familia=recursos-socioemocionales',
    enfoque:
      'Los Recursos Socioemocionales integran el currículum ampliado y las experiencias de bienestar que sostienen el aprendizaje: autoconocimiento, regulación emocional, empatía, colaboración, salud integral, educación sexual con perspectiva de género, actividad física y participación ciudadana. La familia reúne Actividades Artísticas y Culturales, Actividades Físicas y Deportivas, Educación Integral en Sexualidad y Género, Educación para la Salud, Práctica y Colaboración Ciudadana y Psicología.',
    saberes:
      'El saber conceptual incluye desarrollo adolescente, emociones, salud mental, nutrición, sexualidad, consentimiento, equidad de género, derechos y hábitos saludables. El saber hacer comprende rutinas de autorregulación, comunicación asertiva, resolución pacífica de conflictos, toma de decisiones informadas y prácticas de autocuidado. El saber ser se orienta a la empatía, el respeto, la inclusión, la responsabilidad afectiva y el rechazo a toda forma de violencia.',
    planeacion:
      'La planeación debe crear un clima seguro y participativo, con actividades breves, rutinas socioemocionales, estudios de caso, juegos cooperativos, simulaciones y proyectos de bienestar. Es fundamental evitar la exposición forzada de experiencias personales y ofrecer canales de apoyo. La evaluación debe centrarse en reflexión, hábitos y convivencia, no en la calificación de la intimidad de cada estudiante.',
    comunidad:
      'El PAEC puede articular ferias de salud, campañas de prevención, espacios seguros, actividades deportivas y artísticas, y acciones de corresponsabilidad familiar. El objetivo es que el bienestar se convierta en una condición institucional y comunitaria, no en una asignatura aislada.',
  },
  {
    slug: 'curriculo/administracion-y-contabilidad',
    titulo: 'Administración, Contabilidad y Logística — Gestión para la Vida Productiva',
    fuente: 'db:programs_catalog?familia=administracion-y-contabilidad',
    enfoque:
      'Esta familia prepara para comprender y operar organizaciones reales: micro, pequeñas y medianas empresas, cooperativas y áreas administrativas. Integra Administración, Administración de Emprendimientos, Administración de Recursos Humanos, Contabilidad, Logística, Fundamentos de Administración, Procesos Contables y Economía. El eje es la toma de decisiones con información financiera, humana y operativa.',
    saberes:
      'Los saberes conceptuales incluyen planeación estratégica, estructura organizacional, estados financieros, costos, presupuestos, nómina, inventarios, cadena de suministro y marco legal. El saber hacer comprende registrar operaciones, elaborar estados financieros, calcular costos, diseñar procesos, gestionar talento y planear rutas logísticas. El saber ser implica integridad, transparencia, responsabilidad fiscal, servicio y colaboración.',
    planeacion:
      'Las secuencias deben trabajar con casos y datos concretos: un negocio local, una cooperativa escolar o una necesidad del plantel. Son pertinentes simulaciones de empresa, elaboración de planes de negocio, presupuestos, auditorías sencillas y análisis de estados financieros. La evaluación debe valorar la coherencia numérica, la justificación de decisiones y la ética en el manejo de recursos.',
    comunidad:
      'El vínculo comunitario puede expresarse en asesorías a emprendimientos locales, ferias de economía social, educación financiera para familias y proyectos de mejora administrativa en el plantel. El PAEC puede encontrar aquí aliados para la sostenibilidad de sus acciones y para la formación de una cultura emprendedora responsable.',
  },
  {
    slug: 'curriculo/salud-comunitaria',
    titulo: 'Salud Comunitaria — Prevención, Cuidado y Bienestar Colectivo',
    fuente: 'db:programs_catalog?familia=salud-comunitaria',
    enfoque:
      'Salud Comunitaria forma para promover el bienestar individual y colectivo mediante prevención, educación y atención básica con pertinencia cultural. Integra Salud Integral y Estilos de Vida, Área de la Salud, Mecánica Dental y Salud Integral I-II, con una mirada que articula biología, entorno, determinantes sociales y derechos.',
    saberes:
      'Los saberes conceptuales incluyen anatomía y fisiología, microbiología, higiene, nutrición, salud bucal, primeros auxilios, epidemiología básica y promoción de la salud. El saber hacer comprende valoración inicial, medidas de bioseguridad, elaboración de materiales preventivos, registros clínicos básicos y acciones de educación para la salud. El saber ser promueve empatía, confidencialidad, ética del cuidado, respeto a la diversidad y responsabilidad comunitaria.',
    planeacion:
      'La planeación debe combinar laboratorio, simulación, estudios de caso y proyectos de intervención comunitaria. Son pertinentes ferias de salud, campañas de higiene, encuestas de factores de riesgo, talleres de primeros auxilios y materiales accesibles. La evaluación debe incluir desempeño procedimental seguro, comunicación con usuarios y pertinencia de las acciones preventivas.',
    comunidad:
      'El PAEC puede articular brigadas de prevención, diagnóstico participativo de salud, campañas de vacunación informativa, salud bucal y alimentación saludable. La escuela se convierte así en un nodo de cuidado que dialoga con centros de salud, familias y organizaciones locales.',
  },
  {
    slug: 'curriculo/comunicacion-grafica',
    titulo: 'Comunicación Gráfica — Lenguaje Visual, Diseño y Mensaje Público',
    fuente: 'db:programs_catalog?familia=comunicacion-grafica',
    enfoque:
      'Comunicación Gráfica articula diseño, dibujo técnico y comunicación visual para construir mensajes claros, estéticos y accesibles. Integra Diseño Gráfico Digital, Comunicación Gráfica y Dibujo Técnico I-II, con énfasis en composición, tipografía, color, imagen, señalización y comunicación de causas públicas.',
    saberes:
      'Los saberes conceptuales incluyen teoría del color, retícula, jerarquía visual, tipografía, semiótica, formatos, vectores, mapas de bits, normas de señalización y accesibilidad. El saber hacer comprende bocetos, dibujo técnico, edición digital, creación de carteles, infografías, identidades visuales y prototipos. El saber ser implica sensibilidad estética, rigor, escucha del Brief, ética de la imagen y responsabilidad sobre los mensajes que se difunden.',
    planeacion:
      'La planeación debe trabajar con encargos reales: campañas del plantel, señalización, materiales del PAEC, infografías de derechos o identidades de proyectos comunitarios. Son pertinentes el design thinking, la crítica entre pares, la iteración de prototipos y la documentación del proceso. La evaluación debe valorar claridad del mensaje, pertinencia cultural, accesibilidad y calidad técnica.',
    comunidad:
      'El vínculo comunitario se concreta en identidades visuales para organizaciones locales, campañas de salud o medio ambiente, señalización escolar accesible y materiales de difusión pública. El diseño se convierte en una herramienta de participación y no solo en un ejercicio decorativo.',
  },
  {
    slug: 'curriculo/alimentos-y-reposteria',
    titulo: 'Alimentos y Repostería — Técnica, Inocuidad y Cultura Gastronómica',
    fuente: 'db:programs_catalog?familia=alimentos-y-reposteria',
    enfoque:
      'Alimentos y Repostería integra Preparación de Alimentos y Bebidas, Procesos Culinarios y Repostería, Preparación de Alimentos Artesanales y Agroindustrias. Su propósito es formar para la producción, transformación y servicio de alimentos con calidad, inocuidad, aprovechamiento local y conciencia nutricional.',
    saberes:
      'Los saberes conceptuales incluyen técnicas de corte, métodos de cocción, conservación, fermentación, repostería, análisis sensorial, HACCP, nutrición y costeo. El saber hacer comprende mise en place, ejecución de recetas, control de temperaturas, empaque, presentación y cálculo de rendimientos. El saber ser implica higiene rigurosa, trabajo en equipo, creatividad, respeto a la diversidad alimentaria y responsabilidad ambiental.',
    planeacion:
      'La planeación debe privilegiar prácticas de laboratorio con estándares de seguridad, recetas escaladas, análisis de costos y aprovechamiento de productos locales. Son pertinentes estudios de caso de brotes alimentarios, diseño de menús saludables, ferias gastronómicas y proyectos de conservación. La evaluación debe incluir inocuidad, técnica, presentación y viabilidad económica.',
    comunidad:
      'El PAEC puede vincularse con productores locales, mercados, cooperativas y ferias de alimentación saludable. La escuela puede recuperar recetas tradicionales, reducir desperdicios y promover una cultura alimentaria que valore la salud, la identidad y la sostenibilidad.',
  },
  {
    slug: 'curriculo/sistemas-electricos-y-domotica',
    titulo: 'Sistemas Eléctricos, Domótica y Mantenimiento — Energía y Automatización',
    fuente: 'db:programs_catalog?familia=sistemas-electricos-y-domotica',
    enfoque:
      'Esta familia integra Sistemas Eléctricos, Domótica, Refrigeración y Aire Acondicionado, Fuentes Alternas de Energía, Electrónica, Mecatrónica, Mantenimiento Industrial, Instrumentación Industrial y Mecánica Naval. Forma para instalar, operar, diagnosticar y mantener sistemas eléctricos, electrónicos y automatizados con seguridad y eficiencia energética.',
    saberes:
      'Los saberes conceptuales incluyen circuitos, leyes eléctricas, magnitudes, sensores, actuadores, controladores, PLC, refrigeración, energías renovables, lectura de planos y normatividad. El saber hacer comprende medición con multímetro, armado de tableros, cableado, configuración de dispositivos, diagnóstico de fallas y mantenimiento preventivo. El saber ser implica seguridad, autocuidado, trabajo colaborativo, ética profesional y cuidado del ambiente.',
    planeacion:
      'La planeación debe ser predominantemente práctica y segura: talleres, simulaciones, mediciones, armado de circuitos, programación de controladores y mantenimiento de equipos. Son pertinentes el análisis de fallas, la eficiencia energética y la documentación técnica. La evaluación debe valorar procedimiento, seguridad, diagnóstico y funcionamiento verificable.',
    comunidad:
      'El PAEC puede articular diagnósticos energéticos, mantenimiento de equipos escolares, instalación de soluciones domóticas accesibles y proyectos de eficiencia energética. La comunidad gana capacidades técnicas y la escuela reduce consumos y riesgos.',
  },
  {
    slug: 'curriculo/agroecologia-y-recursos-naturales',
    titulo: 'Agroecología y Recursos Naturales — Producción Sustentable y Territorio',
    fuente: 'db:programs_catalog?familia=agroecologia-y-recursos-naturales',
    enfoque:
      'Agroecología y Recursos Naturales integra Agropecuario, Agricultura Sostenible de Traspatio, Recursos Hídricos, Servicios Ecosistémicos y Biotecnología. Forma para producir y conservar el territorio con base científica, saberes locales y criterios de sostenibilidad, biodiversidad y soberanía alimentaria.',
    saberes:
      'Los saberes conceptuales incluyen suelo, agua, clima, ciclos biogeoquímicos, biodiversidad, agroecología, biotecnología, riego y manejo de residuos. El saber hacer comprende diagnóstico de suelo y agua, compostaje, propagación, manejo integrado de plagas, captación de agua y monitoreo de ecosistemas. El saber ser promueve respeto a la naturaleza, responsabilidad intergeneracional, trabajo comunitario y valoración de los saberes campesinos.',
    planeacion:
      'La planeación debe combinar salidas de campo, laboratorio, vivero, parcelas escolares y análisis de datos locales. Son pertinentes proyectos de compostaje, captación de agua, huertos, restauración de áreas verdes y estudios de biodiversidad. La evaluación debe valorar observación, registro, pertinencia técnica y sostenibilidad de las prácticas.',
    comunidad:
      'El PAEC puede articular huertos comunitarios, recuperación de suelos, cuidado del agua, reforestación y ferias de productos locales. La escuela se convierte en un laboratorio vivo de sostenibilidad y en un puente entre ciencia, territorio y saberes comunitarios.',
  },
  {
    slug: 'curriculo/turismo-y-hospitalidad',
    titulo: 'Turismo y Hospitalidad — Servicio, Cultura y Desarrollo Local',
    fuente: 'db:programs_catalog?familia=turismo-y-hospitalidad',
    enfoque:
      'Turismo y Hospitalidad integra Turismo, Servicios de Hospedaje y Recreaciones y Servicios Acuáticos. Forma para ofrecer experiencias seguras, inclusivas y de calidad, valorando el patrimonio natural y cultural de Puebla, la atención al visitante y la sostenibilidad de los destinos.',
    saberes:
      'Los saberes conceptuales incluyen patrimonio, rutas turísticas, tipos de hospedaje, reservaciones, atención al cliente, eventos, seguridad acuática, primeros auxilios y normatividad. El saber hacer comprende diseño de experiencias, protocolos de servicio, gestión de reservas, montaje de eventos, guianza y evaluación de satisfacción. El saber ser implica calidez, empatía, ética, respeto cultural, cuidado ambiental y trabajo colaborativo.',
    planeacion:
      'La planeación debe usar simulaciones de servicio, estudios de caso, recorridos locales, diseño de paquetes y protocolos de seguridad. Son pertinentes el análisis de destinos, la atención a personas con discapacidad y la evaluación de impactos. La evaluación debe valorar trato al cliente, resolución de problemas, seguridad y pertinencia cultural.',
    comunidad:
      'El PAEC puede vincularse con rutas turísticas escolares, ferias culturales, capacitación a prestadores locales y promoción responsable del patrimonio. El turismo se entiende como una oportunidad de desarrollo local que debe proteger la cultura, el ambiente y la dignidad de las comunidades.',
  },
];

function normalizeForLookup(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeMap(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [normalizeForLookup(key), value]));
}

const LABORAL_LOOKUP = normalizeMap(LABORAL_FAMILIES);
const FUNDAMENTAL_LOOKUP = normalizeMap(FUNDAMENTAL_FAMILIES);
const FFE_LOOKUP = normalizeMap(FFE_FAMILIES);
const FFEO_LOOKUP = normalizeMap(FFEO_FAMILIES);

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pageForRow(row: CatalogRow): string | null {
  const name = normalizeForLookup(row.uac_name);
  const curriculum = normalizeForLookup(row.curriculum_name);

  if (row.component === 'laboral') return LABORAL_LOOKUP[curriculum] ?? null;
  if (row.component === 'fundamental') return FUNDAMENTAL_LOOKUP[curriculum] ?? null;
  if (row.component === 'ffe_optativa') return FFE_LOOKUP[name] ?? null;
  if (row.component === 'ffeo') return FFEO_LOOKUP[name] ?? null;
  if (row.component === 'ampliado') return 'recursos-socioemocionales';
  return null;
}

function bodyForPage(page: NewPage, uacSlugs: string[]): string {
  return `# ${page.titulo}

> Fuente: ${page.fuente}. Cobertura: ${uacSlugs.length} UAC del mapa curricular oficial.

## Enfoque de la familia
${page.enfoque}

## Saberes y progresiones
${page.saberes}

## Implicaciones para la planeación
${page.planeacion}

## Vinculación comunitaria y PAEC
${page.comunidad}
`;
}

function frontmatterForPage(page: NewPage, uacSlugs: string[]): string {
  return `---
slug: ${page.slug}
titulo: "${page.titulo.replace(/"/g, '\\"')}"
dominio: curricular
applicable_a: [planeacion, editorial, paec]
status: published
uac_slugs: [${uacSlugs.join(', ')}]
model: deterministic-curriculum-v1
prompt_version: curriculo-v1
fuentes_referencia:
  - ruta: "${page.fuente}"
---
`;
}

async function main(): Promise<void> {
  const rows = (await sql`
    SELECT component, curriculum_name, uac_name
    FROM programs_catalog
    ORDER BY component, curriculum_name, uac_name
  `) as unknown as CatalogRow[];

  const slugsByPage = new Map<string, Set<string>>();
  const unassigned: string[] = [];

  for (const row of rows) {
    const page = pageForRow(row);
    if (!page) {
      unassigned.push(`${row.component} | ${row.curriculum_name} | ${row.uac_name}`);
      continue;
    }
    const set = slugsByPage.get(page) ?? new Set<string>();
    set.add(slugify(row.uac_name));
    slugsByPage.set(page, set);
  }

  if (unassigned.length > 0) {
    console.error('UAC sin asignar:', unassigned);
    process.exit(1);
  }

  let written = 0;
  for (const page of NEW_PAGES) {
    const slugs = [...(slugsByPage.get(page.slug.replace('curriculo/', '')) ?? new Set<string>())].sort();
    if (slugs.length === 0) {
      console.error(`Sin UAC para ${page.slug}`);
      process.exit(1);
    }
    const content = `${frontmatterForPage(page, slugs)}\n${bodyForPage(page, slugs)}`;
    writeFileSync(join(WIKI_ROOT, `${page.slug.replace('curriculo/', '')}.md`), content, 'utf8');
    written++;
  }

  const existingPages = [
    'ciencias-naturales-interacciones',
    'ciencias-sociales',
    'computacion-y-redes',
    'ingles',
    'instalaciones-residenciales',
    'lengua-y-comunicacion',
    'pensamiento-matematico',
  ];

  for (const page of existingPages) {
    const filePath = join(WIKI_ROOT, `${page}.md`);
    if (!existsSync(filePath)) {
      console.error(`No existe ${filePath}`);
      process.exit(1);
    }
    const raw = readFileSync(filePath, 'utf8');
    const slugs = [...(slugsByPage.get(page) ?? new Set<string>())].sort();
    if (slugs.length === 0) {
      console.error(`Sin UAC para página existente ${page}`);
      process.exit(1);
    }
    if (!/^uac_slugs:\s*.*$/m.test(raw)) {
      console.error(`Sin línea uac_slugs en ${page}`);
      process.exit(1);
    }
    const next = raw.replace(/^uac_slugs:\s*.*$/m, `uac_slugs: [${slugs.join(', ')}]`);
    writeFileSync(filePath, next, 'utf8');
  }

  let covered = 0;
  for (const page of NEW_PAGES) {
    const key = page.slug.replace('curriculo/', '');
    covered += (slugsByPage.get(key)?.size ?? 0);
  }
  for (const page of existingPages) covered += slugsByPage.get(page)?.size ?? 0;

  console.log(
    JSON.stringify(
      {
        catalogRows: rows.length,
        newPagesWritten: written,
        existingPagesUpdated: existingPages.length,
        uniqueSlugsCovered: covered,
        pages: Object.fromEntries(
          [...slugsByPage.entries()].map(([page, slugs]) => [page, slugs.size])
        ),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
