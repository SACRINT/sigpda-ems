/**
 * thematic-backgrounds.ts — Fondos Vectoriales Temáticos de Alta Definición V7
 * SEMS Puebla · Marco Curricular Común EMS 2026-2027
 *
 * Genera composiciones vectoriales matemáticas ricas y elegantes para cada una
 * de las 6 grandes áreas curriculares del MCCEMS:
 * 1. Ciencias (Física, Química, Biología, Ecología, Materia y Energía)
 * 2. Matemáticas (Pensamiento Matemático, Geometría, Álgebra, Cálculo)
 * 3. Humanidades (Filosofía, Literatura, Lengua y Comunicación)
 * 4. Tecnología (Cultura Digital, Robótica, Talleres Ocupacionales, Programación)
 * 5. Salud (Ciencias de la Salud, Fisiología, Deporte, Bienestar)
 * 6. Ciencias Sociales (Conciencia Histórica, Formación Socioemocional, Economía)
 */

export type CurricularArea =
  | 'ciencias'
  | 'matematicas'
  | 'humanidades'
  | 'social'
  | 'tecnologia'
  | 'salud';

/**
 * Normaliza una cadena removiendo acentos y convirtiendo a minúsculas.
 */
function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Clasifica la Unidad de Aprendizaje Curricular (UAC) en una de las 6 áreas temáticas.
 */
export function detectCurricularArea(uacName: string): CurricularArea {
  const norm = normalizeString(uacName);

  // 1. Salud y Bienestar
  if (/salud|anatomi|enfermeri|fisiologi|higien|medicin|nutricion|deport|educacion fisica/.test(norm)) {
    return 'salud';
  }

  // 2. Tecnología y Formación para el Trabajo
  if (
    /digital|comput|informatic|tecnologi|programacion|robotic|electronic|electricidad|mecanic|diseno|mantenimiento|capacitacion|trabajo|soporte|software|hardware|redes/.test(
      norm
    )
  ) {
    return 'tecnologia';
  }

  // 3. Matemáticas y Pensamiento Formal
  if (/matematic|calcul|algebra|geometri|trigonometri|estadistic|probabilidad|aritmetic/.test(norm)) {
    return 'matematicas';
  }

  // 4. Ciencias Naturales y Experimentales
  if (
    /fisic|quimic|biologi|materia|energia|ecosistema|reaccion|conservacion|natural|termodinamic|optic|astronomi|geologi/.test(
      norm
    )
  ) {
    return 'ciencias';
  }

  // 5. Ciencias Sociales y Conciencia Histórica
  if (
    /social|histori|conciencia|socioeconom|metodologi|comunidad|politica|derecho|geografi|ciudadan|estado|sociedad|antropologi/.test(
      norm
    )
  ) {
    return 'social';
  }

  // 6. Humanidades por defecto (Lengua, Comunicación, Filosofía, Literatura, Ética)
  return 'humanidades';
}

/**
 * Genera las definiciones de gradientes, patrones y formas geométricas temáticas (viewBox 0 0 1200 1600)
 * para la portada institucional sin superponerse a los contenedores de texto.
 */
export function buildThematicVectorBackground(area: CurricularArea): string {
  switch (area) {
    case 'ciencias':
      return buildCienciasBackground();
    case 'matematicas':
      return buildMatematicasBackground();
    case 'humanidades':
      return buildHumanidadesBackground();
    case 'tecnologia':
      return buildTecnologiaBackground();
    case 'salud':
      return buildSaludBackground();
    case 'social':
      return buildSocialBackground();
  }
}

/**
 * 1. CIENCIAS NATURALES Y EXPERIMENTALES
 * Paleta: Midnight Navy (#061124), Electric Blue (#1E40AF), Cyan (#06B6D4), Emerald (#10B981), Gold (#E8A020)
 * Geometría: Órbitas atómicas elípticas, líneas de campo magnético, ondas sinusoidales, prisma refractante.
 */
function buildCienciasBackground(): string {
  return `
  <!-- Gradientes y Patrones de Ciencias -->
  <defs>
    <linearGradient id="sciBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#040C1A" />
      <stop offset="35%" stop-color="#0B1E38" />
      <stop offset="70%" stop-color="#122B52" />
      <stop offset="100%" stop-color="#0A1830" />
    </linearGradient>
    <linearGradient id="sciCyanGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="50%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <linearGradient id="sciGoldAccent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E8A020" />
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.2" />
    </linearGradient>
    <pattern id="sciDotGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.2" fill="#38BDF8" fill-opacity="0.08" />
      <path d="M 40 0 L 0 40" stroke="#0284C7" stroke-width="0.3" stroke-opacity="0.04" />
    </pattern>
  </defs>

  <!-- Lienzo base -->
  <rect width="1200" height="1600" fill="url(#sciBgGrad)" />
  <rect width="1200" height="1600" fill="url(#sciDotGrid)" />

  <!-- Formas vectoriales temáticas de Ciencias -->
  <!-- Órbitas atómicas dinámicas en fondo medio -->
  <g transform="translate(600, 780)" opacity="0.35">
    <ellipse rx="460" ry="170" transform="rotate(-35)" fill="none" stroke="url(#sciCyanGrad)" stroke-width="2.5" />
    <ellipse rx="460" ry="170" transform="rotate(35)" fill="none" stroke="url(#sciCyanGrad)" stroke-width="2.5" />
    <ellipse rx="460" ry="170" transform="rotate(90)" fill="none" stroke="url(#sciCyanGrad)" stroke-width="2.0" stroke-dasharray="12 6" />
    <!-- Electrones / Nodos cuánticos -->
    <circle cx="340" cy="-190" r="8" fill="#38BDF8" />
    <circle cx="-340" cy="190" r="7" fill="#10B981" />
    <circle cx="0" cy="170" r="8" fill="#F59E0B" />
    <circle cx="0" cy="-170" r="6" fill="#38BDF8" />
  </g>

  <!-- Ondas sinusoidales superpuestas (espectro electromagnético) -->
  <path d="M 0 1120 Q 300 1060 600 1120 T 1200 1120" fill="none" stroke="#06B6D4" stroke-width="3" opacity="0.45" />
  <path d="M 0 1140 Q 300 1200 600 1140 T 1200 1140" fill="none" stroke="#10B981" stroke-width="2" opacity="0.35" stroke-dasharray="6 4" />
  <path d="M 0 1160 Q 300 1100 600 1160 T 1200 1160" fill="none" stroke="#E8A020" stroke-width="1.8" opacity="0.4" />

  <!-- Acento geométrico angular superior derecho (Puebla Wine + Gold) -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="#800020" opacity="0.75" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="url(#sciGoldAccent)" opacity="0.9" />
  <polygon points="0,1150 480,1600 0,1600" fill="#0284C7" opacity="0.22" />
  <rect x="0" y="1520" width="1200" height="12" fill="#E8A020" />
  `;
}

/**
 * 2. MATEMÁTICAS Y PENSAMIENTO FORMAL
 * Paleta: Deep Indigo (#0A0F2C), Cobalt (#1E3A8A), Electric Violet (#6366F1), Golden Amber (#F59E0B)
 * Geometría: Espiral áurea (Fibonacci), poliedros geométricos alámbricos 3D, ejes de coordenadas polares.
 */
function buildMatematicasBackground(): string {
  return `
  <!-- Gradientes y Patrones de Matemáticas -->
  <defs>
    <linearGradient id="mathBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070A1E" />
      <stop offset="40%" stop-color="#0F174A" />
      <stop offset="75%" stop-color="#1A2268" />
      <stop offset="100%" stop-color="#0C1033" />
    </linearGradient>
    <linearGradient id="mathVioletGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="50%" stop-color="#818CF8" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <pattern id="mathCoordGrid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#6366F1" stroke-width="0.4" stroke-opacity="0.08" />
      <circle cx="25" cy="25" r="1.0" fill="#F59E0B" fill-opacity="0.06" />
    </pattern>
  </defs>

  <!-- Lienzo base -->
  <rect width="1200" height="1600" fill="url(#mathBgGrad)" />
  <rect width="1200" height="1600" fill="url(#mathCoordGrid)" />

  <!-- Geometría de Espiral Áurea y Círculos Concéntricos Fibonacci -->
  <g transform="translate(620, 760)" opacity="0.32">
    <!-- Círculos de proporciones armónicas -->
    <circle r="120" fill="none" stroke="#818CF8" stroke-width="1.2" stroke-dasharray="4 4" />
    <circle r="220" fill="none" stroke="#6366F1" stroke-width="1.8" />
    <circle r="360" fill="none" stroke="#F59E0B" stroke-width="2.2" opacity="0.8" />
    <circle r="520" fill="none" stroke="#4338CA" stroke-width="1.0" stroke-dasharray="8 6" />

    <!-- Trazado de Curva Áurea (Arcos continuos) -->
    <path d="M 0 0 A 55 55 0 0 1 55 55 A 90 90 0 0 1 -35 145 A 145 145 0 0 1 -180 0 A 235 235 0 0 1 55 -235 A 380 380 0 0 1 435 145" 
          fill="none" stroke="url(#mathVioletGrad)" stroke-width="3.5" />

    <!-- Poliedro isométrico alámbrico central sutil -->
    <polygon points="0,-160 140,-80 140,80 0,160 -140,80 -140,-80" fill="none" stroke="#A5B4FC" stroke-width="1.5" opacity="0.5" />
    <line x1="0" y1="-160" x2="0" y2="160" stroke="#A5B4FC" stroke-width="1.2" opacity="0.4" />
    <line x1="-140" y1="-80" x2="140" y2="80" stroke="#A5B4FC" stroke-width="1.2" opacity="0.4" />
    <line x1="-140" y1="80" x2="140" y2="-80" stroke="#A5B4FC" stroke-width="1.2" opacity="0.4" />
  </g>

  <!-- Curvas tangenciales en parte inferior -->
  <path d="M 0 1130 C 400 1020 800 1240 1200 1130" fill="none" stroke="#F59E0B" stroke-width="2.5" opacity="0.4" />
  <path d="M 0 1170 C 400 1060 800 1280 1200 1170" fill="none" stroke="#818CF8" stroke-width="1.8" opacity="0.3" stroke-dasharray="8 4" />

  <!-- Acentos angulares institucionales -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="#312E81" opacity="0.8" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="#F59E0B" opacity="0.9" />
  <polygon points="0,1150 480,1600 0,1600" fill="#4338CA" opacity="0.25" />
  <rect x="0" y="1520" width="1200" height="12" fill="#F59E0B" />
  `;
}

/**
 * 3. HUMANIDADES, LENGUA Y COMUNICACIÓN
 * Paleta: Deep Maroon / Puebla Wine (#280710), Rich Burgundy (#800020), Warm Amber (#D97706), Parchment Gold (#FDE68A)
 * Geometría: Columnas clásicas estilizadas, códice radiante, ondas concéntricas de resonancia dialógica.
 */
function buildHumanidadesBackground(): string {
  return `
  <!-- Gradientes y Patrones de Humanidades -->
  <defs>
    <linearGradient id="humBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1F040C" />
      <stop offset="38%" stop-color="#3D0B19" />
      <stop offset="72%" stop-color="#581226" />
      <stop offset="100%" stop-color="#24050F" />
    </linearGradient>
    <linearGradient id="humWineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#800020" />
      <stop offset="50%" stop-color="#B91C1C" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <pattern id="humLinearGrid" width="60" height="60" patternUnits="userSpaceOnUse">
      <line x1="0" y1="30" x2="60" y2="30" stroke="#FCA5A5" stroke-width="0.3" stroke-opacity="0.06" />
      <circle cx="30" cy="30" r="1.2" fill="#F59E0B" fill-opacity="0.07" />
    </pattern>
  </defs>

  <!-- Lienzo base -->
  <rect width="1200" height="1600" fill="url(#humBgGrad)" />
  <rect width="1200" height="1600" fill="url(#humLinearGrid)" />

  <!-- Motivo de Códice Abierto y Radiación del Pensamiento -->
  <g transform="translate(600, 760)" opacity="0.35">
    <!-- Rayos de iluminación dialógica -->
    <line x1="0" y1="0" x2="-380" y2="-220" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="6 6" />
    <line x1="0" y1="0" x2="380" y2="-220" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="6 6" />
    <line x1="0" y1="0" x2="-440" y2="-60" stroke="#F87171" stroke-width="1.0" />
    <line x1="0" y1="0" x2="440" y2="-60" stroke="#F87171" stroke-width="1.0" />
    <line x1="0" y1="0" x2="-400" y2="120" stroke="#F59E0B" stroke-width="1.2" />
    <line x1="0" y1="0" x2="400" y2="120" stroke="#F59E0B" stroke-width="1.2" />

    <!-- Arcos concéntricos de diálogo / Agora -->
    <path d="M -320 60 A 320 320 0 0 1 320 60" fill="none" stroke="url(#humWineGrad)" stroke-width="2.5" />
    <path d="M -240 60 A 240 240 0 0 1 240 60" fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-dasharray="8 4" />
    <path d="M -160 60 A 160 160 0 0 1 160 60" fill="none" stroke="#FCA5A5" stroke-width="1.5" />

    <!-- Silueta estilizada de Códice / Libro vector abierto -->
    <path d="M -140 30 C -70 10 -20 25 0 45 C 20 25 70 10 140 30 L 140 80 C 70 60 20 75 0 95 C -20 75 -70 60 -140 80 Z" 
          fill="none" stroke="#F59E0B" stroke-width="2.5" />
    <line x1="0" y1="45" x2="0" y2="95" stroke="#F59E0B" stroke-width="2.5" />
  </g>

  <!-- Ondas inferiores de comunicación verbal y escrita -->
  <path d="M 0 1140 C 350 1080 850 1200 1200 1140" fill="none" stroke="#F59E0B" stroke-width="2.8" opacity="0.4" />
  <path d="M 0 1170 C 350 1110 850 1230 1200 1170" fill="none" stroke="#DC2626" stroke-width="2.0" opacity="0.3" stroke-dasharray="6 4" />

  <!-- Acentos superiores institucionales -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="#800020" opacity="0.9" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="#F59E0B" opacity="0.95" />
  <polygon points="0,1150 480,1600 0,1600" fill="#991B1B" opacity="0.22" />
  <rect x="0" y="1520" width="1200" height="12" fill="#F59E0B" />
  `;
}

/**
 * 4. TECNOLOGÍA, CULTURA DIGITAL Y TALLERES TÉCNICOS
 * Paleta: Dark Teal/Cyan (#03141B), Cyber Blue (#0284C7), Neon Cyan (#06B6D4), Copper Gold (#D97706)
 * Geometría: Trazas de circuitos impresos (PCB tracks a 45 grados), nodos con soldadura, procesador digital central.
 */
function buildTecnologiaBackground(): string {
  return `
  <!-- Gradientes y Patrones de Tecnología -->
  <defs>
    <linearGradient id="techBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020E14" />
      <stop offset="35%" stop-color="#062330" />
      <stop offset="70%" stop-color="#0B374B" />
      <stop offset="100%" stop-color="#041620" />
    </linearGradient>
    <linearGradient id="techCyanGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="50%" stop-color="#0284C7" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <pattern id="techCircuitGrid" width="48" height="48" patternUnits="userSpaceOnUse">
      <circle cx="24" cy="24" r="1.5" fill="#06B6D4" fill-opacity="0.10" />
      <path d="M 24 0 L 24 48 M 0 24 L 48 24" stroke="#0284C7" stroke-width="0.3" stroke-opacity="0.05" />
    </pattern>
  </defs>

  <!-- Lienzo base -->
  <rect width="1200" height="1600" fill="url(#techBgGrad)" />
  <rect width="1200" height="1600" fill="url(#techCircuitGrid)" />

  <!-- Trazas de Circuito Impreso (PCB) a 45 grados en fondo -->
  <g opacity="0.38" stroke="url(#techCyanGrad)" stroke-width="2.5" fill="none">
    <!-- Pista 1 -->
    <path d="M 80 680 L 320 680 L 440 800 L 760 800 L 880 680 L 1120 680" />
    <circle cx="320" cy="680" r="5" fill="#06B6D4" />
    <circle cx="880" cy="680" r="5" fill="#10B981" />

    <!-- Pista 2 -->
    <path d="M 120 740 L 280 740 L 400 860 L 800 860 L 920 740 L 1080 740" stroke-dasharray="10 6" />
    <circle cx="400" cy="860" r="6" fill="#F59E0B" />
    <circle cx="800" cy="860" r="6" fill="#06B6D4" />

    <!-- Pista 3 vertical / diagonal -->
    <path d="M 600 500 L 600 640 L 520 720 L 520 920 L 600 1000 L 600 1100" stroke-width="2" />
    <circle cx="600" cy="640" r="5" fill="#0284C7" />
    <circle cx="600" cy="1000" r="5" fill="#06B6D4" />

    <!-- Silueta central de Microcontrolador / Bus de datos -->
    <rect x="520" y="740" width="160" height="160" rx="12" stroke="#38BDF8" stroke-width="2.5" fill="#082F49" fill-opacity="0.4" />
    <circle cx="600" cy="820" r="28" stroke="#F59E0B" stroke-width="2" fill="none" />
    <line x1="480" y1="780" x2="520" y2="780" stroke="#38BDF8" stroke-width="2" />
    <line x1="480" y1="820" x2="520" y2="820" stroke="#38BDF8" stroke-width="2" />
    <line x1="480" y1="860" x2="520" y2="860" stroke="#38BDF8" stroke-width="2" />
    <line x1="680" y1="780" x2="720" y2="780" stroke="#38BDF8" stroke-width="2" />
    <line x1="680" y1="820" x2="720" y2="820" stroke="#38BDF8" stroke-width="2" />
    <line x1="680" y1="860" x2="720" y2="860" stroke="#38BDF8" stroke-width="2" />
  </g>

  <!-- Pistas dinámicas inferiores -->
  <path d="M 0 1150 L 380 1150 L 510 1280 L 1200 1280" fill="none" stroke="#06B6D4" stroke-width="2.5" opacity="0.4" />
  <circle cx="380" cy="1150" r="6" fill="#F59E0B" opacity="0.6" />

  <!-- Acentos institucionales -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="#083344" opacity="0.85" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="#06B6D4" opacity="0.9" />
  <polygon points="0,1150 480,1600 0,1600" fill="#0284C7" opacity="0.25" />
  <rect x="0" y="1520" width="1200" height="12" fill="#E8A020" />
  `;
}

/**
 * 5. CIENCIAS DE LA SALUD Y BIENESTAR
 * Paleta: Deep Carmine (#1C050D), Medical Crimson (#9F1239), Vital Green (#059669), Coral (#F43F5E)
 * Geometría: Doble hélice de ADN entrelazada, trazado de pulso cardíaco ECG, red celular bio-orgánica.
 */
function buildSaludBackground(): string {
  return `
  <!-- Gradientes y Patrones de Salud -->
  <defs>
    <linearGradient id="healthBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#140209" />
      <stop offset="38%" stop-color="#2D0615" />
      <stop offset="72%" stop-color="#470B23" />
      <stop offset="100%" stop-color="#16030B" />
    </linearGradient>
    <linearGradient id="healthPulseGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="50%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <pattern id="healthCellGrid" width="55" height="55" patternUnits="userSpaceOnUse">
      <polygon points="27,4 50,18 50,44 27,58 4,44 4,18" fill="none" stroke="#F43F5E" stroke-width="0.3" stroke-opacity="0.06" />
      <circle cx="27" cy="31" r="1.5" fill="#10B981" fill-opacity="0.07" />
    </pattern>
  </defs>

  <!-- Lienzo base -->
  <rect width="1200" height="1600" fill="url(#healthBgGrad)" />
  <rect width="1200" height="1600" fill="url(#healthCellGrid)" />

  <!-- Doble Hélice de ADN en plano medio -->
  <g transform="translate(600, 760)" opacity="0.35">
    <!-- Cadena 1 -->
    <path d="M -360 -120 Q -180 120 0 -120 T 360 -120" fill="none" stroke="#F43F5E" stroke-width="3" />
    <!-- Cadena 2 (en antifase) -->
    <path d="M -360 120 Q -180 -120 0 120 T 360 120" fill="none" stroke="#10B981" stroke-width="3" />

    <!-- Pares de bases nitrogenadas (peldaños) -->
    <line x1="-300" y1="-70" x2="-300" y2="70" stroke="#FBBF24" stroke-width="1.8" />
    <line x1="-220" y1="30" x2="-220" y2="-30" stroke="#F43F5E" stroke-width="1.8" />
    <line x1="-140" y1="100" x2="-140" y2="-100" stroke="#10B981" stroke-width="1.8" />
    <line x1="-60" y1="30" x2="-60" y2="-30" stroke="#FBBF24" stroke-width="1.8" />
    <line x1="20" y1="-70" x2="20" y2="70" stroke="#F43F5E" stroke-width="1.8" />
    <line x1="100" y1="-100" x2="100" y2="100" stroke="#10B981" stroke-width="1.8" />
    <line x1="180" y1="-30" x2="180" y2="30" stroke="#FBBF24" stroke-width="1.8" />
    <line x1="260" y1="70" x2="260" y2="-70" stroke="#F43F5E" stroke-width="1.8" />
  </g>

  <!-- Trazo de Electrocardiograma (ECG) dinámico en la parte inferior -->
  <g opacity="0.45">
    <path d="M 0 1140 L 280 1140 L 320 1110 L 350 1210 L 390 1060 L 430 1180 L 460 1130 L 490 1140 L 750 1140 L 790 1110 L 820 1210 L 860 1060 L 900 1180 L 930 1130 L 960 1140 L 1200 1140" 
          fill="none" stroke="url(#healthPulseGrad)" stroke-width="2.8" />
  </g>

  <!-- Acentos institucionales -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="#881337" opacity="0.85" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="#F43F5E" opacity="0.9" />
  <polygon points="0,1150 480,1600 0,1600" fill="#9F1239" opacity="0.25" />
  <rect x="0" y="1520" width="1200" height="12" fill="#E8A020" />
  `;
}

/**
 * 6. CIENCIAS SOCIALES Y CONCIENCIA HISTÓRICA
 * Paleta: Deep Slate/Charcoal (#0F141C), Terracotta Adobe (#9A3412), Amber (#D97706), Talavera Blue (#1D4ED8)
 * Geometría: Red sociológica de nodos comunitarios interconectados, silueta de pirámide mesoamericana escalonada, ágora cívica.
 */
function buildSocialBackground(): string {
  return `
  <!-- Gradientes y Patrones de Ciencias Sociales -->
  <defs>
    <linearGradient id="socBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117" />
      <stop offset="38%" stop-color="#1C1816" />
      <stop offset="72%" stop-color="#2D1F17" />
      <stop offset="100%" stop-color="#120E0C" />
    </linearGradient>
    <linearGradient id="socTerraGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#EA580C" />
      <stop offset="50%" stop-color="#D97706" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <pattern id="socTileGrid" width="45" height="45" patternUnits="userSpaceOnUse">
      <polygon points="22,0 45,22 22,45 0,22" fill="none" stroke="#D97706" stroke-width="0.3" stroke-opacity="0.07" />
      <circle cx="22" cy="22" r="1.2" fill="#EA580C" fill-opacity="0.08" />
    </pattern>
  </defs>

  <!-- Lienzo base -->
  <rect width="1200" height="1600" fill="url(#socBgGrad)" />
  <rect width="1200" height="1600" fill="url(#socTileGrid)" />

  <!-- Red de Nodos Comunitarios y Matriz Sociológica -->
  <g transform="translate(600, 760)" opacity="0.34">
    <!-- Enlaces entre actores comunitarios -->
    <line x1="-320" y1="-180" x2="-140" y2="-60" stroke="#F59E0B" stroke-width="1.5" />
    <line x1="-140" y1="-60" x2="140" y2="-60" stroke="#EA580C" stroke-width="2.0" />
    <line x1="140" y1="-60" x2="320" y2="-180" stroke="#3B82F6" stroke-width="1.5" />
    <line x1="-140" y1="-60" x2="0" y2="100" stroke="#F59E0B" stroke-width="2.0" />
    <line x1="140" y1="-60" x2="0" y2="100" stroke="#EA580C" stroke-width="2.0" />
    <line x1="0" y1="100" x2="-260" y2="160" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="6 4" />
    <line x1="0" y1="100" x2="260" y2="160" stroke="#3B82F6" stroke-width="1.2" stroke-dasharray="6 4" />

    <!-- Nodos Comunitarios (Poblaciones / Colectivos) -->
    <circle cx="-140" cy="-60" r="14" fill="#EA580C" />
    <circle cx="140" cy="-60" r="14" fill="#3B82F6" />
    <circle cx="0" cy="100" r="18" fill="#F59E0B" />
    <circle cx="-320" cy="-180" r="10" fill="#D97706" />
    <circle cx="320" cy="-180" r="10" fill="#2563EB" />
    <circle cx="-260" cy="160" r="8" fill="#F59E0B" />
    <circle cx="260" cy="160" r="8" fill="#3B82F6" />

    <!-- Motivo geométrico sutil de pirámide mesoamericana escalonada (Homenaje Cholula/Puebla) -->
    <path d="M -220 180 L -180 140 L -140 140 L -110 100 L -70 100 L -40 60 L 40 60 L 70 100 L 110 100 L 140 140 L 180 140 L 220 180 Z" 
          fill="none" stroke="url(#socTerraGrad)" stroke-width="2.0" opacity="0.6" />
  </g>

  <!-- Ondas cívicas inferiores -->
  <path d="M 0 1140 Q 300 1080 600 1140 T 1200 1140" fill="none" stroke="#EA580C" stroke-width="2.5" opacity="0.4" />
  <path d="M 0 1170 Q 300 1210 600 1170 T 1200 1170" fill="none" stroke="#1D4ED8" stroke-width="2.0" opacity="0.3" stroke-dasharray="8 4" />

  <!-- Acentos institucionales -->
  <path d="M 750 0 L 1200 0 L 1200 420 L 980 340 Z" fill="#9A3412" opacity="0.85" />
  <path d="M 740 0 L 760 0 L 1200 350 L 1200 370 Z" fill="#F59E0B" opacity="0.9" />
  <polygon points="0,1150 480,1600 0,1600" fill="#1D4ED8" opacity="0.22" />
  <rect x="0" y="1520" width="1200" height="12" fill="#E8A020" />
  `;
}
