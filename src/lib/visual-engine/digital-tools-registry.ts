/**
 * digital-tools-registry.ts — Catálogo Maestro y Motor de Herramientas Digitales MCCEMS
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Capa de integración digital para el Cuaderno de Trabajo Activo:
 * 1. Catálogo homologado de 12 simuladores y herramientas digitales normadas en el MCCEMS.
 * 2. Generador de códigos QR nítidos en raster PNG (128x128) para incrustación directa a 14x14mm.
 * 3. Selector heurístico de pertinencia didáctica por asignatura, título y texto de la misión.
 */

import QRCode from 'qrcode';

export interface DigitalTool {
  id: string;
  name: string;
  url: string;
  description: string;
  platforms: ('Web' | 'Android' | 'iOS' | 'Offline')[];
  requiresAccount: boolean;
  subjectAffinity: string[];
  relevanceKeywords: string[];
}

export const MCCEMS_DIGITAL_TOOLS: DigitalTool[] = [
  {
    id: 'geogebra',
    name: 'GeoGebra Dinámico',
    url: 'https://www.geogebra.org/calculator',
    description: 'Calculadora gráfica, geometría analítica y álgebra simbólica interactiva.',
    platforms: ['Web', 'Android', 'iOS', 'Offline'],
    requiresAccount: false,
    subjectAffinity: ['matemáticas', 'pensamiento matemático', 'física', 'cálculo', 'geometría'],
    relevanceKeywords: ['función', 'gráfica', 'recta', 'parábola', 'vector', 'ángulo', 'triángulo', 'cónica', 'plano', 'derivada', 'integral', 'geometría'],
  },
  {
    id: 'desmos',
    name: 'Desmos Graphing',
    url: 'https://www.desmos.com/calculator',
    description: 'Trazador gráfico de alta precisión para modelación matemática y curvas.',
    platforms: ['Web', 'Android', 'iOS'],
    requiresAccount: false,
    subjectAffinity: ['matemáticas', 'pensamiento matemático', 'cálculo', 'estadística'],
    relevanceKeywords: ['regresión', 'dispersión', 'curva', 'ecuación', 'desigualdad', 'tablas de valores', 'polinomio'],
  },
  {
    id: 'phet',
    name: 'PhET Interactive Sims',
    url: 'https://phet.colorado.edu/es/',
    description: 'Laboratorio de simulaciones interactivas para física, química y biología.',
    platforms: ['Web', 'Android', 'iOS', 'Offline'],
    requiresAccount: false,
    subjectAffinity: ['física', 'química', 'biología', 'materia y energía', 'ciencias naturales'],
    relevanceKeywords: ['fuerza', 'movimiento', 'energía', 'circuito', 'átomo', 'molécula', 'densidad', 'gravedad', 'ondas', 'luz', 'calor', 'ph', 'presión'],
  },
  {
    id: 'phyphox',
    name: 'Phyphox Phone Physics',
    url: 'https://phyphox.org/',
    description: 'Convierte el teléfono inteligente en un laboratorio con sensores de física.',
    platforms: ['Android', 'iOS', 'Offline'],
    requiresAccount: false,
    subjectAffinity: ['física', 'materia y energía', 'experimentación'],
    relevanceKeywords: ['acelerómetro', 'giroscopio', 'sensor', 'péndulo', 'frecuencia', 'sonido', 'campo magnético', 'presión barométrica', 'laboratorio móvil'],
  },
  {
    id: 'tinkercad',
    name: 'Autodesk Tinkercad',
    url: 'https://www.tinkercad.com/',
    description: 'Simulador de circuitos electrónicos, Arduino y modelado tridimensional.',
    platforms: ['Web'],
    requiresAccount: true,
    subjectAffinity: ['laboral', 'tecnología', 'física', 'electrónica', 'robótica', 'diseño'],
    relevanceKeywords: ['circuito', 'resistencia', 'led', 'arduino', 'voltaje', 'corriente', 'sensor', 'protoboard', '3d', 'componentes'],
  },
  {
    id: 'molview',
    name: 'MolView Chemistry',
    url: 'https://molview.org/',
    description: 'Modelador interactivo de moléculas en 3D y propiedades espectrales.',
    platforms: ['Web'],
    requiresAccount: false,
    subjectAffinity: ['química', 'reacciones químicas', 'biología', 'bioquímica'],
    relevanceKeywords: ['molécula', 'enlace', 'átomo', 'estructura', 'isómero', 'química orgánica', 'estequiometría', 'espectro'],
  },
  {
    id: 'scratch',
    name: 'Scratch / MakeCode',
    url: 'https://scratch.mit.edu/',
    description: 'Entorno de programación por bloques para desarrollo del pensamiento algorítmico.',
    platforms: ['Web', 'Offline'],
    requiresAccount: false,
    subjectAffinity: ['cultura digital', 'informática', 'matemáticas', 'pensamiento algorítmico'],
    relevanceKeywords: ['algoritmo', 'bucle', 'variable', 'condicional', 'programa', 'código', 'lógica', 'animación', 'interactivo'],
  },
  {
    id: 'inegi_mapa',
    name: 'INEGI Mapa Digital',
    url: 'https://www.inegi.org.mx/app/mapa/espacioydatos/',
    description: 'Sistema de información geográfica para análisis territorial, demográfico y social.',
    platforms: ['Web'],
    requiresAccount: false,
    subjectAffinity: ['ciencias sociales', 'geografía', 'paec', 'sociedad', 'economía'],
    relevanceKeywords: ['territorio', 'comunidad', 'demografía', 'censo', 'mapa', 'municipio', 'población', 'cartografía', 'puebla', 'recursos'],
  },
  {
    id: 'canva_edu',
    name: 'Canva Educativo',
    url: 'https://www.canva.com/education/',
    description: 'Diseño colaborativo de infografías, carteles de divulgación y presentaciones.',
    platforms: ['Web', 'Android', 'iOS'],
    requiresAccount: true,
    subjectAffinity: ['lengua y comunicación', 'humanidades', 'ciencias sociales', 'comunicación'],
    relevanceKeywords: ['infografía', 'cartel', 'divulgación', 'presentación', 'ensayo', 'tríptico', 'comunicación', 'diseño visual'],
  },
  {
    id: 'google_earth',
    name: 'Google Earth Web',
    url: 'https://earth.google.com/web/',
    description: 'Exploración geoespacial en 3D para análisis de ecosistemas y relieve.',
    platforms: ['Web', 'Android', 'iOS'],
    requiresAccount: false,
    subjectAffinity: ['geografía', 'biología', 'ecosistemas', 'ciencias naturales', 'conservación'],
    relevanceKeywords: ['relieve', 'ecosistema', 'cuenca', 'río', 'volcán', 'biodiversidad', 'deforestación', 'satélite'],
  },
  {
    id: 'stellarium',
    name: 'Stellarium Web',
    url: 'https://stellarium-web.org/',
    description: 'Planetario interactivo para observación del cielo nocturno y mecánica celeste.',
    platforms: ['Web'],
    requiresAccount: false,
    subjectAffinity: ['física', 'ciencias naturales', 'astronomía', 'matemáticas'],
    relevanceKeywords: ['estrella', 'planeta', 'constelación', 'órbita', 'gravedad', 'luna', 'solar', 'astronomía'],
  },
  {
    id: 'biodigital',
    name: 'BioDigital Human',
    url: 'https://human.biodigital.com/',
    description: 'Atlas anatómico en tercera dimensión de sistemas del cuerpo humano.',
    platforms: ['Web', 'Android', 'iOS'],
    requiresAccount: false,
    subjectAffinity: ['biología', 'ciencias de la salud', 'anatomía', 'cuidado del cuerpo'],
    relevanceKeywords: ['sistema', 'órgano', 'célula', 'tejido', 'esqueleto', 'músculo', 'circulatorio', 'digestivo', 'salud'],
  },
];

/**
 * Genera un código QR nítido en Buffer PNG (128x128 píxeles).
 * Ideal para ser incrustado en jsPDF a 14x14mm sin pixelación.
 */
export async function generateToolQrPng(url: string): Promise<Buffer> {
  return await QRCode.toBuffer(url, {
    margin: 1,
    width: 128,
    errorCorrectionLevel: 'M',
    type: 'png',
  });
}

/**
 * Resuelve la herramienta digital más pertinente para una misión formativa específica.
 * Si ninguna herramienta supera el umbral de relevancia, retorna null para no forzar inserciones.
 */
export function resolveDigitalToolsForMission(
  subjectName: string,
  missionTitle: string,
  missionText?: string
): DigitalTool | null {
  const tools = resolveMultipleDigitalToolsForMission(subjectName, missionTitle, missionText, 1);
  return tools.length > 0 ? tools[0] : null;
}

/**
 * Resuelve múltiples herramientas digitales pertinentes para una misión formativa (hasta un límite).
 * Ordena las herramientas por pertinencia didáctica (score descendente) y filtra aquellas bajo el umbral.
 */
export function resolveMultipleDigitalToolsForMission(
  subjectName: string,
  missionTitle: string,
  missionText?: string,
  limit: number = 2
): DigitalTool[] {
  const normSubject = (subjectName || '').toLowerCase();
  const normTitle = (missionTitle || '').toLowerCase();
  const normText = (missionText || '').toLowerCase();
  const fullText = `${normSubject} ${normTitle} ${normText}`;

  const scoredTools: Array<{ tool: DigitalTool; score: number }> = [];

  for (const tool of MCCEMS_DIGITAL_TOOLS) {
    let score = 0;

    // Afinidad disciplinar (3 puntos)
    for (const affinity of tool.subjectAffinity) {
      if (normSubject.includes(affinity.toLowerCase())) {
        score += 3;
        break;
      }
    }

    // Coincidencia de palabras clave en título (4 puntos) o texto (1 punto)
    for (const kw of tool.relevanceKeywords) {
      const lowerKw = kw.toLowerCase();
      if (normTitle.includes(lowerKw)) {
        score += 4;
      } else if (fullText.includes(lowerKw)) {
        score += 1;
      }
    }

    // Requiere un umbral mínimo de 2 puntos para considerarse pedagógicamente relevante
    if (score >= 2) {
      scoredTools.push({ tool, score });
    }
  }

  // Ordenar de mayor a menor puntuación y aplicar límite solicitado
  scoredTools.sort((a, b) => b.score - a.score);
  return scoredTools.slice(0, Math.max(1, limit)).map((st) => st.tool);
}
