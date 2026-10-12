/**
 * build-editorial-fixture.ts
 * Genera el fixture canónico de capítulo para estudiante bajo Pensamiento Matemático II (Bloque 1)
 * con 14 sesiones completas, rigurosas, situadas en Puebla (PAEC) y validadas contra student-content-model.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StudentChapter, assertValidStudentChapter } from '../src/lib/editorial/student-content-model';

const chapter: StudentChapter = {
  uac: 'Pensamiento Matemático II',
  bloque: 'Bloque 1: Lugares Geométricos, Variación y Optimización en la Comunidad',
  semestre: 2,
  cicloEscolar: '2026–2027',
  plantel: 'Bachillerato General Oficial Cuauhtémoc',
  cct: '21EBH0245X',
  zonaEscolar: 'Zona 004 DBEPA Puebla',
  subsecretaria: 'Subsecretaría de Educación Media Superior Puebla',
  editorialSubtitle: 'Modelado Analítico, Geometría Analítica y Proyectos Comunitarios',
  sesiones: [
    {
      numero: 1,
      titulo: 'Sesión 1: El Plano Cartesiano como Mapa de tu Comunidad',
      objetivo: 'Aprenderás a ubicar puntos en el plano cartesiano y establecer sistemas de coordenadas relativos para mapear parcelas e infraestructura local.',
      motivacion: 'Imagina que en tu comunidad se va a instalar un nuevo sistema de alumbrado solar en la plaza principal. Para que los técnicos sepan con exactitud milimétrica dónde colocar cada poste, necesitan un sistema de coordenadas. Si fijas la entrada de la presidencia municipal como origen (0,0), cada rincón de la comunidad tiene una dirección numérica única.',
      saberesPrevios: 'Manejo básico de números enteros y positivos en la recta numérica; noción de distancia y orientación (norte, sur, este, oeste).',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'El plano cartesiano está formado por dos rectas numéricas perpendiculares llamadas ejes coordenados. El eje horizontal es el eje de las abscisas (eje X) y el eje vertical es el eje de las ordenadas (eje Y). El punto donde se cruzan es el origen O(0,0). Cada punto P en el plano se describe mediante un par ordenado (x, y), donde x indica el desplazamiento horizontal e y el vertical.'
        },
        {
          tipo: 'definicion',
          titulo: 'Par Ordenado y Cuadrantes',
          texto: 'Un par ordenado (x, y) es una pareja de números reales donde el orden importa: (a, b) ≠ (b, a) si a ≠ b. El plano se divide en cuatro cuadrantes: I (+,+), II (-,+), III (-,-) y IV (+,-).'
        },
        {
          tipo: 'formula',
          titulo: 'Representación Algebraica de Coordenadas',
          texto: 'P = (x_P, y_P) in RR^2'
        },
        {
          tipo: 'parrafo',
          texto: 'Cuando modelas situaciones de tu entorno, elegir el origen adecuado simplifica las ecuaciones. Por ejemplo, en un invernadero puedes ubicar el origen en la esquina suroeste para que todas las coordenadas de los aspersores sean positivas en el primer cuadrante.'
        },
        {
          tipo: 'tabla',
          columnas: ['Elemento', 'Signo en X', 'Signo en Y', 'Ejemplo de Coordenada'],
          filas: [
            ['Cuadrante I', 'Positivo (+)', 'Positivo (+)', 'Pozo de riego (15, 30)'],
            ['Cuadrante II', 'Negativo (-)', 'Positivo (+)', 'Bodega comunitaria (-8, 12)'],
            ['Cuadrante III', 'Negativo (-)', 'Negativo (-)', 'Presa de captación (-20, -15)'],
            ['Cuadrante IV', 'Positivo (+)', 'Negativo (-)', 'Límite ejidal sur (25, -10)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'En la cooperativa escolar, se instala un sistema de riego. El depósito central está en el origen (0, 0). Se colocan tres válvulas en V1(40, 20), V2(-30, 50) y V3(-20, -40), con distancias en metros. Determina en qué cuadrante está cada válvula y su distancia proyectada al eje horizontal.',
        pasos: [
          'Paso 1: Analiza la válvula V1(40, 20). Como x = 40 > 0 e y = 20 > 0, está en el Cuadrante I. Su distancia vertical al eje X es |y| = 20 metros.',
          'Paso 2: Analiza la válvula V2(-30, 50). Como x = -30 < 0 e y = 50 > 0, se ubica en el Cuadrante II. Su distancia al eje X es |y| = 50 metros.',
          'Paso 3: Analiza la válvula V3(-20, -40). Como ambas componentes son negativas, se sitúa en el Cuadrante III. Su distancia al eje X es |-40| = 40 metros.',
          'Paso 4: Conclusión: Los técnicos deben tender tuberías hacia tres cuadrantes distintos para abastecer uniformemente el cultivo.'
        ]
      },
      practica: [
        {
          enunciado: 'Un dron de vigilancia forestal despega de la torre de control en O(0,0). Vuela 60 metros al este y 80 metros al norte para revisar una parcela. Escribe las coordenadas de la parcela y calcula a qué distancia se encuentra del eje Y.',
          pista: 'Recuerda que el movimiento al este suma en X y el norte suma en Y. La distancia a un eje vertical corresponde al valor absoluto de la coordenada horizontal.'
        },
        {
          enunciado: 'Si una compuerta hidráulica está ubicada en el punto C(-45, 75), ¿cuántos metros al oeste y cuántos metros al norte del centro comunitario se localiza?',
          pista: 'El signo negativo en la primera coordenada señala dirección oeste.'
        }
      ],
      aplicacion: 'Dibuja en tu libreta un plano a escala de tu escuela o tu parcela familiar. Elige un punto de referencia fijo (la puerta de entrada o el pozo) como el origen O(0,0) y mide a pasos o con cinta métrica las coordenadas de al menos cuatro puntos clave.',
      autoevaluacion: [
        'Puedo identificar con precisión a qué cuadrante pertenece cualquier par ordenado.',
        'Entiendo por qué la elección del origen facilita la resolución de problemas comunitarios.',
        'Sé interpretar física y geométricamente la distancia de un punto hacia cada eje coordenado.'
      ],
      recursos: [
        {
          titulo: 'Video: El origen histórico del plano cartesiano y su uso en topografía',
          url: 'https://www.youtube.com/watch?v=cartesian-plane-intro',
          tipo: 'video'
        },
        {
          titulo: 'Guía interactiva GeoGebra: Graficación de puntos en el plano',
          url: 'https://www.geogebra.org/m/cartesian-intro',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Ábaco y Sistema Numérico',
        archivo: 'abaco.png',
        pie: 'Figura 1.1: Sistema posicional base para la comprensión de pares ordenados.'
      },
      sidenote: 'René Descartes introdujo en 1637 la unión del álgebra y la geometría, permitiendo transformar problemas de figuras en ecuaciones numéricas.'
    },
    {
      numero: 2,
      titulo: 'Sesión 2: Distancia Entre Dos Puntos: Midiendo Trayectos Reales',
      objetivo: 'Calcularás analíticamente la distancia euclidiana entre dos puntos cualesquiera usando el teorema de Pitágoras en el plano.',
      motivacion: 'Para conectar con internet comunitario dos aulas separadas en el plantel, el comité de padres necesita comprar cable de fibra óptica. Si medimos en línea recta sobre el terreno irregular, podemos cometer errores. Al fijar las coordenadas de ambas esquinas en un plano, el cálculo exacto nos dice cuántos metros comprar sin desperdiciar presupuesto.',
      saberesPrevios: 'Teorema de Pitágoras (c² = a² + b²); radicación y simplificación de expresiones algebraicas.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'La distancia euclidiana entre dos puntos P_1(x_1, y_1) y P_2(x_2, y_2) es la longitud del segmento de recta que los une. Al trazar líneas paralelas a los ejes coordenados desde ambos puntos, se forma un triángulo rectángulo cuya hipotenusa es la distancia buscada.'
        },
        {
          tipo: 'definicion',
          titulo: 'Distancia Euclidiana',
          texto: 'Es la medida de la separación en línea recta entre dos puntos en un espacio bidimensional, calculada a partir de las diferencias de sus coordenadas horizontal y vertical.'
        },
        {
          tipo: 'formula',
          titulo: 'Fórmula General de Distancia',
          texto: 'd = sqrt((x_2 - x_1)^2 + (y_2 - y_1)^2)'
        },
        {
          tipo: 'parrafo',
          texto: 'Observa que el orden en que tomes los puntos no altera el resultado, ya que (x_2 - x_1)² = (x_1 - x_2)². La distancia siempre es un valor real no negativo (d ≥ 0).'
        },
        {
          tipo: 'tabla',
          columnas: ['Caso de Posición', 'Condición Geométrica', 'Fórmula Simplificada'],
          filas: [
            ['Puntos en la misma horizontal', 'y_1 = y_2', 'd = |x_2 - x_1|'],
            ['Puntos en la misma vertical', 'x_1 = x_2', 'd = |y_2 - y_1|'],
            ['Puntos oblicuos generales', 'x_1 ≠ x_2 y y_1 ≠ y_2', 'd = sqrt(Delta x^2 + Delta y^2)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un poste eléctrico está en A(12, 18) y un transformador en B(36, 50), con unidades en metros. Calcula la longitud exacta de cable conductor necesaria para unirlos en línea recta.',
        pasos: [
          'Paso 1: Identifica las coordenadas: x_1 = 12, y_1 = 18, x_2 = 36, y_2 = 50.',
          'Paso 2: Calcula la diferencia horizontal: Delta x = 36 - 12 = 24 metros.',
          'Paso 3: Calcula la diferencia vertical: Delta y = 50 - 18 = 32 metros.',
          'Paso 4: Aplica los cuadrados: 24^2 = 576 y 32^2 = 1024.',
          'Paso 5: Suma y extrae la raíz cuadrada: d = sqrt(576 + 1024) = sqrt(1600) = 40 metros.',
          'Paso 6: Conclusión: Se requieren exactamente 40 metros de cable conductor.'
        ]
      },
      practica: [
        {
          enunciado: 'Dos estaciones meteorológicas escolares se ubican en M1(-15, 25) y M2(25, -15) en kilómetros. Calcula la distancia que las separa.',
          pista: 'Ten cuidado con los signos al restar: 25 - (-15) = 25 + 15 = 40.'
        },
        {
          enunciado: 'Verifica si el triángulo formado por los vértices P(0,0), Q(6,0) y R(3, 4) es isósceles calculando la longitud de sus tres lados.',
          pista: 'Un triángulo es isósceles si dos de sus lados miden exactamente lo mismo.'
        }
      ],
      aplicacion: 'Calcula la distancia real entre dos árboles o construcciones en tu comunidad usando una cuadrícula dibujada sobre Google Maps o un croquis manual.',
      autoevaluacion: [
        'Aplico correctamente la fórmula de distancia sin equivocarme en la ley de signos.',
        'Comprendo la deducción geométrica a partir del teorema de Pitágoras.',
        'Interpreto las unidades de medida en problemas de ingeniería rural.'
      ],
      recursos: [
        {
          titulo: 'Video demostrativo: Deducción visual de la distancia entre puntos',
          url: 'https://www.youtube.com/watch?v=distancia-puntos-pitagoras',
          tipo: 'video'
        },
        {
          titulo: 'Simulador PhET: Vector Addition y cálculo de magnitudes',
          url: 'https://phet.colorado.edu/es/simulations/vector-addition',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Cinta Métrica y Herramientas de Medición',
        archivo: 'alambre-ortodontico.png',
        pie: 'Figura 2.1: Material de precisión para contrastar distancias calculadas vs. medidas.'
      },
      sidenote: 'La distancia euclidiana es invariante ante rotaciones y traslaciones del sistema de coordenadas.'
    },
    {
      numero: 3,
      titulo: 'Sesión 3: Punto Medio y División de Segmentos',
      objetivo: 'Determinarás las coordenadas del punto medio y de puntos que dividen a un segmento en una razón dada para optimizar la logística comunitaria.',
      motivacion: 'Dos localidades vecinas de la Sierra Norte de Puebla quieren construir un centro de acopio de café a mitad de camino para que los productores de ambos lados caminen exactamente la misma distancia. ¿En qué coordenadas precisas del mapa debe colocarse el centro de acopio?',
      saberesPrevios: 'Promedios aritméticos simples; concepto de proporción y razón matemática.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'El punto medio M de un segmento de extremos A y B es aquel que divide al segmento en dos partes de igual longitud. Sus coordenadas corresponden al promedio aritmético simple de las coordenadas de los extremos.'
        },
        {
          tipo: 'definicion',
          titulo: 'Punto Medio de un Segmento',
          texto: 'El punto medio M(x_m, y_m) equidista de los extremos: dist(A, M) = dist(M, B). Es el baricentro de dos puntos con masas iguales.'
        },
        {
          tipo: 'formula',
          titulo: 'Coordenadas del Punto Medio',
          texto: 'x_m = (x_1 + x_2) / 2, quad y_m = (y_1 + y_2) / 2'
        },
        {
          tipo: 'parrafo',
          texto: 'De manera más general, un punto P puede dividir al segmento en una razón r = AP / PB. Cuando r = 1, P es el punto medio. Si r = 2, el punto P está dos veces más cerca de B que de A.'
        },
        {
          tipo: 'tabla',
          columnas: ['Razón r = AP/PB', 'Ubicación de P', 'Fórmula de Coordenada'],
          filas: [
            ['r = 1', 'Punto medio exacto', 'x = (x_1 + x_2)/2'],
            ['r = 1/2', 'A una tercera parte desde A', 'x = (x_1 + 0.5 x_2)/1.5'],
            ['r = 2', 'A dos terceras partes desde A', 'x = (x_1 + 2 x_2)/3']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un ducto de agua conecta la toma A(-14, 28) con el tanque B(46, 84). El comité de agua potable necesita instalar una válvula reguladora en el punto medio exacto M. Encuentra sus coordenadas.',
        pasos: [
          'Paso 1: Identifica las coordenadas de los extremos: x_1 = -14, y_1 = 28, x_2 = 46, y_2 = 84.',
          'Paso 2: Suma las abscisas: x_1 + x_2 = -14 + 46 = 32.',
          'Paso 3: Divide entre 2 para obtener la abscisa media: x_m = 32 / 2 = 16.',
          'Paso 4: Suma las ordenadas: y_1 + y_2 = 28 + 84 = 112.',
          'Paso 5: Divide entre 2 para obtener la ordenada media: y_m = 112 / 2 = 56.',
          'Paso 6: Conclusión: La válvula reguladora debe ubicarse en M(16, 56).'
        ]
      },
      practica: [
        {
          enunciado: 'Se desea colocar una antena repetidora a mitad de camino entre la escuela secundaria en S(10, 5) y el bachillerato en B(50, 45). Halla las coordenadas de la antena.',
          pista: 'Aplica el promedio simple tanto a las coordenadas en X como a las de Y.'
        },
        {
          enunciado: 'Si el punto medio de un segmento es M(4, 7) y uno de sus extremos es A(1, 3), ¿cuáles son las coordenadas del otro extremo B?',
          pista: 'Despeja x_2 de la ecuación 4 = (1 + x_2)/2 multiplicando primero por 2.'
        }
      ],
      aplicacion: 'Diseña una ruta de reparto para un micronegocio familiar y localiza el punto de descanso medio entre el almacén y el cliente más lejano.',
      autoevaluacion: [
        'Sé calcular el punto medio de cualquier segmento en el plano.',
        'Puedo despejar las coordenadas de un extremo desconocido si conozco el punto medio.',
        'Comprendo la utilidad logística de dividir segmentos en proporciones.'
      ],
      recursos: [
        {
          titulo: 'Video tutorial: Punto medio y división de segmentos en razón dada',
          url: 'https://www.youtube.com/watch?v=punto-medio-segmentos',
          tipo: 'video'
        },
        {
          titulo: 'Calculadora dinámica: GeoGebra Midpoint tool',
          url: 'https://www.geogebra.org/m/midpoint-segment',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Alicates y Tensado',
        archivo: 'alicates.png',
        pie: 'Figura 3.1: Fijación mecánica en el punto medio de un tendido de cables.'
      },
      sidenote: 'En física, el punto medio de dos masas iguales representa exactamente el centro de gravedad del sistema.',
      productoIntegrador: 'Identifica y calcula las coordenadas del punto medio del tendido principal para tu proyecto PAEC.'
    },
    {
      numero: 4,
      titulo: 'Sesión 4: La Pendiente de una Recta y el Relieve de Puebla',
      objetivo: 'Interpretarás geométrica y algebraicamente la pendiente de una recta como una razón de cambio constante entre elevación y avance horizontal.',
      motivacion: 'Las carreteras que cruzan la sierra de Puebla tienen curvas pronunciadas y pendientes reglamentadas por la SCT (Secretaría de Infraestructura, Comunicaciones y Transportes). Si una rampa para personas con discapacidad o una carretera es demasiado inclinada, los camiones o sillas de ruedas no pueden subir con seguridad. La matemática te permite calcular esa inclinación con total precisión.',
      saberesPrevios: 'Concepto de razón y división; signo positivo y negativo en operaciones básicas.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'La pendiente m de una recta no vertical es la medida de su inclinación. Se define como el cociente entre el cambio vertical (elevación Delta y) y el cambio horizontal (avance Delta x) entre dos puntos cualesquiera sobre la recta.'
        },
        {
          tipo: 'definicion',
          titulo: 'Pendiente como Razón de Cambio',
          texto: 'La pendiente representa la tasa instantánea y constante a la cual cambia la variable dependiente y por cada unidad que se incrementa la variable independiente x.'
        },
        {
          tipo: 'formula',
          titulo: 'Fórmula de la Pendiente',
          texto: 'm = (y_2 - y_1) / (x_2 - x_1) = (Delta y) / (Delta x), quad "con" x_1 != x_2'
        },
        {
          tipo: 'parrafo',
          texto: 'El signo de la pendiente indica la dirección de la recta: si m > 0 la recta sube hacia la derecha; si m < 0 baja; si m = 0 es completamente horizontal. Si x_1 = x_2, la pendiente no está definida (recta vertical).'
        },
        {
          tipo: 'tabla',
          columnas: ['Tipo de Pendiente', 'Comportamiento Gráfico', 'Ángulo de Inclinación theta'],
          filas: [
            ['Positiva (m > 0)', 'Asciende de izquierda a derecha', 'Agudo: 0° < theta < 90°'],
            ['Negativa (m < 0)', 'Desciende de izquierda a derecha', 'Obtuso: 90° < theta < 180°'],
            ['Nula (m = 0)', 'Línea completamente horizontal', 'theta = 0° (sin inclinación)'],
            ['Indefinida', 'Línea completamente vertical', 'theta = 90° (perpendicular al piso)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Una rampa de acceso para el auditorio escolar inicia en A(2, 0.4) y termina en B(14, 1.6), con medidas en metros. Calcula la pendiente de la rampa y su porcentaje de inclinación para verificar si cumple la norma de accesibilidad (máximo 10%).',
        pasos: [
          'Paso 1: Identifica los datos: x_1 = 2, y_1 = 0.4, x_2 = 14, y_2 = 1.6.',
          'Paso 2: Calcula la elevación vertical: Delta y = 1.6 - 0.4 = 1.2 metros.',
          'Paso 3: Calcula el avance horizontal: Delta x = 14 - 2 = 12 metros.',
          'Paso 4: Aplica la fórmula: m = 1.2 / 12 = 0.10.',
          'Paso 5: Convierte a porcentaje multiplicando por 100%: Pendiente = 0.10 * 100% = 10%.',
          'Paso 6: Conclusión: La rampa cumple exactamente con el límite máximo reglamentario de inclinación.'
        ]
      },
      practica: [
        {
          enunciado: 'Un sendero ecológico sube desde el punto P(100, 2100) hasta la cumbre en Q(500, 2380) en metros sobre el nivel del mar. Calcula la pendiente del sendero.',
          pista: 'Resta las altitudes para obtener Delta y y las distancias horizontales para Delta x.'
        },
        {
          enunciado: 'Una tubería de drenaje pluvial va de T1(0, 5) a T2(80, 1). Halla su pendiente e interpreta su signo negativo.',
          pista: 'Una pendiente negativa en drenaje garantiza que el agua fluya hacia abajo por gravedad.'
        }
      ],
      aplicacion: 'Mide la pendiente de una rampa o escalera en tu plantel midiendo con una regla el peralte (altura del escalón) y la huella (ancho del escalón).',
      autoevaluacion: [
        'Interpreto el significado del signo de la pendiente en situaciones reales.',
        'Sé calcular la pendiente a partir de las coordenadas de dos puntos.',
        'Relaciono la pendiente matemática con el porcentaje de inclinación en ingeniería.'
      ],
      recursos: [
        {
          titulo: 'Video interactivo: Pendiente y razón de cambio en carreteras',
          url: 'https://www.youtube.com/watch?v=pendiente-inclinacion-carreteras',
          tipo: 'video'
        },
        {
          titulo: 'Norma Técnica de Accesibilidad Universal en Espacios Educativos',
          url: 'https://normas.sep.gob.mx/accesibilidad-educativa',
          tipo: 'lectura'
        }
      ],
      materialSpot: {
        nombre: 'Altavoz y Señalización Vial',
        archivo: 'altavoz.png',
        pie: 'Figura 4.1: Señalización comunitaria preventiva en zonas de alta pendiente.'
      },
      sidenote: 'El ángulo de inclinación theta de una recta se relaciona directamente con la pendiente mediante la función trigonométrica: m = tan(theta).'
    },
    {
      numero: 5,
      titulo: 'Sesión 5: Ecuación Punto-Pendiente de la Recta',
      objetivo: 'Construirás la ecuación de una recta a partir de un punto conocido y su pendiente para modelar sistemas continuos como el consumo de agua.',
      motivacion: 'En un huerto escolar tecnificado, un tinaco de 1000 litros pierde agua a una tasa constante de 25 litros por hora debido al sistema de goteo. Si sabemos que a las 4 horas de riego quedaban 900 litros, podemos modelar el volumen restante en cualquier instante del día con una ecuación lineal.',
      saberesPrevios: 'Despeje algebraico de primer grado; concepto de pendiente m.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'Si conoces la pendiente m de una recta y las coordenadas de al menos un punto P_1(x_1, y_1) por donde pasa, cualquier otro punto general P(x, y) de la recta debe satisfacer la relación de pendiente m = (y - y_1) / (x - x_1). Al despejar el denominador, se obtiene la forma punto-pendiente.'
        },
        {
          tipo: 'definicion',
          titulo: 'Ecuación Punto-Pendiente',
          texto: 'Es la expresión algebraica lineal más directa para representar una recta cuando se conoce su inclinación y un punto de anclaje geométrico.'
        },
        {
          tipo: 'formula',
          titulo: 'Forma Punto-Pendiente',
          texto: 'y - y_1 = m (x - x_1)'
        },
        {
          tipo: 'parrafo',
          texto: 'Esta forma es extraordinariamente potente porque no requiere conocer la intersección con el eje Y por adelantado. Una vez escrita, puede transformarse algebraicamente a la forma pendiente-ordenada al origen: y = m x + b.'
        },
        {
          tipo: 'tabla',
          columnas: ['Dato de Entrada', 'Estructura Algebraica', 'Transformación a y = mx + b'],
          filas: [
            ['P(2, 5), m = 3', 'y - 5 = 3(x - 2)', 'y = 3x - 6 + 5 -> y = 3x - 1'],
            ['P(-1, 4), m = -2', 'y - 4 = -2(x - (-1))', 'y = -2x - 2 + 4 -> y = -2x + 2'],
            ['P(0, 7), m = 0.5', 'y - 7 = 0.5(x - 0)', 'y = 0.5x + 7 (b = 7 directo)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un sistema de captación pluvial comunitario registra que tras 3 horas de lluvia (x = 3) se han recolectado 150 litros (y = 150). El pluviómetro indica que la tasa constante de captación es de 40 litros por hora (m = 40). Encuentra la ecuación lineal de recolección y calcula cuántos litros habrá tras 8 horas de lluvia.',
        pasos: [
          'Paso 1: Identifica el punto conocido y la pendiente: P_1(3, 150) y m = 40.',
          'Paso 2: Escribe la forma punto-pendiente: y - 150 = 40(x - 3).',
          'Paso 3: Desarrolla el producto del lado derecho: y - 150 = 40x - 120.',
          'Paso 4: Despeja y: y = 40x - 120 + 150 -> y = 40x + 30.',
          'Paso 5: Evalúa en x = 8 horas: y = 40(8) + 30 = 320 + 30 = 350 litros.',
          'Paso 6: Conclusión: La ecuación es y = 40x + 30, y a las 8 horas habrá 350 litros recolectados.'
        ]
      },
      practica: [
        {
          enunciado: 'Una cooperativa agrícola vende bultos de abono orgánico. El costo fijo inicial de empaque y transporte sitúa el modelo en P(5, 450) con un costo marginal por bulto de m = 70 pesos. Escribe la ecuación de costo y calcula el costo de 20 bultos.',
          pista: 'Usa y - 450 = 70(x - 5) y luego despeja la variable de costo y.'
        },
        {
          enunciado: 'Halla la ecuación de la recta que pasa por el punto A(-4, 6) y tiene una pendiente de m = -3/2.',
          pista: 'Cuidado con el doble signo: x - (-4) se convierte en x + 4.'
        }
      ],
      aplicacion: 'Modela un gasto constante en tu hogar (como el costo de recarga de datos móviles o gas LP) como una función lineal y = mx + b y proyecta tu gasto mensual.',
      autoevaluacion: [
        'Puedo escribir la forma punto-pendiente sin dudar en los signos.',
        'Sé convertir de forma fluida la forma punto-pendiente a la forma y = mx + b.',
        'Interpreto la ordenada al origen b como el estado inicial del sistema físico.'
      ],
      recursos: [
        {
          titulo: 'Laboratorio virtual GeoGebra: La recta punto-pendiente',
          url: 'https://www.geogebra.org/m/point-slope-form',
          tipo: 'web'
        },
        {
          titulo: 'Video: Modelado lineal de fenómenos cotidianos',
          url: 'https://www.youtube.com/watch?v=modelado-lineal-aplicaciones',
          tipo: 'video'
        }
      ],
      materialSpot: {
        nombre: 'Aspersor de Riego Agrícola',
        archivo: 'aspersor-riego.png',
        pie: 'Figura 5.1: Flujo constante de riego modelado mediante ecuaciones lineales.'
      },
      sidenote: 'En la forma y = mx + b, el término independiente b indica exactamente dónde la recta corta al eje vertical Y (cuando x = 0).'
    },
    {
      numero: 6,
      titulo: 'Sesión 6: Ecuación General de la Recta y Paralelismo',
      objetivo: 'Formularás la ecuación general Ax + By + C = 0 y aplicarás el criterio de pendientes iguales para trazar rectas paralelas en linderos agrícolas.',
      motivacion: 'Al preparar la tierra para el ciclo agrícola en los valles de Tehuacán y Serdán, los surcos de siembra deben ser perfectamente paralelos entre sí. Si dos surcos se desviaran, la maquinaria aplastaría las plantas al cosechar. La condición algebraica de paralelismo garantiza surcos uniformes.',
      saberesPrevios: 'Identificación de la pendiente m; suma y resta de monomios semejantes.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'Toda recta en el plano puede expresarse en la forma general Ax + By + C = 0, donde A, B y C son números reales y al menos uno entre A y B es distinto de cero. Cuando B ≠ 0, la pendiente de la recta se obtiene inmediatamente como m = -A / B y su corte con el eje Y es b = -C / B.'
        },
        {
          tipo: 'definicion',
          titulo: 'Condición de Paralelismo',
          texto: 'Dos rectas L_1 y L_2 en el plano son paralelas (L_1 || L_2) si y solo si tienen la misma pendiente: m_1 = m_2, y distintas ordenadas al origen (b_1 ≠ b_2).'
        },
        {
          tipo: 'formula',
          titulo: 'Ecuación General y Criterio de Paralelismo',
          texto: 'A x + B y + C = 0, quad "con" m = -A / B; quad L_1 || L_2 <==> m_1 = m_2'
        },
        {
          tipo: 'parrafo',
          texto: 'Dos rectas paralelas nunca se intersectan en el plano euclidiano, manteniendo siempre una separación perpendicular constante entre ellas.'
        },
        {
          tipo: 'tabla',
          columnas: ['Ecuación General', 'Coeficientes (A, B, C)', 'Pendiente m = -A/B'],
          filas: [
            ['3x - 2y + 6 = 0', 'A=3, B=-2, C=6', 'm = -3/(-2) = 1.5'],
            ['4x + y - 10 = 0', 'A=4, B=1, C=-10', 'm = -4/1 = -4'],
            ['6x - 4y - 15 = 0', 'A=6, B=-4, C=-15', 'm = -6/(-4) = 1.5 (Paralela a la primera)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'El lindero norte de una parcela escolar sigue la recta L_1: 4x - 6y + 15 = 0. Se desea trazar un nuevo surco L_2 paralelo a este lindero que pase por el punto de control P(3, 7). Encuentra la ecuación general de L_2.',
        pasos: [
          'Paso 1: Calcula la pendiente de L_1 usando m = -A/B: m_1 = -4 / (-6) = 2/3.',
          'Paso 2: Por condición de paralelismo, la pendiente del nuevo surco debe ser igual: m_2 = 2/3.',
          'Paso 3: Usa la forma punto-pendiente con P(3, 7): y - 7 = (2/3)(x - 3).',
          'Paso 4: Multiplica toda la ecuación por 3 para eliminar fracciones: 3(y - 7) = 2(x - 3).',
          'Paso 5: Expande los términos: 3y - 21 = 2x - 6.',
          'Paso 6: Iguala a cero en forma general: 2x - 3y + 15 = 0. Conclusión: L_2 tiene la misma proporción de coeficientes en x e y.'
        ]
      },
      practica: [
        {
          enunciado: 'Determina si las rectas L_a: 5x - 2y + 8 = 0 y L_b: 10x - 4y - 3 = 0 son paralelas calculando la pendiente de cada una.',
          pista: 'Calcula m_a = -5/(-2) y m_b = -10/(-4) y simplifica las fracciones.'
        },
        {
          enunciado: 'Encuentra la ecuación general de una recta paralela a 3x + y - 4 = 0 que pase por el punto Q(-2, 5).',
          pista: 'La pendiente buscada es m = -3/1 = -3.'
        }
      ],
      aplicacion: 'Observa las vigas del techo de tu salón o las líneas de una cancha deportiva. Comprueba cómo los constructores utilizan la propiedad de pendientes iguales para mantener la simetría estructural.',
      autoevaluacion: [
        'Sé extraer la pendiente directamente de la ecuación general usando m = -A/B.',
        'Aplico con seguridad la condición m_1 = m_2 para encontrar rectas paralelas.',
        'Puedo transformar entre la forma general y la forma pendiente-ordenada al origen.'
      ],
      recursos: [
        {
          titulo: 'Video: Ecuación general de la recta y rectas paralelas explicadas paso a paso',
          url: 'https://www.youtube.com/watch?v=rectas-paralelas-ecuacion-general',
          tipo: 'video'
        },
        {
          titulo: 'Explorador GeoGebra: Familias de rectas paralelas',
          url: 'https://www.geogebra.org/m/parallel-lines-family',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Kit Arduino y Sensores de Alineación',
        archivo: 'arduino-kit.png',
        pie: 'Figura 6.1: Dispositivo programable para verificar paralelismo con sensores de distancia.'
      },
      sidenote: 'Dos rectas paralelas siempre pueden escribirse con los mismos coeficientes A y B, variando únicamente el término independiente C.'
    },
    {
      numero: 7,
      titulo: 'Sesión 7: Rectas Perpendiculares y Ángulos Rectos en la Construcción',
      objetivo: 'Aplicarás la condición de perpendicularidad de pendientes m_1 * m_2 = -1 para diseñar esquinas en ángulo recto y calcular distancias mínimas.',
      motivacion: 'Al construir un aula o un invernadero escolar, una de las tareas más críticas es "sacar la escuadra": garantizar que las paredes formen exactamente un ángulo de 90°. Si las paredes no son perpendiculares, el techo prefabricado no encajará y la estructura será vulnerable ante sismos. La geometría analítica traduce la escuadra a una multiplicación de pendientes.',
      saberesPrevios: 'Multiplicación de fracciones; recíprocos y números simétricos.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'Dos rectas no verticales son perpendiculares si se intersectan formando un ángulo recto de 90°. En geometría analítica, esto se traduce en que sus pendientes son recíprocas y de signo contrario (opuestas).'
        },
        {
          tipo: 'definicion',
          titulo: 'Condición de Perpendicularidad',
          texto: 'Dos rectas L_1 y L_2 con pendientes m_1 y m_2 son perpendiculares (L_1 ⊥ L_2) si y solo si el producto de sus pendientes es igual a menos uno: m_1 * m_2 = -1, o de forma equivalente, m_2 = -1 / m_1.'
        },
        {
          tipo: 'formula',
          titulo: 'Criterio de Perpendicularidad',
          texto: 'L_1 bot L_2 <==> m_1 cdot m_2 = -1 <==> m_2 = - 1 / m_1'
        },
        {
          tipo: 'parrafo',
          texto: 'Si una recta tiene pendiente m = 4, cualquier recta perpendicular a ella tendrá pendiente m_⊥ = -1/4. Si una recta es horizontal (m = 0), su perpendicular es una recta vertical cuya pendiente no está definida.'
        },
        {
          tipo: 'tabla',
          columnas: ['Pendiente de Recta L_1', 'Cálculo de Recíproca Negativa', 'Pendiente Perpendicular L_2'],
          filas: [
            ['m = 2', '-(1 / 2)', 'm_⊥ = -1/2 = -0.5'],
            ['m = -3/4', '-(-4 / 3)', 'm_⊥ = 4/3 ≈ 1.33'],
            ['m = 1/5', '-(5 / 1)', 'm_⊥ = -5'],
            ['m = 1 (45°)', '-(1 / 1)', 'm_⊥ = -1 (135°)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un muro principal del nuevo laboratorio sigue la trayectoria de la recta L_1: 2x - 5y + 10 = 0. Se necesita construir un muro divisorio perpendicular L_2 que comience en el vértice P(4, -1). Encuentra la ecuación general del muro divisorio.',
        pasos: [
          'Paso 1: Determina la pendiente de L_1 usando m = -A/B: m_1 = -2 / (-5) = 2/5.',
          'Paso 2: Aplica el criterio de perpendicularidad: m_2 = -1 / (2/5) = -5/2.',
          'Paso 3: Usa la forma punto-pendiente con P(4, -1): y - (-1) = (-5/2)(x - 4).',
          'Paso 4: Multiplica por 2 para eliminar el denominador: 2(y + 1) = -5(x - 4).',
          'Paso 5: Desarrolla los paréntesis: 2y + 2 = -5x + 20.',
          'Paso 6: Iguala a cero reuniendo los términos: 5x + 2y - 18 = 0. Conclusión: El muro divisorio asegura un ángulo de 90° exacto con el muro principal.'
        ]
      },
      practica: [
        {
          enunciado: 'Una tubería de desagüe sigue la recta 3x + 4y - 12 = 0. Se va a conectar un ramal perpendicular que llega desde la toma T(6, 8). Halla la pendiente y la ecuación de dicho ramal.',
          pista: 'La pendiente de la tubería original es m_1 = -3/4. Su perpendicular es el inverso con signo cambiado: +4/3.'
        },
        {
          enunciado: 'Comprueba si las rectas L_a: y = (2/7)x + 3 y L_b: y = (-7/2)x - 5 son perpendiculares multiplicando sus pendientes.',
          pista: 'Multiplica (2/7) * (-7/2). Si el producto es -1, son perpendiculares.'
        }
      ],
      aplicacion: 'Aplica el método clásico de albañilería "3-4-5" (terna pitagórica) en una esquina de tu casa o patio escolar para verificar si las paredes forman un ángulo recto exacto.',
      autoevaluacion: [
        'Comprendo por qué la multiplicación de pendientes de rectas perpendiculares da -1.',
        'Sé calcular el inverso aditivo y multiplicativo de cualquier fracción.',
        'Puedo formular ecuaciones de rectas perpendiculares para planos de construcción.'
      ],
      recursos: [
        {
          titulo: 'Video: Por qué m1 * m2 = -1 (demostración geométrica)',
          url: 'https://www.youtube.com/watch?v=demostracion-perpendicularidad-rectas',
          tipo: 'video'
        },
        {
          titulo: 'Simulador: Ángulos entre rectas en el plano cartesiano',
          url: 'https://www.geogebra.org/m/perpendicular-lines-angle',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Balanza de Precisión y Nivel',
        archivo: 'balanza-algebraica.png',
        pie: 'Figura 7.1: Equilibrio vectorial y nivelación en ángulos de 90 grados.'
      },
      sidenote: 'El método constructivo 3-4-5 se basa en el teorema de Pitágoras: 3² + 4² = 9 + 16 = 25 = 5², garantizando un ángulo recto sin necesidad de transportador.',
      productoIntegrador: 'Elabora el plano del trazado ortogonal y conexiones perpendiculares de la red comunitaria.'
    },
    {
      numero: 8,
      titulo: 'Sesión 8: Intersección de Rectas y Sistemas de Ecuaciones Lineales',
      objetivo: 'Resolverás sistemas de ecuaciones lineales 2x2 mediante el método analítico y gráfico para localizar el punto de equilibrio en proyectos económicos escolares.',
      motivacion: 'El club de emprendimiento de tu bachillerato elabora mermeladas de manzana de Zacatlán. Tienen costos fijos (frascos, etiquetas, gas) de 1200 pesos y un costo de producción de 20 pesos por frasco. Si venden cada frasco en 50 pesos, ¿cuántos frascos deben vender exactamente para no ganar ni perder dinero? La intersección de las dos rectas marca el punto de equilibrio.',
      saberesPrevios: 'Métodos de igualación, sustitución y reducción para resolver sistemas 2x2.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'El punto de intersección P(x, y) entre dos rectas es el punto que pertenece simultáneamente a ambas. Gráficamente corresponde al cruce visual de las dos líneas, y algebraicamente es la solución única de un sistema de dos ecuaciones lineales con dos incógnitas.'
        },
        {
          tipo: 'definicion',
          titulo: 'Punto de Equilibrio (Break-Even Point)',
          texto: 'En economía y administración de proyectos comunitarios, es el volumen de producción donde los ingresos totales igualan a los costos totales, marcando el umbral donde el proyecto comienza a generar utilidades.'
        },
        {
          tipo: 'formula',
          titulo: 'Sistema de Ecuaciones de Intersección',
          texto: 'cases(y = m_1 x + b_1, y = m_2 x + b_2) ==> m_1 x + b_1 = m_2 x + b_2'
        },
        {
          tipo: 'parrafo',
          texto: 'Si las rectas tienen pendientes distintas (m_1 ≠ m_2), el sistema siempre tiene una solución única. Si tienen la misma pendiente pero diferente ordenada, no se cruzan nunca (sistema inconsistente). Si coinciden en todo, hay infinitas soluciones.'
        },
        {
          tipo: 'tabla',
          columnas: ['Relación de Pendientes', 'Número de Intersecciones', 'Significado en un Proyecto'],
          filas: [
            ['m_1 ≠ m_2', 'Exactamente una solución', 'Punto de equilibrio alcanzable y único'],
            ['m_1 = m_2 y b_1 ≠ b_2', 'Cero soluciones (Paralelas)', 'Los ingresos jamás alcanzan a los costos'],
            ['m_1 = m_2 y b_1 = b_2', 'Infinitas soluciones (Coincidentes)', 'Los modelos son idénticos en todo momento']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'En la cooperativa de mermeladas, los costos totales siguen la recta C: y = 20x + 1200 (donde x es el número de frascos y y es el dinero en pesos). Los ingresos por ventas siguen la recta I: y = 50x. Calcula el punto de equilibrio resolviendo el sistema.',
        pasos: [
          'Paso 1: Plantea el sistema igualando ingresos y costos: 50x = 20x + 1200.',
          'Paso 2: Resta 20x de ambos lados para agrupar términos en x: 50x - 20x = 1200 -> 30x = 1200.',
          'Paso 3: Despeja el número de frascos: x = 1200 / 30 = 40 frascos.',
          'Paso 4: Sustituye x = 40 en la ecuación de ingresos para hallar el monto de dinero: y = 50(40) = 2000 pesos.',
          'Paso 5: Comprueba en los costos: y = 20(40) + 1200 = 800 + 1200 = 2000 pesos.',
          'Paso 6: Conclusión: El punto de intersección es P(40, 2000). A partir del frasco 41, la cooperativa obtiene ganancias netas.'
        ]
      },
      practica: [
        {
          enunciado: 'Encuentra las coordenadas del punto de cruce entre las rectas L_1: 2x + y = 8 y L_2: x - y = 1.',
          pista: 'Suma directamente ambas ecuaciones para eliminar la variable y: (2x + x) + (y - y) = 8 + 1.'
        },
        {
          enunciado: 'Dos senderistas caminan por rutas rectas representadas por y = 3x - 5 e y = -x + 7. ¿En qué punto se encontrarán si mantienen su paso constante?',
          pista: 'Iguala ambas expresiones para x: 3x - 5 = -x + 7 y despeja x.'
        }
      ],
      aplicacion: 'Calcula el punto de equilibrio para una venta escolar de gelatinas, pan o artesanías, considerando el costo de los ingredientes y el precio de venta propuesto.',
      autoevaluacion: [
        'Sé resolver un sistema de ecuaciones lineales por igualación y sustitución.',
        'Interpreto gráficamente el punto de corte de dos rectas en el plano cartesiano.',
        'Aplico el concepto de punto de equilibrio a proyectos productivos de mi comunidad.'
      ],
      recursos: [
        {
          titulo: 'Video: Punto de equilibrio financiero explicado con gráficas lineales',
          url: 'https://www.youtube.com/watch?v=punto-equilibrio-lineal',
          tipo: 'video'
        },
        {
          titulo: 'Herramienta de simulación de intersecciones en GeoGebra',
          url: 'https://www.geogebra.org/m/intersection-two-lines',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Archivo Histórico y Registro Contable',
        archivo: 'archivo-historico.png',
        pie: 'Figura 8.1: Registro de costos y balances financieros en proyectos productivos.'
      },
      sidenote: 'El punto de equilibrio fue formalizado por economistas del siglo XX para evaluar la viabilidad de empresas sin riesgo de bancarrota.'
    },
    {
      numero: 9,
      titulo: 'Sesión 9: La Circunferencia: Radio de Cobertura y Almacenamiento',
      objetivo: 'Definirás la circunferencia como lugar geométrico y formularás su ecuación con centro en el origen para calcular radios de cobertura de servicios.',
      motivacion: 'Una antena comunitaria de alerta sísmica o de radio FM se instala en el centro del pueblo (0,0). La señal tiene una potencia que cubre un radio circular de 5 kilómetros a la redonda. ¿Cómo podemos saber con una sola ecuación matemática si una ranchería o escuela ubicada en P(3, 4) o en Q(4, 4) recibirá la señal de alerta?',
      saberesPrevios: 'Definición de radio y diámetro; teorema de Pitágoras.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'La circunferencia es el lugar geométrico de todos los puntos del plano que equidistan de un punto fijo llamado centro. La distancia constante desde cualquier punto de la circunferencia hacia el centro se denomina radio (r).'
        },
        {
          tipo: 'definicion',
          titulo: 'Circunferencia con Centro en el Origen',
          texto: 'Es el conjunto de puntos P(x, y) tales que dist(O, P) = r. Al elevar al cuadrado la fórmula de distancia con O(0,0), se obtiene su ecuación canónica.'
        },
        {
          tipo: 'formula',
          titulo: 'Ecuación Canónica de la Circunferencia',
          texto: 'x^2 + y^2 = r^2'
        },
        {
          tipo: 'parrafo',
          texto: 'Si un punto P(x, y) cumple que x² + y² < r², se encuentra en el interior del círculo (dentro del área de cobertura). Si x² + y² = r², está exactamente en el límite exterior. Si x² + y² > r², está fuera del alcance de la señal.'
        },
        {
          tipo: 'tabla',
          columnas: ['Posición del Punto P(x, y)', 'Condición Algebraica', 'Significado en Cobertura'],
          filas: [
            ['Punto interior', 'x^2 + y^2 < r^2', 'Zona con excelente recepción de señal'],
            ['Sobre la circunferencia', 'x^2 + y^2 = r^2', 'Límite máximo de cobertura del servicio'],
            ['Punto exterior', 'x^2 + y^2 > r^2', 'Zona de sombra sin cobertura de señal']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un aspersor de pivote central en un campo de hortalizas gira alrededor del origen O(0,0) y alcanza un radio de riego de r = 25 metros. Escribe su ecuación y determina si una planta ubicada en A(15, 20) y otra en B(18, 19) recibirán agua.',
        pasos: [
          'Paso 1: Escribe la ecuación canónica: x^2 + y^2 = 25^2 -> x^2 + y^2 = 625.',
          'Paso 2: Evalúa para la planta A(15, 20): 15^2 + 20^2 = 225 + 400 = 625.',
          'Paso 3: Como 625 = 625, la planta A está exactamente en el perímetro máximo alcanzado por el agua.',
          'Paso 4: Evalúa para la planta B(18, 19): 18^2 + 19^2 = 324 + 361 = 685.',
          'Paso 5: Compara con el radio al cuadrado: Como 685 > 625, la planta B está fuera del alcance.',
          'Paso 6: Conclusión: La planta A sí recibe riego, pero la planta B requiere reubicar el aspersor o instalar uno secundario.'
        ]
      },
      practica: [
        {
          enunciado: 'Halla la ecuación canónica de una cisterna circular construida en el origen cuyo diámetro mide 16 metros.',
          pista: 'El radio es la mitad del diámetro: r = 16 / 2 = 8 metros. Luego eleva al cuadrado: r² = 64.'
        },
        {
          enunciado: 'Una antena transmisora tiene la ecuación de cobertura x² + y² = 100 (en kilómetros cuadrados). ¿Está una comunidad situada en C(6, 7) dentro del área cubierta?',
          pista: 'Calcula 6² + 7² = 36 + 49 = 85 y compáralo con 100.'
        }
      ],
      aplicacion: 'Calcula el radio de acción de una lámpara de alumbrado público o del altavoz de la presidencia de comunidad y determina qué casas quedan dentro del círculo de beneficio.',
      autoevaluacion: [
        'Comprendo la diferencia entre círculo (área) y circunferencia (perímetro/curva).',
        'Sé escribir y aplicar la ecuación canónica x² + y² = r².',
        'Puedo determinar analíticamente si un punto es interior, frontera o exterior.'
      ],
      recursos: [
        {
          titulo: 'Video didáctico: La circunferencia como lugar geométrico y sus aplicaciones',
          url: 'https://www.youtube.com/watch?v=circunferencia-lugar-geometrico',
          tipo: 'video'
        },
        {
          titulo: 'Simulador dinámico: Radio de cobertura de antenas en GeoGebra',
          url: 'https://www.geogebra.org/m/coverage-circle',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Aros y Calibres Circulares',
        archivo: 'aros.png',
        pie: 'Figura 9.1: Instrumentos geométricos para trazo de circunferencias y diámetros.'
      },
      sidenote: 'El número pi (π ≈ 3.14159) es la constante universal que relaciona el perímetro de cualquier circunferencia con su diámetro.'
    },
    {
      numero: 10,
      titulo: 'Sesión 10: Ecuación Ordinaria y General de la Circunferencia',
      objetivo: 'Formularás la ecuación ordinaria (x - h)² + (y - k)² = r² de una circunferencia con centro desplazado C(h, k) y la transformarás a su forma general.',
      motivacion: 'Ante la actividad del volcán Popocatépetl en Puebla, Protección Civil establece un radio de exclusión de seguridad de 12 kilómetros alrededor del cráter. Dado que el cráter del volcán no está en el centro de la ciudad de Puebla sino desplazado a coordenadas geográficas específicas C(h, k), se requiere una ecuación con centro fuera del origen para calcular con precisión las rutas seguras de evacuación.',
      saberesPrevios: 'Desarrollo de binomios al cuadrado: (a ± b)² = a² ± 2ab + b².',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'Cuando el centro de la circunferencia se encuentra en un punto cualquiera C(h, k) distinto del origen, la distancia de cualquier punto P(x, y) de la curva al centro sigue siendo igual al radio r. Aplicando la fórmula de distancia obtenemos la forma ordinaria.'
        },
        {
          tipo: 'definicion',
          titulo: 'Ecuación Ordinaria de la Circunferencia',
          texto: 'Es la ecuación de una circunferencia cuyo centro está ubicado en el punto C(h, k) y tiene un radio r > 0.'
        },
        {
          tipo: 'formula',
          titulo: 'Forma Ordinaria y Forma General',
          texto: '(x - h)^2 + (y - k)^2 = r^2 <===> x^2 + y^2 + D x + E y + F = 0'
        },
        {
          tipo: 'parrafo',
          texto: 'Al expandir los dos binomios al cuadrado y ordenar los términos de mayor a menor grado, obtenemos la ecuación general, donde D = -2h, E = -2k y F = h² + k² - r².'
        },
        {
          tipo: 'tabla',
          columnas: ['Parámetros del Centro y Radio', 'Forma Ordinaria', 'Forma General'],
          filas: [
            ['C(3, 2), r = 5', '(x - 3)^2 + (y - 2)^2 = 25', 'x^2 + y^2 - 6x - 4y - 12 = 0'],
            ['C(-4, 1), r = 3', '(x + 4)^2 + (y - 1)^2 = 9', 'x^2 + y^2 + 8x - 2y + 8 = 0'],
            ['C(0, -5), r = 4', 'x^2 + (y + 5)^2 = 16', 'x^2 + y^2 + 10y + 9 = 0']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un radar de vigilancia forestal en la Sierra Negra de Puebla se instala en el cerro con coordenadas C(-3, 5) y tiene un alcance de detección de r = 10 kilómetros. Encuentra su ecuación ordinaria y desarróllala a su forma general.',
        pasos: [
          'Paso 1: Identifica los datos: h = -3, k = 5, r = 10.',
          'Paso 2: Sustituye en la ecuación ordinaria cuidando los signos: (x - (-3))^2 + (y - 5)^2 = 10^2 -> (x + 3)^2 + (y - 5)^2 = 100.',
          'Paso 3: Desarrolla el primer binomio: (x + 3)^2 = x^2 + 6x + 9.',
          'Paso 4: Desarrolla el segundo binomio: (y - 5)^2 = y^2 - 10y + 25.',
          'Paso 5: Agrupa todos los términos a la izquierda: x^2 + 6x + 9 + y^2 - 10y + 25 - 100 = 0.',
          'Paso 6: Reduce los términos constantes (9 + 25 - 100 = -66) y ordena: x^2 + y^2 + 6x - 10y - 66 = 0.'
        ]
      },
      practica: [
        {
          enunciado: 'Escribe la ecuación ordinaria y general de una glorieta vehicular con centro en C(6, -2) y radio r = 7 metros.',
          pista: 'Recuerda que (y - (-2))² se escribe como (y + 2)².'
        },
        {
          enunciado: 'A partir de la ecuación general x² + y² - 8x + 4y - 5 = 0, halla las coordenadas de su centro C(h, k) sabiendo que h = -D/2 y k = -E/2.',
          pista: 'h = -(-8)/2 = 4 y k = -(4)/2 = -2.'
        }
      ],
      aplicacion: 'Ubica el centro de salud de tu cabecera municipal como C(h, k) en un mapa y traza el círculo de tiempo de respuesta de ambulancias a 15 minutos.',
      autoevaluacion: [
        'Puedo plantear la ecuación ordinaria con centros en cualquier cuadrante.',
        'Desarrollo binomios al cuadrado sin cometer errores en el doble producto.',
        'Sé extraer el centro y radio a partir de los coeficientes de la ecuación general.'
      ],
      recursos: [
        {
          titulo: 'Video tutorial: De la ecuación ordinaria a la general de la circunferencia',
          url: 'https://www.youtube.com/watch?v=circunferencia-ordinaria-a-general',
          tipo: 'video'
        },
        {
          titulo: 'Herramienta interactiva: Circunferencia con centro (h,k) en GeoGebra',
          url: 'https://www.geogebra.org/m/circle-center-hk',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Cámara de Seguridad y Domo Circular',
        archivo: 'autoclave.png',
        pie: 'Figura 10.1: Domo de contención y radios de seguridad perimetral.'
      },
      sidenote: 'Completar el trinomio cuadrado perfecto es el procedimiento algebraico inverso que permite transformar la ecuación general de regreso a la forma ordinaria.'
    },
    {
      numero: 11,
      titulo: 'Sesión 11: La Parábola como Modelo de Concentración de Energía',
      objetivo: 'Identificarás los elementos geométricos de la parábola (vértice, foco, directriz) y formularás su ecuación para diseñar captadores y hornos solares comunitarios.',
      motivacion: 'En comunidades rurales de Puebla donde el costo del gas LP es elevado, los hornos solares parabólicos representan una solución limpia y gratuita para cocinar y calentar agua. La forma parabólica tiene una propiedad óptica asombrosa: todos los rayos solares paralelos que chocan contra su superficie rebotan y se concentran exactamente en un único punto focal. Si colocas una olla en el foco, ¡el agua hierve rápidamente con energía del sol!',
      saberesPrevios: 'Concepto de distancia; propiedades de reflexión de la luz.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'La parábola es el lugar geométrico de todos los puntos del plano que equidistan de un punto fijo llamado foco (F) y de una recta fija llamada directriz (d). El punto medio entre el foco y la directriz sobre la parábola es el vértice (V).'
        },
        {
          tipo: 'definicion',
          titulo: 'Propiedad Óptica y Focal de la Parábola',
          texto: 'Cualquier rayo que incide paralelamente al eje de simetría de un reflector parabólico es reflejado directamente hacia el foco, concentrando calor, luz u ondas electromagnéticas.'
        },
        {
          tipo: 'formula',
          titulo: 'Ecuación Canónica de la Parábola con Vértice en el Origen',
          texto: 'x^2 = 4 p y quad ("vertical, abre hacia arriba si" p > 0)'
        },
        {
          tipo: 'parrafo',
          texto: 'El parámetro p es la distancia dirigida desde el vértice hasta el foco. La longitud del ancho focal o lado recto es |4p|, que mide el ancho de la parábola a la altura del foco.'
        },
        {
          tipo: 'tabla',
          columnas: ['Orientación del Eje', 'Ecuación Canónica', 'Coordenadas del Foco F', 'Ecuación de la Directriz'],
          filas: [
            ['Vertical (abre arriba)', 'x^2 = 4p y (p > 0)', 'F(0, p)', 'y = -p'],
            ['Vertical (abre abajo)', 'x^2 = -4p y (p > 0)', 'F(0, -p)', 'y = p'],
            ['Horizontal (abre derecha)', 'y^2 = 4p x (p > 0)', 'F(p, 0)', 'x = -p'],
            ['Horizontal (abre izquierda)', 'y^2 = -4p x (p > 0)', 'F(-p, 0)', 'x = p']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un grupo de estudiantes diseña un concentrador solar parabólico para el proyecto comunitario PAEC. El disco tiene su vértice en el origen V(0,0), un ancho de boca de 120 cm en la parte superior (desde x = -60 hasta x = 60) y una profundidad de 30 cm (y = 30). Determina la ecuación de la parábola y a qué altura sobre el fondo debe montarse el soporte para la olla (el foco F).',
        pasos: [
          'Paso 1: Identifica el punto del borde superior que pertenece a la parábola: P(60, 30).',
          'Paso 2: Como la parábola es vertical y abre hacia arriba, su ecuación es x^2 = 4py.',
          'Paso 3: Sustituye el punto P(60, 30) en la ecuación: 60^2 = 4p(30) -> 3600 = 120p.',
          'Paso 4: Despeja el parámetro focal p: p = 3600 / 120 = 30 cm.',
          'Paso 5: La ecuación de la parábola es x^2 = 4(30)y -> x^2 = 120y.',
          'Paso 6: Conclusión: Como p = 30 cm, el foco se ubica exactamente en F(0, 30), es decir, justo al ras del borde superior del concentrador solar.'
        ]
      },
      practica: [
        {
          enunciado: 'Una antena parabólica de televisión satelital tiene la ecuación x² = 64y (en centímetros). Halla la distancia desde el centro del plato hasta el receptor de señal (foco).',
          pista: 'Iguala 4p = 64 y divide entre 4 para obtener p.'
        },
        {
          enunciado: 'Encuentra la ecuación de una parábola con vértice en el origen y foco en F(0, 5). Escribe también la ecuación de su recta directriz.',
          pista: 'Como el foco está en el eje Y en y = 5, p = 5. La directriz es la recta horizontal y = -5.'
        }
      ],
      aplicacion: 'Construye un prototipo a escala de concentrador solar con cartón forrado con papel aluminio y mide con un termómetro cómo se concentra el calor en el punto focal.',
      autoevaluacion: [
        'Comprendo la definición geométrica de la parábola como lugar geométrico.',
        'Sé calcular el parámetro focal p a partir de dimensiones físicas reales.',
        'Valoro la aplicación de la parábola en energías limpias y telecomunicaciones.'
      ],
      recursos: [
        {
          titulo: 'Video demostrativo: Construcción de una estufa solar parabólica',
          url: 'https://www.youtube.com/watch?v=estufa-solar-parabolica-diy',
          tipo: 'video'
        },
        {
          titulo: 'Simulador PhET: Trazado de rayos y concentración focal',
          url: 'https://phet.colorado.edu/es/simulations/geometric-optics',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Agitador Magnético y Termometría',
        archivo: 'agitador-magnetico.png',
        pie: 'Figura 11.1: Pruebas térmicas de ebullición asistidas por concentración solar.'
      },
      sidenote: 'Los faros de los automóviles funcionan exactamente al revés: colocan un foco emisor de luz en el punto focal para proyectar un haz recto y paralelo hacia la carretera.'
    },
    {
      numero: 12,
      titulo: 'Sesión 12: Optimización Cuadrática: Maximizando el Área de Cultivo',
      objetivo: 'Modelarás problemas de optimización con funciones cuadráticas para encontrar dimensiones que maximicen áreas de producción con recursos limitados.',
      motivacion: 'Una familia campesina de tu comunidad tiene un rollo de 80 metros de malla ciclónica para cercar un huerto rectangular destinado al cultivo de hortalizas familiares. Si usan una pared existente de adobe como uno de los lados, solo necesitan cercar los tres lados restantes. ¿Cuáles deben ser las dimensiones exactas del huerto para encerrar la mayor área de siembra posible con esos 80 metros de malla? La matemática te permite optimizar sin desperdiciar un solo metro.',
      saberesPrevios: 'Cálculo del vértice de una parábola y = ax² + bx + c; fórmula del vértice x_v = -b / (2a).',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'Un problema de optimización consiste en encontrar el valor máximo o mínimo de una cantidad sujeta a ciertas restricciones. En funciones cuadráticas f(x) = ax² + bx + c, el valor óptimo siempre se encuentra en el vértice de la parábola.'
        },
        {
          tipo: 'definicion',
          titulo: 'Vértice como Punto Óptimo',
          texto: 'Si a < 0, la parábola abre hacia abajo y el vértice representa el valor máximo absoluto de la función. La abscisa del vértice se calcula analíticamente mediante x_v = -b / (2a).'
        },
        {
          tipo: 'formula',
          titulo: 'Abscisa del Vértice y Valor Máximo',
          texto: 'x_v = - b / (2 a), quad "Área Máxima" = f(x_v)'
        },
        {
          tipo: 'parrafo',
          texto: 'Para resolver estos problemas, primero se formula una ecuación de restricción (por ejemplo, el perímetro de cerca disponible) que relaciona las variables. Luego se despeja una variable y se sustituye en la función objetivo que se desea maximizar.'
        },
        {
          tipo: 'tabla',
          columnas: ['Paso Metodológico', 'Acción Algebraica', 'Ejemplo del Huerto'],
          filas: [
            ['1. Restricción de recursos', 'Escribir ecuación de frontera', '2x + y = 80 metros de malla'],
            ['2. Despeje de variable', 'Expresar una variable en función de otra', 'y = 80 - 2x'],
            ['3. Función objetivo', 'Plantear fórmula del área', 'A(x) = x * y = x(80 - 2x) = -2x^2 + 80x'],
            ['4. Cálculo del vértice', 'Aplicar x = -b / (2a)', 'x = -80 / (2 * -2) = 20 metros']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Siguiendo el caso de la familia campesina con 80 metros de cerca aprovechando la pared de adobe: Si x es el ancho de los dos lados perpendiculares a la pared e y es el largo paralelo a la pared, calcula las dimensiones óptimas (x, y) y el área máxima obtenida.',
        pasos: [
          'Paso 1: Plantea la restricción perimetral: 2x + y = 80.',
          'Paso 2: Despeja el largo: y = 80 - 2x.',
          'Paso 3: Expresa el área en función exclusiva de x: A(x) = x * y = x(80 - 2x) = -2x^2 + 80x.',
          'Paso 4: Identifica los coeficientes cuadráticos: a = -2 y b = 80.',
          'Paso 5: Calcula el ancho óptimo en el vértice: x_v = -b / (2a) = -80 / (2 * (-2)) = -80 / (-4) = 20 metros.',
          'Paso 6: Calcula el largo correspondiente: y = 80 - 2(20) = 80 - 40 = 40 metros.',
          'Paso 7: Conclusión: El huerto debe medir 20 metros de ancho por 40 metros de largo. El área máxima cosechable es A_max = 20 * 40 = 800 metros cuadrados.'
        ]
      },
      practica: [
        {
          enunciado: 'Si ahora la cerca debe encerrar los cuatro lados completos del huerto (sin pared de adobe previa) con 120 metros de malla, demuestra que el área máxima se logra cuando el huerto es un cuadrado perfecto y halla su área.',
          pista: 'La restricción es 2x + 2y = 120 -> y = 60 - x. La función es A(x) = -x² + 60x.'
        },
        {
          enunciado: 'Un taller de artesanías en barro modela sus ingresos diarios mediante la función I(p) = -5p² + 200p, donde p es el precio de cada pieza en pesos. ¿Qué precio p maximiza los ingresos del taller?',
          pista: 'Aplica p_v = -b / (2a) con a = -5 y b = 200.'
        }
      ],
      aplicacion: 'Calcula las dimensiones más eficientes para el cercado de una zona de compostaje o reciclaje en tu escuela para aprovechar al máximo los materiales donados.',
      autoevaluacion: [
        'Sé plantear la ecuación de restricción y la función objetivo de área.',
        'Calculo el vértice de una parábola para obtener máximos o mínimos absolutos.',
        'Comprendo cómo la geometría analítica resuelve dilemas económicos y ecológicos reales.'
      ],
      recursos: [
        {
          titulo: 'Video: Optimización de áreas rectangulares con funciones cuadráticas',
          url: 'https://www.youtube.com/watch?v=optimizacion-areas-cuadraticas',
          tipo: 'video'
        },
        {
          titulo: 'Simulador interactivo de optimización en GeoGebra',
          url: 'https://www.geogebra.org/m/optimization-quadratic-area',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Afiche Mural de Proyectos Comunitarios',
        archivo: 'afiche-mural.png',
        pie: 'Figura 12.1: Presentación comunitaria del huerto optimizado en el PAEC.'
      },
      sidenote: 'Los métodos de optimización cuadrática son la base del cálculo diferencial desarrollado por Newton y Leibniz para encontrar máximos y mínimos en la ciencia.'
    },
    {
      numero: 13,
      titulo: 'Sesión 13: Lugares Geométricos Combinados y Trayectorias Compuestas',
      objetivo: 'Resolverás intersecciones entre rectas y circunferencias para determinar zonas seguras de cruce y límites de riesgo territorial.',
      motivacion: 'Un ducto subterráneo de agua potable atraviesa en línea recta una zona ejidal de cultivo. Cerca del ducto se instala un transformador eléctrico de media tensión con un radio de seguridad circular de 35 metros para evitar inducciones eléctricas. Para saber si el ducto cruza la zona de riesgo o pasa tangencialmente a una distancia segura, se resuelve un sistema cuadrático-lineal.',
      saberesPrevios: 'Ecuación general de la recta y ecuación ordinaria de la circunferencia; fórmula general de segundo grado.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'Cuando una recta y una circunferencia coexisten en el plano, pueden presentarse tres posiciones relativas: la recta puede ser secante (corta en dos puntos), tangente (toca en exactamente un punto) o exterior (no se cruzan). La distancia d desde el centro de la circunferencia hacia la recta determina la posición relativa respecto al radio r.'
        },
        {
          tipo: 'definicion',
          titulo: 'Posición Relativa de Recta y Circunferencia',
          texto: 'Si d(C, L) < r la recta es secante. Si d(C, L) = r la recta es tangente. Si d(C, L) > r la recta es exterior.'
        },
        {
          tipo: 'formula',
          titulo: 'Distancia de un Punto a una Recta',
          texto: 'd(C, L) = (|A h + B k + C|) / (sqrt(A^2 + B^2))'
        },
        {
          tipo: 'parrafo',
          texto: 'Algebraicamente, sustituir la ecuación lineal de la recta y = mx + b dentro de la ecuación de la circunferencia produce una ecuación cuadrática en x. Su discriminante Delta = b^2 - 4ac indica de inmediato cuántos puntos de contacto existen: Delta > 0 (secante), Delta = 0 (tangente) o Delta < 0 (exterior).'
        },
        {
          tipo: 'tabla',
          columnas: ['Discriminante Delta', 'Distancia d vs Radio r', 'Condición Geométrica'],
          filas: [
            ['Delta > 0', 'd < r', 'Recta Secante (2 intersecciones)'],
            ['Delta = 0', 'd = r', 'Recta Tangente (1 punto de contacto)'],
            ['Delta < 0', 'd > r', 'Recta Exterior (0 intersecciones)']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un transformador con centro en el origen C(0,0) tiene un radio de seguridad de r = 5 metros (x² + y² = 25). Una cerca lineal sigue la trayectoria L: 3x + 4y - 25 = 0. Determina si la cerca es tangente, secante o exterior al perímetro de seguridad calculando la distancia del centro a la recta.',
        pasos: [
          'Paso 1: Identifica los coeficientes de la recta: A = 3, B = 4, C = -25.',
          'Paso 2: Identifica las coordenadas del centro: h = 0, k = 0, y el radio r = 5.',
          'Paso 3: Evalúa el numerador: |3(0) + 4(0) - 25| = |-25| = 25.',
          'Paso 4: Evalúa el denominador: sqrt(3^2 + 4^2) = sqrt(9 + 16) = sqrt(25) = 5.',
          'Paso 5: Calcula la distancia: d = 25 / 5 = 5 metros.',
          'Paso 6: Conclusión: Como d = r = 5 metros, la cerca es exactamente TANGENTE al perímetro de seguridad, tocando en un solo punto sin invadir la zona crítica.'
        ]
      },
      practica: [
        {
          enunciado: 'Determina si la recta y = x + 1 es secante a la circunferencia x² + y² = 25 sustituyendo y en la ecuación circular.',
          pista: 'Desarrolla x² + (x + 1)² = 25 -> 2x² + 2x - 24 = 0 y calcula su discriminante.'
        },
        {
          enunciado: 'Calcula la distancia desde el pozo C(2, 3) hasta la carretera L: 4x - 3y + 11 = 0 y verifica si un radio de exclusión de r = 3 metros toca la carretera.',
          pista: 'Aplica la fórmula con A = 4, B = -3, C = 11, h = 2, k = 3.'
        }
      ],
      aplicacion: 'Analiza el cruce de cables de alta tensión sobre áreas arboladas en tu comunidad para comprobar si se respetan las distancias de seguridad normativas.',
      autoevaluacion: [
        'Sé calcular la distancia de un punto a una recta usando la fórmula analítica.',
        'Relaciono el discriminante algebraico con la posición geométrica secante o tangente.',
        'Aplico el análisis de lugares geométricos combinados a la prevención de riesgos.'
      ],
      recursos: [
        {
          titulo: 'Video: Intersección de recta y circunferencia paso a paso',
          url: 'https://www.youtube.com/watch?v=interseccion-recta-circunferencia',
          tipo: 'video'
        },
        {
          titulo: 'Simulador: Posiciones relativas en GeoGebra',
          url: 'https://www.geogebra.org/m/line-circle-intersection',
          tipo: 'web'
        }
      ],
      materialSpot: {
        nombre: 'Cinta Métrica y Calibre',
        archivo: 'alambre-ortodontico.png',
        pie: 'Figura 13.1: Medición de radios críticos y distancias a infraestructuras.'
      },
      sidenote: 'En cálculo diferencial, la recta tangente a una curva representa la derivada instantánea de la función en ese punto.'
    },
    {
      numero: 14,
      titulo: 'Sesión 14: Modelado Matemático del Proyecto Comunitario y Rúbrica Integradora',
      objetivo: 'Integrarás todos los conceptos analíticos del bloque en un informe técnico de modelado para tu proyecto comunitario de aula escuela comunidad (PAEC).',
      motivacion: 'A lo largo de este bloque has aprendido a ubicar puntos, medir distancias, calcular pendientes, trazar rectas paralelas y perpendiculares, formular circunferencias, diseñar parábolas concentradoras y optimizar áreas. Ahora vas a reunir todo ese poder matemático para resolver un problema real de tu comunidad en Puebla, demostrando que las matemáticas son una herramienta viva de transformación social.',
      saberesPrevios: 'Síntesis de los conceptos de las sesiones 1 a 13; redacción de reportes técnicos claros.',
      contenido: [
        {
          tipo: 'parrafo',
          texto: 'El ciclo de modelación matemática consta de cuatro fases interconectadas: 1) Comprensión y planteamiento del problema real de la comunidad; 2) Formulación matemática traduciendo el problema a ecuaciones algebraicas y lugares geométricos; 3) Resolución analítica y cálculo numérico riguroso; 4) Interpretación y validación de los resultados en el contexto social de tu entorno.'
        },
        {
          tipo: 'definicion',
          titulo: 'Ciclo de Modelación Matemática Escolar',
          texto: 'Es el proceso sistemático mediante el cual un estudiante transforma una situación problemática de la vida cotidiana en un modelo analítico formal, lo resuelve y valida sus conclusiones con base en datos reales.'
        },
        {
          tipo: 'formula',
          titulo: 'Ecuación Integradora de Evaluación del Modelo',
          texto: '"Precisión" = 1 - (|d_"medida" - d_"calculada"|) / (d_"medida")'
        },
        {
          tipo: 'parrafo',
          texto: 'Para presentar tu proyecto integrador con calidad profesional, tu informe debe contener: croquis con sistema de referencia, tabla de datos cuantitativos medidos, desarrollo algebraico explícito con unidades y propuesta de impacto comunitario.'
        },
        {
          tipo: 'tabla',
          columnas: ['Criterio de Evaluación', 'Nivel Excelente (10)', 'Nivel Suficiente (8)', 'Nivel en Desarrollo (6)'],
          filas: [
            ['Modelado Geométrico', 'Ecuaciones analíticas sin error y con unidades', 'Ecuaciones correctas con leves omisiones', 'Planteamiento incompleto'],
            ['Contexto PAEC Puebla', 'Problema comunitario real y medible', 'Problema comunitario genérico', 'Problema sin anclaje local'],
            ['Optimización y Cálculo', 'Cálculo del óptimo con procedimiento paso a paso', 'Cálculo del óptimo con errores menores', 'Sin justificación del óptimo']
          ]
        }
      ],
      ejemploResuelto: {
        enunciado: 'Un equipo escolar modela la colocación de un tanque de captación pluvial C(15, 20) que abastece tres áreas de siembra. El tanque abastece un radio de 25 metros. La cerca de acceso sigue L: 3x - 4y + 20 = 0. Demuestra formalmente en tres pasos que el tanque no interfiere con el camino de entrada y que abastece el huerto ubicado en H(30, 35).',
        pasos: [
          'Paso 1: Calcula la distancia del huerto H(30, 35) al tanque C(15, 20): d = sqrt((30 - 15)^2 + (35 - 20)^2) = sqrt(15^2 + 15^2) = sqrt(225 + 225) = sqrt(450) ≈ 21.21 metros.',
          'Paso 2: Como 21.21 < 25 metros, el huerto queda completamente dentro del radio de abastecimiento de agua.',
          'Paso 3: Calcula la distancia del tanque al camino de acceso: d(C, L) = |3(15) - 4(20) + 20| / sqrt(3^2 + (-4)^2) = |45 - 80 + 20| / 5 = |-15| / 5 = 3 metros.',
          'Paso 4: Conclusión: El camino está a 3 metros del centro del tanque. Si el tanque tiene radio físico exterior de 1.5 metros, queda 1.5 metros de margen libre para el paso peatonal.'
        ]
      },
      practica: [
        {
          enunciado: 'En tu equipo de proyecto integrador, redacta la justificación geométrica de tu propuesta comunitaria calculando al menos dos distancias y una ecuación de lugar geométrico.',
          pista: 'Revisa las sesiones 2, 5 y 9 para asegurar que tus fórmulas estén completas.'
        },
        {
          enunciado: 'Elabora la lista de materiales requeridos para tu prototipo estimando costos lineales y de área.',
          pista: 'Aplica el modelo de costo y = mx + b aprendido en la sesión 5.'
        }
      ],
      aplicacion: 'Presenta tu informe técnico de modelado a las autoridades de tu escuela o a los comités de padres de familia para respaldar la gestión de recursos del proyecto PAEC.',
      autoevaluacion: [
        'Comprendo cómo enlazar múltiples conceptos matemáticos en un solo proyecto.',
        'Puedo defender con argumentos cuantitativos la viabilidad de mi propuesta.',
        'Reconozco el valor de las matemáticas como herramienta para transformar mi comunidad.'
      ],
      recursos: [
        {
          titulo: 'Guía DGB: Metodología de Proyectos Aula Escuela Comunidad (PAEC)',
          url: 'https://dgb.sep.gob.mx/paec-metodologia-mccems',
          tipo: 'lectura'
        },
        {
          titulo: 'Video: Cómo estructurar un informe técnico escolar de ciencias',
          url: 'https://www.youtube.com/watch?v=informe-tecnico-escolar',
          tipo: 'video'
        }
      ],
      materialSpot: {
        nombre: 'Afiche Mural y Portafolio de Evidencias',
        archivo: 'afiche-mural.png',
        pie: 'Figura 14.1: Socialización comunitaria de resultados y prototipos del PAEC.'
      },
      sidenote: 'La UNESCO señala que las competencias de modelado matemático son fundamentales para el desarrollo sostenible y la resiliencia comunitaria.',
      productoIntegrador: 'Consolida el Informe Técnico Final de Modelado Matemático Comunitario (PAEC) con planos y memoria de cálculo.'
    }
  ]
};

// Validar que cumpla al 100% el modelo canónico sin voz de docente
console.log('Validando fixture contra modelo canónico de estudiante...');
assertValidStudentChapter(chapter);
console.log('✓ Fixture validado exitosamente. Cero marcas de docente detectadas.');

const targetPath = path.join(__dirname, '../src/__tests__/fixtures/editorial/student-workbook-chapter.fixture.json');
fs.writeFileSync(targetPath, JSON.stringify(chapter, null, 2), 'utf8');
console.log(`✓ Fixture guardado en: ${targetPath}`);
