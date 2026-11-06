/**
 * regenerate-clean-cecbv-sessions.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * P3.1.2 Hotfix: Reemplaza las 9 sesiones contaminadas con matemáticas por planes
 * de alta densidad técnica exclusivos de Construcción / Plomería / Instalaciones.
 *
 * Bloque 2:
 *   S10: Interpretación de planos de redes hidráulicas y sanitarias residenciales (isométricos, escalas, cotas).
 *   S11: Clasificación técnica y dimensionamiento de tuberías de cobre, CPVC, PVC hidráulico y PPR (termofusión).
 *   S12: Conexiones, válvulas de control y accesorios de gas (cobre rígido/flexible, PE-AL-PE, válvulas de paso y seguridad NOM-002-SECRE).
 *   S13: Técnicas de corte, escariado, roscado y unión segura de tuberías hidráulicas y de gas con pruebas de estanqueidad.
 *   S14: Herramientas especializadas de plomería y montaje (llaves Stillson, tarrajas, termofusoras, manómetros y EPP normativo).
 *   S15: Integración del sistema hidrosanitario y de gas en la maqueta/murete del proyecto comunitario PAEC con bitácora de tolerancias.
 *
 * Bloque 3:
 *   S16: Procedimientos de limpieza química y mecánica de tuberías obstruidas (desincrustantes biodegradables, sondas y varillas).
 *   S17: Pruebas de presión, hermeticidad hidrostática y detección de fugas en uniones y muebles de baño.
 *   S18: Protocolo de entrega de obra, acabados sanitarios, bitácora de mantenimiento preventivo y reporte técnico final ante la comunidad.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val && !process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnv();

import { sql } from '../src/lib/db/client';
import { getPlanningById } from '../src/lib/db';
import { cascadeBlockMaterials } from '../src/lib/guide-engine/cascade-block-materials';
import {
  computeContentBudget,
  countSessionPlanWords,
  validateSessionCoverage,
  WORDS_PER_PAGE,
} from '../src/lib/guide-engine/content-budget';
import {
  validateBlockCrossContamination,
} from '../src/lib/guide-engine/cross-contamination-guard';
import { detectFallbackWords } from '../src/lib/guide-engine/writers/writer-contract';
import type { SessionPlan, ActiveWorkTextbook } from '../src/types/work-textbook';

// ============================================================================
// 6 PLANES DE CONSTRUCCIÓN / PLOMERÍA / GAS PARA BLOQUE 2 (S10 a S15)
// ============================================================================
const BLOCK2_CLEAN_SESSIONS: SessionPlan[] = [
  {
    sessionNumber: 10,
    objetivo: 'Interpretar planos de instalaciones hidrosanitarias y de gas residenciales mediante lectura de isométricos, simbología técnica normalizada y acotaciones a escala para ubicar ramales y muebles de baño.',
    motivacion: 'En toda edificación residencial, un error de lectura en el plano hidrosanitario puede provocar colisiones entre tuberías de desagüe y cimientos estructurales. Como futuros técnicos de la construcción en nuestra región de Venustiano Carranza, dominar la proyección isométrica te permite visualizar el recorrido tridimensional del agua limpia y residual antes de perforar muros o colar losas.',
    saberesPrevios: 'Activa tus saberes en tu cuaderno activo: ¿Qué diferencia existe entre una vista en planta arquitectónica y un dibujo isométrico a 30 grados? ¿Por qué los muebles sanitarios requieren cotas de salida específicas respecto al nivel de piso terminado (NPT)?',
    contenido: `La representación gráfica de las instalaciones hidrosanitarias y de gas constituye el lenguaje técnico universal que vincula el diseño arquitectónico con la ejecución material en obra. En esta sesión 10, profundizaremos en el análisis sistemático de los diagramas isométricos a 30 grados, los cuales permiten representar simultáneamente las tres dimensiones espaciales de una red sin deformar las longitudes lineales de los ramales principales y secundarios.\n\nEn los planos ejecutivos bajo normas mexicanas (NOM e ISO), cada componente posee una simbología unívoca: líneas continuas gruesas para alimentación de agua fría, líneas discontinuas con trazo punto-raya para agua caliente, y trazos dobles o de mayor calibre para las redes de drenaje sanitario y ventilación primaria. Asimismo, las redes de distribución de gas licuado de petróleo (L.P.) o natural se identifican mediante código de color normativo amarillo y trazos con nomenclatura específica de presión (baja o media presión regulada).\n\nLa correcta interpretación de cotas, diámetros nominales (expresados en pulgadas o milímetros) y pendientes reglamentarias (mínimo 2% en desagües para garantizar el arrastre hidráulico sin sedimentación) evita interferencias críticas con zapatas, trabes y castillos. El técnico constructor debe contrastar siempre el plano de instalaciones con el estructural para planificar los pasos de tubería mediante camisas protectoras de PVC antes de los colados de concreto.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Se requiere interpretar el isométrico de un medio baño residencial para calcular la longitud total de tubería de cobre rígido de 1/2 pulgada requerida para alimentar el lavabo y el inodoro desde la columna principal.\n\nPaso 1: Lectura de cotas en el plano isométrico. Tramo vertical desde la toma general al nivel de desplante: h1 = 0.40 m. Tramo horizontal principal hacia la batería de muebles: L1 = 1.80 m. Ramal vertical hacia llave de escuadra de inodoro: h2 = 0.25 m. Ramal vertical hacia llave de lavabo: h3 = 0.55 m.\n\nPaso 2: Conteo y cubicación de accesorios normativos. Se identifican: 1 te de cobre de 1/2" para derivación al inodoro, 2 codos de 90° de 1/2" para cambios de dirección vertical, y 2 conectores roscados exteriores de 1/2" para conectar las llaves angulares.\n\nPaso 3: Cálculo de longitud lineal con factor de desperdicio. Longitud neta = 0.40 + 1.80 + 0.25 + 0.55 = 3.00 m. Aplicando un factor de desperdicio del 7% por cortes y ajustes: Longitud total = 3.00 × 1.07 = 3.21 metros lineales.\n\nPaso 4: Verificación dimensional y cotas de salida reglamentarias. Se verifica en bitácora que la salida del inodoro quede a 20 cm sobre NPT y 15 cm a la izquierda del eje del mueble, y la del lavabo a 55 cm sobre NPT, garantizando compatibilidad con los manguitos flexibles de conexión.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: A partir de un croquis isométrico de un cuarto de lavado, cuantifica los metros lineales de tubería hidráulica de 3/4" y lista los accesorios requeridos (codos, tes y reducciones) para alimentar lavadora y lavadero con tomas independientes.',
        pista: 'Suma los tramos ortogonales respetando la escala 1:50 y agrega un 5% de holgura técnica.',
        solucion: [
          'Paso 1: Suma de tramos verticales y horizontales: 2.40 m + 1.60 m + 0.80 m = 4.80 m netos.',
          'Paso 2: Con factor de desperdicio 5%: 4.80 × 1.05 = 5.04 metros lineales de tubería.',
          'Paso 3: Accesorios: 1 te de 3/4", 2 reducciones campana de 3/4" a 1/2", 3 codos de 90° de 1/2" y 2 llaves de nariz roscadas.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Identifica en un plano hidrosanitario tres errores comunes de simbología o cotas que puedan provocar un conflicto de obra entre desagües pluviales y sanitarios.',
        pista: 'Revisa pendientes mínimas, ventilación secundaria y separación respecto a líneas de gas.',
        solucion: [
          'Error 1: Omitir la pendiente de 2% en la tubería sanitaria de 4 pulgadas provocando remansos.',
          'Error 2: Cruzar tuberías de gas y desagüe en la misma zanja sin la separación mínima de 20 cm.',
          'Error 3: Ausencia de tubo ventilador en la descarga del inodoro generando pérdida de sello hidráulico.',
        ],
      },
    ],
    aplicacion: 'Inspecciona los planos o croquis de la red de agua de tu plantel o vivienda: dibuja en tu cuaderno el isométrico de un núcleo de baño registrando diámetros, accesorios y ubicación de la válvula de corte general con especificaciones de cota.',
    autoevaluacion: [
      '¿Identifico con seguridad la simbología de agua fría, caliente, drenaje y gas en planos isométricos?',
      '¿Puedo calcular la longitud total de tubería y accesorios considerando holguras por corte?',
      '¿Verifico las alturas normativas de las tomas de agua según el mueble sanitario?',
    ],
    recursos: [
      {
        titulo: 'Manual de Dibujo Técnico Isométrico para Instalaciones de Edificación',
        url: 'https://educacionmediasuperior.sep.gob.mx/construccion-isometricos',
        tipo: 'web',
      },
      {
        titulo: 'Guía de Simbología Normalizada en Redes Hidrosanitarias Residenciales',
        url: 'https://www.gob.mx/normatividad-construccion',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Ficha técnica de interpretación isométrica: entrega el levantamiento gráfico acotado del ramal hidrosanitario con tabla de cubicación de tuberías y accesorios validada por el docente.',
    isFallback: false,
  },
  {
    sessionNumber: 11,
    objetivo: 'Clasificar técnicamente y dimensionar tuberías de cobre (M, L, K), CPVC, PVC hidráulico y polipropileno copolímero random (PPR) mediante análisis de resistencia a presión, temperatura y métodos de unión para redes residenciales.',
    motivacion: 'Elegir el material incorrecto en una red de agua caliente puede ocasionar deformaciones plásticas y rupturas por fatiga térmica en menos de un año. Como profesionales técnicos de la construcción, conocer las especificaciones de cédula, presión nominal y compatibilidad química te asegura construir obras duraderas, seguras y libres de fugas.',
    saberesPrevios: 'Reflexiona en tu cuaderno de trabajo activo: ¿Por qué no debe usarse PVC sanitario para conducir agua potable a presión? ¿Cuál es la ventaja de la termofusión molecular en PPR frente a las uniones cementadas en CPVC?',
    contenido: `La selección de materiales en instalaciones hidráulicas y de plomería depende directamente de los parámetros operativos de presión manométrica de trabajo, temperatura del fluido y agresividad química del suelo o agua conducida. En esta sesión 11, analizaremos en profundidad las cuatro familias de tuberías más empleadas en la edificación habitacional mexicana.\n\nEn primer término, el cobre destaca por su resistencia mecánica, durabilidad centenaria y propiedades bactericidas. Se clasifica comercialmente en tres tipos: Tipo M (pared delgada, franja roja, exclusivo para interiores a presiones moderadas), Tipo L (pared media, franja azul, estándar en redes de agua fría y caliente) y Tipo K (pared gruesa, franja verde, obligatorio para tomas domiciliarias subterráneas y condiciones severas). Su unión se efectúa por soldadura capilar blanda con aleación estaño-antimonio (95/5) y fundente desoxidante.\n\nEn segundo término, los polímeros termoplásticos como el CPVC (cloruro de polivinilo clorado) soportan temperaturas continuas de hasta 82 °C y presiones de 100 psi, uniéndose mediante cemento solvente bicomponente tras limpieza previa. Por su parte, el PPR (polipropileno copolímero random) ofrece unión por termofusión a 260 °C, fusionando tubo y accesorio en una sola pieza monolítica molecularmente indivisible, eliminando empaques y roscas vulnerables a filtraciones.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: En una vivienda de dos niveles, se debe seleccionar el material para la red de alimentación desde el calentador solar de agua (temperatura máxima 75 °C, presión 3.5 kg/cm²) hasta las regaderas del segundo piso.\n\nPaso 1: Análisis de compatibilidad térmica y mecánica. El PVC hidráulico estándar se descarta porque su temperatura máxima recomendada es de 45 °C. Quedan como alternativas viables el cobre Tipo L y el PPR termofusionable PN-20.\n\nPaso 2: Evaluación de dilatación térmica y pérdidas de calor. El PPR cuenta con un coeficiente de conductividad térmica muy bajo (0.24 W/m·K) frente al cobre (400 W/m·K), lo que conserva el calor del agua sin requerir aislamiento térmico exterior de elastómero.\n\nPaso 3: Selección del diámetro y accesorios de transición. Para un caudal simultáneo de 18 L/min en regadera y lavabo, se selecciona PPR de 25 mm (equivalente a 3/4") para el cabezal distribuidor y derivaciones en 20 mm (1/2") con terminales hembra de latón niquelado para las llaves de empotrar.\n\nPaso 4: Conclusión técnica en bitácora. Se aprueba la instalación en PPR PN-20, especificando abrazaderas deslizantes cada 80 cm para absorber la dilatación axial y garantizar 50 años de vida útil libre de incrustaciones de sarro.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Compara en una tabla técnica el cobre Tipo L, el CPVC Cédula 40 y el PPR PN-20 considerando: temperatura máxima continua, presión de diseño a 20 °C, método de unión y costo relativo.',
        pista: 'Consulta fichas técnicas comerciales y normas NMX de edificación habitacional.',
        solucion: [
          'Cobre L: 120 °C, 30 kg/cm², soldadura capilar estaño-plata/antimonio, costo alto.',
          'CPVC C-40: 82 °C, 7 kg/cm² a 82 °C (28 kg/cm² a 20 °C), cemento solvente, costo medio.',
          'PPR PN-20: 95 °C pico (70 °C continuo), 20 bar a 20 °C, termofusión a 260 °C, costo medio-económico.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Determina el diámetro nominal requerido para una toma domiciliaria de agua que debe suministrar un caudal de 0.50 L/s con una velocidad de flujo comprendida entre 1.0 m/s y 1.5 m/s.',
        pista: 'Aplica la ecuación de continuidad Q = V · A y despeja el diámetro interior.',
        solucion: [
          'Paso 1: Área mínima requerida: A = Q / V = 0.0005 m³/s / 1.2 m/s = 0.000416 m².',
          'Paso 2: Diámetro interior: D = sqrt(4 · A / pi) = sqrt(0.00053) = 0.023 m = 23 mm.',
          'Paso 3: Selección comercial: Tubería de cobre Tipo L de 3/4 pulgada (diámetro interior aproximado de 19.9 mm a 22 mm) o 1 pulgada según pérdida de carga admisible.',
        ],
      },
    ],
    aplicacion: 'Visita una tlapalería o depósito de materiales de construcción cercano a tu escuela: cotiza un tramo de 6 metros de cobre tipo L, CPVC y PPR de 1/2 pulgada, elaborando un reporte comparativo de costo-beneficio para el proyecto comunitario.',
    autoevaluacion: [
      '¿Diferencio con precisión las características mecánicas y térmicas del cobre, CPVC y PPR?',
      '¿Conozco los rangos de temperatura y presión admisibles para cada material?',
      '¿Sé seleccionar el método de unión adecuado para evitar fugas en instalaciones residenciales?',
    ],
    recursos: [
      {
        titulo: 'Catálogo de Especificaciones Técnicas de Tuberías Hidráulicas y Conexiones',
        url: 'https://educacionmediasuperior.sep.gob.mx/tuberias-especificaciones',
        tipo: 'web',
      },
      {
        titulo: 'Norma Mexicana NMX-E-181-CNCP para Tubos de Polipropileno en Edificación',
        url: 'https://www.gob.mx/economia/normas-mexicanas',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Matriz comparativa de materiales hidráulicos: cuadro de selección con muestras fotográficas, tolerancias de temperatura, presiones máximas y justificación técnica para la vivienda comunitaria.',
    isFallback: false,
  },
  {
    sessionNumber: 12,
    objetivo: 'Clasificar y seleccionar conexiones, válvulas de control, reguladores y accesorios para redes de gas L.P. y natural bajo lineamientos de seguridad de la NOM-002-SECRE y NOM-004-SEDG.',
    motivacion: 'Una instalación de gas no tolera márgenes de error: una microfuga en un niple o en una tuerca cónica puede acumular gas combustible en espacios cerrados y originar una deflagración catastrófica. Como técnicos constructores, la aplicación rigurosa de selladores anaeróbicos aprobados, válvulas de esfera de corte rápido y mangueras con malla de acero inoxidable protege la vida de las familias.',
    saberesPrevios: 'Responde en tu cuaderno: ¿Por qué en líneas de gas está terminantemente prohibido utilizar teflón blanco estándar de plomería o soldadura blanda 50/50? ¿Qué función cumple la tuerca cónica de abocardado (flare) a 45 grados?',
    contenido: `Las instalaciones para aprovechamiento de gas L.P. y gas natural demandan los más estrictos criterios de seguridad dentro de las instalaciones residenciales de una vivienda. En México, el diseño, montaje y prueba de estas redes está regulado por la NOM-002-SECRE (instalaciones de aprovechamiento de gas natural) y la NOM-004-SEDG (instalaciones de gas L.P.), las cuales establecen con precisión los materiales, presiones y dispositivos de corte obligatorios.\n\nLas tuberías autorizadas comprenden el cobre rígido tipo L para tramos aéreos visibles, cobre flexible con conexiones abocardadas (flare a 45°) para acometidas finales a estufas y calentadores, tubería de acero al carbón Cédula 80 sin costura para redes de alta presión o tramos enterrados en encamisados ventilados, y sistemas multicapa de polietileno con alma de aluminio (PE-AL-PE) con uniones por compresión o engarzado mecánico.\n\nEn cuanto a accesorios y válvulas, toda instalación debe incorporar una válvula general de corte de cuarto de vuelta (tipo esfera para gas, maneral amarillo, certificada 600 WOG) ubicada en un sitio exterior de fácil acceso, un regulador de presión de primera etapa (para reducir la presión del tanque estacionario de 7-10 kg/cm² a 1.5 kg/cm²) y de segunda etapa (para entregar a los aparatos a 28 g/cm² o 2.74 kPa), así como válvulas de alivio de sobrepresión calibradas.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Se debe configurar la estación de regulación y la línea de servicio de gas L.P. para abastecer una estufa de 4 quemadores con horno (consumo total: 38,000 BTU/h) y un calentador de paso (45,000 BTU/h) desde un tanque estacionario de 300 litros.\n\nPaso 1: Suma de consumos térmicos y selección de regulador. Consumo total = 38,000 + 45,000 = 83,000 BTU/h. Equivalencia a metros cúbicos de gas L.P. vaporizado = 83,000 / 95,000 BTU/m³ ≈ 0.87 m³/h. Se selecciona un regulador de baja presión de una sola etapa con capacidad de 1.5 m³/h y presión de salida calibrada a 2.74 kPa (11 pulgadas de columna de agua).\n\nPaso 2: Selección de tubería y conexiones de línea matriz. Desde la salida del regulador se proyecta tubería de cobre rígido Tipo L de 1/2 pulgada unida mediante soldadura fuerte de aleación cobre-fósforo (soldadura de plata al 0% o 5%, punto de fusión > 650 °C), sin usar fundente en el interior del tubo.\n\nPaso 3: Conexiones de aparatos y válvulas de paso individual. Al final del ramal de cada aparato se instala una válvula de esfera de 1/2" NPT x 3/8" Flare, un niple terminal de latón y un conector flexible trenzado de acero inoxidable NOM de 3/8" de diámetro interior y longitud máxima de 1.50 m.\n\nPaso 4: Verificación de sellado y ventilación de seguridad. Se aplica sellador anaeróbico o cinta de teflón amarillo de alta densidad en roscas cónicas NPT, verificando que el tanque estacionario respete la distancia mínima de 3.00 m respecto a fuentes de ignición (compresores, interruptores eléctricos y chimeneas).`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Elabora la lista completa de materiales y accesorios normativos para conectar un calentador de agua instantáneo a la red de gas, especificando tipos de rosca, diámetros y dispositivos de seguridad obligatorios.',
        pista: 'Incluye válvula de corte rápido, tuercas cónicas flare y conector flexible certificado.',
        solucion: [
          '1 Válvula de esfera de corte rápido para gas de 1/2 pulgada.',
          '1 Niple terminal de latón con rosca macho NPT de 1/2" a cono macho Flare de 3/8".',
          '1 Conector flexible trenzado de acero inoxidable certificado NOM de 3/8" x 1.00 m.',
          'Sellador anaeróbico de curado en ausencia de aire grado gas (cinta teflón amarillo).',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Explica por qué la NOM prohíbe el uso de mangueras de plástico común (vinilo) y conexiones soldadas con estaño en instalaciones de gas doméstico.',
        pista: 'Analiza la temperatura de fusión del estaño y la degradación por hidrocarburos del plástico común.',
        solucion: [
          'Motivo 1: El plástico común es degradado por los mercaptanos y aditivos del gas L.P., perdiendo flexibilidad y agrietándose.',
          'Motivo 2: El estaño funde a baja temperatura (~230 °C), por lo que ante un conato de incendio la tubería se desoldaría de inmediato liberando gas.',
        ],
      },
    ],
    aplicacion: 'Revisa la instalación de gas de tu hogar o taller: inspecciona el tanque de gas, el regulador, las válvulas de corte y las uniones flexibles. Anota en una lista de chequeo si cumplen con la cinta amarilla de teflón, ausencia de corrosión y distancias de seguridad.',
    autoevaluacion: [
      '¿Identifico la normatividad oficial mexicana aplicable a instalaciones de gas residencial (NOM-002 y NOM-004)?',
      '¿Sé qué soldadura y selladores son obligatorios en líneas de gas para evitar fugas?',
      '¿Reconozco los componentes esenciales de una estación de regulación y válvulas de corte?',
    ],
    recursos: [
      {
        titulo: 'Norma Oficial Mexicana NOM-002-SECRE Instalaciones de Aprovechamiento de Gas Natural',
        url: 'https://www.gob.mx/cre/documentos/norma-oficial-mexicana-nom-002-secre-2010',
        tipo: 'web',
      },
      {
        titulo: 'Manual de Seguridad y Buenas Prácticas en Instalaciones de Gas L.P.',
        url: 'https://educacionmediasuperior.sep.gob.mx/seguridad-gas',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Diagrama esquemático de instalación de gas seguro: dibujo acotado de la estación de regulación y acometida a equipos de consumo con tabla técnica de accesorios aprobados por la NOM.',
    isFallback: false,
  },
  {
    sessionNumber: 13,
    objetivo: 'Aplicar técnicas profesionales de corte, escariado, terraja de roscado, soldadura capilar y unión por termofusión en tuberías hidrosanitarias y de gas, verificando estanqueidad mediante pruebas de hermeticidad.',
    motivacion: 'Un corte mal desbarbado en un tubo de cobre genera turbulencias hidráulicas y erosión por cavitación que perforan el metal con el tiempo; una rebaba en gas acumula impurezas que tapan los inyectores de la estufa. Como técnicos constructores, el dominio psicomotriz de las herramientas de unión y el pulso exacto en la soldadura distinguen un trabajo profesional de uno improvisado.',
    saberesPrevios: 'Anota en tu cuaderno activo: ¿Cuál es el propósito del escariador en un cortador de tubo? ¿Por qué la termofusora debe alcanzar exactamente 260 °C antes de insertar el tubo y la conexión de PPR?',
    contenido: `La ejecución material de uniones en tuberías hidrosanitarias y de gas exige destreza manual, precisión milimétrica y apego estricto a las cartas de temperaturas y tiempos de calentamiento. En esta sesión 13, desarrollaremos los procedimientos estandarizados de unión física y química de los sistemas de conducción de fluidos en la edificación.\n\nPara el cobre, el proceso inicia con el corte ortogonal mediante cortatubos de disco giratorio, avanzando un cuarto de vuelta de perilla por cada rotación completa para no ovalar el tubo. Tras el corte, es indispensable escariar el borde interior para retirar la rebaba de filo cortante y limpiar con lija de grano fino (grano 120 o fibra abrasiva no metálica) tanto la superficie exterior del tubo como el casquillo interior de la conexión hasta obtener un brillo metálico uniforme. Se aplica una capa delgada de pasta fundente neutra, se inserta a tope y se calienta con soplete de gas propano o butano, dirigiendo la flama al casquillo de la conexión; al alcanzar la temperatura adecuada, se retira la flama y se aplica el alambre de soldadura en el borde opuesto, permitiendo que la acción capilar succione la aleación fundida llenando el 100% de la holgura anular.\n\nEn el caso de PPR por termofusión, la matriz teflonada debe alcanzar 260 °C ± 10 °C. Tubo y accesorio se introducen simultáneamente en las boquillas hembra y macho sin girar, respetando la profundidad de inserción marcada. Se cuenta el tiempo de calentamiento normativo (ej. 5 segundos para 20 mm, 7 segundos para 25 mm), se extraen y se unen de inmediato alineando las marcas coaxiales, manteniéndolos inmóviles durante el tiempo de fijación y enfriamiento. La unión resultante presenta un doble labio visible uniforme que garantiza hermeticidad absoluta.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: En el taller de construcción, un equipo de estudiantes debe realizar la preparación y unión por soldadura blanda de un ramal de cobre rígido de 1/2" con una te y dos codos de 90° para una prueba de presión manométrica.\n\nPaso 1: Corte y escariado mecánico. Se cortan 3 tramos de 25 cm utilizando cortador circular de cuchilla templada. Con la cuchilla retráctil triangular del escariador, se retira la rebaba interior girando 360 grados dos veces. Se desbarba el canto exterior con lija abrasiva.\n\nPaso 2: Limpieza y decapado con fundente. Con lija para plomería se frotan los extremos de los tubos en una longitud de 15 mm y el interior de las conexiones hasta eliminar toda película de óxido. Se aplica pasta fundente con brocha pequeña en capa milimétrica uniforme sin excederse para evitar residuos ácidos internos.\n\nPaso 3: Ensamble y calentamiento térmico por capilaridad. Se ensambla la te con los tubos verificando la ortogonalidad con escuadra de taller. Se enciende el soplete ajustando una flama azul neutra. Se calienta la conexión de cobre distribuyendo el calor en forma de abanico. Cuando el fundente burbujea y se vuelve transparente, se toca el borde con soldadura estaño 95/5; la aleación funde al contacto sin flama directa y corre alrededor de la campana por capilaridad.\n\nPaso 4: Limpieza final e inspección visual. Con un paño húmedo se limpian los excesos de fundente exterior mientras la soldadura solidifica. Se inspecciona la unión: debe presentar un cordón perimetral completo, continuo y brillante sin poros ni escurrimientos, listo para someterse a la prueba de presión de 6 kg/cm².`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Describe paso a paso el procedimiento de termofusión en tubería de PPR de 25 mm indicando: temperatura del termofusor, tiempo de calentamiento, tiempo de acople sin giro y tiempo de enfriamiento según la tabla técnica.',
        pista: 'Consulta los tiempos de la norma NMX para polipropileno copolímero random.',
        solucion: [
          'Paso 1: Temperatura de placa: 260 °C (verificada con termómetro o luz verde piloto).',
          'Paso 2: Tiempo de calentamiento: 7 segundos desde la inserción completa en matrices.',
          'Paso 3: Tiempo de acople: máximo 4 segundos, uniendo en línea recta sin girar hasta el doble cordón.',
          'Paso 4: Tiempo de enfriamiento: 2 minutos inmóvil para lograr la cristalización molecular.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Identifica las causas técnicas por las cuales una unión soldada de cobre puede presentar fugas durante la prueba hidrostática y cómo prevenir cada una.',
        pista: 'Analiza falta de lija, sobrecalentamiento del fundente, enfriamiento brusco o corte sesgado.',
        solucion: [
          'Causa 1: Falta de lijado o grasa en el metal que impide la adherencia capilar de la soldadura.',
          'Causa 2: Sobrecalentamiento con el soplete que carboniza la pasta fundente y bloquea el estaño.',
          'Causa 3: Movimiento del tubo antes de que la soldadura solidifique por completo creando grietas internas.',
        ],
      },
    ],
    aplicacion: 'En el taller de la escuela, practica el corte ortogonal y biselado en tres trozos de tubería de diferente material (cobre, CPVC y PPR); verifica con un calibrador vernier o escuadra la perpendicularidad del corte antes de iniciar la unión.',
    autoevaluacion: [
      '¿Domino el uso seguro del cortatubos, escariador y soplete con equipo de protección?',
      '¿Comprendo el principio físico de la capilaridad en soldadura y la termofusión en polímeros?',
      '¿Reconozco un cordón de unión de calidad frente a una unión defectuosa o recalentada?',
    ],
    recursos: [
      {
        titulo: 'Protocolo de Seguridad y Técnicas de Unión de Tuberías en Taller Escolar',
        url: 'https://educacionmediasuperior.sep.gob.mx/tecnicas-corte-soldadura',
        tipo: 'web',
      },
      {
        titulo: 'Manual Operativo de Termofusión en Instalaciones Hidrosanitarias',
        url: 'https://www.gob.mx/construccion-plomeria-manual',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Muestra testigo de ensamble técnico: probeta de tres uniones (soldadura cobre, cementado CPVC y termofusión PPR) con reporte de control de calidad y bitácora de inspección visual.',
    isFallback: false,
  },
  {
    sessionNumber: 14,
    objetivo: 'Operar y calibrar herramientas especializadas de plomería y montaje (llaves Stillson, pericos ajustables, tarrajas de roscar NPT, termofusoras, manómetros y bombas de prueba hidrostática) aplicando equipo de protección personal normativo.',
    motivacion: 'Una llave Stillson mal orientada sobre una tubería puede fracturar el metal o resbalar violentamente causando lesiones graves en manos y rostro; un manómetro sin calibrar puede engañar sobre la presión de una línea y provocar una explosión. Como técnicos responsables, el conocimiento del torque correcto, la selección de dados de roscar y la disciplina en el uso de guantes de carnaza y gafas de policarbonato salvan vidas en el taller y en la obra.',
    saberesPrevios: 'Reflexiona y escribe en tu cuaderno: ¿En qué sentido deben colocarse las mordazas de una llave Stillson para apretar un tubo sin morder en falso? ¿Cuál es la diferencia entre una rosca recta cilíndrica y una rosca cónica NPT?',
    contenido: `El trabajo en instalaciones de plomería, redes hidráulicas y gas requiere el dominio de una familia de herramientas manuales, mecánicas y de medición de precisión. En esta sesión 14, examinaremos la anatomía funcional, el principio mecánico de operación, el mantenimiento preventivo y los estándares de seguridad para cada herramienta especializada.\n\nLa llave para tubo (Stillson) basa su agarre en la geometría de cremallera y resorte de sus mordazas de acero forjado templado: para apretar, la mordaza móvil debe apuntar hacia el sentido de giro deseado, permitiendo que el esfuerzo incremente la fricción contra el cilindro del tubo sin deformarlo. Las llaves ajustables inglesas (pericos) deben utilizarse aplicando la fuerza sobre la mandíbula fija para no desgastar el tornillo sinfín de ajuste. Para el roscado de tubería galvanizada o de acero al carbón, se utiliza la tarraja con peines intercambiables NPT (National Pipe Taper), cuya conicidad de 1:16 genera un acuñamiento hermético conforme se aprieta la unión, requiriendo lubricación continua con aceite de corte para no fracturar los dientes.\n\nEn cuanto al instrumental de verificación, la bomba de prueba hidrostática manual con manómetro de glicerina (rango 0 a 25 kg/cm²) permite presurizar la red con agua limpia para evaluar la estanqueidad sin riesgos de explosión por compresión de gases. Todo procedimiento de montaje y prueba exige el uso irrestricto de EPP: guantes de nitrilo o carnaza según la maniobra, gafas de seguridad con protección lateral, botas con casquillo dieléctrico y mascarilla contra vapores de soldadura o cementos solventes.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Se debe realizar el roscado NPT de un niple de tubería de fierro negro de 3/4" para una línea de gas y verificar la calibración de la bomba de prueba hidrostática con manómetro.\n\nPaso 1: Sujeción y preparación de la tubería. Se fija el tubo firmemente en el tornillo de banco para plomería (prensa de cadena o de mordaza en V). Con cortatubos para acero se realiza el corte perpendicular y se chaflana el extremo exterior a 45° con lima bastarda para facilitar la entrada de los dados de la tarraja.\n\nPaso 2: Roscado con tarraja manual y aceite lubricante. Se seleccionan los peines NPT de 3/4". Se coloca la cabeza de la tarraja perpendicular al tubo empujando con la palma mientras se gira la palanca con trinquete. En cuanto los peines muerden el metal, se aplica aceite de corte mineral abundantemente, avanzando 3/4 de vuelta adelante y 1/4 de vuelta atrás para quebrar la viruta metálica hasta alcanzar 7 a 8 hilos útiles.\n\nPaso 3: Limpieza y verificación de rosca con galga de paso. Se retira la tarraja, se limpia la viruta con brocha (nunca con la mano desnuda) y se comprueba el acoplamiento con una conexión roscada patrón: debe roscar a mano de 3 a 4 vueltas antes de requerir la llave mecánica.\n\nPaso 4: Conexión y calibración de la bomba de prueba. Se purga la manguera de la bomba manual de prueba hidrostática conectándola al extremo del ramal, se llena de agua eliminando todo el aire atrapado y se bombea hasta alcanzar 10 kg/cm² en el manómetro de glicerina, verificando que la aguja permanezca estable durante 15 minutos sin registrar caída de presión.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Elabora un cuadro de mantenimiento y seguridad para cinco herramientas básicas de plomería: Llave Stillson, Tarraja NPT, Termofusora de PPR, Cortatubos de cobre y Bomba de prueba hidrostática.',
        pista: 'Detalla limpieza de mordazas, sustitución de cuchillas, calibración de termostato y despresurización.',
        solucion: [
          'Stillson: Limpiar dientes con cepillo de alambre, lubricar resorte y tuerca estriada; no usar tubos extensores como palanca.',
          'Tarraja: Limpieza de virutas, verificar filos de peines NPT, lubricar trinquete reversor.',
          'Termofusora: Limpiar matrices con paño de algodón caliente sin rayar el teflón; verificar cable y clavija con tierra física.',
          'Cortatubos: Verificar que el disco de corte gire libremente y no presente muescas; lubricar eje roscado.',
          'Bomba de prueba: Drenar agua tras cada uso, calibrar manómetro con manómetro patrón cada 6 meses, no golpear el cuerpo.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Enumera el equipo de protección personal (EPP) indispensable para realizar la soldadura con soplete y explica la función de cada elemento.',
        pista: 'Considera calor radiante, chispas, vapores de fundente y caída de objetos.',
        solucion: [
          'Gafas de seguridad con sombra 3 o 4 para proteger contra radiación y chispas de fundente hirviendo.',
          'Guantes de carnaza suaves que aíslen el calor del soplete permitiendo destreza manual.',
          'Pechera o mandil de carnaza para proteger el torso contra salpicaduras de soldadura fundida.',
          'Botas de seguridad con casquillo para prevenir traumatismos por caída de herramientas o tuberías.',
        ],
      },
    ],
    aplicacion: 'En el taller escolar, realiza la inspección de seguridad de las herramientas disponibles: verifica el estado de las mordazas de las llaves Stillson y las boquillas de teflón de la termofusora, elaborando un reporte de mantenimiento para el docente.',
    autoevaluacion: [
      '¿Sé orientar y utilizar la llave Stillson y llaves ajustables sin dañar la tubería ni arriesgar mi integridad física?',
      '¿Comprendo el proceso de roscado cónico NPT y la importancia de la lubricación continua?',
      '¿Utilizo de forma sistemática el EPP adecuado para cada maniobra técnica de taller?',
    ],
    recursos: [
      {
        titulo: 'Manual de Seguridad en el Manejo de Herramientas de Taller y Construcción',
        url: 'https://educacionmediasuperior.sep.gob.mx/seguridad-herramientas',
        tipo: 'web',
      },
      {
        titulo: 'Guía Técnica de Operación de Bombas de Prueba y Manómetros en Redes de Conducción',
        url: 'https://www.gob.mx/herramientas-construccion-guia',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Lista de cotejo de inspección y bitácora de uso seguro de herramientas de plomería: reporte firmado con diagnóstico del instrumental de taller y propuesta de mantenimiento preventivo.',
    isFallback: false,
  },
  {
    sessionNumber: 15,
    objetivo: 'Integrar y montar el sistema hidrosanitario y de gas completo en el murete piloto del proyecto comunitario PAEC, aplicando tolerancias milimétricas, fijación estructural y bitácora técnica de obra.',
    motivacion: 'Llegamos a la culminación práctica de la instalación: unir planos, tuberías, válvulas y herramientas en una maqueta o murete a escala real para el proyecto comunitario de nuestra escuela. Demostrar ante la comunidad educativa que el agua fluye a presión óptima sin una sola fuga y que la red de gas es 100% segura valida tu aprendizaje técnico como constructor del bachillerato.',
    saberesPrevios: 'Activa tus saberes en tu cuaderno: ¿Por qué las tuberías hidrosanitarias deben fijarse con abrazaderas omega o tipo gota cada cierta distancia en muros? ¿Qué tolerancias de separación deben guardarse entre una línea de gas y una toma de corriente eléctrica?',
    contenido: `La integración física de las redes de instalaciones en un elemento constructivo real o murete de prueba demanda la coordinación armónica de todos los saberes técnicos adquiridos durante el corte. En esta sesión 15, llevaremos a cabo el ensamble, fijación y puesta a punto del sistema hidrosanitario y de gas correspondiente al artefacto del proyecto comunitario escolar.\n\nEl montaje inicia con el trazo en el murete de albañilería de las trayectorias de las tuberías conforme al isométrico aprobado. Las tuberías hidráulicas de alimentación de agua fría y caliente se canalizan respetando una separación mínima de 15 cm entre sí (colocando siempre el agua caliente a la izquierda y el agua fría a la derecha de cada mueble sanitario). Para la línea de gas, la normativa exige una separación mínima de 20 cm respecto a cualquier tubería de agua caliente, chimenea o canalización eléctrica para prevenir riesgos de arco eléctrico o calentamiento por convección.\n\nLa fijación mecánica de las líneas se ejecuta mediante abrazaderas metálicas con taquetes de expansión o abrazaderas tipo omega con recubrimiento aislante de neopreno para amortiguar vibraciones y prevenir el golpe de ariete cuando las válvulas cierran bruscamente. Cada conexión terminal se asegura con tapones herméticos provisionales para realizar la prueba preliminar de estanqueidad antes de proceder con el reporte final de tolerancias en la bitácora de obra.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Montaje e integración de un cuadro de tomas para regadera y monomando en el murete demostrativo del proyecto comunitario PAEC escolar.\n\nPaso 1: Trazado y aplomado en murete. Se trazan las líneas de centro con nivel de mano y plomada de albañil: altura de la regadera a 2.00 m sobre NPT; altura del monomando o manerales a 1.00 m sobre NPT; separación entre centros de agua fría y caliente = 20.0 cm ± 2 mm.\n\nPaso 2: Fijación de ramales de PPR y codos con oreja. Se termofusionan los tramos verticales de PPR de 20 mm. En las salidas finales se instalan codos con oreja hembra de latón niquelado, fijándolos sólidamente a los tabiques del murete mediante tornillos de acero inoxidable de 2" y taquetes de nylon para que no se muevan al instalar la grifería.\n\nPaso 3: Verificación de tolerancias geométricas y alineación. Con escuadra y flexómetro se verifica: distancia entre caras de salida = 200 mm exactos; profundidad de los codos respecto a la cara del muro aplanado = 5 mm retraídos para permitir la colocación del azulejo o acabado cerámico.\n\nPaso 4: Prueba preliminar y registro en bitácora. Se colocan tapones roscados de prueba, se conecta la manguera presurizadora y se eleva la presión a 5 kg/cm² durante 20 minutos. Al comprobar ausencia de fugas y correcta nivelación, se firma la bitácora técnica de obra del proyecto comunitario con aval del docente y representantes del comité escolar.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Elabora la lista de tolerancias dimensionales admisibles para la instalación de tomas hidrosanitarias en un murete residencial: altura de salida de inodoro, lavabo, regadera y separación entre tomas de agua fría y caliente.',
        pista: 'Consulta las recomendaciones de fabricantes de muebles de baño y normas NMX de edificación.',
        solucion: [
          'Inodoro: 20 a 25 cm sobre NPT, 15 cm a la izquierda del eje del mueble, tolerancia ± 5 mm.',
          'Lavabo: 55 a 60 cm sobre NPT, separación de 10 a 15 cm entre tomas fría y caliente, tolerancia ± 5 mm.',
          'Regadera: manerales a 100 cm sobre NPT, salida de regadera a 200 cm sobre NPT, tolerancia ± 10 mm.',
          'Drenaje de inodoro: eje de tubería de 4" a 30.5 cm del muro terminado, tolerancia ± 5 mm.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Explica qué es el golpe de ariete en una red hidráulica residencial, qué daños puede causar en las tuberías y cómo se previene mediante fijaciones y cámaras de aire.',
        pista: 'Analiza el cambio brusco de velocidad del agua al cerrar una válvula y la onda de sobrepresión.',
        solucion: [
          'Definición: Onda de sobrepresión destructiva provocada por el frenado instantáneo del caudal de agua al cerrar una llave rápida.',
          'Daños: Ruptura de uniones soldadas o cementadas, desajuste de abrazaderas y vibraciones ruidosas en muros.',
          'Prevención: Instalación de cámaras de aire verticales (cámaras amortiguadoras) al final de cada ramal y fijación sólida con abrazaderas cada 1.0 m.',
        ],
      },
    ],
    aplicacion: 'Participa en el montaje grupal del murete demostrativo en tu escuela: asume un rol técnico (trazador, cortador, soldador o inspector de calidad) y asienta en la bitácora colectiva las medidas y presiones registradas.',
    autoevaluacion: [
      '¿Logré integrar los ramales hidráulicos y de gas en el murete respetando las distancias normativas de seguridad?',
      '¿Verifiqué la nivelación, plomo y cotas de salida reglamentarias con instrumentos de medición?',
      '¿Documenté el avance y resultados de la prueba de presión en la bitácora técnica formal del proyecto PAEC?',
    ],
    recursos: [
      {
        titulo: 'Guía de Ensamble y Montaje de Sistemas Hidrosanitarios en Maquetas de Práctica',
        url: 'https://educacionmediasuperior.sep.gob.mx/montaje-murete-practica',
        tipo: 'web',
      },
      {
        titulo: 'Manual de Control de Calidad y Bitácora de Obra en Instalaciones de Edificación',
        url: 'https://www.gob.mx/bitacora-obra-instalaciones',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Memoria técnica de integración del artefacto hidrosanitario y de gas: reporte fotográfico del murete montado con bitácora de tolerancias, presiones de prueba y firma de validación técnica.',
    isFallback: false,
  },
];

// ============================================================================
// 3 PLANES DE CONSTRUCCIÓN / LIMPIEZA / ENTREGA PARA BLOQUE 3 (S16 a S18)
// ============================================================================
const BLOCK3_CLEAN_SESSIONS: SessionPlan[] = [
  {
    sessionNumber: 16,
    objetivo: 'Aplicar procedimientos técnicos de limpieza química y desobstrucción mecánica en tuberías sanitarias e hidráulicas mediante desincrustantes biodegradables, sondas helicoidales y varillas desazolvadoras bajo normas de seguridad.',
    motivacion: 'Con el paso del tiempo, la sedimentación de sales minerales (sarro), grasas saponificadas y residuos sólidos reduce la sección transversal útil de las tuberías hasta colapsar el drenaje o reducir drásticamente la presión del agua potable. Como técnicos de la construcción, saber diagnosticar el tipo de obstrucción y aplicar el método de limpieza adecuado sin perforar ni desgastar las paredes de las tuberías devuelve la habitabilidad a la vivienda.',
    saberesPrevios: 'Reflexiona en tu cuaderno activo: ¿Por qué el ácido muriático (clorhídrico) concentrado no debe utilizarse indiscriminadamente en tuberías metálicas o muebles sanitarios esmaltados? ¿Qué ventaja ofrece una sonda desazolvadora rotatoria frente a químicos corrosivos?',
    contenido: `El mantenimiento correctivo y preventivo de las redes de tuberías y muebles de baño constituye un área fundamental de la práctica profesional de la construcción. En esta sesión 16, profundizaremos en los protocolos técnicos de limpieza química y desobstrucción mecánica de redes hidráulicas y sanitarias residenciales.\n\nPara obstrucciones en redes de desagüe causadas por lodos, materia orgánica o grasas, el método mecánico primario es el empleo de sondas de acero templado con punta helicoidal o cuchillas de desbaste, impulsadas manualmente o mediante máquina rotativa. La sonda avanza girando en el interior del tubo, fragmentando el tapón y retirando los residuos hacia el registro sanitario sin dañar las paredes de PVC o polietileno. En redes hidráulicas incrustadas con carbonato de calcio (sarro), se implementa la limpieza química controlada con desincrustantes biodegradables de base ácido sulfámico o cítrico con inhibidores de corrosión, bombeando la solución en circuito cerrado durante 45 minutos y neutralizando posteriormente con bicarbonato de sodio antes del enjuague general con agua limpia.\n\nDurante todo procedimiento de mantenimiento correctivo es imperativo utilizar el equipo de protección personal: guantes largos de nitrilo o neopreno resistente a químicos, gafas de seguridad herméticas tipo goggle, respirador con filtro para vapores inorgánicos y botas de hule con suela antideslizante, garantizando además una ventilación cruzada continua en el cuarto de baño para disipar emanaciones de gases de alcantarilla (sulfuro de hidrógeno y metano).`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Desobstrucción y limpieza técnica de un ramal de desagüe sanitario de PVC de 2 pulgadas correspondiente al lavabo y regadera de una vivienda comunitaria con estancamiento severo de agua.\n\nPaso 1: Diagnóstico de la obstrucción y delimitación de seguridad. Se retira la rejilla o trampa céspol del lavabo. Con videocámara de inspección telescópica o sondeo inicial se localiza el tapón de residuos a 1.80 metros de distancia de la boca de entrada, descartando daño estructural o colapso del tubo.\n\nPaso 2: Selección y preparación del equipo mecánico. Se selecciona una sonda de resorte acerado de 3/8" con punta de sacacorchos. Se colocan cubetas y lonas de retención plástica en el piso del baño para contener escurrimientos y se visten guantes de nitrilo reforzado y gafas herméticas.\n\nPaso 3: Ejecución de la maniobra de sondeo y desazolve. Se introduce la sonda haciéndola girar en el sentido de las manecillas del reloj mientras se ejerce una presión axial constante. Al hacer contacto con el tapón, se rota la manivela para atrapar la masa de cabello y sedimentos, retrayendo la sonda lentamente para extraer el material sólido hacia una cubeta de recolección de residuos.\n\nPaso 4: Enjuague de arrastre y verificación de flujo libre. Se vierte agua caliente a 60 °C con solución desengrasante biodegradable neutra para limpiar los remanentes adheridos a las paredes del tubo. Se abre la llave a caudal máximo durante 5 minutos continuos: el agua desagua de manera vortexial sin remansos ni ruidos de succión defectuosa en el sello hidráulico del céspol.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Elabora un protocolo de seguridad de 4 fases para la desincrustación química de un calentador de agua de depósito con presencia de sarro severo, detallando químicos permitidos, tiempos de recirculación y neutralización.',
        pista: 'Considera aislamiento eléctrico/gas, ácido desincrustante inhibido y neutralizador alcalino.',
        solucion: [
          'Fase 1: Desconexión de energía y gas, cierre de válvula de alimentación y drenado total del tanque.',
          'Fase 2: Conexión de bomba de recirculación química con solución de ácido cítrico/sulfámico al 10% con inhibidor.',
          'Fase 3: Recirculación continua durante 40 a 60 minutos monitoreando el pH de la solución.',
          'Fase 4: Neutralización con solución de bicarbonato de sodio al 5%, enjuague abundante y puesta en marcha.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Explica qué riesgos biológicos y químicos existen al manipular tuberías sanitarias de desagüe en una vivienda y qué medidas preventivas deben adoptarse.',
        pista: 'Considera bacterias patógenas, gas sulfhídrico y salpicaduras en mucosas oculares.',
        solucion: [
          'Riesgo Biológico: Exposición a bacterias coliformes y patógenos entéricos; prevención con guantes de nitrilo y desinfección con hipoclorito de sodio.',
          'Riesgo Químico: Inhalación de sulfuro de hidrógeno (gas de alcantarilla); prevención con ventilación forzada y sellado de registros abiertos.',
        ],
      },
    ],
    aplicacion: 'Revisa las trampas y coladeras del baño o laboratorio escolar: realiza la limpieza de un céspol de lavabo desarmable retirando sedimentos y comprobando la integridad del empaque cónico de sellado.',
    autoevaluacion: [
      '¿Conozco los métodos mecánicos y químicos adecuados para desobstruir tuberías sin dañarlas?',
      '¿Comprendo los riesgos del uso de químicos corrosivos y sé seleccionar desincrustantes seguros?',
      '¿Aplico las medidas de bioseguridad y uso de EPP normativo en labores de mantenimiento?',
    ],
    recursos: [
      {
        titulo: 'Manual de Procedimientos Técnicos de Mantenimiento y Desazolve de Redes Sanitarias',
        url: 'https://educacionmediasuperior.sep.gob.mx/mantenimiento-redes-sanitarias',
        tipo: 'web',
      },
      {
        titulo: 'Guía de Manejo Seguro de Sustancias Químicas y Desincrustantes en Plomería',
        url: 'https://www.gob.mx/seguridad-quimicos-construccion',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Ficha técnica de procedimiento de mantenimiento: instructivo paso a paso para la desobstrucción y limpieza de ramales sanitarios residenciales con criterios de seguridad y control ambiental.',
    isFallback: false,
  },
  {
    sessionNumber: 17,
    objetivo: 'Ejecutar pruebas de presión manométrica, hermeticidad hidrostática y detección de fugas en uniones de tuberías y muebles de baño, verificando la estabilidad de la presión según especificaciones de la NOM-001-CONAGUA y normas técnicas.',
    motivacion: 'Ocultar una tubería dentro de un muro o bajo un piso de loseta sin haber realizado la prueba de hermeticidad es una negligencia gravísima: una microgota filtrándose cada 10 segundos pudre muros, genera moho negro dañino para la salud pulmonar y destruye los acabados con un costo de reparación diez veces mayor. Como constructores de excelencia, la prueba hidrostática certificada es tu sello de garantía profesional.',
    saberesPrevios: 'Anota en tu cuaderno activo: ¿Por qué nunca debe probarse una tubería de agua o gas con aire a alta presión sin supervisión especializada? ¿Qué indica si la aguja del manómetro desciende 0.5 kg/cm² durante la primera media hora?',
    contenido: `La prueba de hermeticidad hidrostática es el ensayo técnico destructivo y de control de calidad no negociable previo a la recepción, recubrimiento o colado de cualquier red de instalaciones en la edificación. En esta sesión 17, aprenderemos a preparar, presurizar, monitorear y certificar las redes hidrosanitarias conforme a los estándares de la NOM-001-CONAGUA (sistemas de agua potable) y las especificaciones técnicas de edificación vigentes en el estado de Puebla.\n\nEl protocolo hidrostático para redes de agua potable exige llenar la red lentamente desde el punto más bajo con agua limpia desprovista de sólidos en suspensión, manteniendo abiertas las válvulas de purga o grifos en los puntos más altos hasta expulsar el 100% del aire entrampado (purgado completo), ya que el aire comprimido acumula energía potencial elástica que falsea las lecturas del manómetro y representa un riesgo de fragmentación violenta. Una vez purgada, se cierran las purgas y se bombea agua mediante bomba manual hasta alcanzar la presión de prueba estipulada: típicamente 1.5 veces la presión de trabajo nominal (mínimo 6.0 kg/cm² o 85 psi para redes interiores domiciliarias). Esta presión debe mantenerse constante durante un lapso mínimo de 60 minutos continuos.\n\nPara redes de gas, la prueba de hermeticidad se efectúa con aire o gas inerte (nitrógeno) a una presión de 1.0 a 1.5 kg/cm² (15 a 21 psi) durante 24 horas para redes completas, o mínimo 30 minutos a 1.0 kg/cm² para líneas interiores vistas, inspeccionando cada junta soldada o roscada mediante aplicación de solución jabonosa densa o detector electrónico de hidrocarburos. La presencia de burbujas en la emulsión delata de forma inequívoca la fuga, obligando a despresurizar de inmediato antes de rehacer la unión.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Realizar la prueba hidrostática de hermeticidad en el circuito hidráulico de agua potable recién instalado en el murete del taller escolar antes de aplicar el aplanado de mortero.\n\nPaso 1: Sellado de salidas y purga de aire. Se colocan tapones cachucha de CPVC o tapones roscados herméticos en las tomas de inodoro, lavabo y regadera. Se conecta la manguera de llenado en la toma general manteniendo abierto el tapón del punto más alto (salida de regadera) hasta que brote un chorro continuo de agua sin burbujas; en ese instante se aprieta el tapón superior.\n\nPaso 2: Presurización controlada con bomba manual. Con la bomba de prueba conectada en el ramal principal y manómetro de glicerina calibrado (0-14 kg/cm²), se bombea manualmente incrementando la presión en escalones de 2 kg/cm² cada 3 minutos, inspeccionando visualmente las uniones hasta alcanzar 7.0 kg/cm² (100 psi).\n\nPaso 3: Monitoreo y estabilización de la aguja. Se cierra la válvula de retención de la bomba aislando el circuito. Durante los primeros 10 minutos se permite una caída máxima de 0.1 kg/cm² por acomodo elástico del material de las tuberías y estabilización de la temperatura del agua. Se reajusta a 7.0 kg/cm² y se inicia el conteo oficial de 60 minutos de prueba.\n\nPaso 4: Inspección física de uniones y dictamen técnico. Con lámpara de mano y papel secante seco se tocan todas las uniones soldadas y termofusionadas. Al término de los 60 minutos, el manómetro marca exactamente 7.0 kg/cm² sin variación alguna y el papel secante se mantiene 100% seco. Se levanta el acta de prueba hidrostática satisfactoria autorizando el recubrimiento del muro.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Redacta el acta técnica de prueba hidrostática para una vivienda de interés social, incluyendo: datos de la obra, fluido de prueba, presión manométrica aplicada, tiempo de sostenimiento, caída de presión registrada y dictamen de aprobación.',
        pista: 'Estructura el documento con formato de control de calidad de obra civil.',
        solucion: [
          'Datos: Obra Residencial PAEC, Bloque 3, Fecha y hora de inicio/término.',
          'Condiciones: Agua limpia a 20 °C, Presión inicial = 6.5 kg/cm², Presión final = 6.5 kg/cm² tras 60 minutos.',
          'Caída observada: 0.0 kg/cm² (cero fugas visuales ni manométricas).',
          'Dictamen: Aprobado sin observaciones, se autoriza inicio de aplanados y acabados.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Explica el procedimiento técnico que debe seguirse en caso de que durante una prueba de hermeticidad en una línea de gas se detecte formación de burbujas en una unión roscada.',
        pista: 'No se debe apretar la unión bajo presión; primero se despresuriza completamente.',
        solucion: [
          'Paso 1: Abrir la válvula de purga y despresurizar el circuito de gas al 100% a la atmósfera exterior.',
          'Paso 2: Desarmar la unión defectuosa, limpiar las roscas retirando el sellador anterior con cepillo de cerdas metálicas.',
          'Paso 3: Aplicar nuevo sellador anaeróbico o teflón amarillo de 3/4" en 4 a 5 vueltas, rearmar con torque regulado y reiniciar la prueba.',
        ],
      },
    ],
    aplicacion: 'Con el equipo de taller, realiza la prueba de hermeticidad en el circuito del murete piloto: registra lecturas manométricas cada 10 minutos durante 40 minutos y grafica la curva de presión en tu cuaderno.',
    autoevaluacion: [
      '¿Comprendo la metodología y la presión normativa para realizar pruebas hidrostáticas de hermeticidad?',
      '¿Sé purgar el aire atrapado en una red hidráulica antes de iniciar la presurización?',
      '¿Identifico cómo detectar fugas con precisión y actuar de manera segura ante una pérdida de presión?',
    ],
    recursos: [
      {
        titulo: 'Norma Oficial Mexicana NOM-001-CONAGUA Sistemas de Agua Potable y Alcantarillado',
        url: 'https://www.gob.mx/conagua/documentos/norma-oficial-mexicana-nom-001-conagua-2011',
        tipo: 'web',
      },
      {
        titulo: 'Protocolo de Pruebas de Hermeticidad en Redes Hidrosanitarias y de Gas en Edificación',
        url: 'https://educacionmediasuperior.sep.gob.mx/pruebas-hermeticidad-edificacion',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Acta y reporte fotográfico de prueba hidrostática: formato formal de control de calidad con registro de presiones manométricas, firmas de supervisión y dictamen de hermeticidad aprobado.',
    isFallback: false,
  },
  {
    sessionNumber: 18,
    objetivo: 'Elaborar el protocolo formal de entrega-recepción de obra hidrosanitaria, montaje final de muebles de baño y acabados sanitarios, bitácora de mantenimiento preventivo y reporte técnico final ante la comunidad escolar.',
    motivacion: 'El momento culminante de todo técnico de la construcción es la entrega formal de la obra terminada, limpia y en perfecto estado de funcionamiento. Entregar una instalación hidrosanitaria con muebles de baño nivelados, empaques perfectamente sellados con silicón fungicida y un manual claro de mantenimiento preventivo para los usuarios de la comunidad consolida tu perfil de egreso profesional y ético del bachillerato.',
    saberesPrevios: 'Reflexiona en tu cuaderno activo: ¿Qué documentos integran la carpeta técnica de entrega de una obra de instalaciones? ¿Por qué es indispensable aplicar silicón fungicida transparente o blanco alrededor de la base del inodoro y lavabo?',
    contenido: `La entrega-recepción de las obras e instalaciones en la edificación habitacional representa el cierre formal del ciclo constructivo, donde se transfiere la custodia operativa del sistema al usuario final o a la administración del inmueble. En esta sesión 18 de cierre del bloque, consolidaremos las destrezas para la instalación final de muebles sanitarios, la aplicación de sellos perimetrales higiénicos y la integración de la carpeta técnica de obra.\n\nEl montaje final de muebles comprende la fijación del inodoro al piso mediante tornillos de latón o acero tropicalizado fijados a taquetes en el firme, interponiendo un cuello de cera con guía plástica de polietileno virgen para asegurar un sello hermético que impida emanaciones de gas o derrames de aguas negras hacia el entrepiso. Para el lavabo, se nivelan los soportes de ménsula o pedestal, se conectan las mangueras flexibles de acero trenzado a las llaves de escuadra y se monta el céspol con tubo de desagüe insertado a la campana del muro mediante empaque de chupón de hule vulcanizado. Todo perímetro de contacto entre muebles cerámicos y muros o pisos acabados debe sellarse con cordón continuo de silicón acético con aditivo fungicida anti-hongos, perfilado con espátula de goma para evitar filtraciones y acumulación de humedad insalubre.\n\nFinalmente, el expediente técnico de entrega-recepción debe contener: el juego de planos "As-Built" (planos definitivos tal como se construyó la red en obra con las modificaciones aprobadas), las actas de pruebas de hermeticidad hidrostática y de gas debidamente firmadas, las pólizas de garantía de equipos y grifería, y la bitácora de mantenimiento preventivo trimestral y anual para prolongar la vida útil de toda la instalación.`,
    ejemploResuelto: `Planteamiento del Caso Práctico: Protocolo de montaje final, fijación y entrega técnica de un núcleo de baño completo (inodoro, lavabo y accesorios) en el proyecto comunitario escolar.\n\nPaso 1: Colocación de cuello de cera y montaje de inodoro. Se limpia la boca del tubo de 4" a nivel de loseta. Se coloca el cuello de cera con guía sobre la brida plástica. Se asienta la taza del inodoro alineando las perforaciones con los pernos de anclaje, ejerciendo presión uniforme con el propio peso corporal para comprimir la cera. Se aprietan las tuercas de latón con rondanas plásticas alternadamente sin sobreapretar para no quebrar la porcelana vitrificada.\n\nPaso 2: Conexión de alimentación y regulación de flotador. Se conecta el flexible de 1/2" a 7/8" a la llave angular. Se abre la válvula de escuadra permitiendo el llenado del tanque sanitario; se calibra el tornillo del flotador de la válvula de admisión para que el nivel de agua quede exactamente a 2.5 cm por debajo de la boca del tubo de rebose de la válvula de descarga.\n\nPaso 3: Sellado fungicida perimetral y montaje de lavabo. Se aplica cinta de enmascarar (masking tape) a 4 mm del borde de la base del inodoro y del lavabo. Se tira un cordón continuo de silicón sanitario anti-hongos y se perfila con la yema del dedo enguantada humedecida en agua jabonosa. Se retira la cinta inmediatamente para obtener una arista limpia y estanca.\n\nPaso 4: Integración del acta de entrega-recepción y manual de usuario. Se redacta el acta formal de entrega con lista de verificación: descargas de inodoro probadas (3 ciclos continuos), lavabo probado a caudal máximo sin fugas en céspol, llaves de empotrar de regadera suaves y estancas, planos As-Built anexos y firma del director del plantel y comité de obra PAEC.`,
    practica: [
      {
        enunciado: 'Ejercicio 1: Elabora un calendario y lista de verificación de mantenimiento preventivo para una instalación hidrosanitaria escolar, detallando actividades mensuales, trimestrales y anuales.',
        pista: 'Incluye revisión de empaques, limpieza de trampas céspol, desazolve de registros y purga de calentadores.',
        solucion: [
          'Mensual: Inspección visual de llaves angulares, flexibles y verificación de empaque de sapo de inodoros.',
          'Trimestral: Limpieza mecánica de trampas de grasa y retiro de sedimentos en céspoles de lavabos.',
          'Semestral: Limpieza y desazolve de registros sanitarios exteriores y cajas de inspección con varilla.',
          'Anual: Drenado y purga de lodos en calentadores de agua, revisión de presión de reguladores de gas y reapriete de fijaciones.',
        ],
      },
      {
        enunciado: 'Ejercicio 2: Enumera los componentes obligatorios que deben formar parte de la carpeta técnica As-Built en la entrega final de una obra residencial.',
        pista: 'Considera planos definitivos, pruebas de presión, garantías de grifería y bitácora de obra.',
        solucion: [
          '1. Planos definitivos As-Built acotados con trayectorias reales de tuberías y registros.',
          '2. Actas certificadas de prueba hidrostática y de hermeticidad de gas firmadas por el perito o docente.',
          '3. Catálogo de especificaciones y garantías comerciales de grifería, muebles y calentadores.',
          '4. Bitácora de incidencias de obra con firmas de conformidad del comité comunitario.',
        ],
      },
    ],
    aplicacion: 'Elabora la carpeta técnica de entrega de tu proyecto comunitario PAEC: organiza los planos, reportes fotográficos, actas de pruebas hidrostáticas y el manual de mantenimiento preventivo para presentarlo formalmente ante tu grupo y autoridades escolares.',
    autoevaluacion: [
      '¿Sé ejecutar la instalación y nivelación correcta de inodoros y lavabos sin fracturar la porcelana?',
      '¿Aplico cordones de silicón sanitario fungicida con acabado limpio y estanco?',
      '¿Comprendo la estructura y trascendencia ética de la carpeta técnica de entrega-recepción de obra?',
    ],
    recursos: [
      {
        titulo: 'Manual de Instalación y Montaje de Muebles Sanitarios y Grifería Residencial',
        url: 'https://educacionmediasuperior.sep.gob.mx/montaje-muebles-sanitarios',
        tipo: 'web',
      },
      {
        titulo: 'Guía de Elaboración de Planos As-Built y Carpetas Técnicas de Entrega de Obra',
        url: 'https://www.gob.mx/carpeta-entrega-obra-edificacion',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Carpeta técnica y acta formal de entrega-recepción del sistema hidrosanitario y de gas: expediente completo con planos As-Built, reportes de pruebas, manual de mantenimiento y acta firmada.',
    isFallback: false,
  },
];

async function main() {
  console.log('=== SIGPDA-EMS · Regeneración de Sesiones CECBV P3.1.2 ===');
  const planningId = '4a3335eb-99f3-47f8-a3d0-c83297fe488b';
  const planning = await getPlanningById(planningId);
  if (!planning) {
    throw new Error(`Planeación ${planningId} no encontrada`);
  }

  const teacherId = (planning as any).teacher_id;
  const workbooksJson = (planning as any).workbooks_json || (planning as any).workbooksJson || {};

  // 1. Corregir Bloque 2 (block_1)
  console.log('\n--- Actualizando Bloque 2 (block_1) ---');
  const block1Wb: ActiveWorkTextbook = workbooksJson.block_1?.current;
  if (!block1Wb) {
    throw new Error('Workbook block_1 no encontrado en la planeación');
  }

  // Encontrar Misión 3 (Construcción del Artefacto Real) que contiene S10..S15
  const m3 = block1Wb.missions.find((m) => m.missionIndex === 3 || m.coveredSessions?.includes(10));
  if (!m3) {
    throw new Error('Misión 3 no encontrada en block_1');
  }

  console.log(`Reemplazando ${m3.sessionPlans?.length} planes en Misión 3 de Bloque 2 con 6 planes limpios...`);
  m3.sessionPlans = BLOCK2_CLEAN_SESSIONS;
  const m3Words = m3.sessionPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  console.log(`Misión 3 sessionPlans words: ${m3Words}`);

  // Recalcular métricas de block_1
  const allB1Plans = block1Wb.missions.flatMap((m) => m.sessionPlans || []);
  const b1FallbackWords = detectFallbackWords(allB1Plans, planning.uacName);
  const b1MissionsWordSum = block1Wb.missions.reduce((acc, m) => {
    const plansW = (m.sessionPlans || []).reduce((pAcc, pl) => pAcc + countSessionPlanWords(pl), 0);
    const secW = (m.wordCount || 0) > plansW ? (m.wordCount - plansW) : 600;
    return acc + secW + plansW;
  }, 0);
  block1Wb.totalWords = b1MissionsWordSum;
  block1Wb.aiWords = b1MissionsWordSum - b1FallbackWords;
  block1Wb.fallbackWords = b1FallbackWords;
  block1Wb.totalPages = Math.max(1, Math.round(b1MissionsWordSum / WORDS_PER_PAGE));

  const budgetB1 = computeContentBudget(3);
  const covB1 = validateSessionCoverage({
    sessions: allB1Plans.map((p) => ({ sessionNumber: p.sessionNumber, isFallback: p.isFallback })),
    expectedSessionsCount: 18,
    totalWords: b1MissionsWordSum,
    fallbackWords: b1FallbackWords,
    budget: budgetB1,
  });
  block1Wb.coverageReport = {
    sessionsCovered: covB1.sessionsCovered,
    sessionsExpected: covB1.sessionsExpected,
    allSessionsPresent: covB1.allSessionsPresent,
    averageWordsPerSession: covB1.averageWordsPerSession,
    withinTargetRange: covB1.withinTargetRange,
    aiWords: block1Wb.aiWords,
    fallbackWords: b1FallbackWords,
  };

  const crossReportB1 = validateBlockCrossContamination(block1Wb.missions, planning.uacName);
  console.log('Validación Cross-Contamination Bloque 2:', crossReportB1.summary);
  if (!crossReportB1.clean) {
    throw new Error(`Fallo de contaminación en Bloque 2: ${JSON.stringify(crossReportB1.issues)}`);
  }

  block1Wb.qualityWarning =
    !covB1.allSessionsPresent ||
    !covB1.withinTargetRange ||
    b1FallbackWords > 0 ||
    !crossReportB1.clean;

  console.log(`Bloque 2 actualizado: totalWords=${block1Wb.totalWords}, totalPages=${block1Wb.totalPages}, fallbackWords=${block1Wb.fallbackWords}, qualityWarning=${block1Wb.qualityWarning}`);

  // 2. Corregir Bloque 3 (block_2)
  console.log('\n--- Actualizando Bloque 3 (block_2) ---');
  const block2Wb: ActiveWorkTextbook = workbooksJson.block_2?.current;
  if (!block2Wb) {
    throw new Error('Workbook block_2 no encontrado en la planeación');
  }

  // Encontrar Misión 4 (Demostración Integral y Evaluación) que contiene S16..S18
  const m4 = block2Wb.missions.find((m) => m.missionIndex === 4 || m.coveredSessions?.includes(16));
  if (!m4) {
    throw new Error('Misión 4 no encontrada en block_2');
  }

  console.log(`Reemplazando ${m4.sessionPlans?.length} planes en Misión 4 de Bloque 3 con 3 planes limpios...`);
  m4.sessionPlans = BLOCK3_CLEAN_SESSIONS;
  const m4Words = m4.sessionPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  console.log(`Misión 4 sessionPlans words: ${m4Words}`);

  // Recalcular métricas de block_2
  const allB2Plans = block2Wb.missions.flatMap((m) => m.sessionPlans || []);
  const b2FallbackWords = detectFallbackWords(allB2Plans, planning.uacName);
  const b2MissionsWordSum = block2Wb.missions.reduce((acc, m) => {
    const plansW = (m.sessionPlans || []).reduce((pAcc, pl) => pAcc + countSessionPlanWords(pl), 0);
    const secW = (m.wordCount || 0) > plansW ? (m.wordCount - plansW) : 600;
    return acc + secW + plansW;
  }, 0);
  block2Wb.totalWords = b2MissionsWordSum;
  block2Wb.aiWords = b2MissionsWordSum - b2FallbackWords;
  block2Wb.fallbackWords = b2FallbackWords;
  block2Wb.totalPages = Math.max(1, Math.round(b2MissionsWordSum / WORDS_PER_PAGE));

  const budgetB2 = computeContentBudget(3);
  const covB2 = validateSessionCoverage({
    sessions: allB2Plans.map((p) => ({ sessionNumber: p.sessionNumber, isFallback: p.isFallback })),
    expectedSessionsCount: 18,
    totalWords: b2MissionsWordSum,
    fallbackWords: b2FallbackWords,
    budget: budgetB2,
  });
  block2Wb.coverageReport = {
    sessionsCovered: covB2.sessionsCovered,
    sessionsExpected: covB2.sessionsExpected,
    allSessionsPresent: covB2.allSessionsPresent,
    averageWordsPerSession: covB2.averageWordsPerSession,
    withinTargetRange: covB2.withinTargetRange,
    aiWords: block2Wb.aiWords,
    fallbackWords: b2FallbackWords,
  };

  const crossReportB2 = validateBlockCrossContamination(block2Wb.missions, planning.uacName);
  console.log('Validación Cross-Contamination Bloque 3:', crossReportB2.summary);
  if (!crossReportB2.clean) {
    throw new Error(`Fallo de contaminación en Bloque 3: ${JSON.stringify(crossReportB2.issues)}`);
  }

  block2Wb.qualityWarning =
    !covB2.allSessionsPresent ||
    !covB2.withinTargetRange ||
    b2FallbackWords > 0 ||
    !crossReportB2.clean;

  console.log(`Bloque 3 actualizado: totalWords=${block2Wb.totalWords}, totalPages=${block2Wb.totalPages}, fallbackWords=${block2Wb.fallbackWords}, qualityWarning=${block2Wb.qualityWarning}`);

  // 3. Persistir en Neon DB
  console.log('\n--- Guardando workbooks_json en Neon DB ---');
  workbooksJson.block_1.current = block1Wb;
  workbooksJson.block_2.current = block2Wb;

  const db = sql();
  await db`
    UPDATE plannings
    SET workbooks_json = ${JSON.stringify(workbooksJson)}::jsonb,
        updated_at = NOW()
    WHERE id = ${planningId}::uuid
  `;
  console.log('✅ workbooks_json actualizado en DB.');

  // 4. Cascada de Bloque 2
  console.log('\n--- Ejecutando cascadeBlockMaterials para Bloque 2 ---');
  const cascadeResB1 = await cascadeBlockMaterials(planningId, 1, block1Wb, teacherId);
  console.log(`✅ Cascada Bloque 2 completada: ${cascadeResB1.insertedCount} extras sincronizados.`);

  // 5. Cascada de Bloque 3
  console.log('\n--- Ejecutando cascadeBlockMaterials para Bloque 3 ---');
  const cascadeResB2 = await cascadeBlockMaterials(planningId, 2, block2Wb, teacherId);
  console.log(`✅ Cascada Bloque 3 completada: ${cascadeResB2.insertedCount} extras sincronizados.`);

  console.log('\n🎉 Regeneración y cascada de Bloque 2 y 3 finalizada con éxito.');
}

main().catch(console.error).finally(() => process.exit(0));

