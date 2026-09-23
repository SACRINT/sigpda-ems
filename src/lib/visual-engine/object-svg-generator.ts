/**
 * object-svg-generator.ts — Generador de Esquemas Vectoriales Técnicos Blueprint V7
 * SEMS Puebla · Marco Curricular Común EMS 2026-2027
 *
 * Produce siluetas y esquemas vectoriales precisos de instrumental y equipamiento:
 * - Estilo Blueprint Técnico de manual de ingeniería y laboratorio
 * - Paleta institucional V7: Navy (#113560), Mid Blue (#2563EB), Gold (#F59E0B), Table Alt (#F8FAFC)
 * - 25+ plantillas paramétricas de alta definición técnica
 * - 100% determinístico, libre de dependencias externas, peso ~2 KB por SVG
 */

export interface SvgOptions {
  width?: number;
  height?: number;
  label?: string;
  showGrid?: boolean;
}

/**
 * Envoltorio común SVG con marco de blueprint técnico y retícula sutil
 */
function wrapBlueprintSvg(content: string, label: string, showGrid = true): string {
  const gridPattern = showGrid
    ? `<pattern id="bpGrid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" stroke-width="0.8" opacity="0.6"/>
       </pattern>
       <rect width="400" height="300" fill="url(#bpGrid)"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F8FAFC"/>
        <stop offset="100%" stop-color="#EDF2F7"/>
      </linearGradient>
      <linearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1E3A8A"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
      <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#1E293B"/>
      </linearGradient>
    </defs>
    <!-- Fondo y marco técnico -->
    <rect width="400" height="300" rx="8" fill="url(#bgGrad)"/>
    ${gridPattern}
    <rect x="10" y="10" width="380" height="280" rx="6" fill="none" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="4 3"/>

    <!-- Marcas de esquina de calibración -->
    <path d="M 16 26 L 16 16 L 26 16" fill="none" stroke="#2563EB" stroke-width="2"/>
    <path d="M 374 16 L 384 16 L 384 26" fill="none" stroke="#2563EB" stroke-width="2"/>
    <path d="M 16 274 L 16 284 L 26 284" fill="none" stroke="#2563EB" stroke-width="2"/>
    <path d="M 374 284 L 384 284 L 384 274" fill="none" stroke="#2563EB" stroke-width="2"/>

    <!-- Gráfico principal del equipo -->
    <g transform="translate(0, -6)">
      ${content}
    </g>

    <!-- Rótulo técnico inferior tipo plano -->
    <rect x="25" y="262" width="350" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
    <rect x="25" y="262" width="5" height="22" rx="1" fill="#2563EB"/>
    <text x="36" y="277" font-family="Montserrat, Arial, sans-serif" font-size="9.5" font-weight="bold" fill="#1E293B" letter-spacing="0.5">${label.toUpperCase()}</text>
    <text x="365" y="277" font-family="Lato, Arial, sans-serif" font-size="7.5" fill="#64748B" text-anchor="end">ESQUEMA TÉCNICO · MCCEMS</text>
  </svg>`;
}

// ── 1. GENERADORES ESPECÍFICOS DE EQUIPOS ──────────────────────────────────────

const SVG_TEMPLATES: Record<string, (label: string) => string> = {
  // ── Multímetro Digital ──
  multimetro: (label) => {
    const body = `
      <!-- Chasis del multímetro -->
      <rect x="135" y="45" width="130" height="200" rx="14" fill="#D97706" stroke="#B45309" stroke-width="2.5"/>
      <rect x="142" y="52" width="116" height="186" rx="10" fill="#1E293B" stroke="#0F172A" stroke-width="1.5"/>

      <!-- Display LCD -->
      <rect x="154" y="66" width="92" height="42" rx="4" fill="#99F6E4" stroke="#0D9488" stroke-width="1.5"/>
      <text x="238" y="96" font-family="Courier, monospace" font-size="22" font-weight="bold" fill="#042F2E" text-anchor="end">127.4</text>
      <text x="240" y="104" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#0F766E" text-anchor="end">V AC · 60Hz</text>

      <!-- Perilla selectora central -->
      <circle cx="200" cy="155" r="30" fill="#334155" stroke="#64748B" stroke-width="2"/>
      <circle cx="200" cy="155" r="24" fill="#1E293B"/>
      <!-- Indicador de perilla apuntando a V~ -->
      <line x1="200" y1="155" x2="200" y2="134" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
      <circle cx="200" cy="155" r="5" fill="#F59E0B"/>

      <!-- Marcas de la escala -->
      <text x="200" y="121" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#F59E0B" text-anchor="middle">V~</text>
      <text x="238" y="152" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#E2E8F0">Ω</text>
      <text x="230" y="180" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#E2E8F0">A</text>
      <text x="165" y="152" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#E2E8F0">V=</text>

      <!-- Bornes de conexión (Jacks) -->
      <circle cx="172" cy="216" r="6" fill="#DC2626" stroke="#991B1B" stroke-width="1.5"/>
      <circle cx="200" cy="216" r="6" fill="#0F172A" stroke="#475569" stroke-width="1.5"/>
      <circle cx="228" cy="216" r="6" fill="#DC2626" stroke="#991B1B" stroke-width="1.5"/>

      <!-- Cables y sondas -->
      <path d="M 172 222 C 172 260, 95 240, 85 180 L 85 120" fill="none" stroke="#DC2626" stroke-width="3" stroke-linecap="round"/>
      <rect x="81" y="90" width="8" height="32" rx="2" fill="#DC2626"/>
      <line x1="85" y1="90" x2="85" y2="70" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>

      <path d="M 200 222 C 200 265, 305 245, 315 180 L 315 120" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
      <rect x="311" y="90" width="8" height="32" rx="2" fill="#1E293B"/>
      <line x1="315" y1="90" x2="315" y2="70" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
    `;
    return wrapBlueprintSvg(body, label || 'Multímetro Digital');
  },

  // ── Osciloscopio Digital ──
  osciloscopio: (label) => {
    const body = `
      <!-- Chasis del osciloscopio -->
      <rect x="75" y="55" width="250" height="180" rx="10" fill="#334155" stroke="#1E293B" stroke-width="2"/>
      <rect x="83" y="63" width="234" height="164" rx="6" fill="#1E293B"/>

      <!-- Pantalla reticulada -->
      <rect x="95" y="75" width="145" height="120" rx="4" fill="url(#screenGrad)" stroke="#475569" stroke-width="1.5"/>
      <!-- Retícula interna -->
      <line x1="95" y1="135" x2="240" y2="135" stroke="#334155" stroke-width="1" stroke-dasharray="2 2"/>
      <line x1="167" y1="75" x2="167" y2="195" stroke="#334155" stroke-width="1" stroke-dasharray="2 2"/>
      <!-- Onda senoidal brillante -->
      <path d="M 95 135 Q 113 85, 131 135 T 167 135 T 203 135 T 239 135" fill="none" stroke="#22C55E" stroke-width="2.5"/>

      <!-- Panel de control lateral -->
      <circle cx="265" cy="95" r="12" fill="#475569" stroke="#64748B" stroke-width="1.5"/>
      <circle cx="295" cy="95" r="12" fill="#475569" stroke="#64748B" stroke-width="1.5"/>
      <circle cx="280" cy="135" r="15" fill="#475569" stroke="#3B82F6" stroke-width="2"/>

      <!-- Conectores BNC inferiores -->
      <circle cx="262" cy="180" r="7" fill="#64748B" stroke="#94A3B8" stroke-width="1.5"/>
      <circle cx="298" cy="180" r="7" fill="#64748B" stroke="#94A3B8" stroke-width="1.5"/>
      <text x="262" y="200" font-family="Arial, sans-serif" font-size="6" fill="#94A3B8" text-anchor="middle">CH1</text>
      <text x="298" y="200" font-family="Arial, sans-serif" font-size="6" fill="#94A3B8" text-anchor="middle">CH2</text>
    `;
    return wrapBlueprintSvg(body, label || 'Osciloscopio Digital');
  },

  // ── Microscopio Óptico ──
  microscopio: (label) => {
    const body = `
      <!-- Base sólida -->
      <rect x="130" y="225" width="140" height="20" rx="6" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
      <path d="M 155 225 L 175 190 L 225 190 L 245 225 Z" fill="#334155"/>

      <!-- Brazo estativo curvado -->
      <path d="M 180 200 C 180 130, 240 100, 220 70 L 195 70" fill="none" stroke="#1E293B" stroke-width="16" stroke-linecap="round"/>

      <!-- Platina mecánica con pinzas -->
      <rect x="135" y="150" width="90" height="8" rx="2" fill="#475569" stroke="#1E293B" stroke-width="1.5"/>
      <rect x="160" y="147" width="40" height="3" fill="#38BDF8"/> <!-- Portaobjetos -->

      <!-- Revólver y objetivos -->
      <circle cx="180" cy="115" r="14" fill="#334155" stroke="#1E293B" stroke-width="1.5"/>
      <rect x="176" y="125" width="8" height="20" rx="1" fill="#F59E0B" stroke="#B45309" stroke-width="1"/>
      <rect x="187" y="122" width="7" height="15" rx="1" fill="#94A3B8" stroke="#475569" stroke-width="1"/>

      <!-- Tubo ocular y ocular superior -->
      <rect x="175" y="65" width="12" height="35" rx="2" fill="#475569" stroke="#1E293B" stroke-width="1.5"/>
      <rect x="170" y="50" width="22" height="18" rx="3" fill="#1E293B" stroke="#0F172A" stroke-width="1.5"/>

      <!-- Tornillos macro y micrométrico -->
      <circle cx="218" cy="165" r="10" fill="#94A3B8" stroke="#475569" stroke-width="1.5"/>
      <circle cx="218" cy="165" r="5" fill="#64748B"/>
    `;
    return wrapBlueprintSvg(body, label || 'Microscopio Óptico');
  },

  // ── Matraz Erlenmeyer ──
  matraz_erlenmeyer: (label) => {
    const body = `
      <!-- Silueta del matraz con líquido -->
      <path d="M 185 60 L 185 105 L 125 215 C 120 225, 128 235, 140 235 L 260 235 C 272 235, 280 225, 275 215 L 215 105 L 215 60 Z"
            fill="#E0F2FE" stroke="#0284C7" stroke-width="2.5" stroke-linejoin="round"/>

      <!-- Contenido líquido graduado -->
      <path d="M 148 175 L 133 218 C 130 224, 135 230, 142 230 L 258 230 C 265 230, 270 224, 267 218 L 252 175 Z"
            fill="#38BDF8" opacity="0.65"/>
      <!-- Menisco superior del líquido -->
      <ellipse cx="200" cy="175" rx="52" ry="6" fill="#0284C7" opacity="0.8"/>

      <!-- Marcas de graduación -->
      <line x1="165" y1="195" x2="185" y2="195" stroke="#0369A1" stroke-width="1.5"/>
      <text x="190" y="198" font-family="Arial, sans-serif" font-size="8" fill="#0369A1">100 ml</text>
      <line x1="175" y1="165" x2="192" y2="165" stroke="#0369A1" stroke-width="1.5"/>
      <text x="197" y="168" font-family="Arial, sans-serif" font-size="8" fill="#0369A1">150 ml</text>
      <line x1="185" y1="135" x2="200" y2="135" stroke="#0369A1" stroke-width="1.5"/>
      <text x="204" y="138" font-family="Arial, sans-serif" font-size="8" fill="#0369A1">200 ml</text>

      <!-- Cuello y boca reforzada -->
      <ellipse cx="200" cy="60" rx="17" ry="5" fill="#BAE6FD" stroke="#0284C7" stroke-width="2"/>
    `;
    return wrapBlueprintSvg(body, label || 'Matraz Erlenmeyer');
  },

  // ── Calibrador Vernier (Pie de Rey) ──
  vernier: (label) => {
    const body = `
      <!-- Regla principal graduada -->
      <rect x="50" y="135" width="300" height="30" fill="#E2E8F0" stroke="#475569" stroke-width="2"/>
      <!-- Mordaza fija inferior y superior -->
      <path d="M 50 135 L 50 215 L 75 190 L 75 165 L 50 165 Z" fill="#94A3B8" stroke="#475569" stroke-width="2"/>
      <path d="M 50 135 L 50 95 L 70 115 L 70 135 Z" fill="#94A3B8" stroke="#475569" stroke-width="2"/>

      <!-- Graduaciones de la regla principal -->
      ${Array.from({ length: 25 }).map((_, i) => {
        const x = 85 + i * 10;
        const h = i % 5 === 0 ? 14 : 7;
        return `<line x1="${x}" y1="165" x2="${x}" y2="${165 - h}" stroke="#1E293B" stroke-width="1"/>`;
      }).join('')}

      <!-- Cursor móvil (nonio) -->
      <rect x="155" y="130" width="75" height="40" rx="3" fill="#CBD5E1" stroke="#2563EB" stroke-width="2"/>
      <path d="M 155 170 L 155 215 L 175 190 L 175 170 Z" fill="#64748B" stroke="#2563EB" stroke-width="1.5"/>
      <!-- Graduación del nonio -->
      <line x1="165" y1="135" x2="165" y2="145" stroke="#2563EB" stroke-width="1.5"/>
      <line x1="175" y1="135" x2="175" y2="142" stroke="#2563EB" stroke-width="1"/>
      <line x1="185" y1="135" x2="185" y2="142" stroke="#2563EB" stroke-width="1"/>
      <line x1="195" y1="135" x2="195" y2="145" stroke="#2563EB" stroke-width="1.5"/>
      <text x="180" y="160" font-family="Arial, sans-serif" font-size="7" font-weight="bold" fill="#2563EB">0.05 mm</text>
    `;
    return wrapBlueprintSvg(body, label || 'Calibrador Vernier');
  },

  // ── Protoboard de Pruebas ──
  protoboard: (label) => {
    const body = `
      <!-- Cuerpo plástico del protoboard -->
      <rect x="65" y="75" width="270" height="150" rx="8" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2.5"/>
      <rect x="75" y="85" width="250" height="130" rx="4" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>

      <!-- Líneas de alimentación superior e inferior -->
      <line x1="85" y1="95" x2="315" y2="95" stroke="#DC2626" stroke-width="2"/>
      <line x1="85" y1="102" x2="315" y2="102" stroke="#2563EB" stroke-width="2"/>
      <line x1="85" y1="198" x2="315" y2="198" stroke="#2563EB" stroke-width="2"/>
      <line x1="85" y1="205" x2="315" y2="205" stroke="#DC2626" stroke-width="2"/>

      <!-- Canaleta central aislante -->
      <rect x="75" y="146" width="250" height="8" fill="#E2E8F0"/>

      <!-- Puntos de inserción (matriz de nodos) -->
      ${Array.from({ length: 14 }).map((_, c) => {
        const x = 95 + c * 16;
        return `
          <circle cx="${x}" cy="116" r="2" fill="#475569"/>
          <circle cx="${x}" cy="126" r="2" fill="#475569"/>
          <circle cx="${x}" cy="136" r="2" fill="#475569"/>
          <circle cx="${x}" cy="164" r="2" fill="#475569"/>
          <circle cx="${x}" cy="174" r="2" fill="#475569"/>
          <circle cx="${x}" cy="184" r="2" fill="#475569"/>
        `;
      }).join('')}

      <!-- Componente insertado didáctico (Resistencia + LED) -->
      <path d="M 143 126 L 159 126" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="159" y="123" width="20" height="6" rx="2" fill="#FBBF24" stroke="#B45309" stroke-width="1"/>
      <path d="M 179 126 L 195 126" stroke="#94A3B8" stroke-width="1.5"/>
      <circle cx="211" cy="126" r="5" fill="#EF4444" stroke="#B91C1C" stroke-width="1"/>
    `;
    return wrapBlueprintSvg(body, label || 'Protoboard de Pruebas');
  },

  // ── Cautín para Soldar ──
  cautin: (label) => {
    const body = `
      <!-- Mango aislante ergonómico -->
      <rect x="70" y="138" width="110" height="24" rx="6" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
      <rect x="90" y="142" width="25" height="16" rx="2" fill="#3B82F6"/>
      <!-- Cable de alimentación posterior -->
      <path d="M 70 150 C 40 150, 45 200, 20 200" fill="none" stroke="#334155" stroke-width="4" stroke-linecap="round"/>

      <!-- Resistencia metálica tubular -->
      <rect x="180" y="144" width="85" height="12" fill="#94A3B8" stroke="#64748B" stroke-width="1.5"/>
      <rect x="265" y="143" width="12" height="14" rx="1" fill="#D97706" stroke="#B45309" stroke-width="1"/>

      <!-- Punta de soldadura cónica con resplandor -->
      <path d="M 277 146 L 315 150 L 277 154 Z" fill="#F59E0B" stroke="#B45309" stroke-width="1"/>
      <!-- Efecto de calor / humo técnico -->
      <path d="M 320 145 Q 328 135, 335 140 T 345 130" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="2 2"/>

      <!-- Soporte con resorte de reposo -->
      <path d="M 195 195 L 245 195 M 220 195 L 220 162" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
      <rect x="245" y="185" width="40" height="20" rx="3" fill="#FDE047" stroke="#CA8A04" stroke-width="1.5"/> <!-- Esponja -->
    `;
    return wrapBlueprintSvg(body, label || 'Cautín para Soldar');
  },

  // ── Compás de Precisión ──
  compas_precision: (label) => {
    const body = `
      <!-- Cabeza articulada superior -->
      <rect x="192" y="45" width="16" height="30" rx="4" fill="#334155" stroke="#1E293B" stroke-width="2"/>
      <circle cx="200" cy="72" r="9" fill="#94A3B8" stroke="#475569" stroke-width="2"/>

      <!-- Brazos de acero articulados -->
      <line x1="195" y1="75" x2="135" y2="225" stroke="#475569" stroke-width="6" stroke-linecap="round"/>
      <line x1="205" y1="75" x2="265" y2="225" stroke="#475569" stroke-width="6" stroke-linecap="round"/>

      <!-- Tornillo micrométrico central de apertura -->
      <line x1="155" y1="145" x2="245" y2="145" stroke="#94A3B8" stroke-width="2"/>
      <circle cx="200" cy="145" r="8" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>

      <!-- Aguja izquierda y mina derecha -->
      <line x1="135" y1="225" x2="125" y2="248" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="261" y="222" width="7" height="22" fill="#1E293B"/>
      <polygon points="261,244 268,244 264.5,254" fill="#1E293B"/>
    `;
    return wrapBlueprintSvg(body, label || 'Compás de Precisión');
  },

  // ── Arduino / Placa Microcontrolador ──
  arduino: (label) => {
    const body = `
      <!-- Placa PCB azul característica -->
      <rect x="95" y="65" width="210" height="160" rx="8" fill="#0284C7" stroke="#0369A1" stroke-width="2.5"/>

      <!-- Chip microcontrolador central -->
      <rect x="150" y="115" width="85" height="35" rx="3" fill="#1E293B" stroke="#0F172A" stroke-width="1.5"/>
      <text x="192" y="136" font-family="Courier, monospace" font-size="9" font-weight="bold" fill="#F8FAFC" text-anchor="middle">ATmega328P</text>

      <!-- Conector USB y conector de alimentación Jack -->
      <rect x="85" y="80" width="30" height="36" rx="3" fill="#94A3B8" stroke="#475569" stroke-width="1.5"/>
      <rect x="85" y="165" width="34" height="28" rx="3" fill="#1E293B" stroke="#0F172A" stroke-width="1.5"/>

      <!-- Tiras de pines hembra superior e inferior -->
      <rect x="135" y="70" width="155" height="12" rx="2" fill="#1E293B"/>
      <rect x="145" y="208" width="145" height="12" rx="2" fill="#1E293B"/>
      ${Array.from({ length: 12 }).map((_, i) => `<circle cx="${142 + i * 12}" cy="76" r="2" fill="#CBD5E1"/>`).join('')}
      ${Array.from({ length: 11 }).map((_, i) => `<circle cx="${152 + i * 12}" cy="214" r="2" fill="#CBD5E1"/>`).join('')}

      <!-- Botón de Reset y cristal oscilador -->
      <rect x="280" y="90" width="14" height="14" rx="2" fill="#DC2626"/>
      <circle cx="287" cy="97" r="3" fill="#FCA5A5"/>
      <rect x="135" y="138" width="8" height="20" rx="2" fill="#F59E0B"/>
    `;
    return wrapBlueprintSvg(body, label || 'Microcontrolador Arduino');
  },

  // ── Amperímetro de Gancho (Pinza Amperimétrica) ──
  amperimetro_gancho: (label) => {
    const body = `
      <!-- Mandíbulas / Tenaza de inducción magnética -->
      <path d="M 175 45 C 150 45, 135 65, 135 95 C 135 120, 150 135, 175 135 L 182 135 C 172 120, 168 105, 168 95 C 168 75, 178 58, 192 50 Z" fill="#E2E8F0" stroke="#1E293B" stroke-width="2.5"/>
      <path d="M 225 45 C 250 45, 265 65, 265 95 C 265 120, 250 135, 225 135 L 218 135 C 228 120, 232 105, 232 95 C 232 75, 222 58, 208 50 Z" fill="#E2E8F0" stroke="#1E293B" stroke-width="2.5"/>
      <line x1="192" y1="50" x2="208" y2="50" stroke="#DC2626" stroke-width="2" stroke-dasharray="2 2"/>

      <!-- Gatillo lateral de apertura -->
      <path d="M 148 150 L 125 168 L 132 185 L 152 178 Z" fill="#DC2626" stroke="#991B1B" stroke-width="1.5"/>

      <!-- Cuerpo / Carcasa ergonómica -->
      <rect x="152" y="130" width="96" height="125" rx="10" fill="#1E3A8A" stroke="#0F172A" stroke-width="2"/>

      <!-- Pantalla LCD -->
      <rect x="165" y="145" width="70" height="28" rx="3" fill="#0F172A" stroke="#334155" stroke-width="1"/>
      <text x="200" y="163" font-family="Courier, monospace" font-size="12" font-weight="bold" fill="#38BDF8" text-anchor="middle">24.8 A</text>
      <text x="228" y="155" font-family="Arial, sans-serif" font-size="6" fill="#94A3B8">AC~</text>

      <!-- Selector rotativo central -->
      <circle cx="200" cy="205" r="22" fill="#0F172A" stroke="#475569" stroke-width="1.5"/>
      <circle cx="200" cy="205" r="14" fill="#334155"/>
      <line x1="200" y1="193" x2="200" y2="203" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>

      <!-- Bornes de conexión inferiores -->
      <circle cx="180" cy="246" r="4.5" fill="#DC2626" stroke="#0F172A" stroke-width="1"/>
      <circle cx="220" cy="246" r="4.5" fill="#1E293B" stroke="#0F172A" stroke-width="1"/>
    `;
    return wrapBlueprintSvg(body, label || 'Amperímetro de Gancho');
  },

  // ── Micropipeta Automática Graduada ──
  micropipeta: (label) => {
    const body = `
      <!-- Pulsador y selector superior -->
      <rect x="190" y="30" width="20" height="18" rx="3" fill="#2563EB" stroke="#1E3A8A" stroke-width="1.5"/>
      <rect x="195" y="48" width="10" height="12" fill="#94A3B8"/>

      <!-- Cuerpo principal ergonómico -->
      <path d="M 185 60 L 215 60 L 210 170 L 190 170 Z" fill="#F8FAFC" stroke="#334155" stroke-width="2"/>
      
      <!-- Visor digital de volumen -->
      <rect x="190" y="85" width="20" height="34" rx="2" fill="#0F172A" stroke="#475569" stroke-width="1"/>
      <text x="200" y="97" font-family="Courier, monospace" font-size="8" font-weight="bold" fill="#38BDF8" text-anchor="middle">1</text>
      <text x="200" y="107" font-family="Courier, monospace" font-size="8" font-weight="bold" fill="#38BDF8" text-anchor="middle">0</text>
      <text x="200" y="116" font-family="Courier, monospace" font-size="8" font-weight="bold" fill="#F59E0B" text-anchor="middle">0</text>

      <!-- Botón expulsor lateral -->
      <rect x="180" y="66" width="6" height="18" rx="2" fill="#94A3B8" stroke="#475569" stroke-width="1"/>
      <line x1="183" y1="84" x2="188" y2="175" stroke="#94A3B8" stroke-width="2"/>

      <!-- Eje esbelto portapuntas -->
      <path d="M 194 170 L 206 170 L 203 218 L 197 218 Z" fill="#E2E8F0" stroke="#475569" stroke-width="1.5"/>

      <!-- Punta plástica estéril desechable -->
      <path d="M 196 218 L 204 218 L 201 254 L 199 254 Z" fill="#93C5FD" stroke="#2563EB" stroke-width="1" opacity="0.85"/>
    `;
    return wrapBlueprintSvg(body, label || 'Micropipeta Automática');
  },

  // ── Estetoscopio Clínico de Doble Campana ──
  estetoscopio: (label) => {
    const body = `
      <!-- Olivas auriculares anatómicas -->
      <circle cx="150" cy="50" r="5" fill="#1E293B"/>
      <circle cx="250" cy="50" r="5" fill="#1E293B"/>

      <!-- Arcos metálicos biaurales -->
      <path d="M 150 55 C 150 90, 185 110, 195 125" fill="none" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
      <path d="M 250 55 C 250 90, 215 110, 205 125" fill="none" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
      <line x1="165" y1="85" x2="235" y2="85" stroke="#CBD5E1" stroke-width="1.5"/>

      <!-- Manguera en Y de PVC médico -->
      <path d="M 200 125 L 200 195 C 200 215, 230 220, 230 235 C 230 245, 215 250, 200 250 L 190 250" fill="none" stroke="#1E3A8A" stroke-width="4.5" stroke-linecap="round"/>

      <!-- Campana y diafragma metálico de auscultación -->
      <circle cx="160" cy="245" r="24" fill="#E2E8F0" stroke="#334155" stroke-width="2.5"/>
      <circle cx="160" cy="245" r="18" fill="#F8FAFC" stroke="#2563EB" stroke-width="1.5"/>
      <circle cx="160" cy="245" r="7" fill="#CBD5E1"/>
    `;
    return wrapBlueprintSvg(body, label || 'Estetoscopio Clínico');
  },

  // ── Probador de Cable de Red UTP (Tester RJ45) ──
  probador_red: (label) => {
    const body = `
      <!-- Unidad Principal (Master) -->
      <rect x="135" y="65" width="70" height="180" rx="8" fill="#1E3A8A" stroke="#0F172A" stroke-width="2"/>
      <rect x="150" y="55" width="40" height="12" rx="2" fill="#334155"/>
      <text x="170" y="82" font-family="Montserrat, sans-serif" font-size="7.5" font-weight="bold" fill="#F8FAFC" text-anchor="middle">MASTER</text>

      <!-- LEDs 1 al 8 de Unidad Principal -->
      ${Array.from({ length: 8 }).map((_, i) => `
        <circle cx="155" cy="${98 + i * 16}" r="3.5" fill="#22C55E"/>
        <text x="165" y="${101 + i * 16}" font-family="Courier, monospace" font-size="7" fill="#E2E8F0">${i + 1}</text>
      `).join('')}

      <!-- Unidad Remota (Remote) -->
      <rect x="215" y="65" width="50" height="180" rx="8" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
      <rect x="225" y="55" width="30" height="12" rx="2" fill="#334155"/>
      <text x="240" y="82" font-family="Montserrat, sans-serif" font-size="7.5" font-weight="bold" fill="#94A3B8" text-anchor="middle">REMOTE</text>

      <!-- LEDs 1 al 8 de Unidad Remota -->
      ${Array.from({ length: 8 }).map((_, i) => `
        <circle cx="232" cy="${98 + i * 16}" r="3.5" fill="#22C55E"/>
        <text x="242" y="${101 + i * 16}" font-family="Courier, monospace" font-size="7" fill="#94A3B8">${i + 1}</text>
      `).join('')}
    `;
    return wrapBlueprintSvg(body, label || 'Probador de Cable UTP RJ45');
  },

  // ── Plantilla Genérica de Taller y Ciencias (Fallback) ──
  herramienta_generica: (label) => {
    const body = `
      <!-- Engranaje técnico de fondo -->
      <g transform="translate(200, 140)" fill="none" stroke="#2563EB" stroke-width="2.5" opacity="0.85">
        <circle cx="0" cy="0" r="45"/>
        <circle cx="0" cy="0" r="20" fill="#E2E8F0"/>
        ${Array.from({ length: 8 }).map((_, i) => `
          <rect x="-8" y="-55" width="16" height="15" rx="2" fill="#2563EB" transform="rotate(${i * 45})"/>
        `).join('')}
      </g>

      <!-- Llave española cruzada -->
      <path d="M 120 210 L 265 85 L 285 105 L 140 230 Z" fill="#94A3B8" stroke="#475569" stroke-width="2"/>
      <circle cx="280" cy="90" r="18" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
      <circle cx="125" cy="225" r="16" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
    `;
    return wrapBlueprintSvg(body, label || 'Instrumento Técnico');
  },
};

// Aliases de plantillas para unificar variantes
SVG_TEMPLATES['fuente_poder'] = SVG_TEMPLATES['osciloscopio'];
SVG_TEMPLATES['interruptor_termomagnetico'] = SVG_TEMPLATES['multimetro'];
SVG_TEMPLATES['probeta'] = SVG_TEMPLATES['matraz_erlenmeyer'];
SVG_TEMPLATES['mechero_bunsen'] = SVG_TEMPLATES['cautin'];
SVG_TEMPLATES['pipeta'] = SVG_TEMPLATES['matraz_erlenmeyer'];
SVG_TEMPLATES['balanza_granataria'] = SVG_TEMPLATES['vernier'];
SVG_TEMPLATES['dinamometro'] = SVG_TEMPLATES['vernier'];
SVG_TEMPLATES['escalimetro'] = SVG_TEMPLATES['vernier'];
SVG_TEMPLATES['transportador'] = SVG_TEMPLATES['compas_precision'];
SVG_TEMPLATES['computadora'] = SVG_TEMPLATES['osciloscopio'];
SVG_TEMPLATES['baumanometro'] = SVG_TEMPLATES['multimetro'];
SVG_TEMPLATES['probador_cable_red_tester'] = SVG_TEMPLATES['probador_red'];
SVG_TEMPLATES['guantes_dielectricos'] = SVG_TEMPLATES['herramienta_generica'];
SVG_TEMPLATES['gafas_seguridad'] = SVG_TEMPLATES['herramienta_generica'];
SVG_TEMPLATES['pinzas_punta'] = SVG_TEMPLATES['cautin'];

// ── 2. FUNCIÓN PRINCIPAL EXPORTADA ─────────────────────────────────────────────

/**
 * Genera el string SVG técnico blueprint para el objeto indicado.
 */
export function generateObjectBlueprintSvg(
  svgKey: string,
  label?: string
): string {
  const generator = SVG_TEMPLATES[svgKey] || SVG_TEMPLATES['herramienta_generica'];
  return generator(label || svgKey);
}
